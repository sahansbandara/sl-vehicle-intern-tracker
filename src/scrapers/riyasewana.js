import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from 'apify';
import { normalizeListing } from '../utils/normalize.js';

const RIYASEWANA_URL = 'https://riyasewana.com/search/cars';

export async function scrapeRiyasewana() {
    const listings = [];

    try {
        const { data: html } = await axios.get(RIYASEWANA_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 30000,
            validateStatus: s => s < 500,
        });

        const $ = cheerio.load(html);

        // riyasewana uses <li class="item round"> or similar for listing cards.
        // Fallback strategies: look for any anchor leading to a vehicle detail page.
        const cards = $('li.item, .item.round, div.item, ul.list li').toArray();

        let parsed = [];

        if (cards.length > 0) {
            for (const el of cards) {
                const $el = $(el);
                const link = $el.find('a[href*="riyasewana.com"]').first().attr('href')
                          || $el.find('h2 a, h3 a').first().attr('href');
                if (!link) continue;

                const title = $el.find('h2.more a, h2 a, h3 a').first().text().trim()
                           || $el.find('a').first().text().trim();
                const text = $el.text();

                const priceMatch = text.match(/Rs\.?\s*([\d,]+)/i);
                const price = priceMatch ? priceMatch[1] : null;

                const mileageMatch = text.match(/([\d,]+)\s*km/i);
                const mileage = mileageMatch ? mileageMatch[1] : null;

                const yearMatch = text.match(/\b((?:19|20)\d{2})\b/);
                const year = yearMatch ? parseInt(yearMatch[1]) : null;

                const locMatch = text.match(/(Colombo|Gampaha|Kandy|Galle|Matara|Kurunegala|Jaffna|Anuradhapura|Ratnapura|Kalutara|Negombo|Dehiwala|Matale|Nuwara[- ]?Eliya|Badulla|Batticaloa|Trincomalee|Hambantota|Polonnaruwa|Puttalam|Kegalle|Vavuniya|Mannar|Kilinochchi|Mullaitivu|Ampara|Monaragala)[^\n]*/i);
                const location = locMatch ? locMatch[0].trim() : null;

                const img = $el.find('img').first().attr('src') || null;

                // Date: riyasewana shows dates like "Apr 3" or ISO
                const dateMatch = text.match(/([A-Z][a-z]{2}\s+\d{1,2}|\d+\s*(?:hour|day|week)s?\s*ago)/);
                const posted = dateMatch ? dateMatch[0] : null;

                if (title || price) {
                    parsed.push({
                        url: link.startsWith('http') ? link : `https://riyasewana.com${link}`,
                    title: title || 'Car listing',
                        price_raw: price,
                        mileage_raw: mileage,
                        year,
                        location,
                        image: img,
                        posted_raw: posted,
                        raw_text: text.substring(0, 500),
                    });
                }
            }
        }

        // Fallback: if no cards matched, scan anchors that still look like vehicle detail links
        if (parsed.length === 0) {
            log.warning('riyasewana: primary selector matched 0, falling back to anchor scan');
            $('a').each((_, el) => {
                const $a = $(el);
                const href = $a.attr('href');
                if (!href || !/(car|vehicle|sale|buy)/i.test(href)) return;
                const parentText = $a.closest('li, div, tr').text();
                const priceMatch = parentText.match(/Rs\.?\s*([\d,]+)/i);
                if (!priceMatch) return;

                parsed.push({
                    url: href.startsWith('http') ? href : `https://riyasewana.com${href}`,
                    title: $a.text().trim() || 'Car listing',
                    price_raw: priceMatch[1],
                    mileage_raw: (parentText.match(/([\d,]+)\s*km/i) || [])[1] || null,
                    year: parseInt((parentText.match(/\b((?:19|20)\d{2})\b/) || [])[1]) || null,
                    location: (parentText.match(/(Colombo|Gampaha|Kandy|Galle|Matara|Kurunegala|Jaffna|Dehiwala|Matale|Kalutara|Negombo)[^\n]*/i) || [])[0] || null,
                    image: null,
                    posted_raw: null,
                    raw_text: parentText.substring(0, 500),
                });
            });
        }

        log.info(`riyasewana raw extracted: ${parsed.length}`);

        for (const raw of parsed) {
            const normalized = normalizeListing({
                source: 'riyasewana',
                url: raw.url,
                title: raw.title,
                price_raw: raw.price_raw,
                year: raw.year,
                mileage_raw: raw.mileage_raw,
                location: raw.location,
                images: raw.image ? [raw.image] : [],
                posted_raw: raw.posted_raw,
                raw_text: raw.raw_text,
            });
            if (normalized) listings.push(normalized);
        }
    } catch (err) {
        log.error('riyasewana scraper error', { error: err.message });
        throw err;
    }

    return listings;
}
