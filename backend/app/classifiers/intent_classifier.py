import json
import logging

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an intent classifier for Reddit posts. You analyze posts to identify content research signals relevant to a client's industry.

CLIENT CONTEXT:
- Name: {client_name}
- Location: {client_location}
- Vertical: {client_vertical}
- Products/Services: {client_products_services}
- Competitors: {client_competitors}

INTENT TAXONOMY:
- recommendation_request: User asking for product/service suggestions
- comparison: User comparing options or asking "X vs Y"
- complaint: User frustrated with a product, service, or situation
- question: User asking how something works or how to do something
- review: User sharing a first-hand experience
- local: User asking about something in a specific location
- purchase_intent: User actively looking to buy or hire

INSTRUCTIONS:
For each signal, return a JSON object with:
- intents: array of matching intent types (can be multiple)
- confidences: object mapping each intent to a confidence score 0-100
- summary: one sentence describing why this signal is relevant to the client's industry
- thread_gap: boolean — true if the client's product/service category is NOT mentioned in existing replies
- keyword_relevance: integer 0-100

Respond with ONLY a JSON array. No markdown, no explanation, no code fences."""

USER_PROMPT = """Classify these {count} signals:

{signals_json}"""


class IntentClassifier:
    """Batched intent classification via Claude API."""

    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def classify(
        self, signals: list[dict], client_context: dict
    ) -> list[dict]:
        """Classify a batch of signals.

        Args:
            signals: list of dicts with keys: id, title, body, community,
                     engagement_score, top_responses
            client_context: dict with keys: name, location, vertical,
                           products_services, competitors

        Returns:
            list of dicts with keys: intents, confidences, summary,
            thread_gap, keyword_relevance
        """
        if not signals:
            return []

        system = SYSTEM_PROMPT.format(
            client_name=client_context.get("name", ""),
            client_location=client_context.get("location", ""),
            client_vertical=client_context.get("vertical", ""),
            client_products_services=client_context.get("products_services", ""),
            client_competitors=client_context.get("competitors", ""),
        )

        # Prepare signals for the prompt — trim bodies to save tokens
        prompt_signals = []
        for s in signals:
            trimmed = {
                "id": s["id"],
                "title": s["title"],
                "body": (s.get("body") or "")[:500],
                "community": s.get("community", ""),
                "engagement_score": s.get("engagement_score", 0),
                "top_responses": [
                    {"author": r.get("author", ""), "body": r.get("body", "")[:300]}
                    for r in (s.get("top_responses") or [])[:10]
                ],
            }
            prompt_signals.append(trimmed)

        user_msg = USER_PROMPT.format(
            count=len(prompt_signals),
            signals_json=json.dumps(prompt_signals, indent=2),
        )

        try:
            response = await self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=system,
                messages=[{"role": "user", "content": user_msg}],
            )

            raw = response.content[0].text.strip()
            results = json.loads(raw)

            if not isinstance(results, list):
                logger.error("Classification response is not a list: %s", raw[:200])
                return self._fallback(signals)

            return results

        except json.JSONDecodeError as e:
            logger.error("Failed to parse classification JSON: %s", e)
            return self._fallback(signals)
        except anthropic.APIError as e:
            logger.error("Claude API error during classification: %s", e)
            return self._fallback(signals)

    async def classify_batched(
        self, signals: list[dict], client_context: dict, batch_size: int = None
    ) -> list[dict]:
        """Classify signals in batches to stay within token limits."""
        batch_size = batch_size or settings.classification_batch_size
        all_results = []

        for i in range(0, len(signals), batch_size):
            batch = signals[i : i + batch_size]
            results = await self.classify(batch, client_context)
            all_results.extend(results)

        return all_results

    def _fallback(self, signals: list[dict]) -> list[dict]:
        """Return empty classifications when the API call fails."""
        return [
            {
                "intents": [],
                "confidences": {},
                "summary": "",
                "thread_gap": False,
                "keyword_relevance": 0,
            }
            for _ in signals
        ]
