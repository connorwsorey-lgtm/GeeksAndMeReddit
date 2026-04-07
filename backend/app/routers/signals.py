from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.signal import Signal
from app.schemas.signal import SignalOut, SignalStatusUpdate

router = APIRouter()

VALID_STATUSES = {"new", "viewed", "actioned", "dismissed"}


@router.get("", response_model=list[SignalOut])
async def list_signals(
    client_id: int | None = Query(None),
    intent: str | None = Query(None),
    min_score: int | None = Query(None),
    max_score: int | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Signal).order_by(Signal.relevance_score.desc(), Signal.created_at.desc())
    if client_id is not None:
        stmt = stmt.where(Signal.client_id == client_id)
    if intent is not None:
        stmt = stmt.where(Signal.intent_labels.any(intent))
    if min_score is not None:
        stmt = stmt.where(Signal.relevance_score >= min_score)
    if max_score is not None:
        stmt = stmt.where(Signal.relevance_score <= max_score)
    if status is not None:
        stmt = stmt.where(Signal.status == status)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/stats")
async def signal_stats(
    client_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    base = select(Signal)
    if client_id is not None:
        base = base.where(Signal.client_id == client_id)

    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    actioned = await db.scalar(
        select(func.count()).select_from(
            base.where(Signal.status == "actioned").subquery()
        )
    )
    avg_score = await db.scalar(
        select(func.avg(Signal.relevance_score)).select_from(base.subquery())
    )

    return {
        "total_signals": total or 0,
        "actioned": actioned or 0,
        "action_rate": round((actioned or 0) / total * 100, 1) if total else 0,
        "average_score": round(avg_score or 0, 1),
    }


@router.get("/{signal_id}", response_model=SignalOut)
async def get_signal(signal_id: int, db: AsyncSession = Depends(get_db)):
    signal = await db.get(Signal, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    return signal


@router.patch("/{signal_id}/status", response_model=SignalOut)
async def update_signal_status(
    signal_id: int,
    data: SignalStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    if data.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {VALID_STATUSES}")
    signal = await db.get(Signal, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    signal.status = data.status
    await db.commit()
    await db.refresh(signal)
    return signal
