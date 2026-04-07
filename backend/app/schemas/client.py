from datetime import datetime

from pydantic import BaseModel


class ClientCreate(BaseModel):
    name: str
    location: str | None = None
    vertical: str | None = None
    products_services: str | None = None
    competitors: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    vertical: str | None = None
    products_services: str | None = None
    competitors: str | None = None


class ClientOut(BaseModel):
    id: int
    name: str
    location: str | None
    vertical: str | None
    products_services: str | None
    competitors: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
