import { Actor, log } from 'apify';
import { scrapeIkman } from '../scrapers/ikman.js';
import { scrapeRiyasewana } from '../scrapers/riyasewana.js';
import { scrapePatpat } from '../scrapers/patpat.js';
import { scrapeAutodirect } from '../scrapers/autodirect.js';
import { scrapeCartivate } from '../scrapers/cartivate.js';
import { scrapeAutolanka } from '../scrapers/autolanka.js';
import { scrapeDealers } from '../scrapers/dealers.js';
import { scrapeNews } from '../scrapers/news.js';
import { dedupeListings } from '../utils/dedupe.js';
import { scoreListings } from '../utils/score.js';
import { sendDealAlert, sendDealerAlert, sendNewsAlert, sendOpsAlert } from '../utils/telegram.js';
import { persistDataset, persistHistoricalSnapshot, persistDealerDataset, persistDealerSnapshot, persistNewsDataset, persistNewsSnapshot } from '../utils/storage.js';

/**
 * Run the vehicle tracker across 3 categories:
 * 1. Market sites (ikman, patpat, riyasewana, autodirect, cartivate, autolanka)
 * 2. Official dealer sites (MG, BYD, Toyota, Hyundai, Suzuki, Kia, Nissan, Tata, DIMO, United Motors, BAIC)
 * 3. News sites (VIASL, Motorguide, Newswire, Daily Mirror, Ada Derana, EconomyNext, AutoLanka)
 */
export async function runVehicleTracker({
    botToken,
    chatId,
    opsChatId,
    maxPriceLkr = 30_000_000,
    maxPagesPerSite = 10,
    sitesEnabled = ['ikman', 'patpat'],
    dealerBrands = [],
    newsEnabled = true,
}) {
    log.info('Starting vehicle tracker (all 3 categories)', {
        marketSites: sitesEnabled,
        dealerBrands: dealerBrands.length > 0 ? dealerBrands : 'ALL',
        newsEnabled,
        maxPriceLkr,
    });

    // ── 1. Market Sites ─────────────────────────────────────────
    const marketScraperMap = {
        ikman: scrapeIkman,
        riyasewana: scrapeRiyasewana,
        patpat: scrapePatpat,
        autodirect: scrapeAutodirect,
        cartivate: scrapeCartivate,
        autolanka: scrapeAutolanka,
    };

    const allMarketListings = [];
    const marketReport = {};

    for (const site of sitesEnabled) {
        const scraper = marketScraperMap[site];
        if (!scraper) {
            log.warning(`Unknown vehicle market site: ${site}`);
            continue;
        }
        try {
            log.info(`Scraping market: ${site}...`);
            const listings = await scraper({ maxPages: maxPagesPerSite, maxPriceLkr });
            marketReport[site] = listings.length;
            log.info(`${site}: ${listings.length} listings`);
            allMarketListings.push(...listings);

            if (listings.length === 0) {
                await sendOpsAlert(botToken, opsChatId, `⚠️ ${site} returned 0 listings — selectors may be broken`);
            }
        } catch (err) {
            log.error(`${site} market scraper failed`, { error: err.message });
            marketReport[site] = `ERROR: ${err.message}`;
            await sendOpsAlert(botToken, opsChatId, `🔥 ${site} market scraper failed: ${err.message}`);
        }
    }

    // ── 2. Official Dealer Sites ────────────────────────────────
    let dealerListings = [];
    const dealerReport = {};

    try {
        log.info('Scraping official dealer sites...');
        dealerListings = await scrapeDealers({ maxPriceLkr, brandsEnabled: dealerBrands });
        dealerReport.total = dealerListings.length;
        log.info(`Official dealers: ${dealerListings.length} models found`);
    } catch (err) {
        log.error('Dealer scraper failed', { error: err.message });
        dealerReport.error = err.message;
        await sendOpsAlert(botToken, opsChatId, `🔥 Dealer scraper failed: ${err.message}`);
    }

    // ── 3. News Sites ───────────────────────────────────────────
    let newsArticles = [];

    if (newsEnabled) {
        try {
            log.info('Scraping vehicle news sites...');
            newsArticles = await scrapeNews();
            log.info(`News: ${newsArticles.length} vehicle-related articles`);
        } catch (err) {
            log.error('News scraper failed', { error: err.message });
            await sendOpsAlert(botToken, opsChatId, `🔥 News scraper failed: ${err.message}`);
        }
    }

    // ── Process Market Listings ─────────────────────────────────
    log.info(`Total raw market listings: ${allMarketListings.length}`);

    let marketAlertsSent = 0;

    if (allMarketListings.length > 0) {
        const deduped = dedupeListings(allMarketListings);
        log.info(`After dedupe: ${deduped.length} unique market listings`);

        const withinBudget = deduped.filter(l => l.price_lkr && l.price_lkr <= maxPriceLkr);
        log.info(`Within budget (<= ${maxPriceLkr}): ${withinBudget.length} listings`);

        const scored = scoreListings(withinBudget);
        await persistDataset(scored);
        await persistHistoricalSnapshot(scored);

        // Dedupe against already-alerted
        const kv = await Actor.openKeyValueStore('alerted-listings');
        const alreadyAlerted = (await kv.getValue('ids')) || {};
        const newAlerts = scored.filter(l => !alreadyAlerted[l.id]);
        log.info(`New market alerts: ${newAlerts.length}`);

        for (const listing of newAlerts) {
            try {
                await sendDealAlert(botToken, chatId, listing);
                alreadyAlerted[listing.id] = { alerted_at: new Date().toISOString(), price: listing.price_lkr, score: listing.deal_score };
                await new Promise(r => setTimeout(r, 2500));
                marketAlertsSent++;
            } catch (err) {
                log.error(`Failed to send market alert for ${listing.id}`, { error: err.message });
            }
        }

        // Prune older than 30 days
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        for (const [id, meta] of Object.entries(alreadyAlerted)) {
            if (new Date(meta.alerted_at).getTime() < cutoff) delete alreadyAlerted[id];
        }
        await kv.setValue('ids', alreadyAlerted);
    } else {
        log.warning('Zero market listings across all sites.');
        await sendOpsAlert(botToken, opsChatId, `❌ All market scrapers returned 0 listings.`);
    }

    // ── Process Dealer Listings ─────────────────────────────────
    let dealerAlertsSent = 0;

    if (dealerListings.length > 0) {
        await persistDealerDataset(dealerListings);
        await persistDealerSnapshot(dealerListings);

        const kv = await Actor.openKeyValueStore('alerted-dealer-models');
        const alreadyAlerted = (await kv.getValue('ids')) || {};
        const newDealerAlerts = dealerListings.filter(l => !alreadyAlerted[l.id]);
        log.info(`New dealer alerts: ${newDealerAlerts.length}`);

        for (const listing of newDealerAlerts) {
            try {
                await sendDealerAlert(botToken, chatId, listing);
                alreadyAlerted[listing.id] = { alerted_at: new Date().toISOString(), brand: listing.brand, price: listing.price_lkr };
                await new Promise(r => setTimeout(r, 2500));
                dealerAlertsSent++;
            } catch (err) {
                log.error(`Failed to send dealer alert for ${listing.id}`, { error: err.message });
            }
        }

        // Prune older than 30 days
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        for (const [id, meta] of Object.entries(alreadyAlerted)) {
            if (new Date(meta.alerted_at).getTime() < cutoff) delete alreadyAlerted[id];
        }
        await kv.setValue('ids', alreadyAlerted);
    }

    // ── Process News Articles ───────────────────────────────────
    let newsAlertsSent = 0;

    if (newsArticles.length > 0) {
        await persistNewsDataset(newsArticles);
        await persistNewsSnapshot(newsArticles);

        const kv = await Actor.openKeyValueStore('alerted-news');
        const alreadyAlerted = (await kv.getValue('ids')) || {};
        const newNewsAlerts = newsArticles.filter(a => !alreadyAlerted[a.id]);
        log.info(`New news alerts: ${newNewsAlerts.length}`);

        for (const article of newNewsAlerts) {
            try {
                await sendNewsAlert(botToken, chatId, article);
                alreadyAlerted[article.id] = { alerted_at: new Date().toISOString(), source: article.source, category: article.category };
                await new Promise(r => setTimeout(r, 2500));
                newsAlertsSent++;
            } catch (err) {
                log.error(`Failed to send news alert for ${article.id}`, { error: err.message });
            }
        }

        // Prune older than 30 days
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        for (const [id, meta] of Object.entries(alreadyAlerted)) {
            if (new Date(meta.alerted_at).getTime() < cutoff) delete alreadyAlerted[id];
        }
        await kv.setValue('ids', alreadyAlerted);
    }

    // ── Summary ─────────────────────────────────────────────────
    const summary = [
        `✅ Vehicle tracker run complete`,
        ``,
        `📊 Market Sources:`,
        ...Object.entries(marketReport).map(([site, count]) => `  • ${site}: ${count}`),
        ``,
        `🏭 Official Dealers: ${dealerListings.length} models`,
        `📰 News Articles: ${newsArticles.length}`,
        ``,
        `🔔 Alerts Sent:`,
        `  • Market: ${marketAlertsSent}`,
        `  • Dealer: ${dealerAlertsSent}`,
        `  • News: ${newsAlertsSent}`,
        `💾 All datasets + snapshots persisted`,
    ].join('\n');
    log.info(summary);
    await sendOpsAlert(botToken, opsChatId, summary);

    return { marketReport, dealerReport, marketAlertsSent, dealerAlertsSent, newsAlertsSent };
}
