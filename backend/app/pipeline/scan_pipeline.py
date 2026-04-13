import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.classifiers.intent_classifier import IntentClassifier
from app.config import settings
from app.models.alert_log import AlertLog
from app.models.client import Client
from app.models.notification_config import NotificationConfig
from app.models.client_phrase import ClientPhrase
from app.models.search import Search
from app.models.signal import Signal
from app.notifications.base import AlertPayload
from app.notifications.in_app import InAppNotifier
from app.notifications.whatsapp import WhatsAppNotifier
from app.scoring.relevance_scorer import RelevanceScorer
from app.source_adapters.reddit_public import RedditPublicAdapter

logger = logging.getLogger(__name__)


def _fetch_gsc_queries(client: Client) -> list[str]:
    """Pull top GSC queries for a client if connected. Returns list of query strings."""
    if not client.gsc_tokens or not client.gsc_property:
        return []

    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=client.gsc_tokens.get("token"),
            refresh_token=client.gsc_tokens.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
        )
        service = build("searchconsole", "v1", credentials=creds)

        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=28)

        response = (
            service.searchanalytics()
            .query(
                siteUrl=client.gsc_property,
                body={
                    "startDate": start_date.isoformat(),
                    "endDate": end_date.isoformat(),
                    "dimensions": ["query"],
                    "rowLimit": 50,
                },
            )
            .execute()
        )

        return [row["keys"][0] for row in response.get("rows", [])]
    except Exception:
        logger.exception("Failed to fetch GSC queries for pipeline")
        return []


class ScanPipeline:
    """Orchestrates: scrape → classify → score → store → alert."""

    def __init__(self):
        self.adapter = RedditPublicAdapter()
        self.classifier = IntentClassifier()
        self.scorer = RelevanceScorer()
        self.notifiers = {
            "whatsapp": WhatsAppNotifier(api_key=settings.wasender_api_key),
            "in_app": InAppNotifier(),
        }

    async def run(self, search_id: int, db: AsyncSession, progress_cb=None) -> dict:
        """Run the full scan pipeline for a search."""
        async def log(stage, message, data=None):
            logger.info("[%s] %s", stage, message)
            if progress_cb:
                await progress_cb(stage, message, data)

        # 1. Load search + client
        search = await db.get(Search, search_id)
        if not search:
            raise ValueError(f"Search {search_id} not found")
        if not search.is_active:
            return {"status": "skipped", "reason": "search is paused"}

        client = await db.get(Client, search.client_id)
        if not client:
            raise ValueError(f"Client {search.client_id} not found")

        kw_list = ", ".join(search.keywords[:6])
        sub_list = ", ".join((search.subreddits or ["all of Reddit"])[:8])
        await log("init", f"Starting scan for '{search.name}' — client: {client.name}")
        await log("init", f"Keywords: {kw_list}{'...' if len(search.keywords) > 6 else ''}")
        await log("init", f"Subreddits: {sub_list}{'...' if len(search.subreddits or []) > 8 else ''}")
        await log("init", f"Alert threshold: {search.alert_threshold}/100, Frequency: {search.scan_frequency}")

        # 1b. Pull GSC queries if connected (excluding toggled-off ones)
        gsc_queries = []
        try:
            gsc_queries = _fetch_gsc_queries(client)
            excluded = client.gsc_excluded_queries or []
            if excluded:
                gsc_queries = [q for q in gsc_queries if q not in excluded]
            if gsc_queries:
                await log("gsc", f"Loaded {len(gsc_queries)} GSC queries", {"count": len(gsc_queries)})
        except Exception as e:
            await log("error", f"GSC query fetch failed: {e}")

        # 1c. Load active seed phrases
        phrase_result = await db.execute(
            select(ClientPhrase.phrase).where(
                ClientPhrase.client_id == client.id,
                ClientPhrase.is_active == True,
            )
        )
        seed_phrases = [row[0] for row in phrase_result]
        if seed_phrases:
            await log("phrases", f"Loaded {len(seed_phrases)} seed phrases", {"count": len(seed_phrases)})

        # 2. FETCH — scrape Reddit
        subs = search.subreddits if search.subreddits else ["all"]
        kw_count = len(search.keywords)
        sub_count = len(subs)
        await log("fetch", f"Starting Reddit search: {kw_count} keywords × {sub_count} subreddits", {"subreddits": subs, "keywords": search.keywords})
        try:
            raw_signals = await self.adapter.fetch(
                keywords=search.keywords,
                communities=search.subreddits if search.subreddits else None,
                limit=settings.scan_default_limit,
                log_cb=progress_cb,
            )
            await log("fetch", f"Fetch complete: {len(raw_signals)} total posts", {"count": len(raw_signals)})
        except Exception as e:
            await log("error", f"Reddit fetch failed: {e}")
            raw_signals = []

        # 3. FILTER — negative keywords
        if search.negative_keywords:
            before = len(raw_signals)
            raw_signals = [
                s for s in raw_signals
                if not any(
                    neg.lower() in (s.title + " " + (s.body or "")).lower()
                    for neg in search.negative_keywords
                )
            ]
            filtered = before - len(raw_signals)
            if filtered:
                await log("filter", f"Filtered {filtered} posts by negative keywords", {"removed": filtered, "remaining": len(raw_signals)})

        # 4. DEDUPLICATE
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
        dupes = len(raw_signals) - len(new_signals)
        if dupes:
            await log("dedup", f"Skipped {dupes} duplicate posts", {"duplicates": dupes})
        await log("dedup", f"{len(new_signals)} new signals to classify", {"new": len(new_signals)})

        if not new_signals:
            search.last_scan_at = datetime.utcnow()
            await db.commit()
            return {"status": "complete", "fetched": len(raw_signals), "new": 0, "alerted": 0}

        # 4b. PRE-FILTER — local keyword relevance check (free, no API cost)
        # Only send signals to Claude that have at least some keyword overlap
        all_match_terms = list(set(
            [k.lower() for k in search.keywords]
            + [p.lower() for p in seed_phrases[:10]]
            + [q.lower() for q in gsc_queries[:10]]
        ))

        def _local_relevance(signal) -> int:
            """Count how many match terms appear in the signal text."""
            text = (signal.title + " " + (signal.body or "")).lower()
            return sum(1 for term in all_match_terms if term in text)

        scored_signals = [(s, _local_relevance(s)) for s in new_signals]
        min_hits = settings.prefilter_min_keyword_hits
        qualified = [s for s, hits in scored_signals if hits >= min_hits]
        skipped = len(new_signals) - len(qualified)

        if skipped:
            await log("prefilter", f"Pre-filtered {skipped} low-relevance posts (no keyword matches)", {"skipped": skipped, "qualified": len(qualified)})

        # Cap to avoid runaway API costs
        if len(qualified) > settings.max_classify_per_scan:
            # Sort by local relevance, take the best
            scored_signals.sort(key=lambda x: x[1], reverse=True)
            qualified = [s for s, _ in scored_signals[:settings.max_classify_per_scan]]
            await log("prefilter", f"Capped at {settings.max_classify_per_scan} signals (budget limit)", {"cap": settings.max_classify_per_scan})

        new_signals = qualified

        if not new_signals:
            await log("prefilter", "No signals passed pre-filter, skipping classification")
            search.last_scan_at = datetime.utcnow()
            await db.commit()
            return {"status": "complete", "fetched": len(raw_signals), "new": 0, "classified": 0, "alerted": 0}

        # 5. CLASSIFY — estimate cost before running
        est_tokens = len(new_signals) * 3000  # ~3K tokens per signal (input + output)
        est_cost = est_tokens / 1_000_000 * 1.25  # Haiku pricing ~$0.25 input + $1.25 output per 1M
        await log("classify", f"Classifying {len(new_signals)} signals with {settings.classification_model.split('-')[1].title()} (~{est_tokens:,} tokens, ~${est_cost:.2f})")
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

        # Inject GSC queries into client context so the classifier sees them
        if gsc_queries:
            client_context["gsc_top_queries"] = ", ".join(gsc_queries[:20])

        # Inject seed phrases so the classifier can do semantic matching
        if seed_phrases:
            client_context["seed_phrases"] = seed_phrases

        try:
            classifications = await self.classifier.classify_batched(
                classify_input, client_context
            )
            await log("classify", f"Classification complete for {len(classifications)} signals")
        except Exception as e:
            await log("error", f"Classification failed: {e}")
            classifications = self.classifier._fallback(classify_input)

        # 6. SCORE + STORE
        await log("score", "Scoring and storing signals...")
        alert_payloads: list[AlertPayload] = []
        alert_signals: list[Signal] = []

        for signal_data, classification in zip(new_signals, classifications):
            relevance = self.scorer.score(
                classification=classification,
                search_intent_filters=search.intent_filters or [],
                engagement_score=signal_data.engagement_score,
                post_created_at=signal_data.created_at,
                gsc_queries=gsc_queries,
                signal_title=signal_data.title,
                signal_body=signal_data.body or "",
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
            await db.flush()

            intents_str = ", ".join(classification.get("intents", []))
            gap = " [CONTENT GAP]" if classification.get("thread_gap", False) else ""
            await log("score", f"Score {relevance}/100{gap} — r/{signal_data.community}: {signal_data.title[:60]}",
                       {"score": relevance, "title": signal_data.title[:80], "community": signal_data.community, "intents": intents_str})

            # Collect alerts above threshold — send as batch later
            if relevance >= search.alert_threshold:
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
                alert_payloads.append(payload)
                alert_signals.append(signal)

        # 7. BATCH ALERT
        if alert_payloads:
            await log("alert", f"Sending {len(alert_payloads)} signals to WhatsApp (batched)", {"count": len(alert_payloads)})
            try:
                await self._send_batch_alerts(alert_payloads, alert_signals, client, search, db)
                await log("alert", "WhatsApp alert sent")
            except Exception as e:
                await log("error", f"WhatsApp alert failed: {e}")
        else:
            await log("alert", "No signals above alert threshold", {"threshold": search.alert_threshold})

        # 8. Update last scan time
        search.last_scan_at = datetime.utcnow()
        await db.commit()

        est_cost = len(classifications) * 3000 / 1_000_000 * 1.25
        summary = {
            "status": "complete",
            "fetched": len(raw_signals),
            "prefiltered": len(new_signals),
            "classified": len(classifications),
            "alerted": len(alert_payloads),
            "gsc_queries_used": len(gsc_queries),
            "est_cost": f"${est_cost:.3f}",
            "model": settings.classification_model,
        }
        await log("done", f"Scan complete: {len(raw_signals)} fetched → {len(new_signals)} classified → {len(alert_payloads)} alerted (est. ${est_cost:.3f} API cost)", summary)
        return summary

    async def _send_batch_alerts(
        self,
        payloads: list[AlertPayload],
        signals: list[Signal],
        client: Client,
        search: Search,
        db: AsyncSession,
    ):
        """Send all alerts from a scan as ONE batched message per channel.

        This keeps WhatsApp API usage to 1 request per scan regardless of
        how many signals are above threshold.
        """
        result = await db.execute(
            select(NotificationConfig).where(
                NotificationConfig.client_id == client.id,
                NotificationConfig.is_active == True,
                NotificationConfig.mode == "immediate",
            )
        )
        configs = result.scalars().all()

        # Build list of (channel, recipient) to send to
        targets: list[tuple[str, str]] = []
        if configs:
            for config in configs:
                targets.append((config.channel, config.recipient))
        elif settings.wasender_default_recipient:
            targets.append(("whatsapp", settings.wasender_default_recipient))

        for channel, recipient in targets:
            notifier = self.notifiers.get(channel)
            if not notifier:
                continue

            # Use batch send for WhatsApp, individual for others
            if hasattr(notifier, "send_batch"):
                success = await notifier.send_batch(payloads, recipient)
            else:
                # In-app or other adapters — send individually
                success = True
                for p in payloads:
                    if not await notifier.send(p, recipient):
                        success = False

            # Log one entry per batch per channel
            preview = f"{len(payloads)} signals: {payloads[0].post_title[:120]}"
            log = AlertLog(
                signal_id=signals[0].id,
                channel=channel,
                recipient=recipient,
                message_preview=preview,
                delivery_status="sent" if success else "failed",
            )
            db.add(log)
