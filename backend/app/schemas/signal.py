from datetime import datetime

from pydantic import BaseModel


class SignalOut(BaseModel):
    id: int
    search_id: int
    client_id: int
    source_type: str
    external_id: str
    post_title: str
    post_body: str | None
    post_url: str
    community: str | None
    author: str | None
    engagement_score: int
    post_created_at: datetime | None
    top_responses: list | dict
    intent_labels: list[str]
    intent_confidences: dict
    relevance_score: int
    signal_summary: str | None
    thread_gap_detected: bool
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SignalStatusUpdate(BaseModel):
    status: str  # 'new', 'viewed', 'actioned', 'dismissed'
