from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import clients, searches, signals, notifications, dashboard

app = FastAPI(title="UGC Signal Scraper", version="0.1.0")

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


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
