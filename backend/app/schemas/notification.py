from datetime import datetime, time

from pydantic import BaseModel


class NotificationConfigCreate(BaseModel):
    client_id: int
    channel: str  # 'whatsapp', 'in_app'
    recipient: str
    mode: str = "immediate"  # 'immediate', 'digest', 'off'
    digest_time: time | None = None
    is_active: bool = True


class NotificationConfigUpdate(BaseModel):
    channel: str | None = None
    recipient: str | None = None
    mode: str | None = None
    digest_time: time | None = None
    is_active: bool | None = None


class NotificationConfigOut(BaseModel):
    id: int
    client_id: int
    channel: str
    recipient: str
    mode: str
    digest_time: time | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
