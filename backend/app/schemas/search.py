from datetime import datetime

from pydantic import BaseModel


class SearchCreate(BaseModel):
    client_id: int
    name: str
    keywords: list[str]
    negative_keywords: list[str] = []
    subreddits: list[str] = []
    intent_filters: list[str] = []
    alert_threshold: int = 50
    scan_frequency: str = "daily"
    is_active: bool = True


class SearchUpdate(BaseModel):
    name: str | None = None
    keywords: list[str] | None = None
    negative_keywords: list[str] | None = None
    subreddits: list[str] | None = None
    intent_filters: list[str] | None = None
    alert_threshold: int | None = None
    scan_frequency: str | None = None
    is_active: bool | None = None


class SearchOut(BaseModel):
    id: int
    client_id: int
    name: str
    keywords: list[str]
    negative_keywords: list[str]
    subreddits: list[str]
    intent_filters: list[str]
    alert_threshold: int
    scan_frequency: str
    is_active: bool
    last_scan_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
