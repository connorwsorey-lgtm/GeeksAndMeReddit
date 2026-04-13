"""Smart suggestion engine for search configuration.

Uses Claude to suggest relevant subreddits and keywords based on
client data (vertical, location, products, website, competitors).
When GSC is connected, includes top search queries for better suggestions.
"""

import json
import logging
from datetime import datetime, timedelta

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.client import Client

logger = logging.getLogger(__name__)
router = APIRouter()

SUGGEST_PROMPT = """You are an expert at Reddit community research. Given a business client's profile, suggest the most relevant subreddits and search keywords for monitoring user-generated content signals.

CLIENT PROFILE:
- Business: {name}
- Website: {website}
- Location: {location}
- Vertical/Industry: {vertical}
- Products/Services: {products_services}
- Competitors: {competitors}
{gsc_section}
Return a JSON object with these keys:

1. "subreddits" — object with three arrays:
   - "vertical": subreddits related to the client's industry/vertical (e.g. for personal injury law: legaladvice, personalinjury, AskLawyers, Insurance)
   - "location": subreddits for the client's geographic area (e.g. for New Orleans: NewOrleans, Louisiana, AskNOLA). Include city, state, and regional subs.
   - "general": broadly relevant subreddits where their target audience hangs out (e.g. for a lawyer: AskReddit, LifeProTips, personalfinance)

2. "keywords" — object with two arrays:
   - "primary": direct search terms someone looking for this service would use (e.g. "need a personal injury lawyer", "car accident attorney")
   - "long_tail": longer, more specific phrases that indicate high purchase intent or need (e.g. "how to file injury claim new orleans", "best lawyer for car accident louisiana")

3. "negative_keywords" — array of terms to exclude (common false positives for this vertical)

4. "search_name_suggestion" — a short, descriptive name for this search configuration

Rules:
- Only suggest subreddits that actually exist on Reddit
- For location subs, use the actual subreddit names (e.g. "NewOrleans" not "New Orleans")
- Aim for 5-10 subreddits per category, 5-8 keywords per category
- Keywords should reflect how real people talk on Reddit, not marketing speak
- If GSC data is provided, use the top queries to inform keyword suggestions — they show what people already search to find this business
- Respond with ONLY the JSON object. No markdown, no explanation."""


def _get_gsc_queries(client: Client) -> list[dict] | None:
    """Try to pull GSC top queries if connected. Returns None if unavailable."""
    if not client.gsc_tokens or not client.gsc_property:
        return None

    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=client.gsc_tokens.get("token"),
            refresh_token=client.gsc_tokens.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
        )
        service = build("searchconsole", "v1", credentials=creds)

        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=28)

        response = (
            service.searchanalytics()
            .query(
                siteUrl=client.gsc_property,
                body={
                    "startDate": start_date.isoformat(),
                    "endDate": end_date.isoformat(),
                    "dimensions": ["query"],
                    "rowLimit": 30,
                },
            )
            .execute()
        )

        return [
            {
                "query": row["keys"][0],
                "clicks": row.get("clicks", 0),
                "impressions": row.get("impressions", 0),
            }
            for row in response.get("rows", [])
        ]
    except Exception:
        logger.exception("Failed to fetch GSC data for suggestions")
        return None


@router.post("/suggest")
async def suggest_search_config(
    client_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Generate keyword and subreddit suggestions for a client."""
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if not settings.anthropic_api_key:
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY not configured")

    # Try to pull GSC data
    gsc_queries = _get_gsc_queries(client)
    gsc_section = ""
    if gsc_queries:
        top_terms = [f"  - \"{q['query']}\" ({q['clicks']} clicks, {q['impressions']} impressions)" for q in gsc_queries[:20]]
        gsc_section = "\nGOOGLE SEARCH CONSOLE — Top queries people use to find this business:\n" + "\n".join(top_terms) + "\n\n"

    prompt = SUGGEST_PROMPT.format(
        name=client.name,
        website=client.website or "not provided",
        location=client.location or "not specified",
        vertical=client.vertical or "not specified",
        products_services=client.products_services or "not specified",
        competitors=client.competitors or "not specified",
        gsc_section=gsc_section,
    )

    try:
        api = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await api.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        logger.info("Suggestion raw response length: %d", len(raw))

        # Strip markdown code fences if Claude wrapped the JSON
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        if not raw:
            logger.error("Empty response from Claude API")
            raise HTTPException(status_code=502, detail="Empty response from AI")

        suggestions = json.loads(raw)
        suggestions["gsc_connected"] = gsc_queries is not None
        return suggestions

    except json.JSONDecodeError as e:
        logger.error("Failed to parse suggestion JSON: %s\nRaw: %s", e, raw[:500])
        raise HTTPException(status_code=502, detail="Failed to parse AI suggestions")
    except anthropic.APIError as e:
        logger.error("Claude API error: %s", e)
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
