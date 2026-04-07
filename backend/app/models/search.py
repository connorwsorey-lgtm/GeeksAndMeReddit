from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Search(Base):
    __tablename__ = "searches"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    keywords: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    negative_keywords: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    subreddits: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    intent_filters: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    alert_threshold: Mapped[int] = mapped_column(Integer, default=50)
    scan_frequency: Mapped[str] = mapped_column(String(50), default="daily")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_scan_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    client: Mapped["Client"] = relationship(back_populates="searches")
    signals: Mapped[list["Signal"]] = relationship(back_populates="search", cascade="all, delete-orphan")
