from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ClientPhrase(Base):
    """Seed phrases for semantic matching.

    These are example posts/sentences that represent what the client
    wants to find on Reddit. Claude uses them during classification
    to recognize semantically similar content.

    source:
      - "manual"    — user typed it in
      - "generated" — AI generated from client profile + keywords
    """

    __tablename__ = "client_phrases"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    phrase: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="manual")
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    client = relationship("Client", backref="phrases")
