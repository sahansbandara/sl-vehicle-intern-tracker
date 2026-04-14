import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from 'apify';
import { parsePostedDate } from '../utils/normalize.js';

const BASE_URL = 'https://www.itpro.lk';

/**
 * IT keywords for filtering relevant posts.
 */
const IT_KEYWORDS = [
    'IT', 'Software', 'Web', 'Mobile', 'Developer', 'Engineering', 'Data',
    'AI', 'Machine Learning', 'DevOps', 'Cloud', 'QA', 'Testing', 'UI', 'UX',
    'Database', 'Networking', 'Cybersecurity', 'Security', 'System Admin',
    'Computer Science', 'Full Stack', 'Frontend', 'Backend', 'Python', 'Java',
    'React', 'Node', 'AWS', 'Azure', 'Programmer', 'Analyst', 'Tech',
    'Information Technology', 'ICT', 'Help Desk', 'Network', 'Infra',
];

/**
 * Check if text matches IT keywords.
 */
function matchesITKeywords(text, extraKeywords = []) {
    const lower = text.toLowerCase();
    const allKeywords = [...IT_KEYWORDS, ...extraKeywords];
    return allKeywords.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Scrape ITPro.lk for IT internship and trainee postings.
 * ITPro.lk is a niche IT-focused job board in Sri Lanka.
 */
export async function scrapeItproJobs({ maxPages = 5, keywords = [] } = {}) {
    const posts = [];

    const searchUrls = [
        `${BASE_URL}/jobs`,
        `${BASE_URL}/internships`,
        `${BASE_URL}/careers`,
        `${BASE_URL}/vacancies`,
        `${BASE_URL}/job-listings`,
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
            if (page === 1) log.warning('ITPro.lk: All base URLs failed');
            break;
        }

        const $ = cheerio.load(html);
        const pagePosts = [];

        // Job card selectors
        const cardSelector = '.job-card, .job-listing, .vacancy, .position, article, .job-item, .career-item, .listing, [class*="job"], [class*="vacancy"], [class*="career"], [class*="position"]';

        $(cardSelector).each((_, el) => {
            const card = $(el);
            const title = card.find('h2, h3, h4, .title, .job-title, .position-title, [class*="title"], [class*="name"]').first().text().trim();
            const company = card.find('.company, .employer, .organization, [class*="company"], [class*="employer"]').first().text().trim();
            const location = card.find('.location, [class*="location"], .area').first().text().trim();
            const link = card.find('a').first().attr('href') || '';
            const dateText = card.find('.date, .posted, time, [class*="date"], [class*="posted"]').first().text().trim();
            const salaryText = card.find('.salary, [class*="salary"], .pay, [class*="pay"]').first().text().trim();
            const description = card.find('p, .description, .summary, [class*="description"], [class*="summary"]').first().text().trim();

            if (!title || title.length < 3) return;

            // Check if it's intern/trainee related
            const fullText = `${title} ${description} ${company}`.toLowerCase();
            const isIntern = /intern|trainee|apprentice|attachment|industrial training|placement/i.test(fullText);
            const isIT = matchesITKeywords(fullText, keywords);

            // This pipeline is strictly for IT internships/trainees only.
            if (!isIntern || !isIT) return;

            const fullUrl = link ? new URL(link, BASE_URL).href : usedUrl;

            // Determine field based on content
            let field = 'IT General';
            if (/software|developer|programming|coding/i.test(fullText)) field = 'Software Development';
            else if (/network|networking|cisco|ccna/i.test(fullText)) field = 'Networking';
            else if (/cyber|security|infosec|penetration/i.test(fullText)) field = 'Cybersecurity';
            else if (/data|analytics|database|sql/i.test(fullText)) field = 'Data & Analytics';
            else if (/web|frontend|backend|full.?stack/i.test(fullText)) field = 'Web Development';
            else if (/cloud|aws|azure|devops/i.test(fullText)) field = 'Cloud & DevOps';
            else if (/qa|testing|quality/i.test(fullText)) field = 'QA & Testing';
            else if (/ai|machine.?learn|deep.?learn/i.test(fullText)) field = 'AI & Machine Learning';
            else if (/mobile|android|ios|flutter|react.?native/i.test(fullText)) field = 'Mobile Development';
            else if (/ui|ux|design|figma/i.test(fullText)) field = 'UI/UX Design';
            else if (/help.?desk|support|tech.?support/i.test(fullText)) field = 'IT Support';
            else if (/system.?admin|infrastructure/i.test(fullText)) field = 'System Administration';

            pagePosts.push({
                id: `itpro-${title.toLowerCase().replace(/\s+/g, '-').substring(0, 50)}-${company.toLowerCase().replace(/\s+/g, '-').substring(0, 20)}`,
                source: 'itpro',
                url: fullUrl,
                title,
                company: company || 'Unknown',
                location: location || 'Sri Lanka',
                salary_range: salaryText || null,
                field,
                is_intern: isIntern,
                posted_date: parsePostedDate(dateText),
                deadline: null,
                qualifications: [],
                description: description.substring(0, 500) || null,
                scraped_at: new Date().toISOString(),
            });
        });

        // Fallback: scan links if no cards found
        if (page === 1 && pagePosts.length === 0) {
            log.info('ITPro.lk: No cards found, scanning links');
            $('a').each((_, el) => {
                const $a = $(el);
                const title = $a.text().trim();
                const href = $a.attr('href') || '';

                if (!title || title.length < 10 || title.length > 200) return;
                if (!matchesITKeywords(title, keywords)) return;

                const fullUrl = href ? new URL(href, BASE_URL).href : usedUrl;

                pagePosts.push({
                    id: `itpro-link-${title.toLowerCase().replace(/\s+/g, '-').substring(0, 50)}`,
                    source: 'itpro',
                    url: fullUrl,
                    title,
                    company: 'Unknown',
                    location: 'Sri Lanka',
                    salary_range: null,
                    field: 'IT General',
                    is_intern: /intern|trainee/i.test(title),
                    posted_date: null,
                    deadline: null,
                    qualifications: [],
                    description: null,
                    scraped_at: new Date().toISOString(),
                });
            });
        }

        log.info(`ITPro.lk page ${page}: ${pagePosts.length} IT positions`);
        posts.push(...pagePosts);

        if (pagePosts.length === 0 && page > 1) break;
        await new Promise(r => setTimeout(r, 2000));
    }

    return posts;
}
