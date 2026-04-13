import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import clients, searches, signals, notifications, dashboard, suggestions, gsc, phrases, browser
from app.scheduler.scan_scheduler import ScanScheduler

logging.basicConfig(level=logging.INFO)
scheduler = ScanScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.stop()
    from app.browser.browser_pool import shutdown_browser
    await shutdown_browser()


app = FastAPI(title="UGC Signal Scraper", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients.router, prefix="/api/clients", tags=["clients"])
app.include_router(searches.router, prefix="/api/searches", tags=["searches"])
app.include_router(signals.router, prefix="/api/signals", tags=["signals"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(suggestions.router, prefix="/api/suggestions", tags=["suggestions"])
app.include_router(gsc.router, prefix="/api/gsc", tags=["gsc"])
app.include_router(phrases.router, prefix="/api/phrases", tags=["phrases"])
app.include_router(browser.router, prefix="/api/browser", tags=["browser"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
