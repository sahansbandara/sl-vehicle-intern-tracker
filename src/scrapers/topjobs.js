import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from 'apify';
import { normalizeInternPost } from '../utils/normalize.js';

const TOPJOBS_BASE_URL = 'https://www.topjobs.lk/applicant/vacancybyfunctionalarea.jsp';
const TOPJOBS_DETAIL_BASE = 'https://www.topjobs.lk';

const TOPJOBS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
};

// TopJobs functional area IDs for IT-related categories
const IT_FUNCTIONAL_AREAS = [
    '35', // IT - Software
    '36', // IT - Hardware
    '41', // IT - Quality Assurance
];

/**
 * Scrape topjobs.lk for IT intern/trainee positions.
 */
export async function scrapeTopjobs({ maxPages = 5, keywords = [] } = {}) {
    const listings = [];
    const seenUrls = new Set();

    for (const areaId of IT_FUNCTIONAL_AREAS) {
        try {
            const { data: html } = await axios.get(TOPJOBS_BASE_URL, {
                params: { FA: areaId },
                headers: TOPJOBS_HEADERS,
                timeout: 30000,
                validateStatus: (status) => status < 500,
            });

            const posts = extractPostsFromHtml(html, keywords);
            log.info(`topjobs area ${areaId}: ${posts.length} intern posts`);

            for (const raw of posts) {
                if (seenUrls.has(raw.url)) continue;
                seenUrls.add(raw.url);

                const normalized = normalizeInternPost({
                    source: 'topjobs',
                    url: raw.url,
                    title: raw.title,
                    company: raw.company,
                    salary_raw: raw.salary_raw,
                    duration: raw.duration,
                    qualifications: raw.qualifications,
                    location: raw.location,
                    field: raw.field,
                    posted_raw: raw.posted_raw,
                    deadline_raw: raw.deadline_raw,
                    raw_text: raw.raw_text,
                });

                if (normalized) listings.push(normalized);
            }
        } catch (err) {
            log.error(`topjobs scraper error for area ${areaId}`, { error: err.message });
            // Continue to next area instead of failing completely
        }
    }

    return listings;
}

function extractPostsFromHtml(html, keywords) {
    const $ = cheerio.load(html);
    const results = [];

    // TopJobs lists vacancies in table rows or divs with job details
    $('tr, div.vacancy-item, .job-item, div[class*="vacancy"]').each((_, el) => {
        const $el = $(el);
        const text = $el.text().replace(/\s+/g, ' ').trim();

        // Filter: must mention intern/trainee keywords
        if (!isInternPost(text)) return;

        // Filter by user-specified IT keywords
        if (keywords.length > 0 && !matchesKeywords(text, keywords)) return;

        const link = $el.find('a[href]').first().attr('href');
        if (!link) return;

        const absoluteUrl = link.startsWith('http') ? link : `${TOPJOBS_DETAIL_BASE}${link}`;

        const title = $el.find('b, strong, h3, h4, a').first().text().trim()
            || text.substring(0, 100);
        const company = extractCompany($, $el, text);

        results.push({
            url: absoluteUrl,
            title,
            company,
            salary_raw: extractFirst(text, /(?:Rs\.?|LKR)\s*([\d,]+(?:\s*[-–]\s*[\d,]+)?)/i),
            duration: extractFirst(text, /(\d+\s*(?:month|year|week)s?)/i),
            qualifications: extractQualifications(text),
            location: extractLocation(text),
            field: detectITField(text),
            posted_raw: extractFirst(text, /(?:posted|date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i),
            deadline_raw: extractFirst(text, /(?:closing|deadline|expires?)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i),
            raw_text: text.substring(0, 500),
        });
    });

    return results;
}

function isInternPost(text) {
    const t = text.toLowerCase();
    return /\b(?:intern(?:ship)?|trainee|training|industrial\s*training|undergraduate|placement)\b/.test(t);
}

function matchesKeywords(text, keywords) {
    const t = text.toLowerCase();
    return keywords.some(kw => t.includes(kw.toLowerCase()));
}

function extractCompany($, $el, text) {
    // Try to find company name from the card structure
    const companyEl = $el.find('[class*="company"], [class*="employer"]').first().text().trim();
    if (companyEl) return companyEl;

    // Fallback: look for common patterns
    const match = text.match(/(?:company|employer)\s*:?\s*([^\n|,]+)/i);
    return match ? match[1].trim() : null;
}

function extractQualifications(text) {
    const quals = [];
    const t = text.toLowerCase();

    // Degrees
    if (/\bb\.?sc\.?\b|bachelor/i.test(t)) quals.push('BSc');
    if (/\bm\.?sc\.?\b|master/i.test(t)) quals.push('MSc');
    if (/\bhnd\b|higher national diploma/i.test(t)) quals.push('HND');
    if (/\bdit\b|diploma in it/i.test(t)) quals.push('DIT');

    // Tech skills
    const techSkills = [
        'Python', 'Java', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue',
        'Node.js', 'NodeJS', '.NET', 'C#', 'PHP', 'Laravel', 'Django', 'Flask',
        'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'AWS', 'Azure', 'Docker',
        'Git', 'Linux', 'Flutter', 'Kotlin', 'Swift', 'Spring Boot',
        'HTML', 'CSS', 'Figma', 'UI/UX', 'Machine Learning', 'AI',
        'Data Science', 'Cybersecurity', 'Networking', 'DevOps', 'Cloud',
    ];

    for (const skill of techSkills) {
        const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(text)) quals.push(skill);
    }

    return quals;
}

function extractLocation(text) {
    const locations = [
        'Colombo', 'Gampaha', 'Kandy', 'Galle', 'Matara', 'Kurunegala',
        'Jaffna', 'Dehiwala', 'Matale', 'Kalutara', 'Negombo', 'Ratnapura',
        'Anuradhapura', 'Badulla', 'Batticaloa', 'Trincomalee', 'Hambantota',
        'Puttalam', 'Kegalle', 'Nuwara Eliya', 'Polonnaruwa', 'Vavuniya',
        'Mannar', 'Kilinochchi', 'Ampara', 'Monaragala',
    ];

    for (const loc of locations) {
        if (new RegExp(`\\b${loc}\\b`, 'i').test(text)) return loc;
    }
    return null;
}

function detectITField(text) {
    const t = text.toLowerCase();
    if (/\bsoftware\s*(?:develop|engineer)/i.test(t)) return 'Software Engineering';
    if (/\bweb\s*develop/i.test(t)) return 'Web Development';
    if (/\bmobile\s*(?:app|develop)/i.test(t)) return 'Mobile Development';
    if (/\bdata\s*(?:science|analy)/i.test(t)) return 'Data Science';
    if (/\bdevops|cloud/i.test(t)) return 'DevOps / Cloud';
    if (/\bcyber\s*security|security/i.test(t)) return 'Cybersecurity';
    if (/\bnetwork/i.test(t)) return 'Networking';
    if (/\bqa\b|quality\s*assurance|test/i.test(t)) return 'QA / Testing';
    if (/\bui\s*\/?\s*ux|design/i.test(t)) return 'UI/UX Design';
    if (/\bdatabase|sql|dba/i.test(t)) return 'Database';
    if (/\bai\b|machine\s*learn|artificial/i.test(t)) return 'AI / Machine Learning';
    return 'IT General';
}

function extractFirst(text, regex) {
    const match = text.match(regex);
    return match ? match[1] || match[0] : null;
}
