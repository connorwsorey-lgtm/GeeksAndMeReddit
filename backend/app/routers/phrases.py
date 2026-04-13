"""Client phrase management + auto-generation.

Handles:
- CRUD for seed phrases (manual + generated)
- GSC keyword exclusion toggling
- AI phrase generation from client profile + keywords
"""

import json
import logging

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.client import Client
from app.models.client_phrase import ClientPhrase
from app.schemas.phrase import PhraseCreate, PhraseOut

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Phrase CRUD ---

@router.get("/{client_id}", response_model=list[PhraseOut])
async def list_phrases(client_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClientPhrase)
        .where(ClientPhrase.client_id == client_id)
        .order_by(ClientPhrase.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=PhraseOut, status_code=201)
async def create_phrase(data: PhraseCreate, db: AsyncSession = Depends(get_db)):
    phrase = ClientPhrase(**data.model_dump())
    db.add(phrase)
    await db.commit()
    await db.refresh(phrase)
    return phrase


@router.patch("/{phrase_id}/toggle")
async def toggle_phrase(phrase_id: int, db: AsyncSession = Depends(get_db)):
    phrase = await db.get(ClientPhrase, phrase_id)
    if not phrase:
        raise HTTPException(status_code=404, detail="Phrase not found")
    phrase.is_active = not phrase.is_active
    await db.commit()
    return {"id": phrase.id, "is_active": phrase.is_active}


@router.delete("/{phrase_id}", status_code=204)
async def delete_phrase(phrase_id: int, db: AsyncSession = Depends(get_db)):
    phrase = await db.get(ClientPhrase, phrase_id)
    if not phrase:
        raise HTTPException(status_code=404, detail="Phrase not found")
    await db.delete(phrase)
    await db.commit()


# --- GSC keyword exclusion ---

@router.post("/gsc-exclude")
async def toggle_gsc_keyword(
    client_id: int = Query(...),
    query: str = Query(...),
    exclude: bool = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Add or remove a GSC query from the exclusion list."""
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    excluded = client.gsc_excluded_queries or []

    if exclude and query not in excluded:
        excluded.append(query)
    elif not exclude and query in excluded:
        excluded.remove(query)

    client.gsc_excluded_queries = excluded
    await db.commit()
    return {"excluded": excluded}


# --- AI phrase generation ---

GENERATE_PROMPT = """You are an expert at understanding how people talk on Reddit when they need a specific service or product.

CLIENT PROFILE:
- Business: {name}
- Website: {website}
- Location: {location}
- Vertical: {vertical}
- Products/Services: {products_services}
- Competitors: {competitors}

THEIR ACTIVE KEYWORDS:
{keywords}

{gsc_section}

TASK: Generate 15-20 realistic Reddit post titles and opening sentences that a person in need of this client's services would write. These should:

1. Sound like real people on Reddit — casual, emotional, sometimes panicked, sometimes matter-of-fact
2. Cover different scenarios within the client's vertical (e.g. for a PI attorney: car accidents, slip & fall, workplace injury, medical malpractice, dog bites)
3. Include location-specific variations if the client has a location
4. Include phrases about cost concerns, urgency, not knowing what to do
5. Mix question-style posts ("Has anyone...?", "What should I do...?") with story-style posts ("I just got...","So my...")
6. DO NOT use marketing language — use the language of someone who doesn't know the industry terms

Return a JSON array of strings. Each string is one phrase. No markdown, no explanation, just the JSON array."""


@router.post("/generate")
async def generate_phrases(
    client_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Use AI to generate Reddit-style seed phrases from client profile + keywords."""
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if not settings.anthropic_api_key:
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY not configured")

    # Gather keywords from active searches
    from app.models.search import Search
    result = await db.execute(
        select(Search).where(Search.client_id == client_id, Search.is_active == True)
    )
    searches = result.scalars().all()
    all_keywords = []
    for s in searches:
        all_keywords.extend(s.keywords or [])
    keywords_str = ", ".join(set(all_keywords)) if all_keywords else "none configured yet"

    # GSC queries (excluding toggled-off ones)
    gsc_section = ""
    excluded = client.gsc_excluded_queries or []
    if client.gsc_tokens and client.gsc_property:
        try:
            from app.routers.gsc import _credentials_from_tokens
            from googleapiclient.discovery import build
            from datetime import datetime, timedelta

            creds = _credentials_from_tokens(client.gsc_tokens)
            service = build("searchconsole", "v1", credentials=creds)
            end_date = datetime.utcnow().date()
            start_date = end_date - timedelta(days=28)
            resp = service.searchanalytics().query(
                siteUrl=client.gsc_property,
                body={
                    "startDate": start_date.isoformat(),
                    "endDate": end_date.isoformat(),
                    "dimensions": ["query"],
                    "rowLimit": 50,
                },
            ).execute()
            queries = [r["keys"][0] for r in resp.get("rows", []) if r["keys"][0] not in excluded]
            if queries:
                gsc_section = "GSC TOP QUERIES (what real users search):\n" + "\n".join(f"- {q}" for q in queries[:25])
        except Exception:
            logger.exception("Failed to pull GSC for phrase generation")

    prompt = GENERATE_PROMPT.format(
        name=client.name,
        website=client.website or "not provided",
        location=client.location or "not specified",
        vertical=client.vertical or "not specified",
        products_services=client.products_services or "not specified",
        competitors=client.competitors or "not specified",
        keywords=keywords_str,
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

        # Strip markdown code fences
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        phrases = json.loads(raw)

        if not isinstance(phrases, list):
            raise ValueError("Expected a list")

        # Save them all as generated phrases
        created = []
        for p in phrases:
            if not isinstance(p, str) or len(p.strip()) < 10:
                continue
            obj = ClientPhrase(
                client_id=client_id,
                phrase=p.strip(),
                source="generated",
                is_active=True,
            )
            db.add(obj)
            created.append(p.strip())

        await db.commit()
        return {"generated": len(created), "phrases": created}

    except json.JSONDecodeError:
        logger.exception("Failed to parse phrase generation response")
        raise HTTPException(status_code=502, detail="Failed to parse AI response")
    except anthropic.APIError as e:
        logger.error("Claude API error: %s", e)
        raise HTTPException(status_code=502, detail="AI service unavailable")
