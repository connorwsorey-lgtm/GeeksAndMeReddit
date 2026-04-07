from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class AlertPayload:
    """What gets sent in every alert regardless of channel."""

    signal_id: int
    post_title: str
    post_url: str
    community: str
    intent_labels: list[str]
    relevance_score: int
    signal_summary: str
    client_name: str
    search_name: str
    thread_gap_detected: bool


class NotificationAdapter(ABC):
    @abstractmethod
    async def send(self, payload: AlertPayload, recipient: str) -> bool:
        """Send an alert. Returns True if successful."""
        pass
