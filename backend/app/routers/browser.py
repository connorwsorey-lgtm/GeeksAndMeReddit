"""Browser-powered endpoints — website analysis, subreddit discovery, Claude audit."""

import json
import logging

import anthropic
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.client import Client

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/analyze-website")
async def analyze_website(
    client_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Scrape a client's website and extract/update their business profile."""
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if not client.website:
        raise HTTPException(status_code=400, detail="No website set for this client")

    from app.browser.website_analyzer import analyze_website as _analyze
    result = await _analyze(client.website)

    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])

    # Auto-update client fields if they're empty
    updated = []
    if not client.vertical and result.get("vertical"):
        client.vertical = result["vertical"]
        updated.append("vertical")
    if not client.location and result.get("location"):
        client.location = result["location"]
        updated.append("location")
    if not client.products_services and result.get("products_services"):
        client.products_services = result["products_services"]
        updated.append("products_services")
    if not client.competitors and result.get("competitors"):
        client.competitors = result["competitors"]
        updated.append("competitors")

    if updated:
        await db.commit()

    result["fields_updated"] = updated
    return result


@router.get("/discover-subreddits")
async def discover_subreddits(subreddit: str = Query(...)):
    """Scrape a subreddit's sidebar to find related communities."""
    from app.browser.subreddit_discovery import discover_related_subreddits
    related = await discover_related_subreddits(subreddit)
    return {"subreddit": subreddit, "related": related}


@router.post("/audit-suggestions")
async def audit_suggestions(
    client_id: int = Query(...),
    subreddits: list[str] = Body(default=[]),
    keywords: list[str] = Body(default=[]),
    db: AsyncSession = Depends(get_db),
):
    """Have Claude audit selected subreddits and keywords for relevance to this client."""
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if not settings.anthropic_api_key:
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY not configured")

    prompt = f"""You are auditing suggested Reddit monitoring targets for a business.

CLIENT:
- Name: {client.name}
- Vertical: {client.vertical or 'Unknown'}
- Location: {client.location or 'Unknown'}
- Products/Services: {client.products_services or 'Unknown'}

SUBREDDITS TO AUDIT:
{', '.join(subreddits) if subreddits else 'None selected'}

KEYWORDS TO AUDIT:
{', '.join(keywords) if keywords else 'None selected'}

For each item, respond with a JSON object containing:
1. "subreddits" — array of objects with:
   - "name": subreddit name
   - "verdict": "keep", "maybe", or "drop"
   - "reason": one sentence why
   - "estimated_volume": "high", "medium", "low" (how likely to find relevant posts)

2. "keywords" — array of objects with:
   - "term": the keyword
   - "verdict": "keep", "maybe", or "drop"
   - "reason": one sentence why
   - "suggested_alternative": a better version if the original is weak (null if fine)

3. "missing" — array of strings: subreddits or keywords you think are MISSING that would be valuable

Respond with ONLY the JSON object."""

    try:
        api = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await api.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()
        return json.loads(raw)

    except Exception as e:
        logger.exception("Audit failed")
        raise HTTPException(status_code=502, detail=str(e))
