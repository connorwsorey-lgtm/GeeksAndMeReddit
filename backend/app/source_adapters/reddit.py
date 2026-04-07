from datetime import datetime, timezone

import asyncpraw

from app.config import settings
from app.source_adapters.base import ScrapedSignal, SourceAdapter

MAX_COMMENTS = 15


def _reddit_instance() -> asyncpraw.Reddit:
    return asyncpraw.Reddit(
        client_id=settings.reddit_client_id,
        client_secret=settings.reddit_client_secret,
        username=settings.reddit_username,
        password=settings.reddit_password,
        user_agent=settings.reddit_user_agent,
    )


class RedditAdapter(SourceAdapter):
    """Reddit scraping via asyncpraw (OAuth2).

    Searches by keywords, optionally scoped to subreddits.
    Collects post + top comments for thread gap detection.
    """

    async def fetch(
        self,
        keywords: list[str],
        communities: list[str] | None = None,
        limit: int = 25,
    ) -> list[ScrapedSignal]:
        query = " OR ".join(keywords)
        signals: list[ScrapedSignal] = []

        reddit = _reddit_instance()
        try:
            if communities:
                # Search within specific subreddits
                for sub_name in communities:
                    subreddit = await reddit.subreddit(sub_name)
                    async for submission in subreddit.search(
                        query, sort="new", limit=limit
                    ):
                        signal = await self._submission_to_signal(submission)
                        signals.append(signal)
            else:
                # Search all of Reddit
                subreddit = await reddit.subreddit("all")
                async for submission in subreddit.search(
                    query, sort="new", limit=limit
                ):
                    signal = await self._submission_to_signal(submission)
                    signals.append(signal)
        finally:
            await reddit.close()

        return signals

    async def _submission_to_signal(
        self, submission: asyncpraw.models.Submission
    ) -> ScrapedSignal:
        """Convert a Reddit submission to a ScrapedSignal."""
        # Fetch top-level comments
        submission.comment_sort = "best"
        submission.comment_limit = MAX_COMMENTS
        await submission.load()
        await submission.comments.replace_more(limit=0)

        top_responses = []
        for comment in submission.comments.list()[:MAX_COMMENTS]:
            if hasattr(comment, "body"):
                top_responses.append(
                    {
                        "author": str(comment.author) if comment.author else "[deleted]",
                        "body": comment.body[:1000],
                        "score": comment.score,
                    }
                )

        return ScrapedSignal(
            external_id=submission.id,
            title=submission.title,
            body=submission.selftext or None,
            url=f"https://reddit.com{submission.permalink}",
            community=submission.subreddit.display_name,
            author=str(submission.author) if submission.author else None,
            engagement_score=submission.score + submission.num_comments,
            created_at=datetime.fromtimestamp(
                submission.created_utc, tz=timezone.utc
            ),
            top_responses=top_responses,
        )
