# Project Brain — Sri Lanka Vehicle & IT Intern Tracker v3.1

> **Apify Actor** that scrapes **25+ Sri Lankan sources** for vehicles under budget, official dealer prices, vehicle news, and IT internship postings — routed to **separate Telegram channels** with hashtag-based categorization.

## Stack

- **Runtime:** Node.js 20+
- **Platform:** Apify (Actor SDK v3)
- **Scraping:** Axios + Cheerio (no browser required)
- **Messaging:** Telegram Bot API (MarkdownV2)
- **Storage:** Apify Dataset + Key-Value Store (4 named datasets)
- **Deduplication:** fast-levenshtein + SHA-1 content IDs
- **Containerization:** Docker (apify/actor-node-playwright-chrome)

## Commands

```bash
npm install          # Install dependencies
npm start            # Run the actor (needs Apify runtime)
npm run start:local  # Run locally with .env file
apify run            # Run with Apify CLI (local)
apify push           # Deploy to Apify cloud
apify login          # Authenticate with Apify
node --check src/*.js src/**/*.js  # Syntax validation
```

## Modes

| Mode | Description |
|------|-------------|
| `vehicles` | Run all 3 vehicle categories: market (6 sites), official dealers (11 brands), news (7 sites) |
| `interns` | Run IT intern tracker across 5 job boards |
| `both` | Run vehicle + intern trackers sequentially (default) |

## Project Structure

```
.
├── .actor/actor.json          # Apify actor config (v3.1)
├── .env.example               # Environment variable template
├── .gitignore                 # Ignores .env, node_modules, storage
├── Dockerfile                 # Apify Docker build
├── INPUT_SCHEMA.json          # Apify input schema (all toggles)
├── package.json               # Node.js config (v3.1.0)
├── README.md                  # Full deployment guide
├── CLAUDE.md                  # This file — agent context
├── src/
│   ├── main.js                # Entry point — mode dispatcher
│   ├── modes/
│   │   ├── vehicle-tracker.js # Orchestrates 3 vehicle categories
│   │   └── intern-tracker.js  # Orchestrates 5 intern sources
│   ├── scrapers/
│   │   ├── ikman.js           # ikman.lk car scraper
│   │   ├── patpat.js          # patpat.lk car scraper
│   │   ├── riyasewana.js      # riyasewana.com car scraper
│   │   ├── autodirect.js      # autodirect.lk car scraper
│   │   ├── cartivate.js       # cartivatmotors.lk car scraper
│   │   ├── autolanka.js       # autolanka.com car scraper
│   │   ├── dealers.js         # Config-driven factory for 11 official dealer sites
│   │   ├── news.js            # Config-driven factory for 7 news sites
│   │   ├── topjobs.js         # topjobs.lk IT intern scraper
│   │   ├── ikman-jobs.js      # ikman.lk jobs section scraper
│   │   ├── xpress-jobs.js     # xpress.jobs IT intern scraper
│   │   ├── itpro-jobs.js      # itpro.lk niche IT board scraper
│   │   └── linkedin-jobs.js   # LinkedIn public job search (anti-blocking v2)
│   └── utils/
│       ├── dedupe.js          # Cross-source dedup (vehicle + intern)
│       ├── normalize.js       # Data normalization (vehicle + intern)
│       ├── score.js           # Deal scoring (vehicle) + relevance scoring (intern)
│       ├── storage.js         # 4 datasets + 4 KV snapshot stores
│       └── telegram.js        # 4 alert types with hashtag-based categorization
```

## Architecture

```
INPUT → main.js (mode select: vehicles | interns | both)
         │
         ├── vehicle-tracker.js
         │    ├── MARKET (6 sites):
         │    │   ikman, patpat, riyasewana, autodirect, cartivate, autolanka
         │    │   → normalize → dedupe → score → persist → #vehicle alerts
         │    │
         │    ├── DEALERS (11 brands):
         │    │   MG, BYD, Toyota, Hyundai, Suzuki, Kia, Nissan, Tata,
         │    │   DIMO, United Motors, BAIC
         │    │   → persist → #official alerts
         │    │
         │    └── NEWS (7 sites):
         │        VIASL, Motorguide, Newswire, Daily Mirror, Ada Derana,
         │        EconomyNext, AutoLanka
         │        → persist → #vehiclenews alerts
         │
         └── intern-tracker.js
              ├── topjobs, xpress-jobs, ikman-jobs, itpro, linkedin
              └── → normalize → dedupe → score → persist → #intern alerts
```

## Telegram Channel Routing

Alerts are sent to **separate** Telegram channels:

| Alert Type | Channel | Hashtags | Example |
|------------|---------|----------|---------|
| Market listings | `TELEGRAM_VEHICLE_CHAT_ID` | `#vehicle #over10M #ikman` | Used car under budget |
| Official dealers | `TELEGRAM_VEHICLE_CHAT_ID` | `#vehicle #official #MG` | MG ZS price from dealer |
| Vehicle news | `TELEGRAM_VEHICLE_CHAT_ID` | `#vehiclenews #taxupdate` | Import duty change article |
| IT internships | `TELEGRAM_INTERN_CHAT_ID` | `#intern #IT #Cybersecurity` | Network intern at Dialog |
| Ops alerts | `TELEGRAM_OPS_CHAT_ID` | (plain text) | Scraper failure warning |

## Data Storage (Apify Datasets)

| Dataset Name | Contents | Type |
|-------------|----------|------|
| `default` | Market vehicle listings | Append per run |
| `dealer-models` | Official dealer model/price data | Append per run |
| `vehicle-news` | News articles | Append per run |
| `intern-posts` | IT intern postings | Append per run |

**Key-Value Stores** (historical daily snapshots):
- `cars-under-budget-history`
- `dealer-models-history`
- `vehicle-news-history`
- `intern-tracker-history`

**Alert dedup stores** (prevent duplicate Telegram alerts):
- `alerted-listings` — vehicle marketplace IDs
- `alerted-dealer-models` — dealer model IDs
- `alerted-news` — news article IDs
- `alerted-intern-posts` — intern post IDs (pruned after 30 days)

## Conventions

- ES Modules (`import`/`export`) throughout
- All scrapers pattern: fetch HTML → Cheerio parse → normalize → return array
- Config-driven factories for dealers (11 configs) and news (7 configs) to minimize code
- Telegram rate limiting: 2500ms delay between messages
- Deduplication: SHA-1 content IDs + Levenshtein fuzzy title matching
- Historical snapshots stored daily in Apify Key-Value Store
- Separate dedup stores per alert category prevent duplicate alerts across runs
- LinkedIn scraper uses rotating User-Agents, exponential backoff, and consecutive block detection
- Intern Telegram alerts compact multi-line whitespace before rendering, and include a dedicated posted-date line when source data provides one
- The intern pipeline is strict: only `is_intern === true` posts are eligible for the intern channel, and recent-age filtering happens after that gate

## Input Configuration

### Required
- `TELEGRAM_BOT_TOKEN` — Bot token from @BotFather
- `TELEGRAM_VEHICLE_CHAT_ID` — Vehicle alert channel ID
- `TELEGRAM_INTERN_CHAT_ID` — Intern alert channel ID

### Optional
- `TELEGRAM_OPS_CHAT_ID` — Ops channel (default: vehicle channel)
- `TELEGRAM_CHAT_ID` — Legacy fallback for both channels
- `MODE` — `"vehicles"`, `"interns"`, or `"both"` (default: `"both"`)
- `MIN_PRICE_LKR` — Min vehicle price (default: 10,000,000)
- `MAX_PRICE_LKR` — Max vehicle price (default: 500,000,000)
- `MIN_VEHICLE_YEAR` — Minimum model year filter (default: 2022)
- `MAX_PAGES_PER_SITE` — Max pages per market site (default: 10)
- `SITES_ENABLED` — Market sites (default: `["ikman", "patpat", "autodirect", "cartivate", "autolanka"]`)
- `DEALER_BRANDS` — Official dealer brands, empty = all 11 (default: `[]`)
- `NEWS_ENABLED` — Enable vehicle news monitoring (default: `true`)
- `INTERN_MAX_PAGES_PER_SITE` — Max pages per intern site (default: 5)
- `INTERN_MAX_POST_AGE_DAYS` — Only keep internship posts newer than this many days (default: 14)
- `INTERN_SITES_ENABLED` — Intern sites (default: `["topjobs", "xpress-jobs", "ikman-jobs", "itpro", "linkedin"]`)
- `INTERN_KEYWORDS` — IT filter keywords (default: 30 keywords covering all IT subfields)

## Known Issues & Solutions

- **LinkedIn blocking**: LinkedIn aggressively rate-limits scraping. The scraper now uses rotating UAs, exponential backoff, and stops after 3 consecutive blocks to avoid IP bans.
- **LinkedIn metadata leakage**: Public LinkedIn cards may mix status badges and relative timestamps into the location block. Keep location extraction sanitized before persistence so Telegram posts do not render large blank gaps.
- **Intern post freshness**: Internship alerts are intentionally strict. Keep only posts with a parseable `posted_date` inside the last 14 days by default; drop older or undated posts before scoring, persistence, and Telegram delivery.
- **Cartivate/AutoLanka failures**: These sites may change URLs or go down. The scraper logs `ALL_URLS_FAILED` and continues gracefully.
- **Dealer sites failing**: Many dealer websites are poorly maintained; the scraper tries multiple URL patterns per brand.
- **ITPro returns non-intern IT jobs**: By design — all IT positions are included since the site is IT-focused. The scoring system ranks true intern roles higher.
