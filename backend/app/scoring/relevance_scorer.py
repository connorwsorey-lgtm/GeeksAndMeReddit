class RelevanceScorer:
    """Weighted relevance scoring.

    Factors:
      - Intent match (30%): signal intents match search intent_filters
      - Keyword relevance (25%): how directly the signal matches search terms
      - Engagement (20%): normalized engagement_score
      - Recency (15%): hours since creation (newer = higher)
      - Thread gap (10%): bonus if thread_gap_detected is true
    """

    def score(self, signal: dict, search: dict, classification: dict) -> int:
        raise NotImplementedError("Relevance scorer not yet implemented — Step 5")
