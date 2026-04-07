import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.classifiers.intent_classifier import IntentClassifier
from app.config import settings
from app.models.alert_log import AlertLog
from app.models.client import Client
from app.models.notification_config import NotificationConfig
from app.models.search import Search
from app.models.signal import Signal
from app.notifications.base import AlertPayload
from app.notifications.in_app import InAppNotifier
from app.notifications.whatsapp import WhatsAppNotifier
from app.scoring.relevance_scorer import RelevanceScorer
from app.source_adapters.reddit import RedditAdapter

logger = logging.getLogger(__name__)


class ScanPipeline:
    """Orchestrates: scrape → classify → score → store → alert."""

    def __init__(self):
        self.adapter = RedditAdapter()
        self.classifier = IntentClassifier()
        self.scorer = RelevanceScorer()
        self.notifiers = {
            "whatsapp": WhatsAppNotifier(api_key=settings.wasender_api_key),
            "in_app": InAppNotifier(),
        }

    async def run(self, search_id: int, db: AsyncSession) -> dict:
        """Run the full scan pipeline for a search.

        Returns a summary dict with counts.
        """
        # 1. Load search + client
        search = await db.get(Search, search_id)
        if not search:
            raise ValueError(f"Search {search_id} not found")
        if not search.is_active:
            return {"status": "skipped", "reason": "search is paused"}

        client = await db.get(Client, search.client_id)
        if not client:
            raise ValueError(f"Client {search.client_id} not found")

        # 2. FETCH — scrape Reddit
        logger.info("Scanning search %d: %s", search.id, search.name)
        raw_signals = await self.adapter.fetch(
            keywords=search.keywords,
            communities=search.subreddits if search.subreddits else None,
            limit=settings.scan_default_limit,
        )
        logger.info("Fetched %d raw signals", len(raw_signals))

        # 3. FILTER — negative keywords
        if search.negative_keywords:
            raw_signals = [
                s for s in raw_signals
                if not any(
                    neg.lower() in (s.title + " " + (s.body or "")).lower()
                    for neg in search.negative_keywords
                )
            ]
            logger.info("%d signals after negative keyword filter", len(raw_signals))

        # 4. DEDUPLICATE — skip signals already in DB
        existing_ids = set()
        if raw_signals:
            ext_ids = [s.external_id for s in raw_signals]
            result = await db.execute(
                select(Signal.external_id).where(
                    Signal.source_type == "reddit",
                    Signal.external_id.in_(ext_ids),
                )
            )
            existing_ids = {row[0] for row in result}

        new_signals = [s for s in raw_signals if s.external_id not in existing_ids]
        logger.info("%d new signals after dedup", len(new_signals))

        if not new_signals:
            search.last_scan_at = datetime.now(timezone.utc)
            await db.commit()
            return {"status": "complete", "fetched": len(raw_signals), "new": 0, "alerted": 0}

        # 5. CLASSIFY — batch through Claude API
        classify_input = [
            {
                "id": s.external_id,
                "title": s.title,
                "body": s.body,
                "community": s.community,
                "engagement_score": s.engagement_score,
                "top_responses": s.top_responses,
            }
            for s in new_signals
        ]

        client_context = {
            "name": client.name,
            "location": client.location or "",
            "vertical": client.vertical or "",
            "products_services": client.products_services or "",
            "competitors": client.competitors or "",
        }

        classifications = await self.classifier.classify_batched(
            classify_input, client_context
        )

        # 6. SCORE + STORE
        alerted = 0
        for signal_data, classification in zip(new_signals, classifications):
            relevance = self.scorer.score(
                classification=classification,
                search_intent_filters=search.intent_filters or [],
                engagement_score=signal_data.engagement_score,
                post_created_at=signal_data.created_at,
            )

            signal = Signal(
                search_id=search.id,
                client_id=client.id,
                source_type="reddit",
                external_id=signal_data.external_id,
                post_title=signal_data.title,
                post_body=signal_data.body,
                post_url=signal_data.url,
                community=signal_data.community,
                author=signal_data.author,
                engagement_score=signal_data.engagement_score,
                post_created_at=signal_data.created_at,
                top_responses=signal_data.top_responses,
                intent_labels=classification.get("intents", []),
                intent_confidences=classification.get("confidences", {}),
                relevance_score=relevance,
                signal_summary=classification.get("summary", ""),
                thread_gap_detected=classification.get("thread_gap", False),
                status="new",
            )
            db.add(signal)
            await db.flush()  # get signal.id for alert logging

            # 7. ALERT — if above threshold
            if relevance >= search.alert_threshold:
                await self._send_alerts(signal, client, search, db)
                alerted += 1

        # 8. Update last scan time
        search.last_scan_at = datetime.now(timezone.utc)
        await db.commit()

        summary = {
            "status": "complete",
            "fetched": len(raw_signals),
            "new": len(new_signals),
            "classified": len(classifications),
            "alerted": alerted,
        }
        logger.info("Scan complete for search %d: %s", search.id, summary)
        return summary

    async def _send_alerts(
        self, signal: Signal, client: Client, search: Search, db: AsyncSession
    ):
        """Send alerts through configured notification channels."""
        payload = AlertPayload(
            signal_id=signal.id,
            post_title=signal.post_title,
            post_url=signal.post_url,
            community=signal.community or "",
            intent_labels=signal.intent_labels or [],
            relevance_score=signal.relevance_score,
            signal_summary=signal.signal_summary or "",
            client_name=client.name,
            search_name=search.name,
            thread_gap_detected=signal.thread_gap_detected,
        )

        # Get notification configs for this client
        result = await db.execute(
            select(NotificationConfig).where(
                NotificationConfig.client_id == client.id,
                NotificationConfig.is_active == True,
                NotificationConfig.mode == "immediate",
            )
        )
        configs = result.scalars().all()

        # If no configs, try default WhatsApp recipient
        if not configs and settings.wasender_default_recipient:
            notifier = self.notifiers.get("whatsapp")
            if notifier:
                success = await notifier.send(payload, settings.wasender_default_recipient)
                log = AlertLog(
                    signal_id=signal.id,
                    channel="whatsapp",
                    recipient=settings.wasender_default_recipient,
                    message_preview=signal.post_title[:200],
                    delivery_status="sent" if success else "failed",
                )
                db.add(log)
            return

        for config in configs:
            notifier = self.notifiers.get(config.channel)
            if not notifier:
                continue

            success = await notifier.send(payload, config.recipient)
            log = AlertLog(
                signal_id=signal.id,
                channel=config.channel,
                recipient=config.recipient,
                message_preview=signal.post_title[:200],
                delivery_status="sent" if success else "failed",
            )
            db.add(log)
