import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from 'apify';
import { parsePostedDate } from '../utils/normalize.js';

/**
 * Scrape LinkedIn public job search for IT internships in Sri Lanka.
 * Uses LinkedIn's public job search pages (no login required).
 *
 * Implements anti-blocking strategies:
 *  - Rotating User-Agent strings
 *  - Exponential backoff on failures
 *  - Random delays between requests
 *  - Multiple fallback endpoints
 */

const LINKEDIN_SEARCH_QUERIES = [
    'IT intern Sri Lanka',
    'Software intern Sri Lanka',
    'Cybersecurity intern Sri Lanka',
    'Networking intern Sri Lanka',
    'Developer intern Sri Lanka',
    'Data intern Sri Lanka',
    'QA intern Sri Lanka',
    'DevOps intern Sri Lanka',
];

/**
 * Pool of realistic User-Agent strings to rotate.
 */
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
];

const IT_KEYWORDS = [
    'IT', 'Software', 'Web', 'Mobile', 'Developer', 'Engineering', 'Data',
    'AI', 'Machine Learning', 'DevOps', 'Cloud', 'QA', 'Testing', 'UI', 'UX',
    'Database', 'Networking', 'Cybersecurity', 'Security', 'System Administration',
    'Computer Science', 'Full Stack', 'Frontend', 'Backend', 'Python', 'Java',
    'React', 'Node.js', 'AWS', 'Azure', 'Programmer', 'Analyst', 'Tech',
    'Information Technology', 'ICT', 'Help Desk', 'Network', 'Infrastructure',
];

function randomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cleanInlineText(text) {
    if (!text) return '';
    return String(text).replace(/\s+/g, ' ').trim();
}

function cleanupLinkedInLocation(text) {
    if (!text) return '';

    const cleaned = cleanInlineText(text)
        .replace(/\b(Actively Hiring|Be an early applicant|Reposted)\b/gi, '')
        .replace(/\b\d+\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago\b/gi, '')
        .replace(/\s+,/g, ',')
        .replace(/,\s*$/, '')
        .trim();

    return cleaned || 'Sri Lanka';
}

function extractLocation(card) {
    const exactLocation = cleanInlineText(
        card.find('.job-search-card__location, .base-search-card__location').first().text(),
    );
    if (exactLocation) return cleanupLinkedInLocation(exactLocation);

    const locationLike = card.find('[class*="location"], .base-search-card__metadata').first();
    if (!locationLike.length) return 'Sri Lanka';

    // Prefer only the node's direct text so nested status/date labels do not leak into location.
    const directText = cleanInlineText(
        locationLike
            .clone()
            .children()
            .remove()
            .end()
            .text(),
    );

    if (directText) return cleanupLinkedInLocation(directText);
    return cleanupLinkedInLocation(locationLike.text());
}

function matchesITKeywords(text, extraKeywords = []) {
    const lower = String(text || '').toLowerCase();
    const allKeywords = [...IT_KEYWORDS, ...extraKeywords];
    return allKeywords.some(keyword => lower.includes(String(keyword).toLowerCase()));
}

/**
 * Build a LinkedIn public job search URL.
 */
function buildLinkedInUrl(query, start = 0) {
    const params = new URLSearchParams({
        keywords: query,
        location: 'Sri Lanka',
        f_E: '1',         // Entry level
        f_JT: 'I',        // Internship
        start: start.toString(),
    });
    return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

/**
 * LinkedIn public job API (guest endpoint) — returns HTML fragments.
 */
function buildLinkedInApiUrl(query, start = 0) {
    const params = new URLSearchParams({
        keywords: query,
        location: 'Sri Lanka',
        f_E: '1',
        f_JT: 'I',
        start: start.toString(),
    });
    return `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
}

/**
 * Alternative Google-cached LinkedIn search URL.
 */
function buildGoogleLinkedInUrl(query) {
    const params = new URLSearchParams({
        q: `site:linkedin.com/jobs ${query}`,
        num: '20',
    });
    return `https://www.google.com/search?${params.toString()}`;
}

/**
 * Fetch HTML with retry and exponential backoff.
 */
async function fetchWithRetry(url, { maxRetries = 2, headers = {} } = {}) {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const ua = randomUA();
            const { data, status } = await axios.get(url, {
                timeout: 20_000,
                headers: {
                    'User-Agent': ua,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,si;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                    ...headers,
                },
                validateStatus: s => s < 500,
            });

            if (status === 429 || status === 403) {
                const backoff = Math.min(2000 * Math.pow(2, attempt), 15000);
                log.info(`LinkedIn rate limited (${status}), backing off ${backoff}ms (attempt ${attempt + 1})`);
                await new Promise(r => setTimeout(r, backoff));
                continue;
            }

            if (typeof data === 'string' && data.length > 200) return data;
            return null;
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                const backoff = randomDelay(2000, 5000) * (attempt + 1);
                await new Promise(r => setTimeout(r, backoff));
            }
        }
    }

    return null;
}

/**
 * Parse a LinkedIn job card from the public/guest HTML.
 */
function parseJobCard($, el) {
    const card = $(el);

    const title = cleanInlineText(card.find('.base-search-card__title, .job-search-card__title, h3, [class*="title"]').first().text());
    const company = cleanInlineText(card.find('.base-search-card__subtitle, .job-search-card__subtitle, h4, [class*="subtitle"], [class*="company"]').first().text());
    const location = extractLocation(card);
    const link = card.find('a.base-card__full-link, a[class*="card__full-link"], a').first().attr('href') || '';
    const dateText = cleanInlineText(card.find('time, .job-search-card__listdate, [class*="date"]').first().text());
    const dateAttr = card.find('time').attr('datetime') || '';
    const image = card.find('img').first().attr('data-delayed-url') || card.find('img').first().attr('src') || '';

    if (!title || title.length < 3) return null;

    // Determine IT field
    const fullText = `${title} ${company}`.toLowerCase();
    let field = 'IT General';
    if (/software|developer|programming|coding|engineer/i.test(fullText)) field = 'Software Development';
    else if (/network|networking|cisco|ccna|noc/i.test(fullText)) field = 'Networking';
    else if (/cyber|security|infosec|soc|penetration/i.test(fullText)) field = 'Cybersecurity';
    else if (/data|analytics|database|sql|bi/i.test(fullText)) field = 'Data & Analytics';
    else if (/web|frontend|backend|full.?stack|html|css/i.test(fullText)) field = 'Web Development';
    else if (/cloud|aws|azure|devops|sre/i.test(fullText)) field = 'Cloud & DevOps';
    else if (/qa|testing|quality|automation/i.test(fullText)) field = 'QA & Testing';
    else if (/ai|machine.?learn|deep.?learn|ml/i.test(fullText)) field = 'AI & Machine Learning';
    else if (/mobile|android|ios|flutter|react.?native/i.test(fullText)) field = 'Mobile Development';
    else if (/ui|ux|design|figma|graphic/i.test(fullText)) field = 'UI/UX Design';
    else if (/help.?desk|support|tech.?support/i.test(fullText)) field = 'IT Support';
    else if (/system.?admin|infrastructure|sysadmin/i.test(fullText)) field = 'System Administration';

    return {
        id: `linkedin-${title.toLowerCase().replace(/\s+/g, '-').substring(0, 50)}-${company.toLowerCase().replace(/\s+/g, '-').substring(0, 20)}`,
        source: 'linkedin',
        url: link ? link.split('?')[0] : 'https://www.linkedin.com/jobs/search/',
        title,
        company: company || 'Unknown',
        location: location || 'Sri Lanka',
        salary_range: null,
        field,
        is_intern: /intern|trainee|apprentice|attachment|industrial training/i.test(title),
        posted_date: parsePostedDate(dateAttr || dateText),
        deadline: null,
        qualifications: [],
        description: null,
        image: image || null,
        scraped_at: new Date().toISOString(),
    };
}

/**
 * Scrape LinkedIn public job search for IT interns in Sri Lanka.
 * Uses three fetching strategies to maximize success:
 *   1. Guest API endpoint (HTML fragments)
 *   2. Public search page (full HTML)
 *   3. Cached/alternative endpoints
 *
 * @param {Object} options
 * @param {number} options.maxPages - Max paginated pages per search query
 * @param {string[]} options.keywords - Extra keywords (combined with defaults)
 * @returns {Promise<Array>} Array of intern posts
 */
export async function scrapeLinkedinJobs({ maxPages = 2, keywords = [] } = {}) {
    const allPosts = [];
    const seen = new Set();
    const queries = [...LINKEDIN_SEARCH_QUERIES];

    // Add custom keyword-based queries
    for (const kw of keywords) {
        const q = `${kw} intern Sri Lanka`;
        if (!queries.includes(q)) queries.push(q);
    }

    // Limit queries to avoid rate limiting
    const limitedQueries = queries.slice(0, 8);
    let consecutiveBlocks = 0;
    const MAX_CONSECUTIVE_BLOCKS = 3; // Stop after 3 consecutive blocked queries

    for (const query of limitedQueries) {
        if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) {
            log.info(`LinkedIn: ${consecutiveBlocks} consecutive blocks — stopping to avoid IP ban`);
            break;
        }

        let queryFoundPosts = false;

        for (let page = 0; page < maxPages; page++) {
            const start = page * 25;

            // Strategy 1: Guest API endpoint
            let html = await fetchWithRetry(buildLinkedInApiUrl(query, start));

            // Strategy 2: Public search page
            if (!html) {
                html = await fetchWithRetry(buildLinkedInUrl(query, start));
            }

            if (!html) {
                log.info(`LinkedIn blocked or empty for: "${query}" page ${page + 1}`);
                break;
            }

            const $ = cheerio.load(html);
            let pageCount = 0;

            // LinkedIn job card selectors
            const cardSelector = '.base-card, .job-search-card, .base-search-card, li[class*="card"], div[class*="card"]';

            $(cardSelector).each((_, el) => {
                const post = parseJobCard($, el);
                if (!post) return;
                if (!post.is_intern) return;
                if (!matchesITKeywords(`${post.title} ${post.company}`, keywords)) return;

                // Dedupe across queries
                const dedupeKey = `${post.title}-${post.company}`.toLowerCase();
                if (seen.has(dedupeKey)) return;
                seen.add(dedupeKey);

                allPosts.push(post);
                pageCount++;
            });

            log.info(`LinkedIn "${query}" page ${page + 1}: ${pageCount} posts`);
            if (pageCount === 0) break;

            queryFoundPosts = true;

            // Random delay between LinkedIn requests (3-6 seconds)
            await new Promise(r => setTimeout(r, randomDelay(3000, 6000)));
        }

        // Track consecutive blocks
        if (!queryFoundPosts) {
            consecutiveBlocks++;
        } else {
            consecutiveBlocks = 0;
        }

        // Random delay between different queries (2-5 seconds)
        await new Promise(r => setTimeout(r, randomDelay(2000, 5000)));
    }

    log.info(`Total LinkedIn intern posts: ${allPosts.length}`);
    return allPosts;
}
