import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from 'apify';

/**
 * Scrape LinkedIn public job search for IT internships in Sri Lanka.
 * Uses LinkedIn's public job search pages (no login required).
 *
 * NOTE: LinkedIn may throttle or block aggressive scraping.
 * This scraper uses gentle rate limiting and degrades gracefully.
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
 * Build a LinkedIn public job search URL.
 * LinkedIn's public search works without authentication.
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
 * Alternative: LinkedIn public job API (guest endpoint)
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
 * Parse a LinkedIn job card from the public/guest HTML.
 */
function parseJobCard($, el) {
    const card = $(el);

    // LinkedIn public job cards have specific class patterns
    const title = card.find('.base-search-card__title, .job-search-card__title, h3, [class*="title"]').first().text().trim();
    const company = card.find('.base-search-card__subtitle, .job-search-card__subtitle, h4, [class*="subtitle"], [class*="company"]').first().text().trim();
    const location = card.find('.job-search-card__location, .base-search-card__metadata, [class*="location"]').first().text().trim();
    const link = card.find('a.base-card__full-link, a[class*="card__full-link"], a').first().attr('href') || '';
    const dateText = card.find('time, .job-search-card__listdate, [class*="date"]').first().text().trim();
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
        salary_range: null, // LinkedIn rarely shows salary on public pages
        field,
        is_intern: /intern|trainee|apprentice|attachment|industrial training/i.test(title),
        posted_date: dateAttr || dateText || null,
        deadline: null,
        qualifications: [],
        description: null,
        image: image || null,
        scraped_at: new Date().toISOString(),
    };
}

/**
 * Scrape LinkedIn public job search for IT interns in Sri Lanka.
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

    for (const query of limitedQueries) {
        for (let page = 0; page < maxPages; page++) {
            const start = page * 25;

            try {
                // Try the guest API endpoint first (returns HTML fragments)
                let html = null;
                try {
                    const apiUrl = buildLinkedInApiUrl(query, start);
                    const { data } = await axios.get(apiUrl, {
                        timeout: 15_000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,*/*',
                            'Accept-Language': 'en-US,en;q=0.9',
                        },
                    });
                    if (typeof data === 'string' && data.length > 200) html = data;
                } catch {
                    // Fall back to public search page
                    try {
                        const searchUrl = buildLinkedInUrl(query, start);
                        const { data } = await axios.get(searchUrl, {
                            timeout: 15_000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.9',
                            },
                        });
                        if (typeof data === 'string' && data.length > 1000) html = data;
                    } catch {
                        // LinkedIn blocked this request
                    }
                }

                if (!html) {
                    log.info(`LinkedIn blocked or empty for: "${query}" page ${page + 1}`);
                    break;
                }

                const $ = cheerio.load(html);
                let pageCount = 0;

                // LinkedIn job card selectors
                const cardSelector = '.base-card, .job-search-card, .base-search-card, li, [class*="card"]';

                $(cardSelector).each((_, el) => {
                    const post = parseJobCard($, el);
                    if (!post) return;

                    // Dedupe across queries
                    const dedupeKey = `${post.title}-${post.company}`.toLowerCase();
                    if (seen.has(dedupeKey)) return;
                    seen.add(dedupeKey);

                    allPosts.push(post);
                    pageCount++;
                });

                log.info(`LinkedIn "${query}" page ${page + 1}: ${pageCount} posts`);
                if (pageCount === 0) break;

                // 3-second delay between LinkedIn requests to avoid rate limiting
                await new Promise(r => setTimeout(r, 3000));
            } catch (err) {
                log.warning(`LinkedIn query "${query}" failed: ${err.message}`);
                break;
            }
        }

        // Extra delay between different queries (2s)
        await new Promise(r => setTimeout(r, 2000));
    }

    log.info(`Total LinkedIn intern posts: ${allPosts.length}`);
    return allPosts;
}
