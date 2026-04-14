import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from 'apify';
import { normalizeListing } from '../utils/normalize.js';

const PATPAT_BASE_URL = 'https://patpat.lk/en/sri-lanka/vehicle/car';
const PATPAT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
};

export async function scrapePatpat({ maxPages = 10, maxPriceLkr = 30000000 } = {}) {
    const listings = [];
    const seenUrls = new Set();

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        try {
            const { data: html } = await axios.get(buildPageUrl({ maxPriceLkr, pageNumber }), {
                headers: PATPAT_HEADERS,
                timeout: 30000,
                validateStatus: (status) => status < 500,
            });

            const rawListings = extractListingsFromHtml(html);
            log.info(`patpat page ${pageNumber}: ${rawListings.length} ads`);
            if (rawListings.length === 0) break;

            for (const raw of rawListings) {
                if (seenUrls.has(raw.url)) continue;
                seenUrls.add(raw.url);

                const normalized = normalizeListing({
                    source: 'patpat',
                    url: raw.url,
                    title: raw.title,
                    price_raw: raw.price_raw,
                    year: raw.year,
                    mileage_raw: raw.mileage_raw,
                    location: raw.location,
                    images: raw.images,
                    posted_raw: null,
                    raw_text: raw.raw_text,
                });

                if (normalized) listings.push(normalized);
            }
        } catch (err) {
            log.error(`patpat scraper error on page ${pageNumber}`, { error: err.message });
            throw err;
        }
    }

    return listings;
}

function buildPageUrl({ maxPriceLkr, pageNumber }) {
    const url = new URL(PATPAT_BASE_URL);
    url.searchParams.set('max-price', String(maxPriceLkr));
    if (pageNumber > 1) {
        url.searchParams.set('page', String(pageNumber));
    }
    return url.toString();
}

function extractListingsFromHtml(html) {
    const $ = cheerio.load(html);
    const results = [];
    const pageSeen = new Set();

    $('a[href*="/en/ad/vehicle/"], a[href*="/ad/vehicle/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        const absoluteUrl = href.startsWith('http') ? href : `https://patpat.lk${href}`;
        if (pageSeen.has(absoluteUrl)) return;
        pageSeen.add(absoluteUrl);

        let $card = $(el);
        for (let i = 0; i < 5; i++) {
            if (/(?:Rs\.?|LKR)/i.test($card.text())) break;
            const parent = $card.parent();
            if (!parent.length) break;
            $card = parent;
        }

        const text = $card.text().replace(/\s+/g, ' ').trim();
        if (!text || !/(?:Rs\.?|LKR)/i.test(text)) return;

        const title = $card.find('h1, h2, h3, [class*="title"], [class*="Title"]').first().text().trim()
            || $(el).text().trim()
            || text.split(/(?:Rs[:.]?|LKR)/i)[0].trim()
            || 'Car listing';

        results.push({
            url: absoluteUrl,
            title,
            price_raw: extractFirst(text, /(?:Rs[:.]?|LKR)\s*([\d,]+)/i),
            mileage_raw: extractFirst(text, /([\d,]+)\s*km/i),
            year: parseYear(text),
            location: extractFirst(text, /(Colombo|Gampaha|Kandy|Galle|Matara|Kurunegala|Jaffna|Dehiwala|Matale|Kalutara|Negombo|Ratnapura|Anuradhapura|Badulla|Batticaloa|Trincomalee|Hambantota|Puttalam|Kegalle)[^\n]*/i),
            images: $card.find('img').first().attr('src') ? [$card.find('img').first().attr('src')] : [],
            raw_text: text.substring(0, 500),
        });
    });
    return results;
}

function extractFirst(text, regex) {
    const match = text.match(regex);
    return match ? match[1] || match[0] : null;
}

function parseYear(text) {
    const match = text.match(/\b((?:19|20)\d{2})\b/);
    return match ? parseInt(match[1], 10) : null;
}
