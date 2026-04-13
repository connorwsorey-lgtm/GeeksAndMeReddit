"""APScheduler-based scan scheduling.

Runs a check every 60 seconds. Only triggers scans for searches that:
- Are active
- Have been manually scanned at least once (last_scan_at is not null)
- Are past their scan_frequency interval
"""

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.search import Search

logger = logging.getLogger(__name__)

FREQUENCY_INTERVALS = {
    "hourly": timedelta(hours=1),
    "every_6h": timedelta(hours=6),
    "daily": timedelta(days=1),
}

# Global flag to prevent scheduler running during manual scans
_manual_scan_active = False


def set_manual_scan_active(active: bool):
    global _manual_scan_active
    _manual_scan_active = active


async def _run_due_scans():
    """Check for searches that are due and run them."""
    global _manual_scan_active

    if _manual_scan_active:
        logger.debug("Skipping scheduled scan — manual scan in progress")
        return

    from app.pipeline.scan_pipeline import ScanPipeline

    async with async_session() as db:
        result = await db.execute(
            select(Search).where(
                Search.is_active == True,
                Search.last_scan_at.isnot(None),  # must have been scanned manually first
            )
        )
        searches = result.scalars().all()

        now = datetime.now(timezone.utc)
        pipeline = ScanPipeline()

        for search in searches:
            if _manual_scan_active:
                break

            interval = FREQUENCY_INTERVALS.get(
                search.scan_frequency, timedelta(days=1)
            )
            last = search.last_scan_at
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if (now - last) < interval:
                continue

            logger.info("Scheduler triggering scan for search %d: %s", search.id, search.name)
            try:
                summary = await pipeline.run(search.id, db)
                logger.info("Scheduled scan complete for search %d: %s", search.id, summary)
            except Exception:
                logger.exception("Scheduled scan failed for search %d", search.id)


class ScanScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()

    def start(self):
        self.scheduler.add_job(
            _run_due_scans,
            "interval",
            seconds=120,  # check every 2 min, not every 1 min
            id="scan_check",
            replace_existing=True,
            max_instances=1,  # never stack
        )
        self.scheduler.start()
        logger.info("Scan scheduler started (checking every 120s)")

    def stop(self):
        self.scheduler.shutdown(wait=False)
        logger.info("Scan scheduler stopped")
