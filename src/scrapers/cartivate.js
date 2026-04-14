import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from 'apify';

const BASE_URL = 'https://www.cartivatmotors.lk';

/**
 * Scrape Cartivate Motors for vehicle listings.
 * Dealer-owned inventory — Hyundai, Honda, Kia, etc.
 */
export async function scrapeCartivate({ maxPages = 5, maxPriceLkr = 30_000_000 } = {}) {
    const listings = [];

    const searchUrls = [
        `${BASE_URL}/vehicles`,
        `${BASE_URL}/inventory`,
        `${BASE_URL}/stock`,
        `${BASE_URL}/cars`,
        `${BASE_URL}/`,
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
            if (page === 1) log.warning('Cartivate: All base URLs failed');
            break;
        }

        const $ = cheerio.load(html);
        const pageListings = [];

        const cardSelector = '.vehicle-card, .car-card, .listing-card, .product-card, .inventory-item, article, .car-item, [class*="vehicle"], [class*="listing"], [class*="car-card"], [class*="product"]';

        $(cardSelector).each((_, el) => {
            const card = $(el);
            const title = card.find('h2, h3, h4, .title, .car-name, .vehicle-name, [class*="title"], [class*="name"]').first().text().trim();
            const priceText = card.find('.price, [class*="price"], .amount').first().text().trim();
            const link = card.find('a').first().attr('href') || '';
            const image = card.find('img').first().attr('src') || card.find('img').first().attr('data-src') || '';
            const location = card.find('.location, [class*="location"]').first().text().trim();
            const yearText = card.find('.year, [class*="year"]').first().text().trim();
            const mileageText = card.find('.mileage, [class*="mileage"], [class*="km"]').first().text().trim();

            if (!title || title.length < 3) return;

            const price = parseCartivatePrice(priceText);
            if (price && price > maxPriceLkr) return;

            const yearMatch = (yearText || title).match(/20\d{2}/);
            const mileageMatch = mileageText.match(/([\d,]+)\s*km/i);

            pageListings.push({
                id: `cartivate-${title.toLowerCase().replace(/\s+/g, '-').substring(0, 50)}-${price || 'np'}`,
                source: 'cartivate',
                source_type: 'market',
                url: link ? new URL(link, BASE_URL).href : usedUrl,
                title,
                price_lkr: price,
                price_raw: priceText || null,
                year: yearMatch ? parseInt(yearMatch[0]) : null,
                mileage_km: mileageMatch ? parseInt(mileageMatch[1].replace(/,/g, '')) : null,
                location: location || 'Sri Lanka',
                condition: 'Brand New',
                images: image ? [new URL(image, BASE_URL).href] : [],
                scraped_at: new Date().toISOString(),
            });
        });

        // Fallback: scan body text for price patterns
        if (page === 1 && pageListings.length === 0) {
            log.info('Cartivate: No cards found, scanning body text');
            const bodyText = $('body').text();
            const pricePattern = /(?:Rs\.?\s*|LKR\s*)([\d,.]+\s*(?:M(?:illion)?)?)/gi;
            let match;
            while ((match = pricePattern.exec(bodyText)) !== null) {
                const price = parseCartivatePrice(match[0]);
                if (price && price >= 1_000_000 && price <= maxPriceLkr) {
                    const contextStart = Math.max(0, match.index - 60);
                    const context = bodyText.substring(contextStart, match.index).trim();
                    const modelName = context.split(/[.\n\r,]/).pop()?.trim() || 'Cartivate Vehicle';

                    pageListings.push({
                        id: `cartivate-text-${modelName.substring(0, 30).toLowerCase().replace(/\s+/g, '-')}-${price}`,
                        source: 'cartivate',
                        source_type: 'market',
                        url: usedUrl,
                        title: modelName.substring(0, 100),
                        price_lkr: price,
                        price_raw: match[0],
                        year: null,
                        mileage_km: null,
                        location: 'Sri Lanka',
                        condition: null,
                        images: [],
                        scraped_at: new Date().toISOString(),
                    });
                }
            }
        }

        log.info(`Cartivate page ${page}: ${pageListings.length} listings`);
        listings.push(...pageListings);

        if (pageListings.length === 0 && page > 1) break;
        await new Promise(r => setTimeout(r, 2000));
    }

    return listings;
}

function parseCartivatePrice(raw) {
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
