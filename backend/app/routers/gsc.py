"""Google Search Console OAuth + data endpoints.

Flow:
1. GET /api/gsc/auth-url?client_id=X  → returns Google OAuth URL
2. Google redirects to GET /api/gsc/callback?code=...&state=client_id
3. Backend exchanges code for tokens, stores on client
4. GET /api/gsc/properties?client_id=X → list available GSC properties
5. POST /api/gsc/select-property       → save chosen property
6. GET /api/gsc/top-queries?client_id=X → pull top search queries
"""

import json
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.client import Client

logger = logging.getLogger(__name__)
router = APIRouter()

SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]


def _build_flow() -> Flow:
    """Build a Google OAuth flow from env config."""
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = settings.google_redirect_uri
    return flow


def _credentials_from_tokens(tokens: dict) -> Credentials:
    """Rebuild Credentials from stored token dict."""
    return Credentials(
        token=tokens.get("token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )


def _tokens_from_credentials(creds: Credentials) -> dict:
    """Serialize Credentials to storable dict."""
    return {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "expiry": creds.expiry.isoformat() if creds.expiry else None,
    }


@router.get("/auth-url")
async def get_auth_url(client_id: int = Query(...)):
    """Generate Google OAuth authorization URL."""
    if not settings.google_client_id:
        raise HTTPException(status_code=400, detail="GOOGLE_CLIENT_ID not configured")

    flow = _build_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=str(client_id),
    )
    return {"auth_url": auth_url}


@router.get("/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth callback, store tokens on client."""
    client_id = int(state)
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    flow = _build_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials

    client.gsc_tokens = _tokens_from_credentials(creds)
    await db.commit()

    # Redirect back to the client page in the frontend
    return RedirectResponse(url=f"http://localhost:5173/clients/{client_id}?gsc=connected")


@router.get("/properties")
async def list_properties(
    client_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """List GSC properties available to this client's Google account."""
    client = await db.get(Client, client_id)
    if not client or not client.gsc_tokens:
        raise HTTPException(status_code=400, detail="GSC not connected for this client")

    creds = _credentials_from_tokens(client.gsc_tokens)
    service = build("searchconsole", "v1", credentials=creds)

    try:
        result = service.sites().list().execute()
        sites = result.get("siteEntry", [])
        return {
            "properties": [
                {"url": s["siteUrl"], "permission": s.get("permissionLevel", "")}
                for s in sites
            ]
        }
    except Exception as e:
        logger.exception("Failed to list GSC properties")
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/select-property")
async def select_property(
    client_id: int = Query(...),
    property_url: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Save the chosen GSC property for a client."""
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.gsc_property = property_url
    await db.commit()
    return {"status": "ok", "property": property_url}


@router.get("/top-queries")
async def get_top_queries(
    client_id: int = Query(...),
    days: int = Query(28),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
):
    """Pull top search queries from GSC for this client."""
    client = await db.get(Client, client_id)
    if not client or not client.gsc_tokens:
        raise HTTPException(status_code=400, detail="GSC not connected")
    if not client.gsc_property:
        raise HTTPException(status_code=400, detail="No GSC property selected")

    creds = _credentials_from_tokens(client.gsc_tokens)
    service = build("searchconsole", "v1", credentials=creds)

    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days)

    try:
        response = (
            service.searchanalytics()
            .query(
                siteUrl=client.gsc_property,
                body={
                    "startDate": start_date.isoformat(),
                    "endDate": end_date.isoformat(),
                    "dimensions": ["query"],
                    "rowLimit": limit,
                    "dataState": "final",
                },
            )
            .execute()
        )

        rows = response.get("rows", [])
        queries = [
            {
                "query": row["keys"][0],
                "clicks": row.get("clicks", 0),
                "impressions": row.get("impressions", 0),
                "ctr": round(row.get("ctr", 0) * 100, 1),
                "position": round(row.get("position", 0), 1),
            }
            for row in rows
        ]

        return {"property": client.gsc_property, "days": days, "queries": queries}

    except Exception as e:
        logger.exception("Failed to fetch GSC data")
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/top-pages")
async def get_top_pages(
    client_id: int = Query(...),
    days: int = Query(28),
    limit: int = Query(25),
    db: AsyncSession = Depends(get_db),
):
    """Pull top pages from GSC for this client."""
    client = await db.get(Client, client_id)
    if not client or not client.gsc_tokens or not client.gsc_property:
        raise HTTPException(status_code=400, detail="GSC not connected or no property selected")

    creds = _credentials_from_tokens(client.gsc_tokens)
    service = build("searchconsole", "v1", credentials=creds)

    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days)

    try:
        response = (
            service.searchanalytics()
            .query(
                siteUrl=client.gsc_property,
                body={
                    "startDate": start_date.isoformat(),
                    "endDate": end_date.isoformat(),
                    "dimensions": ["page"],
                    "rowLimit": limit,
                    "dataState": "final",
                },
            )
            .execute()
        )

        rows = response.get("rows", [])
        pages = [
            {
                "page": row["keys"][0],
                "clicks": row.get("clicks", 0),
                "impressions": row.get("impressions", 0),
                "ctr": round(row.get("ctr", 0) * 100, 1),
                "position": round(row.get("position", 0), 1),
            }
            for row in rows
        ]

        return {"property": client.gsc_property, "days": days, "pages": pages}

    except Exception as e:
        logger.exception("Failed to fetch GSC pages")
        raise HTTPException(status_code=502, detail=str(e))


@router.delete("/disconnect")
async def disconnect_gsc(
    client_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Remove GSC connection from a client."""
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.gsc_tokens = None
    client.gsc_property = None
    await db.commit()
    return {"status": "disconnected"}
