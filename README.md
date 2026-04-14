<p align="center">
  <h1 align="center">🇱🇰 Sri Lanka Vehicle & IT Intern Tracker v3.0</h1>
  <p align="center">
    <strong>25+ sources • 4 alert categories • One Telegram channel</strong>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Node.js-20+-green?logo=node.js" alt="Node.js 20+">
    <img src="https://img.shields.io/badge/Apify-Actor%20v3-blue?logo=apify" alt="Apify">
    <img src="https://img.shields.io/badge/Telegram-Bot%20API-blue?logo=telegram" alt="Telegram">
    <img src="https://img.shields.io/badge/version-3.0.0-orange" alt="v3.0.0">
    <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
  </p>
</p>

---

An **Apify Actor** that monitors **25+ Sri Lankan websites** for vehicle prices, official dealer updates, vehicle-related news, and IT internship postings — then sends real-time **Telegram alerts** with hashtag-based categorization to a single channel.

## 📋 Table of Contents

- [Features](#-features)
- [Alert Categories](#-alert-categories)
- [Sources Monitored](#-sources-monitored)
- [Quick Start](#-quick-start)
- [Prerequisites](#-prerequisites)
- [Local Setup](#-local-setup)
- [Deploy to Apify Cloud](#-deploy-to-apify-cloud)
- [Telegram Bot Setup](#-telegram-bot-setup)
- [Configuration](#-configuration)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Data Storage](#-data-storage)
- [Scheduling](#-scheduling)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## ✨ Features

- **🚗 Vehicle Price Tracking** — Monitors 6 marketplace sites for cars under your budget (default: LKR 30M)
- **🏭 Official Dealer Monitoring** — Tracks prices from 11 authorized Sri Lankan vehicle distributors
- **📰 Vehicle News Alerts** — Catches tax changes, import rule updates, and new model launches from 7 news sources
- **💼 IT Intern Tracking** — Finds IT internship/trainee posts from 5 job boards across 34 IT keywords
- **📱 Unified Telegram Channel** — All alerts go to one channel with `#hashtag` categorization for easy filtering
- **🎯 Smart Scoring** — Deal scoring for vehicles (price/year/mileage) and relevance scoring for intern posts
- **🔄 Deduplication** — Cross-source fuzzy matching prevents duplicate alerts
- **📊 Historical Snapshots** — Daily data persistence for trend analysis

---

## 🏷 Alert Categories

All alerts are tagged with hashtags for easy filtering in Telegram:

| Category | Hashtags | Description |
|----------|----------|-------------|
| 🚗 Market Listings | `#vehicle #under30M #ikman` | Used/reconditioned car deals under budget |
| 🏭 Official Dealers | `#vehicle #official #MG` | Brand-new vehicle prices from authorized dealers |
| 📰 Vehicle News | `#vehiclenews #taxupdate` | Tax, import, price change articles |
| 💼 IT Internships | `#intern #IT #Cybersecurity` | IT internship and trainee opportunities |

---

## 🌐 Sources Monitored

### Vehicle Marketplaces (6 sites)
| Source | URL | Type |
|--------|-----|------|
| ikman.lk | ikman.lk/en/ads/sri-lanka/vehicles | Largest SL classifieds |
| patpat.lk | patpat.lk | Vehicle marketplace |
| riyasewana.com | riyasewana.com | Established car classifieds |
| autodirect.lk | autodirect.lk | Vehicle marketplace |
| Cartivate Motors | cartivatmotors.lk | Dealer/marketplace |
| AutoLanka | autolanka.com | Car marketplace |

### Official Dealers (11 brands)
| Brand | Dealer | Under 30M Models |
|-------|--------|-------------------|
| MG | MG Sri Lanka | ZS MCE (12.4M), ZS Hybrid+ (18.4M), HS PHEV (22.6M) |
| BYD | John Keells CG Auto | Sealion 6 (from 21.7M) |
| Toyota | Toyota Lanka | Yaris Cross, smaller lineup |
| Hyundai | Hyundai Lanka | Venue, Creta, i20 |
| Suzuki | Suzuki SL (AMW) | Swift, Baleno, Vitara Brezza |
| Kia | Kia SL (Micro Cars) | Picanto, Stonic |
| Nissan | Nissan SL (United Motors) | Magnite, Kicks |
| Tata | Tata SL (DIMO) | Nexon, Punch |
| DIMO | DIMO | Multi-brand dealer |
| United Motors | United Motors Lanka | Multi-brand dealer |
| BAIC | BAIC SL | BJ40, X55, D20 |

### Vehicle News (7 sites)
| Source | Focus |
|--------|-------|
| VIASL | Vehicle Importers Association news |
| Motorguide.lk | Car reviews and price updates |
| NewsWire.lk | Business/finance vehicle news |
| Daily Mirror | National newspaper auto section |
| Ada Derana | News auto/transport section |
| EconomyNext | Economic impact on vehicle market |
| AutoLanka News | Auto industry news |

### IT Internship Sites (5 sites)
| Source | Strength |
|--------|----------|
| topjobs.lk | Large volume, established employers |
| XpressJobs | Strong local IT coverage |
| ikman.lk/jobs | Classifieds job section |
| ITPro.lk | Niche IT/software focus |
| LinkedIn Jobs | Professional network, remote roles |

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/sahansbandara/sl-vehicle-intern-tracker.git
cd sl-vehicle-intern-tracker

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your Telegram bot token and channel ID

# 4. Run locally
npm run start:local
```

---

## 📦 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | 20+ | Runtime |
| [npm](https://npmjs.com/) | 10+ | Package manager |
| [Apify CLI](https://docs.apify.com/cli/) | Latest | Cloud deployment (optional) |
| Telegram Bot | — | Alerts delivery |

### Install Apify CLI (for cloud deployment)

```bash
npm install -g apify-cli
apify login  # Enter your Apify API token
```

---

## 💻 Local Setup

### Step 1: Clone and Install

```bash
git clone https://github.com/sahansbandara/sl-vehicle-intern-tracker.git
cd sl-vehicle-intern-tracker
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=-100your_channel_id
TELEGRAM_OPS_CHAT_ID=-100your_channel_id
MODE=both
MAX_PRICE_LKR=30000000
MAX_PAGES_PER_SITE=10
NEWS_ENABLED=true
INTERN_MAX_PAGES_PER_SITE=5
```

### Step 3: Run

```bash
# With .env file
npm run start:local

# Or with Apify CLI (creates local storage)
apify run

# Run only vehicles
MODE=vehicles npm run start:local

# Run only interns
MODE=interns npm run start:local
```

---

## ☁️ Deploy to Apify Cloud

### Step 1: Install and Authenticate Apify CLI

```bash
npm install -g apify-cli
apify login
# Enter your API token from https://console.apify.com/account/integrations
```

### Step 2: Push to Apify

```bash
apify push
```

This uploads your code and builds the Docker image on Apify's servers.

### Step 3: Configure on Apify Console

1. Go to [Apify Console](https://console.apify.com/) → Your Actors → **sl-vehicle-intern-tracker**
2. Click **"Input"** tab and set:

```json
{
  "TELEGRAM_BOT_TOKEN": "your_bot_token",
  "TELEGRAM_CHAT_ID": "-100your_channel_id",
  "MODE": "both",
  "MAX_PRICE_LKR": 30000000,
  "SITES_ENABLED": ["ikman", "patpat", "autodirect", "cartivate", "autolanka"],
  "DEALER_BRANDS": [],
  "NEWS_ENABLED": true,
  "INTERN_SITES_ENABLED": ["topjobs", "xpress-jobs", "ikman-jobs", "itpro", "linkedin"],
  "INTERN_KEYWORDS": ["IT", "Software", "Web", "Developer", "Networking", "Cybersecurity", "Data", "AI", "Cloud"]
}
```

3. Click **"Run"** to test.

### Step 4: Set up Scheduling

In the Apify Console:
1. Go to your actor → **"Schedules"** tab
2. Click **"Create schedule"**
3. Set cron expression:

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Every 6 hours | `0 */6 * * *` | Recommended for regular monitoring |
| Every 4 hours | `0 */4 * * *` | More frequent checks |
| Twice daily | `0 8,18 * * *` | Morning and evening (SL time: 1:30 PM, 11:30 PM) |
| Once daily | `0 6 * * *` | Daily morning check |

---

## 🤖 Telegram Bot Setup

### Step 1: Create a Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a name: e.g., *SL Vehicle Tracker*
4. Choose a username: e.g., *sl_vehicle_tracker_bot*
5. Copy the **bot token** (format: `1234567890:ABCdefGhIjKlMnOpQrStUvWxYz`)

### Step 2: Create a Channel

1. Create a new Telegram channel (e.g., "SL Vehicle & Intern Alerts")
2. Make it **public** or **private**
3. Add your bot as an **administrator** (with "Post Messages" permission)

### Step 3: Get Channel ID

**Option A — For public channels:**
Your chat ID is `@your_channel_username`

**Option B — For private channels:**
1. Add [@userinfobot](https://t.me/userinfobot) to your channel
2. Forward any message from the channel to @userinfobot
3. It will reply with the channel ID (format: `-100xxxxxxxxxx`)

### Step 4: Test the Bot

```bash
# Test sending a message (replace with your values)
curl -s "https://api.telegram.org/botYOUR_TOKEN/sendMessage" \
  -d "chat_id=YOUR_CHANNEL_ID" \
  -d "text=🤖 Bot is working!"
```

---

## ⚙️ Configuration

### All Input Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | string | **required** | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | string | **required** | Target channel/chat ID |
| `TELEGRAM_OPS_CHAT_ID` | string | Same as above | Separate channel for ops alerts |
| `MODE` | enum | `"both"` | `"vehicles"`, `"interns"`, or `"both"` |
| `MAX_PRICE_LKR` | integer | `30000000` | Vehicle budget cap in LKR |
| `MAX_PAGES_PER_SITE` | integer | `10` | Max pages per marketplace |
| `SITES_ENABLED` | array | See below | Which market sites to scrape |
| `DEALER_BRANDS` | array | `[]` (all) | Which dealer brands to monitor |
| `NEWS_ENABLED` | boolean | `true` | Enable vehicle news monitoring |
| `INTERN_MAX_PAGES_PER_SITE` | integer | `5` | Max pages per job board |
| `INTERN_SITES_ENABLED` | array | See below | Which intern sites to scrape |
| `INTERN_KEYWORDS` | array | 34 keywords | IT field keywords to filter |

### Default Values

```json
{
  "SITES_ENABLED": ["ikman", "patpat", "autodirect", "cartivate", "autolanka"],
  "DEALER_BRANDS": [],
  "INTERN_SITES_ENABLED": ["topjobs", "xpress-jobs", "ikman-jobs", "itpro", "linkedin"],
  "INTERN_KEYWORDS": [
    "IT", "Software", "Web", "Mobile", "Developer", "Engineering", "Data",
    "AI", "Machine Learning", "DevOps", "Cloud", "QA", "Testing", "UI", "UX",
    "Database", "Networking", "Cybersecurity", "Security", "System Administration",
    "Computer Science", "Full Stack", "Frontend", "Backend", "Python", "Java",
    "React", "Node.js", "AWS", "Azure"
  ]
}
```

---

## 🏗 Architecture

```
main.js (MODE dispatcher: vehicles | interns | both)
│
├── vehicle-tracker.js
│   ├── MARKET (6 sites) → normalize → dedupe → score → persist → #vehicle alerts
│   │   ikman, patpat, riyasewana, autodirect, cartivate, autolanka
│   │
│   ├── DEALERS (11 brands) → persist → #official alerts
│   │   MG, BYD, Toyota, Hyundai, Suzuki, Kia, Nissan, Tata,
│   │   DIMO, United Motors, BAIC
│   │
│   └── NEWS (7 sites) → persist → #vehiclenews alerts
│       VIASL, Motorguide, Newswire, Daily Mirror, Ada Derana,
│       EconomyNext, AutoLanka
│
└── intern-tracker.js
    └── 5 SOURCES → normalize → dedupe → score → persist → #intern alerts
        topjobs, xpress-jobs, ikman-jobs, itpro, linkedin
```

### Data Pipeline

```
Scrape → Normalize → Dedupe → Score → Persist → Telegram Alert
  │          │          │        │        │           │
  │          │          │        │        │           └── MarkdownV2 + hashtags
  │          │          │        │        └── Apify Dataset + KV Store
  │          │          │        └── Deal score (0-100) or Relevance score (0-100)
  │          │          └── SHA-1 ID + Levenshtein fuzzy matching
  │          └── Unified schema (vehicle/intern/news/dealer)
  └── Axios + Cheerio HTML parsing
```

---

## 📁 Project Structure

```
sl-vehicle-intern-tracker/
├── .actor/
│   └── actor.json              # Apify actor config (v3.0)
├── src/
│   ├── main.js                 # Entry: mode dispatcher
│   ├── modes/
│   │   ├── vehicle-tracker.js  # Orchestrates market + dealer + news
│   │   └── intern-tracker.js   # Orchestrates 5 job boards
│   ├── scrapers/
│   │   ├── ikman.js            # ikman.lk marketplace
│   │   ├── patpat.js           # patpat.lk marketplace
│   │   ├── riyasewana.js       # riyasewana.com marketplace
│   │   ├── autodirect.js       # autodirect.lk marketplace
│   │   ├── cartivate.js        # cartivatmotors.lk marketplace
│   │   ├── autolanka.js        # autolanka.com marketplace
│   │   ├── dealers.js          # 11 official dealer sites (config factory)
│   │   ├── news.js             # 7 news sites (config factory)
│   │   ├── topjobs.js          # topjobs.lk job board
│   │   ├── ikman-jobs.js       # ikman.lk/jobs section
│   │   ├── xpress-jobs.js      # xpress.jobs portal
│   │   ├── itpro-jobs.js       # itpro.lk IT niche board
│   │   └── linkedin-jobs.js    # LinkedIn public search
│   └── utils/
│       ├── dedupe.js           # Cross-source deduplication
│       ├── normalize.js        # Data normalization
│       ├── score.js            # Deal + relevance scoring
│       ├── storage.js          # Dataset + KV persistence
│       └── telegram.js         # Bot API + hashtag alerts
├── .env.example                # Env template
├── .gitignore                  # Ignores .env, node_modules
├── CLAUDE.md                   # Agent context file
├── Dockerfile                  # Apify Docker build
├── INPUT_SCHEMA.json           # Apify input form schema
├── LICENSE                     # MIT License
├── package.json                # v3.0.0
└── README.md                   # This file
```

---

## 💾 Data Storage

### Apify Datasets
| Dataset | What's Stored |
|---------|---------------|
| `default` | Market vehicle listings (price, year, mileage, deal score) |
| `dealer-models` | Official dealer model/price data |
| `vehicle-news` | News articles (title, source, category, date) |
| `intern-posts` | IT intern postings (company, salary, field, relevance) |

### Key-Value Stores (Daily Snapshots)
| Store Name | Purpose |
|-----------|---------|
| `cars-under-budget-history` | Vehicle market price trends |
| `dealer-models-history` | Official price change tracking |
| `vehicle-news-history` | News article archive |
| `intern-tracker-history` | Intern post history |
| `alerted-listings` | Dedup IDs for market alerts |
| `alerted-dealer-models` | Dedup IDs for dealer alerts |
| `alerted-news` | Dedup IDs for news alerts |
| `alerted-intern-posts` | Dedup IDs for intern alerts |

---

## ⏰ Scheduling

### Apify Console
1. Go to **Schedules** → **Create schedule**
2. Set your preferred cron expression
3. Link it to your actor

### Recommended Schedules

| Use Case | Cron | Frequency |
|----------|------|-----------|
| Active monitoring | `0 */4 * * *` | Every 4 hours |
| Standard | `0 */6 * * *` | Every 6 hours |
| Daily check | `0 6 * * *` | Once daily at 6AM UTC |
| Weekdays only | `0 8 * * 1-5` | Mon-Fri at 8AM UTC |

---

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `TELEGRAM_BOT_TOKEN required` | Set token in `.env` or Apify input |
| `403 Forbidden` from Telegram | Add bot as channel admin with "Post Messages" |
| `0 listings from all sites` | Website selectors may have changed; check ops alerts |
| Site returns empty | Website may be blocking requests; check user-agent |
| `parsedPrice is null` | Price format changed on the site |

### Checking Logs

```bash
# Local
apify run 2>&1 | tee run.log

# Apify Cloud
# Go to Console → Runs → Click on run → "Log" tab
```

### Validating Syntax

```bash
# Check all source files
for f in src/main.js src/modes/*.js src/scrapers/*.js src/utils/*.js; do
  node --check "$f" && echo "✅ $f" || echo "❌ $f FAILED"
done
```

---

## 📄 License

[MIT License](LICENSE) — made with ❤️ for Sri Lanka's vehicle buyers and IT students.

---

<p align="center">
  <strong>Built by <a href="https://github.com/sahansbandara">sahansbandara</a> (SLIIT IT24100559)</strong>
</p>
