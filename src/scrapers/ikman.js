import axios from 'axios';
import { log } from 'apify';
import { normalizeListing } from '../utils/normalize.js';

const IKMAN_BASE_URL = 'https://ikman.lk/en/ads/sri-lanka/cars?sort=date';
const IKMAN_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
};

export async function scrapeIkman({ maxPages = 10 } = {}) {
    const listings = [];
    const seenUrls = new Set();

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        try {
            const { data: html } = await axios.get(buildPageUrl(pageNumber), {
                headers: IKMAN_HEADERS,
                timeout: 30000,
                validateStatus: (status) => status < 500,
            });

            const ads = extractAdsFromHtml(html);
            log.info(`ikman page ${pageNumber}: ${ads.length} ads`);
            if (ads.length === 0) break;

            for (const raw of ads.map(mapAdToListing).filter(Boolean)) {
                if (seenUrls.has(raw.url)) continue;
                seenUrls.add(raw.url);

                const normalized = normalizeListing({
                    source: 'ikman',
                    url: raw.url,
                    title: raw.title,
                    price_raw: raw.price_raw,
                    year: raw.year,
                    mileage_raw: raw.mileage_raw,
                    location: raw.location,
                    images: raw.images,
                    posted_raw: raw.posted_raw,
                    raw_text: raw.raw_text,
                });

                if (normalized) listings.push(normalized);
            }
        } catch (err) {
            log.error(`ikman scraper error on page ${pageNumber}`, { error: err.message });
            throw err;
        }
    }

    return listings;
}

function buildPageUrl(pageNumber) {
    const url = new URL(IKMAN_BASE_URL);
    if (pageNumber > 1) {
        url.searchParams.set('page', String(pageNumber));
    }
    return url.toString();
}

function extractAdsFromHtml(html) {
    const marker = 'window.initialData = ';
    const start = html.indexOf(marker);
    if (start === -1) {
        log.warning('ikman: window.initialData not found');
        return [];
    }

    try {
        const scriptStart = start + marker.length;
        const scriptEnd = html.indexOf('</script>', scriptStart);
        if (scriptEnd === -1) {
            log.warning('ikman: initialData script end not found');
            return [];
        }

        const jsonText = html.slice(scriptStart, scriptEnd).trim();
        const data = JSON.parse(jsonText);
        return data?.serp?.ads?.data?.ads ?? [];
    } catch (err) {
        log.warning('ikman: failed to parse initialData JSON', { error: err.message });
        return [];
    }
}

function mapAdToListing(ad) {
    if (!ad?.slug || !ad?.price) return null;

    const rawText = [
        ad.title,
        ad.description,
        ad.details,
        ad.location,
        ad.shopName,
    ].filter(Boolean).join(' | ');

    return {
        url: `https://ikman.lk/en/ad/${ad.slug}`,
        title: ad.title || 'Car listing',
        price_raw: ad.price,
        year: parseYear(`${ad.title || ''} ${ad.description || ''}`),
        mileage_raw: ad.details || null,
        location: ad.location || null,
        images: ad.imgUrl ? [ad.imgUrl] : [],
        posted_raw: ad.lastBumpUpDate || ad.timeStamp || null,
        raw_text: rawText,
    };
}

function parseYear(text) {
    const match = text.match(/\b((?:19|20)\d{2})\b/);
    return match ? parseInt(match[1], 10) : null;
}
