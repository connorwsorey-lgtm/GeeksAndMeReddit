from app.notifications.base import AlertPayload, NotificationAdapter


class InAppNotifier(NotificationAdapter):
    """In-app notifications — signals appear in the dashboard feed.

    For MVP, signals already show up in the feed by default.
    This adapter exists so the alert engine can log in-app
    notifications the same way it logs WhatsApp alerts.
    """

    async def send(self, payload: AlertPayload, recipient: str) -> bool:
        # In-app signals are already visible in the feed.
        # This just returns True so the alert log records it.
        return True
