from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AlertLog(Base):
    __tablename__ = "alert_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("signals.id", ondelete="CASCADE"))
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    recipient: Mapped[str | None] = mapped_column(String(255))
    message_preview: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    delivery_status: Mapped[str] = mapped_column(String(50), default="sent")  # 'sent', 'delivered', 'failed'

    signal: Mapped["Signal"] = relationship(back_populates="alert_logs")
