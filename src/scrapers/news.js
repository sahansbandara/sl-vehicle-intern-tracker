import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from 'apify';

/**
 * Config-driven news scraper for 7 Sri Lanka vehicle news/update sites.
 * Monitors for price changes, tax changes, import rule updates, and market moves.
 */

const NEWS_SOURCES = [
    {
        name: 'VIASL',
        label: 'Vehicle Importers Association',
        urls: [
            'https://www.viasl.lk/news',
            'https://www.viasl.lk/updates',
            'https://www.viasl.lk/',
        ],
        keywords: ['vehicle', 'import', 'price', 'tax', 'duty', 'customs', 'regulation', 'SSCL', 'automobile', 'car'],
    },
    {
        name: 'Motorguide',
        label: 'Motorguide.lk',
        urls: [
            'https://www.motorguide.lk/news',
            'https://www.motorguide.lk/articles',
            'https://www.motorguide.lk/blog',
            'https://www.motorguide.lk/',
        ],
        keywords: ['price', 'review', 'launch', 'new', 'update', 'market', 'cost', 'budget', 'affordable'],
    },
    {
        name: 'Newswire',
        label: 'Newswire.lk',
        urls: [
            'https://www.newswire.lk/category/automobile',
            'https://www.newswire.lk/category/business',
            'https://www.newswire.lk/tag/vehicle',
            'https://www.newswire.lk/',
        ],
        keywords: ['vehicle', 'car', 'import', 'tax', 'duty', 'price', 'automobile', 'VIASL', 'customs'],
    },
    {
        name: 'DailyMirror',
        label: 'Daily Mirror Sri Lanka',
        urls: [
            'https://www.dailymirror.lk/business-news/116',
            'https://www.dailymirror.lk/top-story/155',
            'https://www.dailymirror.lk/',
        ],
        keywords: ['vehicle', 'car', 'import', 'tax', 'duty', 'price', 'automobile', 'customs', 'motor'],
    },
    {
        name: 'AdaDerana',
        label: 'Ada Derana',
        urls: [
            'https://www.adaderana.lk/business',
            'https://www.adaderana.lk/hot-news',
            'https://www.adaderana.lk/',
        ],
        keywords: ['vehicle', 'car', 'import', 'tax', 'duty', 'price', 'automobile', 'customs', 'motor'],
    },
    {
        name: 'EconomyNext',
        label: 'EconomyNext',
        urls: [
            'https://economynext.com/category/business',
            'https://economynext.com/category/sri-lanka',
            'https://economynext.com/',
        ],
        keywords: ['vehicle', 'car', 'import', 'tax', 'duty', 'customs', 'automobile', 'motor', 'price'],
    },
    {
        name: 'AutoLankaNews',
        label: 'AutoLanka News',
        urls: [
            'https://www.autolanka.com/news',
            'https://www.autolanka.com/articles',
            'https://www.autolanka.com/forum',
            'https://www.autolanka.com/',
        ],
        keywords: ['price', 'new', 'launch', 'update', 'market', 'tax', 'import', 'duty', 'review'],
    },
];

/**
 * Check if an article title/text matches vehicle-related keywords.
 */
function matchesVehicleKeywords(text, sourceKeywords) {
    const lower = text.toLowerCase();
    return sourceKeywords.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Categorize the news article for hashtag tagging.
 */
function categorizeArticle(text) {
    const lower = text.toLowerCase();
    if (/tax|duty|customs|sscl|excise|levy|tariff/.test(lower)) return 'taxupdate';
    if (/price\s*(change|increas|decreas|drop|rise|hike|cut|reduc)/.test(lower)) return 'pricechange';
    if (/launch|new\s*model|unveil|introduc/.test(lower)) return 'newlaunch';
    if (/import\s*(ban|restrict|rule|regulation|policy)/.test(lower)) return 'importrule';
    if (/ev|electric\s*vehicle|hybrid|battery/.test(lower)) return 'ev';
    return 'marketupdate';
}

/**
 * Try fetching from multiple URL candidates.
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
 * Extract articles from a page.
 */
function extractArticles($, source, baseUrl) {
    const articles = [];
    const seen = new Set();

    // Generic article selectors
    const articleSelector = 'article, .article, .news-item, .post, .story, .entry, .blog-post, .news-card, .list-item, [class*="article"], [class*="news"], [class*="story"], [class*="post"]';

    $(articleSelector).each((_, el) => {
        const card = $(el);
        const titleEl = card.find('h1, h2, h3, h4, a.title, .headline, .post-title, [class*="title"], [class*="headline"]').first();
        const title = titleEl.text().trim();
        const link = titleEl.find('a').attr('href') || titleEl.attr('href') || card.find('a').first().attr('href') || '';
        const summary = card.find('p, .excerpt, .summary, .description, [class*="excerpt"], [class*="summary"]').first().text().trim();
        const dateText = card.find('time, .date, .published, [class*="date"], [class*="time"], [datetime]').first().text().trim();
        const image = card.find('img').first().attr('src') || card.find('img').first().attr('data-src') || '';

        if (!title || title.length < 10 || title.length > 300) return;

        // Check relevance
        const fullText = `${title} ${summary}`;
        if (!matchesVehicleKeywords(fullText, source.keywords)) return;

        // Dedupe within source
        const dedupeKey = title.toLowerCase().substring(0, 60);
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const category = categorizeArticle(fullText);
        const fullUrl = link ? new URL(link, baseUrl).href : baseUrl;

        articles.push({
            id: `news-${source.name.toLowerCase()}-${dedupeKey.replace(/\s+/g, '-').substring(0, 40)}`,
            source: source.name,
            source_label: source.label,
            source_type: 'news',
            url: fullUrl,
            title,
            summary: summary.substring(0, 300) || null,
            date: dateText || null,
            category,
            image: image ? new URL(image, baseUrl).href : null,
            scraped_at: new Date().toISOString(),
        });
    });

    // Fallback: scan <a> tags with vehicle keywords for news sites with unusual layouts
    if (articles.length === 0) {
        $('a').each((_, el) => {
            const $a = $(el);
            const title = $a.text().trim();
            const href = $a.attr('href') || '';

            if (!title || title.length < 15 || title.length > 200) return;
            if (!matchesVehicleKeywords(title, source.keywords)) return;

            const dedupeKey = title.toLowerCase().substring(0, 60);
            if (seen.has(dedupeKey)) return;
            seen.add(dedupeKey);

            articles.push({
                id: `news-${source.name.toLowerCase()}-${dedupeKey.replace(/\s+/g, '-').substring(0, 40)}`,
                source: source.name,
                source_label: source.label,
                source_type: 'news',
                url: href ? new URL(href, baseUrl).href : baseUrl,
                title,
                summary: null,
                date: null,
                category: categorizeArticle(title),
                image: null,
                scraped_at: new Date().toISOString(),
            });
        });
    }

    return articles;
}

/**
 * Scrape all configured news sources for vehicle-related articles.
 * @returns {Promise<Array>} Array of news articles
 */
export async function scrapeNews() {
    const allArticles = [];
    const report = {};

    for (const source of NEWS_SOURCES) {
        try {
            log.info(`Scraping news: ${source.label}`);
            const result = await fetchFirstAvailable(source.urls);

            if (!result) {
                log.warning(`${source.label}: All URLs failed`);
                report[source.name] = 'ALL_URLS_FAILED';
                continue;
            }

            const $ = cheerio.load(result.html);
            const articles = extractArticles($, source, result.baseUrl);

            report[source.name] = articles.length;
            allArticles.push(...articles);
            log.info(`${source.label}: ${articles.length} vehicle-related articles`);

            // Gentle delay between sites (1.5s)
            await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
            log.error(`${source.label} news scraper failed`, { error: err.message });
            report[source.name] = `ERROR: ${err.message}`;
        }
    }

    log.info(`Total news articles: ${allArticles.length}`, { report });
    return allArticles;
}

export { NEWS_SOURCES };
