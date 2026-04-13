"""Reddit adapter using public JSON endpoints — no API key required.

Hits reddit.com/*.json with a polite user-agent. Rate-limited to
~10 req/min by Reddit. Drop-in replacement for asyncpraw adapter.
"""

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from app.config import settings
from app.source_adapters.base import ScrapedSignal, SourceAdapter

logger = logging.getLogger(__name__)

MAX_COMMENTS = 5
REQUEST_DELAY = 2
BASE_URL = "https://www.reddit.com"
HEADERS = {"User-Agent": settings.reddit_user_agent}


class RedditPublicAdapter(SourceAdapter):
    """Reddit scraping via public JSON endpoints (no OAuth)."""

    async def fetch(
        self,
        keywords: list[str],
        communities: list[str] | None = None,
        limit: int = 25,
        log_cb=None,
        fast_mode: bool = True,
    ) -> list[ScrapedSignal]:
        # Break keywords into batches of 4
        keyword_batches = []
        for i in range(0, len(keywords), 4):
            batch = keywords[i : i + 4]
            keyword_batches.append(" OR ".join(batch))

        signals: list[ScrapedSignal] = []
        seen_ids: set[str] = set()

        async def _log(msg):
            logger.info(msg)
            if log_cb:
                await log_cb("fetch", msg)

        async with httpx.AsyncClient(
            headers=HEADERS, follow_redirects=True, timeout=30
        ) as client:
            if communities:
                total_searches = len(communities) * len(keyword_batches)
                search_num = 0
                for sub_name in communities:
                    for query in keyword_batches:
                        search_num += 1
                        await _log(f"[{search_num}/{total_searches}] r/{sub_name} — {query}")
                        try:
                            posts = await self._search(client, query, subreddit=sub_name, limit=limit, fetch_comments=not fast_mode)
                            new_count = 0
                            for p in posts:
                                if p.external_id not in seen_ids:
                                    seen_ids.add(p.external_id)
                                    signals.append(p)
                                    new_count += 1
                            if posts:
                                await _log(f"  → {len(posts)} posts found, {new_count} new")
                        except Exception as e:
                            await _log(f"  → FAILED: {e}")
                        await asyncio.sleep(REQUEST_DELAY)
            else:
                for i, query in enumerate(keyword_batches):
                    await _log(f"[{i+1}/{len(keyword_batches)}] All of Reddit — {query}")
                    try:
                        posts = await self._search(client, query, limit=limit, fetch_comments=not fast_mode)
                        new_count = 0
                        for p in posts:
                            if p.external_id not in seen_ids:
                                seen_ids.add(p.external_id)
                                signals.append(p)
                                new_count += 1
                        if posts:
                            await _log(f"  → {len(posts)} posts found, {new_count} new")
                    except Exception as e:
                        await _log(f"  → FAILED: {e}")
                    if len(keyword_batches) > 1:
                        await asyncio.sleep(REQUEST_DELAY)

        await _log(f"Fetch complete: {len(signals)} unique posts from {len(communities or ['all'])} subreddits")
        return signals

    async def _search(
        self,
        client: httpx.AsyncClient,
        query: str,
        subreddit: str | None = None,
        limit: int = 25,
        fetch_comments: bool = False,
    ) -> list[ScrapedSignal]:
        """Search Reddit and return ScrapedSignals."""
        if subreddit:
            url = f"{BASE_URL}/r/{subreddit}/search.json"
            params = {"q": query, "sort": "new", "limit": limit, "restrict_sr": "on", "include_over_18": "off"}
        else:
            url = f"{BASE_URL}/search.json"
            params = {"q": query, "sort": "new", "limit": limit, "include_over_18": "off"}

        resp = await client.get(url, params=params)

        if resp.status_code == 429:
            # Fallback to Playwright browser — looks like a real user, no rate limit
            logger.info("429 on JSON → switching to browser for r/%s", subreddit or "all")
            try:
                from app.browser.reddit_browser import browser_search_reddit
                return await browser_search_reddit(query, subreddit=subreddit, limit=limit)
            except Exception as e:
                logger.warning("Browser fallback also failed: %s", e)
                return []

        if resp.status_code == 404:
            logger.warning("Subreddit not found: %s", subreddit)
            return []

        if resp.status_code != 200:
            logger.warning("Reddit search returned %d for r/%s", resp.status_code, subreddit or "all")
            return []

        data = resp.json()
        posts = data.get("data", {}).get("children", [])

        signals: list[ScrapedSignal] = []
        for post in posts:
            p = post.get("data", {})
            if not p.get("id"):
                continue
            # Skip NSFW content
            if p.get("over_18", False):
                continue
            permalink = p.get("permalink", f"/r/{p.get('subreddit', '')}/comments/{p['id']}/")
            signal = ScrapedSignal(
                external_id=p["id"],
                title=p.get("title", ""),
                body=p.get("selftext") or None,
                url=f"https://reddit.com{permalink}",
                community=p.get("subreddit", ""),
                author=p.get("author") if p.get("author") != "[deleted]" else None,
                engagement_score=p.get("score", 0) + p.get("num_comments", 0),
                created_at=datetime.fromtimestamp(p.get("created_utc", 0), tz=timezone.utc),
                top_responses=[],
            )
            signals.append(signal)

        # Fetch comments only in full mode
        if fetch_comments:
            for signal in signals:
                signal.top_responses = await self._fetch_comments(client, signal.external_id)
                await asyncio.sleep(REQUEST_DELAY)

        return signals

    async def _fetch_comments(
        self, client: httpx.AsyncClient, post_id: str
    ) -> list[dict]:
        """Fetch top comments for a post via public JSON."""
        url = f"{BASE_URL}/comments/{post_id}.json"
        params = {"sort": "confidence", "limit": MAX_COMMENTS}

        try:
            resp = await client.get(url, params=params)
            if resp.status_code == 429:
                # Don't retry on rate limit for comments — just skip
                return []
            if resp.status_code != 200:
                return []

            data = resp.json()
            if len(data) < 2:
                return []

            comments_data = data[1].get("data", {}).get("children", [])
            comments = []
            for c in comments_data[:MAX_COMMENTS]:
                if c.get("kind") != "t1":
                    continue
                cd = c["data"]
                author = cd.get("author", "[deleted]")
                body = cd.get("body", "")
                comments.append({
                    "author": author if author != "[deleted]" else "[deleted]",
                    "body": body[:1000],
                    "score": cd.get("score", 0),
                })
            return comments

        except Exception:
            logger.exception("Error fetching comments for post %s", post_id)
            return []
