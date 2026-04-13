from datetime import datetime
from pydantic import BaseModel


class PhraseCreate(BaseModel):
    client_id: int
    phrase: str
    source: str = "manual"


class PhraseOut(BaseModel):
    id: int
    client_id: int
    phrase: str
    source: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
