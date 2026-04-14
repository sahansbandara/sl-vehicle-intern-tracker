# Project Brain — Sri Lanka Vehicle & IT Intern Tracker v3.0

> **Apify Actor** that scrapes **25+ Sri Lankan sources** for vehicles under budget, official dealer prices, vehicle news, and IT internship postings — all routed to one Telegram channel with hashtag-based categorization.

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
├── .actor/actor.json          # Apify actor config (v3.0)
├── .env.example               # Environment variable template
├── .gitignore                 # Ignores .env, node_modules, storage
├── Dockerfile                 # Apify Docker build
├── INPUT_SCHEMA.json          # Apify input schema (all toggles)
├── package.json               # Node.js config (v3.0.0)
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
│   │   └── linkedin-jobs.js   # LinkedIn public job search scraper
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

## Telegram Hashtag System

All 4 alert types go to one channel:

| Alert Type | Hashtags | Example |
|------------|----------|---------|
| Market listings | `#vehicle #under30M #ikman` | Used car under budget |
| Official dealers | `#vehicle #official #MG` | MG ZS price from dealer |
| Vehicle news | `#vehiclenews #taxupdate` | Import duty change article |
| IT internships | `#intern #IT #Cybersecurity` | Network intern at Dialog |

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

## Conventions

- ES Modules (`import`/`export`) throughout
- All scrapers pattern: fetch HTML → Cheerio parse → normalize → return array
- Config-driven factories for dealers (11 configs) and news (7 configs) to minimize code
- Telegram rate limiting: 2500ms delay between messages
- Deduplication: SHA-1 content IDs + Levenshtein fuzzy title matching
- Historical snapshots stored daily in Apify Key-Value Store
- Separate dedup stores per alert category prevent duplicate alerts across runs

## Input Configuration

### Required
- `TELEGRAM_BOT_TOKEN` — Bot token from @BotFather
- `TELEGRAM_CHAT_ID` — Target Telegram chat/channel ID

### Optional
- `MODE` — `"vehicles"`, `"interns"`, or `"both"` (default: `"both"`)
- `MAX_PRICE_LKR` — Vehicle budget cap (default: 30,000,000)
- `MAX_PAGES_PER_SITE` — Max pages per market site (default: 10)
- `SITES_ENABLED` — Market sites (default: `["ikman", "patpat", "autodirect", "cartivate", "autolanka"]`)
- `DEALER_BRANDS` — Official dealer brands, empty = all 11 (default: `[]`)
- `NEWS_ENABLED` — Enable vehicle news monitoring (default: `true`)
- `INTERN_SITES_ENABLED` — Intern sites (default: `["topjobs", "xpress-jobs", "ikman-jobs", "itpro", "linkedin"]`)
- `INTERN_KEYWORDS` — IT filter keywords (default: 34 keywords covering all IT subfields)
- `TELEGRAM_OPS_CHAT_ID` — Separate ops alert channel (default: falls back to main chat)
