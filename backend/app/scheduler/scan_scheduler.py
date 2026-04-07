class ScanScheduler:
    """APScheduler-based scan scheduling.

    Checks for active searches where last_scan_at + scan_frequency <= now
    and triggers the scan pipeline for each.
    """

    async def start(self):
        raise NotImplementedError("Scan scheduler not yet implemented — Step 10")

    async def stop(self):
        raise NotImplementedError("Scan scheduler not yet implemented — Step 10")
