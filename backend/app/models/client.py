from datetime import datetime

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255))
    vertical: Mapped[str | None] = mapped_column(String(255))
    products_services: Mapped[str | None] = mapped_column(Text)
    competitors: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(500))
    gsc_property: Mapped[str | None] = mapped_column(String(500))
    gsc_tokens: Mapped[dict | None] = mapped_column(JSONB)
    gsc_excluded_queries: Mapped[list | None] = mapped_column(JSONB)  # queries toggled off
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    searches: Mapped[list["Search"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    signals: Mapped[list["Signal"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    notification_configs: Mapped[list["NotificationConfig"]] = relationship(back_populates="client", cascade="all, delete-orphan")
