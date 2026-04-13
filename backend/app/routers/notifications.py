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


@router.get("/whatsapp-groups")
async def list_whatsapp_groups():
    """Fetch all WhatsApp groups from WaSender so user can pick a group JID."""
    import httpx
    from app.config import settings

    if not settings.wasender_api_key:
        raise HTTPException(status_code=400, detail="WASENDER_API_KEY not set")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://wasenderapi.com/api/groups",
            headers={"Authorization": f"Bearer {settings.wasender_api_key}"},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"WaSender error: {resp.status_code}")

        data = resp.json()
        # WaSender returns groups with id (JID) and subject (name)
        groups = data if isinstance(data, list) else data.get("groups", data.get("data", []))
        return {
            "groups": [
                {
                    "jid": g.get("id") or g.get("jid") or g.get("groupId", ""),
                    "name": g.get("subject") or g.get("name") or g.get("groupName", "Unknown"),
                    "participants": g.get("size") or g.get("participants", 0),
                }
                for g in groups
            ]
        }


@router.post("/test")
async def test_notification():
    from app.config import settings
    from app.notifications.base import AlertPayload
    from app.notifications.whatsapp import WhatsAppNotifier

    if not settings.wasender_api_key or not settings.wasender_default_recipient:
        raise HTTPException(
            status_code=400,
            detail="WASENDER_API_KEY and WASENDER_DEFAULT_RECIPIENT must be set in .env",
        )

    payload = AlertPayload(
        signal_id=0,
        post_title="Test Alert — UGC Signal Scraper is connected",
        post_url="https://reddit.com",
        community="test",
        intent_labels=["recommendation_request"],
        relevance_score=85,
        signal_summary="This is a test notification to verify your WhatsApp connection is working.",
        client_name="Test Client",
        search_name="Test Search",
        thread_gap_detected=False,
    )

    notifier = WhatsAppNotifier(api_key=settings.wasender_api_key)
    success = await notifier.send(payload, settings.wasender_default_recipient)
    if not success:
        raise HTTPException(status_code=502, detail="WhatsApp delivery failed")
    return {"status": "sent", "recipient": settings.wasender_default_recipient}
