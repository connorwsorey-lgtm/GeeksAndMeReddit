from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client import Client
from app.models.search import Search
from app.models.signal import Signal

router = APIRouter()


@router.get("/overview")
async def dashboard_overview(db: AsyncSession = Depends(get_db)):
    total_clients = await db.scalar(select(func.count(Client.id)))
    total_searches = await db.scalar(select(func.count(Search.id)))
    active_searches = await db.scalar(
        select(func.count(Search.id)).where(Search.is_active == True)
    )
    total_signals = await db.scalar(select(func.count(Signal.id)))
    new_signals = await db.scalar(
        select(func.count(Signal.id)).where(Signal.status == "new")
    )
    avg_score = await db.scalar(select(func.avg(Signal.relevance_score)))

    return {
        "total_clients": total_clients or 0,
        "total_searches": total_searches or 0,
        "active_searches": active_searches or 0,
        "total_signals": total_signals or 0,
        "new_signals": new_signals or 0,
        "average_score": round(avg_score or 0, 1),
    }


@router.get("/client/{client_id}")
async def client_dashboard(client_id: int, db: AsyncSession = Depends(get_db)):
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    total_signals = await db.scalar(
        select(func.count(Signal.id)).where(Signal.client_id == client_id)
    )
    actioned = await db.scalar(
        select(func.count(Signal.id)).where(
            Signal.client_id == client_id, Signal.status == "actioned"
        )
    )
    avg_score = await db.scalar(
        select(func.avg(Signal.relevance_score)).where(Signal.client_id == client_id)
    )

    # Top communities
    community_counts = await db.execute(
        select(Signal.community, func.count(Signal.id).label("count"))
        .where(Signal.client_id == client_id, Signal.community.isnot(None))
        .group_by(Signal.community)
        .order_by(func.count(Signal.id).desc())
        .limit(10)
    )

    return {
        "client": {"id": client.id, "name": client.name, "vertical": client.vertical},
        "total_signals": total_signals or 0,
        "actioned": actioned or 0,
        "action_rate": round((actioned or 0) / total_signals * 100, 1) if total_signals else 0,
        "average_score": round(avg_score or 0, 1),
        "top_communities": [
            {"community": row.community, "count": row.count}
            for row in community_counts
        ],
    }
