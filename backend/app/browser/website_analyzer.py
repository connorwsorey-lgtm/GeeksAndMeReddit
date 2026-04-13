"""Website analyzer — scrape a client's site and extract business profile.

Uses Playwright to render the site, grabs key pages, then sends the
content to Claude to extract structured business data.
"""

import json
import logging

import anthropic

from app.browser.browser_pool import new_page
from app.config import settings

logger = logging.getLogger(__name__)

EXTRACT_PROMPT = """Analyze this website content and extract a structured business profile.

WEBSITE URL: {url}

HOMEPAGE CONTENT:
{homepage}

ADDITIONAL PAGES:
{extra_pages}

Return a JSON object with:
- "name": business name
- "vertical": industry/vertical (e.g. "Personal Injury Law", "Digital Marketing Agency", "Plumbing")
- "location": primary location (city, state)
- "service_areas": array of cities/regions they serve
- "products_services": comma-separated list of services or products they offer
- "competitors": any competitors mentioned on the site (empty string if none)
- "description": one sentence describing the business
- "suggested_subreddits": array of 10-15 Reddit subreddits where their target customers would hang out
- "suggested_keywords": array of 10-15 search terms people would use when looking for this type of business

Respond with ONLY the JSON object. No markdown, no explanation."""


async def analyze_website(url: str, progress_cb=None) -> dict:
    """Scrape a website and extract business profile using Claude."""
    if not url.startswith("http"):
        url = f"https://{url}"

    async def _log(msg):
        logger.info(msg)
        if progress_cb:
            await progress_cb("browser", msg)

    page = await new_page()

    try:
        # 1. Homepage
        await _log(f"Loading {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(2000)
        homepage = await page.inner_text("body")
        homepage = homepage[:5000]  # cap for token limits
        await _log(f"Homepage loaded ({len(homepage)} chars)")

        # 2. Find key pages — about, services, contact
        links = await page.eval_on_selector_all("a[href]", """
            els => els.map(el => ({ text: el.innerText.trim().toLowerCase(), href: el.href }))
                .filter(l => l.text && l.href && !l.href.includes('#'))
                .filter(l => ['about', 'service', 'practice', 'what we do', 'contact', 'our team', 'areas'].some(k => l.text.includes(k) || l.href.toLowerCase().includes(k)))
                .slice(0, 5)
        """)

        extra_pages_text = ""
        visited = set()
        for link in links[:4]:
            href = link.get("href", "")
            if href in visited or not href.startswith("http"):
                continue
            visited.add(href)
            try:
                await _log(f"Loading page: {link.get('text', '')} → {href[:60]}...")
                await page.goto(href, wait_until="domcontentloaded", timeout=10000)
                await page.wait_for_timeout(1000)
                text = await page.inner_text("body")
                extra_pages_text += f"\n\n--- {link.get('text', 'page').upper()} ({href}) ---\n{text[:3000]}"
            except Exception:
                await _log(f"  → Failed to load {href[:50]}")

        await _log(f"Scraped {1 + len(visited)} pages, sending to Claude for analysis...")

    finally:
        await page.context.close()

    # 3. Claude extracts structured data
    if not settings.anthropic_api_key:
        return {"error": "ANTHROPIC_API_KEY not configured"}

    prompt = EXTRACT_PROMPT.format(
        url=url,
        homepage=homepage,
        extra_pages=extra_pages_text[:8000] if extra_pages_text else "None loaded",
    )

    try:
        api = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await api.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        result = json.loads(raw)
        # Include raw scraped content for user audit
        result["_scraped_homepage"] = homepage[:3000]
        result["_scraped_pages"] = extra_pages_text[:5000] if extra_pages_text else ""
        result["_pages_visited"] = [url] + list(visited)
        await _log(f"Analysis complete: {result.get('name', 'Unknown')} — {result.get('vertical', 'Unknown')}")
        return result

    except Exception as e:
        logger.exception("Website analysis failed")
        return {"error": str(e)}
