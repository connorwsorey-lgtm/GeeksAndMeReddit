# Signal Ops — UGC Signal Scraper

A Reddit monitoring tool that scrapes posts matching client keyword searches, classifies each by intent using Claude AI, scores relevance, and sends WhatsApp alerts when high-value signals are detected. Built for Fuel Results.

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, WASENDER_API_KEY, WASENDER_DEFAULT_RECIPIENT

# 2. Run everything
docker-compose up --build

# 3. Run database migrations
docker-compose exec backend alembic upgrade head
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Auto-set by Docker | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for intent classification |
| `WASENDER_API_KEY` | Yes | WaSender API key for WhatsApp alerts |
| `WASENDER_DEFAULT_RECIPIENT` | Yes | Default WhatsApp recipient (phone number or group JID) |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID for Search Console integration |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Optional | Defaults to `http://localhost:8000/api/gsc/callback` |
| `REDDIT_USER_AGENT` | Optional | Custom user agent for Reddit requests |
| `SCAN_DEFAULT_LIMIT` | Optional | Posts per search (default: 25) |
| `CLASSIFICATION_BATCH_SIZE` | Optional | Signals per Claude batch (default: 15) |
| `MAX_CLASSIFY_PER_SCAN` | Optional | Cap on signals sent to Claude per scan (default: 50) |

## How It Works

### The Scan Pipeline

1. **Fetch** — Scrapes Reddit posts via public JSON endpoints (no API key needed). Falls back to Playwright browser rendering if rate-limited.
2. **Filter** — Removes posts matching negative keywords.
3. **Deduplicate** — Skips posts already in the database.
4. **Pre-filter** — Local keyword relevance check (free) before sending to Claude. Posts must match at least one keyword from search terms, seed phrases, or GSC queries.
5. **Classify** — Claude Haiku classifies each post with intent labels, confidence scores, a one-sentence summary, thread gap detection, and keyword/phrase relevance.
6. **Score** — Computes a 0-100 relevance score using weighted factors (see Scoring below).
7. **Store** — Saves signals to the database.
8. **Alert** — Sends batched WhatsApp messages for signals above the alert threshold.

### Relevance Scoring

| Factor | Weight | Description |
|--------|--------|-------------|
| Intent match | 20% | Average confidence of intents matching the search's intent filters |
| Keyword relevance | 15% | How well the post matches search keywords (from Claude) |
| Phrase match | 20% | Semantic similarity to seed phrases (from Claude) |
| GSC match | 10% | Post text matches Google Search Console top queries |
| Engagement | 15% | Normalized score + comment count |
| Recency | 10% | Decays linearly from 100 (< 1 hour) to 0 (> 72 hours) |
| Thread gap | 10% | Bonus when client's service category is absent from replies |

### Intent Taxonomy

Posts are classified into one or more of these intents:

- **recommendation_request** — Asking for product/service suggestions
- **comparison** — "X vs Y" style posts
- **complaint** — Frustrated with a product/service
- **question** — How-to or conceptual questions
- **review** — First-hand experience sharing
- **local** — Location-specific needs
- **purchase_intent** — Actively looking to buy or hire

### Signal Status Workflow

`new` → `viewed` → `actioned` → `dismissed`

Action rate (actioned / total above threshold) is the key performance metric.

---

## Features

### Client Management

Navigate to **Clients** to create and manage clients.

**Fields:**
- Name (required)
- Website
- Location
- Vertical (industry)
- Products/Services
- Competitors

Each client can have multiple searches, notification configs, seed phrases, and an optional Google Search Console connection.

### Website Analysis

From a client's detail page (**Clients → click a client → Website Analysis tab**):

1. Click **Analyze Website** — Playwright scrapes the client's site and Claude extracts structured business data (vertical, location, products, competitors, suggested subreddits and keywords).
2. Empty client fields are auto-populated from the analysis.
3. Review suggested subreddits and keywords with checkboxes.
4. Click **Audit with Claude** to get relevance verdicts on your selections before using them in a search.
5. Copy selections to clipboard for pasting into a search form.

### Google Search Console Integration

From a client's detail page (**GSC tab**):

1. Click **Connect to GSC** — Redirects through Google OAuth.
2. Select a property from the list.
3. View top queries and pages from the last 28 days.
4. Exclude irrelevant queries (they won't be used in scans).
5. Connected GSC data automatically enriches scan classification and scoring.

### Seed Phrases

From a client's detail page (**Seed Phrases tab**):

Seed phrases are example Reddit post titles/openings that represent what you're looking for. They improve semantic matching during classification.

- **Add manually** — Type phrases that represent ideal signal posts.
- **Generate with AI** — Claude creates 15-20 realistic phrases based on the client profile, keywords, and GSC queries.
- **Toggle active/inactive** — Inactive phrases are excluded from scans.

### Search Configuration

Navigate to **Searches** to create and manage search configs.

**Fields:**
- **Client** — Which client this search belongs to
- **Search Name** — Descriptive label
- **Keywords** — Terms to search Reddit for (one per line)
- **Negative Keywords** — Exclude posts containing these terms
- **Subreddits** — Specific subreddits to search (leave empty for all of Reddit)
- **Intent Filters** — Only surface signals matching these intents (leave empty for all)
- **Alert Threshold** — Minimum relevance score (0-100) for WhatsApp alerts
- **Scan Frequency** — How often to auto-scan (hourly, every 6 hours, daily)
- **Active** — Toggle on/off

**AI Suggestions:** Click the **AI Suggest** button when creating a search. Claude analyzes the client profile and GSC data to suggest subreddits (categorized by industry/location/general), primary and long-tail keywords, and negative keywords. Suggestions appear as clickable chips.

### Running Scans

**Manual scan:** Click the **Scan** button next to any search in the Searches page. A real-time log panel appears at the bottom of the screen showing each pipeline stage with color-coded progress.

**Automatic scans:** After the first manual scan, the scheduler picks up the search based on its scan frequency. The scheduler checks every 2 minutes for searches that are due.

**Scan log stages:**
- `init` (gray) — Loading search config
- `gsc` (green) — Fetching GSC queries
- `phrases` (pink) — Loading seed phrases
- `fetch` (teal) — Scraping Reddit
- `filter` (orange) — Applying negative keywords
- `dedup` (cyan) — Checking for duplicates
- `prefilter` (cyan) — Local keyword matching
- `classify` (blue) — Claude AI classification
- `score` (violet) — Computing relevance scores
- `alert` (amber) — Sending notifications
- `done` (green) — Complete with summary
- `error` (red) — Something failed

The scan log persists across page navigation. Click **CLEAR** to dismiss it.

### Signal Feed

Navigate to **Signals** (home page) to view and manage detected signals.

**Filters:**
- Client
- Intent type
- Status (new, viewed, actioned, dismissed)
- Min/max relevance score

**Stats bar** shows total signals, actioned count, action rate %, and average score.

**Each signal card shows:**
- Relevance score (0-100 with color coding)
- Intent badges
- Post title and body snippet
- Subreddit community
- Author and engagement metrics
- Thread gap indicator (when detected)
- Status buttons to mark as viewed/actioned/dismissed
- Direct link to the Reddit post

### Notification Settings

Navigate to **Alerts** to configure where signals get sent.

**Channels:**
- **WhatsApp** — Send to a phone number or WhatsApp group
- **In-App** — (placeholder for future in-app notifications)

**Modes:**
- **Immediate** — Alert as soon as signals are found
- **Daily Digest** — Bundle signals into a daily summary at a set time
- **Off** — Disabled

**WhatsApp message format:**
- Single signals get a detailed card with score, intents, title, summary, and link.
- Multiple signals from one scan are batched into a single message (up to 10 items) to avoid rate limits.
- Score indicators: fire (80+), lightning (60-79), pin (below 60).
- Thread gap detection is highlighted with a "CONTENT GAP DETECTED" label.

Click **Test** to send a test message to the default recipient.

### Client Dashboard

From a client's detail page (**Dashboard tab**):

- Overview stats: total signals, actioned, action rate, average score
- Top communities breakdown
- Recent signals list
- Quick access to all client tabs (Website Analysis, GSC, Seed Phrases, Searches)

---

## API Reference

All endpoints are prefixed with `/api`.

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |

### Clients
| Method | Path | Description |
|--------|------|-------------|
| GET | `/clients` | List all clients |
| POST | `/clients` | Create client |
| GET | `/clients/{id}` | Get client |
| PUT | `/clients/{id}` | Update client |
| DELETE | `/clients/{id}` | Delete client (cascades) |

### Searches
| Method | Path | Description |
|--------|------|-------------|
| GET | `/searches` | List searches (optional `?client_id=`) |
| POST | `/searches` | Create search |
| GET | `/searches/{id}` | Get search |
| PUT | `/searches/{id}` | Update search |
| DELETE | `/searches/{id}` | Delete search |
| POST | `/searches/{id}/scan` | Trigger manual scan |
| GET | `/searches/{id}/scan-stream` | SSE stream of scan progress |

### Signals
| Method | Path | Description |
|--------|------|-------------|
| GET | `/signals` | List signals (filters: `client_id`, `intent`, `status`, `min_score`, `max_score`, `limit`, `offset`) |
| GET | `/signals/stats` | Signal statistics (optional `?client_id=`) |
| GET | `/signals/{id}` | Get signal |
| PATCH | `/signals/{id}/status` | Update signal status |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/overview` | Global dashboard stats |
| GET | `/dashboard/client/{id}` | Client-specific dashboard |

### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications/config/{client_id}` | List notification configs |
| POST | `/notifications/config` | Create notification config |
| PUT | `/notifications/config/{id}` | Update notification config |
| DELETE | `/notifications/config/{id}` | Delete notification config |
| GET | `/notifications/whatsapp-groups` | List available WhatsApp groups |
| POST | `/notifications/test` | Send test notification |

### AI Suggestions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/suggestions/suggest?client_id=` | Generate AI-powered keyword and subreddit suggestions |

### Google Search Console
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gsc/auth-url?client_id=` | Get Google OAuth URL |
| GET | `/gsc/callback` | OAuth callback (internal) |
| GET | `/gsc/properties?client_id=` | List GSC properties |
| POST | `/gsc/select-property?client_id=&property_url=` | Save selected property |
| GET | `/gsc/top-queries?client_id=` | Get top search queries |
| GET | `/gsc/top-pages?client_id=` | Get top pages |
| DELETE | `/gsc/disconnect?client_id=` | Disconnect GSC |

### Seed Phrases
| Method | Path | Description |
|--------|------|-------------|
| GET | `/phrases/{client_id}` | List phrases |
| POST | `/phrases` | Create phrase |
| PATCH | `/phrases/{id}/toggle` | Toggle phrase active/inactive |
| DELETE | `/phrases/{id}` | Delete phrase |
| POST | `/phrases/gsc-exclude?client_id=&query=&exclude=` | Toggle GSC query exclusion |
| POST | `/phrases/generate?client_id=` | AI-generate seed phrases |

### Browser / Website Analysis
| Method | Path | Description |
|--------|------|-------------|
| POST | `/browser/analyze-website?client_id=` | Scrape and analyze client website |
| GET | `/browser/discover-subreddits?subreddit=` | Discover related subreddits |
| POST | `/browser/audit-suggestions?client_id=` | Audit subreddit/keyword selections |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, async SQLAlchemy, asyncpg |
| Database | PostgreSQL 16 |
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| AI | Anthropic Claude (Haiku for classification, Sonnet for suggestions/analysis) |
| Scraping | Reddit public JSON + Playwright fallback |
| Notifications | WaSender WhatsApp API |
| Search Console | Google Search Console API (OAuth2) |
| Scheduling | APScheduler |
| Containers | Docker + docker-compose |

## Project Structure

```
backend/
  app/
    main.py                 — FastAPI app, CORS, router registration
    config.py               — Settings via pydantic-settings
    database.py             — Async SQLAlchemy engine + session
    models/                 — ORM models (Client, Search, Signal, NotificationConfig, ClientPhrase, AlertLog)
    schemas/                — Pydantic request/response schemas
    routers/
      clients.py            — Client CRUD
      searches.py           — Search CRUD + scan trigger + SSE stream
      signals.py            — Signal listing, filtering, status updates
      dashboard.py          — Dashboard stats
      notifications.py      — Notification config + WhatsApp groups + test
      suggestions.py        — AI-powered search suggestions
      gsc.py                — Google Search Console OAuth + data
      phrases.py            — Seed phrase management + AI generation
      browser.py            — Website analysis + subreddit discovery + audit
    source_adapters/
      reddit_public.py      — Reddit public JSON scraper
    browser/
      reddit_browser.py     — Playwright fallback for Reddit
      website_analyzer.py   — Website scraping + Claude extraction
      subreddit_discovery.py — Sidebar-based subreddit discovery
    classifiers/
      intent_classifier.py  — Claude intent classification (batch)
    scoring/
      relevance_scorer.py   — Weighted relevance scoring
    notifications/
      whatsapp.py           — WaSender WhatsApp integration
    scheduler/
      scan_scheduler.py     — APScheduler auto-scan scheduling
    pipeline/
      scan_pipeline.py      — Full scan orchestration
  alembic/                  — Database migrations

frontend/
  src/
    App.jsx                 — Router, nav, global scan log
    ScanContext.jsx          — Global scan state management
    api.js                  — Backend API client
    pages/
      SignalFeed.jsx         — Signal feed with filters and stats
      SearchManager.jsx      — Search CRUD + AI suggestions + scan trigger
      ClientManager.jsx      — Client list and CRUD
      ClientView.jsx         — Client dashboard, website analysis, GSC, phrases, searches
      NotificationSettings.jsx — Notification config per client
    components/
      SignalCard.jsx         — Individual signal display
      ScoreIndicator.jsx     — Visual score badge (0-100)
      IntentBadge.jsx        — Intent label badge
      SourceIcon.jsx         — Source type icon
      SearchForm.jsx         — Reusable search config form
```

## Cost

Each scan costs approximately **$0.25-$0.50** using Claude Haiku for bulk classification. AI suggestions and website analysis use Claude Sonnet (slightly higher per-call cost but infrequent).
