from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notification_config import NotificationConfig
from app.schemas.notification import NotificationConfigCreate, NotificationConfigOut, NotificationConfigUpdate

router = APIRouter()


@router.get("/config/{client_id}", response_model=list[NotificationConfigOut])
async def get_notification_configs(client_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NotificationConfig).where(NotificationConfig.client_id == client_id)
    )
    return result.scalars().all()


@router.post("/config", response_model=NotificationConfigOut, status_code=201)
async def create_notification_config(
    data: NotificationConfigCreate, db: AsyncSession = Depends(get_db)
):
    config = NotificationConfig(**data.model_dump())
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.put("/config/{config_id}", response_model=NotificationConfigOut)
async def update_notification_config(
    config_id: int, data: NotificationConfigUpdate, db: AsyncSession = Depends(get_db)
):
    config = await db.get(NotificationConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Notification config not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    await db.commit()
    await db.refresh(config)
    return config


@router.delete("/config/{config_id}", status_code=204)
async def delete_notification_config(config_id: int, db: AsyncSession = Depends(get_db)):
    config = await db.get(NotificationConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Notification config not found")
    await db.delete(config)
    await db.commit()


@router.post("/test")
async def test_notification():
    # WhatsApp test alert integration in Step 7
    return {"status": "test_not_yet_implemented"}
