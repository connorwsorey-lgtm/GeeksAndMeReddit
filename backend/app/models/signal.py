from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Signal(Base):
    __tablename__ = "signals"
    __table_args__ = (UniqueConstraint("source_type", "external_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    search_id: Mapped[int] = mapped_column(ForeignKey("searches.id", ondelete="CASCADE"))
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    post_title: Mapped[str] = mapped_column(Text, nullable=False)
    post_body: Mapped[str | None] = mapped_column(Text)
    post_url: Mapped[str] = mapped_column(Text, nullable=False)
    community: Mapped[str | None] = mapped_column(String(255))
    author: Mapped[str | None] = mapped_column(String(255))
    engagement_score: Mapped[int] = mapped_column(Integer, default=0)
    post_created_at: Mapped[datetime | None] = mapped_column(default=None)
    top_responses: Mapped[dict] = mapped_column(JSONB, default=list)
    intent_labels: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    intent_confidences: Mapped[dict] = mapped_column(JSONB, default=dict)
    relevance_score: Mapped[int] = mapped_column(Integer, default=0)
    signal_summary: Mapped[str | None] = mapped_column(Text)
    thread_gap_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(50), default="new")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    search: Mapped["Search"] = relationship(back_populates="signals")
    client: Mapped["Client"] = relationship(back_populates="signals")
    alert_logs: Mapped[list["AlertLog"]] = relationship(back_populates="signal", cascade="all, delete-orphan")
