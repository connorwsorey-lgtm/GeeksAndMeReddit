"""Subreddit sidebar scraper — discover related subs."""

import logging
import re

from app.browser.browser_pool import new_page

logger = logging.getLogger(__name__)


async def discover_related_subreddits(subreddit: str) -> list[str]:
    """Scrape a subreddit's sidebar on old.reddit.com to find related subs."""
    url = f"https://old.reddit.com/r/{subreddit}"
    page = await new_page()
    related: list[str] = []

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=12000)
        await page.wait_for_timeout(1000)

        # Get sidebar HTML
        sidebar = await page.query_selector("div.side")
        if not sidebar:
            return []

        sidebar_html = await sidebar.inner_html()

        # Find all subreddit links in sidebar
        pattern = r'/r/([A-Za-z0-9_]+)'
        matches = re.findall(pattern, sidebar_html)

        # Dedupe, exclude self
        seen = set()
        for m in matches:
            lower = m.lower()
            if lower != subreddit.lower() and lower not in seen and lower not in ("all", "popular", "random"):
                seen.add(lower)
                related.append(m)

        logger.info("Found %d related subs in r/%s sidebar", len(related), subreddit)

    except Exception:
        logger.exception("Failed to scrape sidebar for r/%s", subreddit)
    finally:
        await page.context.close()

    return related
