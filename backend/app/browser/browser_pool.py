"""Shared Playwright browser pool.

Lazily creates a single Chromium instance, reuses it across
all scraping tasks. Handles cleanup on shutdown.
"""

import asyncio
import logging

from playwright.async_api import async_playwright, Browser, Page

logger = logging.getLogger(__name__)

_playwright = None
_browser: Browser | None = None
_lock = asyncio.Lock()


async def get_browser() -> Browser:
    """Get or create the shared browser instance."""
    global _playwright, _browser
    async with _lock:
        if _browser is None or not _browser.is_connected():
            logger.info("Launching Chromium browser...")
            _playwright = await async_playwright().start()
            _browser = await _playwright.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            logger.info("Chromium browser launched")
        return _browser


async def new_page() -> Page:
    """Create a new browser page with sensible defaults."""
    browser = await get_browser()
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 800},
    )
    page = await context.new_page()
    # Block images/fonts/media to speed things up
    await page.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2,mp4,webm}", lambda route: route.abort())
    return page


async def shutdown_browser():
    """Close browser on app shutdown."""
    global _playwright, _browser
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright:
        await _playwright.stop()
        _playwright = None
    logger.info("Browser pool shut down")
