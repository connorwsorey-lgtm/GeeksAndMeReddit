import httpx

from app.notifications.base import AlertPayload, NotificationAdapter


class WhatsAppNotifier(NotificationAdapter):
    """Send WhatsApp alerts via WaSenderAPI when high-value signals are detected."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://wasenderapi.com/api"

    async def send(self, payload: AlertPayload, recipient: str) -> bool:
        message = self._format_message(payload)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/send-message",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"to": recipient, "text": message},
            )
            return response.status_code == 200

    def _format_message(self, payload: AlertPayload) -> str:
        score_indicator = (
            "\U0001f525"
            if payload.relevance_score >= 80
            else "\u26a1"
            if payload.relevance_score >= 60
            else "\U0001f4cc"
        )
        gap_flag = (
            "\n\U0001f3af *CONTENT GAP DETECTED*"
            if payload.thread_gap_detected
            else ""
        )
        intents = " | ".join(payload.intent_labels)

        return f"""{score_indicator} *{payload.client_name}* — New Signal

\U0001f534 *Source:* Reddit / {payload.community}
\U0001f4ca *Score:* {payload.relevance_score}/100
\U0001f3f7\ufe0f *Intent:* {intents}

*{payload.post_title}*

{payload.signal_summary}{gap_flag}

\U0001f449 {payload.post_url}"""
