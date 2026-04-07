from datetime import datetime, timezone


class RelevanceScorer:
    """Weighted relevance scoring for classified signals.

    Factors:
      - Intent match (30%): signal intents match search intent_filters
      - Keyword relevance (25%): from Claude classification
      - Engagement (20%): normalized engagement_score
      - Recency (15%): hours since creation (newer = higher)
      - Thread gap (10%): bonus if thread_gap_detected is true
    """

    # Engagement score normalization — posts above this are treated as max
    ENGAGEMENT_CAP = 500

    def score(
        self,
        classification: dict,
        search_intent_filters: list[str],
        engagement_score: int,
        post_created_at: datetime | None,
    ) -> int:
        """Calculate relevance score 0-100.

        Args:
            classification: dict from Claude with keys: intents, confidences,
                           keyword_relevance, thread_gap
            search_intent_filters: intent types the search is filtering for
            engagement_score: raw engagement (upvotes + comments)
            post_created_at: when the post was created
        """
        intent_score = self._intent_match(
            classification.get("intents", []),
            classification.get("confidences", {}),
            search_intent_filters,
        )
        keyword_score = min(classification.get("keyword_relevance", 0), 100)
        engagement = self._normalize_engagement(engagement_score)
        recency = self._recency_score(post_created_at)
        gap_bonus = 100 if classification.get("thread_gap", False) else 0

        total = (
            intent_score * 0.30
            + keyword_score * 0.25
            + engagement * 0.20
            + recency * 0.15
            + gap_bonus * 0.10
        )

        return max(0, min(100, round(total)))

    def _intent_match(
        self,
        signal_intents: list[str],
        confidences: dict,
        search_filters: list[str],
    ) -> int:
        """Score 0-100 based on how well signal intents match search filters.

        If no filters are set, any intent scores full marks.
        If filters are set, score is the average confidence of matching intents.
        """
        if not signal_intents:
            return 0

        if not search_filters:
            # No filter = all intents count, average their confidences
            values = [confidences.get(i, 50) for i in signal_intents]
            return round(sum(values) / len(values))

        # Find intents that match the search filters
        matching = [i for i in signal_intents if i in search_filters]
        if not matching:
            return 0

        values = [confidences.get(i, 50) for i in matching]
        return round(sum(values) / len(values))

    def _normalize_engagement(self, raw: int) -> int:
        """Normalize engagement to 0-100 scale."""
        if raw <= 0:
            return 0
        return min(100, round((raw / self.ENGAGEMENT_CAP) * 100))

    def _recency_score(self, created_at: datetime | None) -> int:
        """Score 0-100 based on how recent the post is.

        < 1 hour = 100, 24 hours = 50, 72+ hours = 0.
        """
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

        # Linear decay from 100 at 1h to 0 at 72h
        return max(0, round(100 - (hours / 72) * 100))
