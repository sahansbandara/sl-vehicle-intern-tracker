import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from 'apify';

/**
 * Config-driven scraper for official Sri Lanka dealer sites.
 * Each brand is a config entry — one factory serves all 11 brands.
 */

const DEALER_CONFIGS = [
    {
        brand: 'MG',
        name: 'MG Sri Lanka',
        urls: [
            'https://www.mgmotor.lk/models',
            'https://www.mgmotor.lk/vehicles',
            'https://www.mgcars.lk/models',
        ],
        selectors: {
            modelCard: '.model-card, .vehicle-card, .car-item, .product-card, article.model, .car-card, [class*="model"], [class*="vehicle"]',
            modelName: 'h2, h3, h4, .model-name, .title, .car-name, .vehicle-name, [class*="name"], [class*="title"]',
            price: '.price, .starting-price, .model-price, [class*="price"], .amount, .value',
            image: 'img',
            link: 'a',
        },
    },
    {
        brand: 'BYD',
        name: 'BYD Sri Lanka / John Keells',
        urls: [
            'https://www.byd.lk/models',
            'https://www.byd.lk/vehicles',
            'https://byd.johnkeellscg.com/models',
        ],
        selectors: {
            modelCard: '.model-card, .vehicle-card, .car-item, .product-card, article, .car-card, [class*="model"], [class*="vehicle"]',
            modelName: 'h2, h3, h4, .model-name, .title, .car-name, [class*="name"], [class*="title"]',
            price: '.price, .starting-price, [class*="price"], .amount',
            image: 'img',
            link: 'a',
        },
    },
    {
        brand: 'Toyota',
        name: 'Toyota Lanka',
        urls: [
            'https://www.toyota.lk/vehicles',
            'https://www.toyota.lk/models',
            'https://www.toyotalanka.com/vehicles',
        ],
        selectors: {
            modelCard: '.vehicle-card, .model-card, .car-item, article, .product-item, [class*="vehicle"], [class*="model"]',
            modelName: 'h2, h3, h4, .vehicle-name, .model-name, .title, [class*="name"], [class*="title"]',
            price: '.price, .vehicle-price, [class*="price"], .amount',
            image: 'img',
            link: 'a',
        },
    },
    {
        brand: 'Hyundai',
        name: 'Hyundai Abans Sri Lanka',
        urls: [
            'https://www.hyundai.lk/models',
            'https://www.hyundai.lk/vehicles',
            'https://www.abans.com/hyundai',
        ],
        selectors: {
            modelCard: '.model-card, .vehicle-card, .car-item, article, [class*="model"], [class*="vehicle"]',
            modelName: 'h2, h3, h4, .model-name, .title, [class*="name"], [class*="title"]',
            price: '.price, [class*="price"], .amount',
            image: 'img',
            link: 'a',
        },
    },
    {
        brand: 'Suzuki',
        name: 'Suzuki Sri Lanka',
        urls: [
            'https://www.suzuki.lk/automobiles',
            'https://www.suzuki.lk/models',
            'https://www.suzuki.lk/cars',
        ],
        selectors: {
            modelCard: '.model-card, .vehicle-card, .car-item, article, [class*="model"], [class*="automobile"]',
            modelName: 'h2, h3, h4, .model-name, .title, [class*="name"], [class*="title"]',
            price: '.price, [class*="price"], .amount',
            image: 'img',
            link: 'a',
        },
    },
    {
        brand: 'Kia',
        name: 'Kia Sri Lanka',
        urls: [
            'https://www.kia.lk/models',
            'https://www.kia.lk/vehicles',
            'https://www.kia.com/lk/models',
        ],
        selectors: {
            modelCard: '.model-card, .vehicle-card, .car-item, article, [class*="model"], [class*="vehicle"]',
            modelName: 'h2, h3, h4, .model-name, .title, [class*="name"], [class*="title"]',
            price: '.price, [class*="price"], .amount',
            image: 'img',
            link: 'a',
        },
    },
    {
        brand: 'Nissan',
        name: 'Nissan Sri Lanka',
        urls: [
            'https://www.nissan.lk/vehicles',
            'https://www.nissan.lk/models',
            'https://www.nissan.lk/range.html',
        ],
        selectors: {
            modelCard: '.vehicle-card, .model-card, .car-item, article, [class*="model"], [class*="vehicle"]',
            modelName: 'h2, h3, h4, .vehicle-name, .title, [class*="name"], [class*="title"]',
            price: '.price, [class*="price"], .amount',
            image: 'img',
            link: 'a',
        },
    },
    {
        brand: 'Tata',
        name: 'Tata Motors Sri Lanka',
        urls: [
            'https://www.tatamotors.lk/vehicles',
            'https://www.tatamotors.lk/passenger-vehicles',
            'https://www.tatamotors.com/lk/vehicles',
        ],
        selectors: {
            modelCard: '.vehicle-card, .model-card, .car-item, article, [class*="model"], [class*="vehicle"]',
            modelName: 'h2, h3, h4, .vehicle-name, .title, [class*="name"], [class*="title"]',
            price: '.price, [class*="price"], .amount',
            image: 'img',
            link: 'a',
        },
    },
    {
        brand: 'DIMO',
        name: 'DIMO Passenger Vehicles',
        urls: [
            'https://www.dimo.lk/passenger-vehicles',
            'https://www.dimo.lk/vehicles',
            'https://www.dimolanka.com/vehicles',
        ],
        selectors: {
            modelCard: '.vehicle-card, .model-card, .car-item, article, .product-card, [class*="vehicle"], [class*="product"]',
            modelName: 'h2, h3, h4, .vehicle-name, .title, [class*="name"], [class*="title"]',
            price: '.price, [class*="price"], .amount',
            image: 'img',
            link: 'a',
        },
    },
    {
        brand: 'United Motors',
        name: 'United Motors Lanka',
        urls: [
            'https://www.unitedmotors.lk/vehicles',
            'https://www.unitedmotors.lk/models',
            'https://www.unitedmotors.lk/',
        ],
        selectors: {
            modelCard: '.vehicle-card, .model-card, .car-item, article, .product-card, [class*="vehicle"], [class*="model"]',
            modelName: 'h2, h3, h4, .vehicle-name, .title, [class*="name"], [class*="title"]',
            price: '.price, [class*="price"], .amount',
            image: 'img',
            link: 'a',
        },
    },
    {
        brand: 'BAIC',
        name: 'BAIC Sri Lanka',
        urls: [
            'https://www.baic.lk/models',
            'https://www.baic.lk/vehicles',
            'https://www.baic.lk/',
        ],
        selectors: {
            modelCard: '.vehicle-card, .model-card, .car-item, article, .product-card, [class*="vehicle"], [class*="model"]',
            modelName: 'h2, h3, h4, .vehicle-name, .title, [class*="name"], [class*="title"]',
            price: '.price, [class*="price"], .amount',
            image: 'img',
            link: 'a',
        },
    },
];

/**
 * Parse a Sri Lankan price string into LKR number.
 * Handles: "Rs 12,385,000", "LKR 12.385M", "Rs. 12.385 Million", "12385000"
 */
function parsePriceLKR(raw) {
    if (!raw) return null;
    const text = raw.replace(/,/g, '').trim();

    // "12.385M" or "12.385 Million"
    const millionMatch = text.match(/([\d.]+)\s*M(?:illion)?/i);
    if (millionMatch) return Math.round(parseFloat(millionMatch[1]) * 1_000_000);

    // Plain number: "12385000"
    const numMatch = text.match(/([\d,]+(?:\.\d+)?)/);
    if (numMatch) {
        const val = parseFloat(numMatch[1].replace(/,/g, ''));
        if (val > 10_000) return Math.round(val);
    }

    return null;
}

/**
 * Try to fetch a page from multiple URL candidates.
 * Returns { html, baseUrl } from the first one that succeeds.
 */
async function fetchFirstAvailable(urls) {
    for (const url of urls) {
        try {
            const { data } = await axios.get(url, {
                timeout: 15_000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
            });
            if (typeof data === 'string' && data.length > 500) {
                return { html: data, baseUrl: url };
            }
        } catch {
            // Try next URL
        }
    }
    return null;
}

/**
 * Extract model listings from a dealer page.
 */
function extractModels($, config, baseUrl) {
    const listings = [];
    const sel = config.selectors;

    // Strategy 1: Try config selectors for model cards
    $(sel.modelCard).each((_, el) => {
        const card = $(el);
        const nameEl = card.find(sel.modelName).first();
        const priceEl = card.find(sel.price).first();
        const imgEl = card.find(sel.image).first();
        const linkEl = card.find(sel.link).first();

        const name = nameEl.text().trim();
        const priceText = priceEl.text().trim();
        const price = parsePriceLKR(priceText);
        const image = imgEl.attr('src') || imgEl.attr('data-src') || '';
        const link = linkEl.attr('href') || '';

        if (name && name.length > 2 && name.length < 200) {
            listings.push({
                brand: config.brand,
                model: name,
                price_lkr: price,
                price_raw: priceText || null,
                image: image ? new URL(image, baseUrl).href : null,
                url: link ? new URL(link, baseUrl).href : baseUrl,
                source: config.name,
                source_type: 'official_dealer',
            });
        }
    });

    // Strategy 2: If no cards found, try scanning for price patterns in body text
    if (listings.length === 0) {
        const bodyText = $('body').text();
        const pricePattern = /(?:Rs\.?\s*|LKR\s*)([\d,.]+\s*(?:M(?:illion)?)?)/gi;
        let match;
        while ((match = pricePattern.exec(bodyText)) !== null) {
            const price = parsePriceLKR(match[0]);
            if (price && price >= 1_000_000 && price <= 200_000_000) {
                // Try to find nearby model name (20 chars before the price match)
                const contextStart = Math.max(0, match.index - 80);
                const context = bodyText.substring(contextStart, match.index).trim();
                const modelName = context.split(/[.\n\r]/).pop()?.trim() || `${config.brand} Model`;

                listings.push({
                    brand: config.brand,
                    model: modelName.substring(0, 100),
                    price_lkr: price,
                    price_raw: match[0],
                    image: null,
                    url: baseUrl,
                    source: config.name,
                    source_type: 'official_dealer',
                });
            }
        }
    }

    return listings;
}

/**
 * Scrape all configured official dealer sites.
 * @param {Object} options
 * @param {number} options.maxPriceLkr - Maximum price to include
 * @param {string[]} options.brandsEnabled - Which brands to scrape (empty = all)
 * @returns {Promise<Array>} Normalized dealer listings
 */
export async function scrapeDealers({ maxPriceLkr = 30_000_000, brandsEnabled = [] } = {}) {
    const configs = brandsEnabled.length > 0
        ? DEALER_CONFIGS.filter(c => brandsEnabled.includes(c.brand))
        : DEALER_CONFIGS;

    const allListings = [];
    const report = {};

    for (const config of configs) {
        try {
            log.info(`Scraping dealer: ${config.name}`);
            const result = await fetchFirstAvailable(config.urls);

            if (!result) {
                log.warning(`${config.name}: All URLs failed`);
                report[config.brand] = 'ALL_URLS_FAILED';
                continue;
            }

            const $ = cheerio.load(result.html);
            const models = extractModels($, config, result.baseUrl);

            // Filter by budget
            const withinBudget = models.filter(m =>
                !m.price_lkr || m.price_lkr <= maxPriceLkr
            );

            // Generate IDs
            for (const model of withinBudget) {
                model.id = `dealer-${config.brand.toLowerCase()}-${model.model.toLowerCase().replace(/\s+/g, '-').substring(0, 40)}`;
                model.scraped_at = new Date().toISOString();
            }

            report[config.brand] = withinBudget.length;
            allListings.push(...withinBudget);
            log.info(`${config.name}: ${withinBudget.length} models found`);

            // Gentle delay between sites (1.5s)
            await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
            log.error(`${config.name} scraper failed`, { error: err.message });
            report[config.brand] = `ERROR: ${err.message}`;
        }
    }

    log.info(`Total dealer listings: ${allListings.length}`, { report });
    return allListings;
}

export { DEALER_CONFIGS };
