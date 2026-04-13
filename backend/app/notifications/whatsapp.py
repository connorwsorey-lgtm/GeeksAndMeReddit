import httpx

from app.notifications.base import AlertPayload, NotificationAdapter


class WhatsAppNotifier(NotificationAdapter):
    """Send WhatsApp alerts via WaSenderAPI.

    Supports both individual numbers and group chats.
    - Individual: recipient is a phone number (e.g. "15551234567")
    - Group: recipient is a group JID (e.g. "120363045559@g.us")
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://wasenderapi.com/api"

    async def send(self, payload: AlertPayload, recipient: str) -> bool:
        message = self._format_message(payload)
        return await self._send_raw(message, recipient)

    async def send_batch(self, payloads: list[AlertPayload], recipient: str) -> bool:
        """Send multiple alerts as a single batched message. Respects rate limits."""
        if not payloads:
            return True
        if len(payloads) == 1:
            return await self.send(payloads[0], recipient)

        message = self._format_batch(payloads)
        return await self._send_raw(message, recipient)

    async def _send_raw(self, message: str, recipient: str) -> bool:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        body = {"to": recipient, "text": message}

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/send-message",
                headers=headers,
                json=body,
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

    def _format_batch(self, payloads: list[AlertPayload]) -> str:
        """Format multiple alerts into one scannable message."""
        client_name = payloads[0].client_name
        search_name = payloads[0].search_name
        count = len(payloads)

        header = f"\U0001f4e1 *{client_name}* — {count} New Signal{'s' if count > 1 else ''}\n\U0001f50e Search: {search_name}\n"

        items = []
        for p in payloads[:10]:  # cap at 10 to keep message scannable
            score_indicator = (
                "\U0001f525" if p.relevance_score >= 80
                else "\u26a1" if p.relevance_score >= 60
                else "\U0001f4cc"
            )
            gap = " \U0001f3af" if p.thread_gap_detected else ""
            intents = ", ".join(p.intent_labels[:2])
            items.append(
                f"\n{score_indicator} *{p.relevance_score}/100*{gap} — r/{p.community}\n"
                f"*{p.post_title[:80]}*\n"
                f"{p.signal_summary[:120]}\n"
                f"_{intents}_\n"
                f"\U0001f449 {p.post_url}"
            )

        body = "\n".join(items)

        overflow = ""
        if count > 10:
            overflow = f"\n\n_...and {count - 10} more. Check the dashboard._"

        return f"{header}{body}{overflow}"
