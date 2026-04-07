class ScanPipeline:
    """Orchestrates: scrape -> classify -> score -> store -> alert.

    Runs per search. Source-agnostic — gets the right adapter
    based on search.source_type.
    """

    async def run(self, search_id: int):
        raise NotImplementedError("Scan pipeline not yet implemented — Step 6")
