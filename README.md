# Sri Lanka Vehicle & IT Intern Tracker

An `Apify` actor that monitors Sri Lankan vehicle marketplaces,
official dealer catalogs, vehicle-news sources, and IT internship
job boards, then sends categorized Telegram alerts to dedicated
channels.

The actor supports three operating modes:

- `vehicles` for market listings, official dealer models, and vehicle news
- `interns` for IT internship and trainee postings
- `both` to run everything in one execution

## What The Actor Does

- Scrapes 6 vehicle marketplace sources, with 5 enabled by default
- Scrapes 11 official Sri Lankan dealer brand catalogs
- Scrapes 7 vehicle-news sources for tax, import, price, and launch updates
- Scrapes 5 internship/job sources for IT-focused intern and trainee roles
- Sends alerts to separate vehicle and intern Telegram channels
- Sends scraper-health summaries and failures to an optional ops channel
- Filters used-market alerts to vehicles from 2022 onward by default
- Deduplicates listings/posts across sources with fuzzy matching
- Scores vehicle deals and internship relevance before alerting
- Persists datasets and daily snapshots inside Apify storages

## Tech Stack

| Area | Implementation |
| --- | --- |
| Runtime | Node.js 20+ |
| Actor platform | Apify Actor SDK |
| Scraping approach | Axios + Cheerio |
| Alert delivery | Telegram Bot API |
| Deduplication | `fast-levenshtein` + heuristic matching |
| Packaging | Docker (`apify/actor-node-playwright-chrome:20`) |

## Source Coverage

### Vehicle marketplaces

The codebase contains 6 marketplace scrapers:

| Source key | Site | Default enabled |
| --- | --- | --- |
| `ikman` | `ikman.lk` | Yes |
| `riyasewana` | `riyasewana.com` | No |
| `patpat` | `patpat.lk` | Yes |
| `autodirect` | `autodirect.lk` | Yes |
| `cartivate` | `cartivatemotors.lk` | Yes |
| `autolanka` | `autolanka.com` | Yes |

### Official dealer brands

When `DEALER_BRANDS` is empty, the actor scrapes all supported brands:

`MG`, `BYD`, `Toyota`, `Hyundai`, `Suzuki`, `Kia`, `Nissan`,
`Tata`, `DIMO`, `United Motors`, `BAIC`

### Vehicle news sources

| Source | Label |
| --- | --- |
| `VIASL` | Vehicle Importers Association |
| `Motorguide` | Motorguide.lk |
| `Newswire` | Newswire.lk |
| `DailyMirror` | Daily Mirror Sri Lanka |
| `AdaDerana` | Ada Derana |
| `EconomyNext` | EconomyNext |
| `AutoLankaNews` | AutoLanka News |

### Internship sources

All 5 intern scrapers are enabled by default:

`topjobs`, `xpress-jobs`, `ikman-jobs`, `itpro`, `linkedin`

## Telegram Routing

The actor supports separate channels for each alert stream:

- `TELEGRAM_VEHICLE_CHAT_ID`: vehicle marketplace alerts, dealer alerts,
  and vehicle-news alerts
- `TELEGRAM_INTERN_CHAT_ID`: internship alerts
- `TELEGRAM_OPS_CHAT_ID`: scraper failures, zero-result warnings, and
  run summaries

Legacy behavior is still supported:

- `TELEGRAM_CHAT_ID` can be used as a fallback for both vehicle and intern channels
- If `TELEGRAM_OPS_CHAT_ID` is omitted, ops alerts fall back to the vehicle channel

Typical hashtag patterns sent by the actor:

- Vehicle market alerts: `#vehicle #over10M #<source>`
- Official dealer alerts: `#vehicle #official #<brand>`
- Vehicle news alerts: `#vehiclenews #<category>`
- Internship alerts: `#intern #IT #<field>`

## Prerequisites

- Node.js 20 or newer
- npm
- A Telegram bot token from `@BotFather`
- At least one target Telegram channel or group ID
- An Apify account only if you want cloud deployment or Apify storage
  in production

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/sahansbandara/sl-vehicle-intern-tracker.git
cd sl-vehicle-intern-tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a local environment file

```bash
cp .env.example .env
```

Then edit `.env`:

```env
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
TELEGRAM_VEHICLE_CHAT_ID=-100YOUR_VEHICLE_CHANNEL_ID
TELEGRAM_INTERN_CHAT_ID=-100YOUR_INTERN_CHANNEL_ID
TELEGRAM_OPS_CHAT_ID=-100YOUR_OPS_CHANNEL_ID

MODE=both

MIN_PRICE_LKR=10000000
MAX_PRICE_LKR=500000000
MIN_VEHICLE_YEAR=2022
MAX_PAGES_PER_SITE=10
NEWS_ENABLED=true

INTERN_MAX_PAGES_PER_SITE=5
```

### 4. Run locally

Use the local script if you want `.env` loading:

```bash
npm run start:local
```

Useful variants:

```bash
MODE=vehicles npm run start:local
MODE=interns npm run start:local
MIN_PRICE_LKR=15000000 MAX_PRICE_LKR=30000000 npm run start:local
MIN_VEHICLE_YEAR=2023 npm run start:local
```

Notes:

- `npm run start:local` loads `.env` via `node --env-file=.env`
- `npm start` does not load `.env`; it expects Apify input or
  externally injected environment variables
- If `MODE=both` but only one content channel is configured, the missing
  mode is skipped and logged as an error

## Configuration Reference

The runtime merges Apify input with environment variables and applies
code defaults.

- `TELEGRAM_BOT_TOKEN`:
  required bot token
- `TELEGRAM_VEHICLE_CHAT_ID`:
  required for `vehicles` mode
- `TELEGRAM_INTERN_CHAT_ID`:
  required for `interns` mode
- `TELEGRAM_OPS_CHAT_ID`:
  optional ops channel, defaults to the vehicle channel
- `TELEGRAM_CHAT_ID`:
  legacy fallback for both content channels
- `MODE`:
  defaults to `both`; valid values are `vehicles`, `interns`, or `both`
- `MIN_PRICE_LKR`:
  defaults to `10000000`
- `MAX_PRICE_LKR`:
  defaults to `500000000`
- `MIN_VEHICLE_YEAR`:
  defaults to `2022`; marketplace listings older than this, or missing
  a year, are excluded
- `MAX_PAGES_PER_SITE`:
  defaults to `10`
- `SITES_ENABLED`:
  defaults to `["ikman","patpat","autodirect","cartivate","autolanka"]`
- `DEALER_BRANDS`:
  defaults to `[]`, which means all 11 brands
- `NEWS_ENABLED`:
  defaults to `true`
- `INTERN_MAX_PAGES_PER_SITE`:
  defaults to `5`
- `INTERN_SITES_ENABLED`:
  defaults to `["topjobs","xpress-jobs","ikman-jobs","itpro","linkedin"]`
- `INTERN_KEYWORDS`:
  defaults to the built-in IT keyword list

There is also backward-compatible support in code for
`PRICE_ALERT_THRESHOLD_LKR`, but `MAX_PRICE_LKR` is the current
documented input.

## Apify Usage

### Push the actor

```bash
npm install -g apify-cli
apify login
apify push
```

### Example actor input

```json
{
  "TELEGRAM_BOT_TOKEN": "your_bot_token",
  "TELEGRAM_VEHICLE_CHAT_ID": "-1001234567890",
  "TELEGRAM_INTERN_CHAT_ID": "-1001234567891",
  "TELEGRAM_OPS_CHAT_ID": "-1001234567892",
  "MODE": "both",
  "MIN_PRICE_LKR": 10000000,
  "MAX_PRICE_LKR": 500000000,
  "MIN_VEHICLE_YEAR": 2022,
  "MAX_PAGES_PER_SITE": 10,
  "SITES_ENABLED": [
    "ikman",
    "patpat",
    "autodirect",
    "cartivate",
    "autolanka"
  ],
  "DEALER_BRANDS": [],
  "NEWS_ENABLED": true,
  "INTERN_MAX_PAGES_PER_SITE": 5,
  "INTERN_SITES_ENABLED": [
    "topjobs",
    "xpress-jobs",
    "ikman-jobs",
    "itpro",
    "linkedin"
  ],
  "INTERN_KEYWORDS": ["IT", "Software", "Developer", "Data", "Cybersecurity", "Cloud"]
}
```

### Scheduling

Common Apify schedules for this actor:

- Every 6 hours for regular monitoring
- Every 4 hours for more aggressive alerting
- Twice daily if you only want summary-style change tracking

Configure schedules from the Apify Console after the first successful push.

## How It Works

### Execution flow

1. `src/main.js` initializes the actor and loads input from Apify.
2. Local `.env` values are used as fallbacks when running outside Apify.
3. The actor routes execution by `MODE`.
4. Vehicle mode runs three pipelines:
   - marketplace scraping
   - official dealer scraping
   - vehicle-news scraping
5. Intern mode scrapes internship sources using the configured keyword list.
6. Marketplace listings are filtered by price band and minimum model
   year before alerting.
7. The actor deduplicates results, scores them, persists them, sends
   only unseen alerts, then prunes old alerted IDs after 30 days.

### Vehicle scoring

Vehicle listings are scored from `0` to `100` using:

- relative price within the current result set
- mileage
- year
- trim bonus
- condition bonus

### Internship scoring

Internship posts are scored from `0` to `100` using:

- field specificity
- company presence
- salary availability
- duration availability
- qualification richness
- active deadline
- location presence
- recency

### Deduplication

The actor uses fuzzy matching with `fast-levenshtein` plus source-specific heuristics:

- Vehicle duplicates consider normalized title similarity, price
  proximity, location, and year
- Internship duplicates consider normalized title similarity, company, and location

## Output Storage

The actor writes to multiple Apify storages:

### Datasets

| Dataset | Contents |
| --- | --- |
| default dataset | scored vehicle marketplace listings |
| `dealer-models` | official dealer vehicle models |
| `vehicle-news` | vehicle-news articles |
| `intern-posts` | scored internship posts |

### Key-value stores

| Store | Purpose |
| --- | --- |
| `cars-under-budget-history` | daily vehicle marketplace snapshots |
| `dealer-models-history` | daily dealer snapshots |
| `vehicle-news-history` | daily news snapshots |
| `intern-tracker-history` | daily internship snapshots |
| `alerted-listings` | vehicle marketplace IDs already alerted |
| `alerted-dealer-models` | dealer model IDs already alerted |
| `alerted-news` | news article IDs already alerted |
| `alerted-intern-posts` | internship post IDs already alerted |

Every snapshot store also keeps a `latest` key for convenient access to
the most recent run.

## Project Structure

```text
.
├── .actor/                 # Apify actor metadata
├── src/
│   ├── main.js             # Entry point and mode routing
│   ├── modes/
│   │   ├── vehicle-tracker.js
│   │   └── intern-tracker.js
│   ├── scrapers/
│   │   ├── ikman.js
│   │   ├── riyasewana.js
│   │   ├── patpat.js
│   │   ├── autodirect.js
│   │   ├── cartivate.js
│   │   ├── autolanka.js
│   │   ├── dealers.js
│   │   ├── news.js
│   │   ├── topjobs.js
│   │   ├── xpress-jobs.js
│   │   ├── ikman-jobs.js
│   │   ├── itpro-jobs.js
│   │   └── linkedin-jobs.js
│   └── utils/
│       ├── dedupe.js
│       ├── normalize.js
│       ├── score.js
│       ├── storage.js
│       └── telegram.js
├── Dockerfile
├── INPUT_SCHEMA.json
├── package.json
└── README.md
```

## Operational Notes

- Zero-result scrapes trigger an ops warning so selector breakages are
  visible quickly.
- Scraper failures trigger an ops alert with the error message.
- The default vehicle marketplace set does not include `riyasewana`;
  add it explicitly if you want it.
- The Docker image uses Apify's Playwright base image, but the current
  scraper implementation is Axios/Cheerio-driven.
- There is no automated test suite or lint task defined in
  `package.json` at the moment.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
