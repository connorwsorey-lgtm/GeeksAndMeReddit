import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.search import Search
from app.schemas.search import SearchCreate, SearchOut, SearchUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=list[SearchOut])
async def list_searches(
    client_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Search).order_by(Search.created_at.desc())
    if client_id is not None:
        stmt = stmt.where(Search.client_id == client_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=SearchOut, status_code=201)
async def create_search(data: SearchCreate, db: AsyncSession = Depends(get_db)):
    search = Search(**data.model_dump())
    db.add(search)
    await db.commit()
    await db.refresh(search)
    return search


@router.get("/{search_id}", response_model=SearchOut)
async def get_search(search_id: int, db: AsyncSession = Depends(get_db)):
    search = await db.get(Search, search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")
    return search


@router.put("/{search_id}", response_model=SearchOut)
async def update_search(search_id: int, data: SearchUpdate, db: AsyncSession = Depends(get_db)):
    search = await db.get(Search, search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(search, field, value)
    await db.commit()
    await db.refresh(search)
    return search


@router.delete("/{search_id}", status_code=204)
async def delete_search(search_id: int, db: AsyncSession = Depends(get_db)):
    search = await db.get(Search, search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")
    await db.delete(search)
    await db.commit()


@router.post("/{search_id}/scan")
async def trigger_scan(search_id: int, db: AsyncSession = Depends(get_db)):
    search = await db.get(Search, search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")

    from app.pipeline.scan_pipeline import ScanPipeline
    pipeline = ScanPipeline()
    try:
        result = await pipeline.run(search_id, db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{search_id}/scan-stream")
async def scan_stream(search_id: int, db: AsyncSession = Depends(get_db)):
    """Stream scan progress via Server-Sent Events."""
    search = await db.get(Search, search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")

    log_queue: asyncio.Queue = asyncio.Queue()

    async def progress(stage: str, message: str, data: dict | None = None):
        event = {"stage": stage, "message": message}
        if data:
            event["data"] = data
        await log_queue.put(event)

    async def run_and_stream():
        from app.pipeline.scan_pipeline import ScanPipeline
        from app.database import async_session
        from app.scheduler.scan_scheduler import set_manual_scan_active

        set_manual_scan_active(True)
        async with async_session() as scan_db:
            pipeline = ScanPipeline()
            try:
                result = await pipeline.run(search_id, scan_db, progress_cb=progress)
                await log_queue.put({"stage": "done", "message": "Scan complete", "data": result})
            except Exception as e:
                await log_queue.put({"stage": "error", "message": str(e)})
            finally:
                set_manual_scan_active(False)
                await log_queue.put(None)  # sentinel

    async def event_generator():
        task = asyncio.create_task(run_and_stream())
        try:
            while True:
                event = await log_queue.get()
                if event is None:
                    break
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
