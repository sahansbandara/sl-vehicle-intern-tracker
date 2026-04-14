import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from 'apify';

const BASE_URL = 'https://www.autolanka.com';

/**
 * Scrape AutoLanka for vehicle listings.
 * AutoLanka is both a marketplace + news site for Sri Lanka vehicles.
 */
export async function scrapeAutolanka({ maxPages = 5, maxPriceLkr = 30_000_000 } = {}) {
    const listings = [];

    const searchUrls = [
        `${BASE_URL}/cars-for-sale`,
        `${BASE_URL}/classifieds`,
        `${BASE_URL}/listings`,
        `${BASE_URL}/vehicles`,
    ];

    for (let page = 1; page <= maxPages; page++) {
        let html = null;
        let usedUrl = null;

        for (const baseSearchUrl of searchUrls) {
            try {
                const url = page === 1 ? baseSearchUrl : `${baseSearchUrl}?page=${page}`;
                const { data } = await axios.get(url, {
                    timeout: 15_000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    },
                });
                if (typeof data === 'string' && data.length > 1000) {
                    html = data;
                    usedUrl = url;
                    break;
                }
            } catch {
                continue;
            }
        }

        if (!html) {
            if (page === 1) log.warning('AutoLanka: All base URLs failed');
            break;
        }

        const $ = cheerio.load(html);
        const pageListings = [];

        // AutoLanka typically uses forum/classified style layouts
        const cardSelector = '.listing, .classified, .car-listing, .vehicle-item, .ad-item, article, .result-item, tr.listing, [class*="listing"], [class*="classified"], [class*="vehicle"]';

        $(cardSelector).each((_, el) => {
            const card = $(el);
            const title = card.find('h2, h3, h4, a.title, .listing-title, .vehicle-name, [class*="title"], [class*="name"]').first().text().trim();
            const priceText = card.find('.price, [class*="price"], .amount').first().text().trim();
            const link = card.find('a').first().attr('href') || '';
            const image = card.find('img').first().attr('src') || card.find('img').first().attr('data-src') || '';
            const location = card.find('.location, [class*="location"], .area').first().text().trim();

            if (!title || title.length < 3) return;

            const price = parseAutolankaPrice(priceText);
            if (price && price > maxPriceLkr) return;

            const yearMatch = title.match(/20\d{2}|19\d{2}/);
            const mileageMatch = (card.text() || '').match(/([\d,]+)\s*km/i);

            pageListings.push({
                id: `autolanka-${title.toLowerCase().replace(/\s+/g, '-').substring(0, 50)}-${price || 'np'}`,
                source: 'autolanka',
                source_type: 'market',
                url: link ? new URL(link, BASE_URL).href : usedUrl,
                title,
                price_lkr: price,
                price_raw: priceText || null,
                year: yearMatch ? parseInt(yearMatch[0]) : null,
                mileage_km: mileageMatch ? parseInt(mileageMatch[1].replace(/,/g, '')) : null,
                location: location || 'Sri Lanka',
                condition: null,
                images: image ? [new URL(image, BASE_URL).href] : [],
                scraped_at: new Date().toISOString(),
            });
        });

        log.info(`AutoLanka page ${page}: ${pageListings.length} listings`);
        listings.push(...pageListings);

        if (pageListings.length === 0 && page > 1) break;
        await new Promise(r => setTimeout(r, 2000));
    }

    return listings;
}

function parseAutolankaPrice(raw) {
    if (!raw) return null;
    const text = raw.replace(/,/g, '').trim();
    const millionMatch = text.match(/([\d.]+)\s*M(?:illion)?/i);
    if (millionMatch) return Math.round(parseFloat(millionMatch[1]) * 1_000_000);
    const numMatch = text.match(/([\d]+(?:\.\d+)?)/);
    if (numMatch) {
        const val = parseFloat(numMatch[1]);
        if (val > 100_000) return Math.round(val);
    }
    return null;
}
