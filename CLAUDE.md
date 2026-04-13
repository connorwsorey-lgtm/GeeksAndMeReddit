# UGC Signal Scraper

## What This Is

A Reddit monitoring tool for Fuel Results. Scrapes posts matching client keyword searches, classifies each by intent via Claude API, scores relevance, and sends WhatsApp alerts when high-value signals are detected.

## Stack

- **Backend:** Python 3.12, FastAPI, async SQLAlchemy, asyncpg
- **Database:** PostgreSQL 16
- **Scraping:** Reddit public JSON endpoints via `httpx` (no API key required)
- **AI Classification:** Anthropic Claude API (`claude-sonnet-4-20250514`)
- **WhatsApp Alerts:** WaSenderAPI (unofficial API, QR code auth)
- **Frontend:** React 18, Vite, Tailwind CSS, React Router
- **Scheduling:** APScheduler
- **Containerization:** Docker + docker-compose

## Running Locally

```bash
docker-compose up --build
```

- **Backend:** http://localhost:8000 (FastAPI, auto-reload)
- **Frontend:** http://localhost:5173 (Vite dev server)
- **API docs:** http://localhost:8000/docs
- **Health check:** http://localhost:8000/api/health

## Running Migrations

```bash
docker-compose exec backend alembic upgrade head
```

## Project Structure

```
backend/
  app/
    main.py              — FastAPI app, CORS, router registration
    config.py            — pydantic-settings, reads .env
    database.py          — async SQLAlchemy engine + session
    models/              — SQLAlchemy ORM models (5 tables)
    schemas/             — Pydantic request/response schemas
    routers/             — API endpoints (clients, searches, signals, notifications, dashboard)
    source_adapters/     — Reddit scraping via public JSON endpoints (httpx)
    classifiers/         — Claude API intent classification
    scoring/             — Weighted relevance scoring
    notifications/       — Alert channels (WhatsApp, in-app)
    scheduler/           — APScheduler scan scheduling
    pipeline/            — Scan pipeline: scrape → classify → score → store → alert
  alembic/               — Database migrations
  tests/

frontend/
  src/
    App.jsx              — Router + nav
    pages/               — SignalFeed, SearchManager, ClientManager, ClientView, NotificationSettings
    components/          — SignalCard, SearchForm, IntentBadge, ScoreIndicator, SourceIcon
```

## Key Architecture Decisions

- **Notification adapters:** WhatsApp and in-app implement the same `NotificationAdapter` interface. WhatsApp is the primary channel.
- **No authentication:** Internal tool, no login required.
- **Deduplication:** `UNIQUE(source_type, external_id)` at the DB level. Also checked before sending to Claude API.
- **Reddit scraping:** Uses public `.json` endpoints (no OAuth). Rate-limited to ~10 req/min, so scans take ~1 min for 25 posts. If Reddit approves API access, swap `RedditPublicAdapter` for the asyncpraw-based `RedditAdapter` in `scan_pipeline.py`.
- **Scheduler:** APScheduler checks every 60s for searches due based on their `scan_frequency`. Runs inside the FastAPI lifespan.

## Intent Taxonomy

`recommendation_request`, `comparison`, `complaint`, `question`, `review`, `local`, `purchase_intent`

A single post can have multiple intents.

## Signal Status Workflow

`new` → `viewed` → `actioned` → `dismissed`

Action rate (actioned / total above threshold) is the key performance metric.

## Relevance Scoring Weights

| Factor | Weight |
|--------|--------|
| Intent match | 30% |
| Keyword relevance | 25% |
| Engagement | 20% |
| Recency | 15% |
| Thread gap | 10% |

Thread gap = the client's product/service category is absent from existing replies. This is the most valuable signal for content research.

## Build Sequence

1. ~~Project scaffold + database~~ (done)
2. ~~Client and Search CRUD (API + basic UI)~~ (done)
3. ~~Reddit source adapter (public JSON endpoints)~~ (done)
4. ~~Intent classifier (Claude API)~~ (done)
5. ~~Relevance scorer~~ (done)
6. ~~Scan pipeline (wire it all together)~~ (done)
7. ~~WhatsApp alerts (WaSenderAPI)~~ (done)
8. ~~Signal feed UI~~ (done)
9. ~~Notification settings UI~~ (done)
10. ~~Scheduler + client dashboard~~ (done)

## Environment Variables

See `.env.example`. Required for operation:
- `DATABASE_URL` — PostgreSQL connection string
- `ANTHROPIC_API_KEY` — Claude API for intent classification
- `WASENDER_API_KEY` / `WASENDER_DEFAULT_RECIPIENT` — WhatsApp alerts

Reddit scraping uses public JSON endpoints — no API credentials needed.

## Important Notes

- **WhatsApp is the primary alert channel.** Messages must be scannable in 5 seconds.
- **Thread gap detection is the most valuable signal.** A recommendation request where nobody has mentioned the client's category surfaces a content research insight.
- **WaSenderAPI is unofficial.** Fine for internal use at low volume. If unreliable, swap to Meta Cloud API.
