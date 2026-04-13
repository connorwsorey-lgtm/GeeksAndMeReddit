from datetime import datetime, timezone


class RelevanceScorer:
    """Weighted relevance scoring for classified signals.

    Factors:
      - Intent match (20%): signal intents match search intent_filters
      - Keyword relevance (15%): from Claude classification
      - Phrase match (20%): semantic similarity to seed phrases (from Claude)
      - GSC query match (10%): signal matches client's top search queries
      - Engagement (15%): normalized engagement_score
      - Recency (10%): hours since creation (newer = higher)
      - Thread gap (10%): bonus if thread_gap_detected is true
    """

    ENGAGEMENT_CAP = 500

    def score(
        self,
        classification: dict,
        search_intent_filters: list[str],
        engagement_score: int,
        post_created_at: datetime | None,
        gsc_queries: list[str] | None = None,
        signal_title: str = "",
        signal_body: str = "",
    ) -> int:
        """Calculate relevance score 0-100."""
        intent_score = self._intent_match(
            classification.get("intents", []),
            classification.get("confidences", {}),
            search_intent_filters,
        )
        keyword_score = min(classification.get("keyword_relevance", 0), 100)
        phrase_score = min(classification.get("phrase_match", 0), 100)
        engagement = self._normalize_engagement(engagement_score)
        recency = self._recency_score(post_created_at)
        gap_bonus = 100 if classification.get("thread_gap", False) else 0
        gsc_score = self._gsc_match(gsc_queries, signal_title, signal_body)

        total = (
            intent_score * 0.20
            + keyword_score * 0.15
            + phrase_score * 0.20
            + gsc_score * 0.10
            + engagement * 0.15
            + recency * 0.10
            + gap_bonus * 0.10
        )

        return max(0, min(100, round(total)))

    def _intent_match(
        self,
        signal_intents: list[str],
        confidences: dict,
        search_filters: list[str],
    ) -> int:
        if not signal_intents:
            return 0

        if not search_filters:
            values = [confidences.get(i, 50) for i in signal_intents]
            return round(sum(values) / len(values))

        matching = [i for i in signal_intents if i in search_filters]
        if not matching:
            return 0

        values = [confidences.get(i, 50) for i in matching]
        return round(sum(values) / len(values))

    def _normalize_engagement(self, raw: int) -> int:
        if raw <= 0:
            return 0
        return min(100, round((raw / self.ENGAGEMENT_CAP) * 100))

    def _recency_score(self, created_at: datetime | None) -> int:
        if not created_at:
            return 0

        now = datetime.now(timezone.utc)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        hours = (now - created_at).total_seconds() / 3600

        if hours < 1:
            return 100
        if hours >= 72:
            return 0

        return max(0, round(100 - (hours / 72) * 100))

    def _gsc_match(
        self,
        gsc_queries: list[str] | None,
        title: str,
        body: str,
    ) -> int:
        if not gsc_queries:
            return 0

        text_lower = (title + " " + (body or "")).lower()
        title_lower = title.lower()

        best = 0
        for query in gsc_queries:
            q = query.lower()
            if q in title_lower:
                best = max(best, 100)
                break
            elif q in text_lower:
                best = max(best, 60)

        return best
