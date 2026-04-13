"""Reddit scraping via Playwright browser.

Fallback when the public JSON endpoints return 429.
Renders old.reddit.com search results and parses the HTML.
Uses old.reddit.com because it's lighter and more parseable.
"""

import logging
from datetime import datetime, timezone

from app.browser.browser_pool import new_page
from app.source_adapters.base import ScrapedSignal

logger = logging.getLogger(__name__)


async def browser_search_reddit(
    query: str,
    subreddit: str | None = None,
    limit: int = 25,
) -> list[ScrapedSignal]:
    """Search Reddit via browser and return ScrapedSignals."""
    if subreddit:
        url = f"https://old.reddit.com/r/{subreddit}/search?q={query}&restrict_sr=on&sort=new&limit={limit}"
    else:
        url = f"https://old.reddit.com/search?q={query}&sort=new&limit={limit}"

    page = await new_page()
    signals: list[ScrapedSignal] = []

    try:
        logger.info("Browser: navigating to %s", url[:100])
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(1500)

        # Parse search results from old.reddit.com
        posts = await page.query_selector_all("div.search-result-link")

        for post in posts[:limit]:
            try:
                # Title + link
                title_el = await post.query_selector("a.search-title")
                if not title_el:
                    continue
                title = (await title_el.inner_text()).strip()
                href = await title_el.get_attribute("href")
                if not href:
                    continue

                # Make URL absolute
                post_url = href if href.startswith("http") else f"https://old.reddit.com{href}"

                # Extract post ID from URL
                # URLs look like /r/sub/comments/abc123/title/
                parts = href.split("/")
                external_id = ""
                for i, p in enumerate(parts):
                    if p == "comments" and i + 1 < len(parts):
                        external_id = parts[i + 1]
                        break

                if not external_id:
                    continue

                # Subreddit
                sub_el = await post.query_selector("a.search-subreddit-link")
                community = ""
                if sub_el:
                    sub_text = (await sub_el.inner_text()).strip()
                    community = sub_text.replace("r/", "").replace("/r/", "")

                # Author
                author_el = await post.query_selector("a.author")
                author = (await author_el.inner_text()).strip() if author_el else None

                # Snippet/body
                snippet_el = await post.query_selector("span.search-result-body")
                body = (await snippet_el.inner_text()).strip() if snippet_el else None

                # Score
                score_el = await post.query_selector("span.search-score")
                score = 0
                if score_el:
                    score_text = (await score_el.inner_text()).strip()
                    try:
                        score = int(score_text.split()[0].replace(",", ""))
                    except (ValueError, IndexError):
                        pass

                # Comments count
                comments_el = await post.query_selector("a.search-comments")
                num_comments = 0
                if comments_el:
                    c_text = (await comments_el.inner_text()).strip()
                    try:
                        num_comments = int(c_text.split()[0].replace(",", ""))
                    except (ValueError, IndexError):
                        pass

                signals.append(ScrapedSignal(
                    external_id=external_id,
                    title=title,
                    body=body,
                    url=post_url.replace("old.reddit.com", "reddit.com"),
                    community=community,
                    author=author,
                    engagement_score=score + num_comments,
                    created_at=datetime.now(timezone.utc),  # old.reddit doesn't show exact time in search
                    top_responses=[],
                ))
            except Exception:
                logger.debug("Failed to parse a search result, skipping")
                continue

        logger.info("Browser: found %d posts for query '%s' in r/%s", len(signals), query[:40], subreddit or "all")

    except Exception:
        logger.exception("Browser Reddit search failed for r/%s", subreddit or "all")
    finally:
        await page.context.close()

    return signals
