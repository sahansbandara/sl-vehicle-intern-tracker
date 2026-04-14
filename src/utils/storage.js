import { Actor, log } from 'apify';

/**
 * Persist all vehicle listings to the default Apify Dataset.
 */
export async function persistDataset(listings) {
    const dataset = await Actor.openDataset();
    await dataset.pushData(listings);
    log.info(`Persisted ${listings.length} listings to default dataset`);
}

/**
 * Persist vehicle historical snapshot keyed by date (YYYY-MM-DD).
 */
export async function persistHistoricalSnapshot(listings) {
    const kv = await Actor.openKeyValueStore('cars-under-budget-history');
    const today = new Date().toISOString().substring(0, 10);

    const snapshot = {
        date: today,
        run_at: new Date().toISOString(),
        listing_count: listings.length,
        stats: computeVehicleStats(listings),
        listings: listings.map(l => ({
            id: l.id,
            source: l.source,
            url: l.url,
            title: l.title,
            price_lkr: l.price_lkr,
            year: l.year,
            mileage_km: l.mileage_km,
            location: l.location,
            condition: l.condition,
            trim: l.trim,
            deal_score: l.deal_score,
        })),
    };

    await kv.setValue(today, snapshot);
    log.info(`Saved vehicle historical snapshot: ${today}`);
    await kv.setValue('latest', { date: today, ...snapshot });
}

/**
 * Persist official dealer model listings to a separate dataset.
 */
export async function persistDealerDataset(listings) {
    const dataset = await Actor.openDataset('dealer-models');
    await dataset.pushData(listings);
    log.info(`Persisted ${listings.length} dealer models to dealer-models dataset`);
}

/**
 * Persist dealer listing snapshot keyed by date.
 */
export async function persistDealerSnapshot(listings) {
    const kv = await Actor.openKeyValueStore('dealer-models-history');
    const today = new Date().toISOString().substring(0, 10);

    const snapshot = {
        date: today,
        run_at: new Date().toISOString(),
        model_count: listings.length,
        models: listings.map(l => ({
            id: l.id,
            brand: l.brand,
            model: l.model,
            price_lkr: l.price_lkr,
            price_raw: l.price_raw,
            source: l.source,
            url: l.url,
        })),
    };

    await kv.setValue(today, snapshot);
    log.info(`Saved dealer snapshot: ${today}`);
    await kv.setValue('latest', { date: today, ...snapshot });
}

/**
 * Persist news articles to a separate dataset.
 */
export async function persistNewsDataset(articles) {
    const dataset = await Actor.openDataset('vehicle-news');
    await dataset.pushData(articles);
    log.info(`Persisted ${articles.length} news articles to vehicle-news dataset`);
}

/**
 * Persist news snapshot keyed by date.
 */
export async function persistNewsSnapshot(articles) {
    const kv = await Actor.openKeyValueStore('vehicle-news-history');
    const today = new Date().toISOString().substring(0, 10);

    const snapshot = {
        date: today,
        run_at: new Date().toISOString(),
        article_count: articles.length,
        by_source: {},
        by_category: {},
        articles: articles.map(a => ({
            id: a.id,
            source: a.source,
            title: a.title,
            category: a.category,
            url: a.url,
            date: a.date,
        })),
    };

    for (const a of articles) {
        snapshot.by_source[a.source] = (snapshot.by_source[a.source] || 0) + 1;
        snapshot.by_category[a.category] = (snapshot.by_category[a.category] || 0) + 1;
    }

    await kv.setValue(today, snapshot);
    log.info(`Saved news snapshot: ${today}`);
    await kv.setValue('latest', { date: today, ...snapshot });
}

/**
 * Persist intern post data to a separate dataset.
 */
export async function persistInternDataset(posts) {
    const dataset = await Actor.openDataset('intern-posts');
    await dataset.pushData(posts);
    log.info(`Persisted ${posts.length} intern posts to intern-posts dataset`);
}

/**
 * Persist intern historical snapshot keyed by date.
 */
export async function persistInternSnapshot(posts) {
    const kv = await Actor.openKeyValueStore('intern-tracker-history');
    const today = new Date().toISOString().substring(0, 10);

    const snapshot = {
        date: today,
        run_at: new Date().toISOString(),
        post_count: posts.length,
        stats: computeInternStats(posts),
        posts: posts.map(p => ({
            id: p.id,
            source: p.source,
            url: p.url,
            title: p.title,
            company: p.company,
            salary_range: p.salary_range,
            duration: p.duration,
            location: p.location,
            field: p.field,
            relevance_score: p.relevance_score,
        })),
    };

    await kv.setValue(today, snapshot);
    log.info(`Saved intern historical snapshot: ${today}`);
    await kv.setValue('latest', { date: today, ...snapshot });
}

// ── Stats helpers ───────────────────────────────────────────────

function computeVehicleStats(listings) {
    const prices = listings.map(l => l.price_lkr).filter(Boolean).sort((a, b) => a - b);
    if (prices.length === 0) return null;

    const median = prices[Math.floor(prices.length / 2)];
    const mean = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

    const bySource = {};
    for (const l of listings) bySource[l.source] = (bySource[l.source] || 0) + 1;

    const byCondition = {};
    for (const l of listings) byCondition[l.condition] = (byCondition[l.condition] || 0) + 1;

    return { min_price: prices[0], max_price: prices[prices.length - 1], median_price: median, mean_price: mean, by_source: bySource, by_condition: byCondition };
}

function computeInternStats(posts) {
    const bySource = {};
    const byField = {};
    const byLocation = {};

    for (const p of posts) {
        bySource[p.source] = (bySource[p.source] || 0) + 1;
        byField[p.field] = (byField[p.field] || 0) + 1;
        if (p.location) byLocation[p.location] = (byLocation[p.location] || 0) + 1;
    }

    return { by_source: bySource, by_field: byField, by_location: byLocation };
}
