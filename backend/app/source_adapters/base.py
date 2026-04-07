from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ScrapedSignal:
    """Scraped Reddit signal structure."""

    external_id: str
    title: str
    body: str | None
    url: str
    community: str
    author: str | None
    engagement_score: int
    created_at: datetime
    top_responses: list[dict]


class SourceAdapter(ABC):
    @abstractmethod
    async def fetch(
        self,
        keywords: list[str],
        communities: list[str] | None = None,
        limit: int = 25,
    ) -> list[ScrapedSignal]:
        """Fetch signals matching keywords from this source."""
        pass
