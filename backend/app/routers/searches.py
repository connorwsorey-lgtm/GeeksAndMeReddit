from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.search import Search
from app.schemas.search import SearchCreate, SearchOut, SearchUpdate

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
    # Pipeline integration in Step 6
    return {"status": "scan_triggered", "search_id": search_id}
