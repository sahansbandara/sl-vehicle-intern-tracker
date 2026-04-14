import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from 'apify';
import { normalizeInternPost } from '../utils/normalize.js';

const XPRESS_BASE_URL = 'https://www.xpress.jobs/jobs';

const XPRESS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Scrape xpress.jobs for IT intern/trainee positions in Sri Lanka.
 */
export async function scrapeXpressJobs({ maxPages = 5, keywords = [] } = {}) {
    const listings = [];
    const seenUrls = new Set();

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        try {
            const { data: html } = await axios.get(buildPageUrl(pageNumber), {
                headers: XPRESS_HEADERS,
                timeout: 30000,
                validateStatus: (status) => status < 500,
            });

            const posts = extractPostsFromHtml(html, keywords);
            log.info(`xpress-jobs page ${pageNumber}: ${posts.length} intern posts`);
            if (posts.length === 0) break;

            for (const raw of posts) {
                if (seenUrls.has(raw.url)) continue;
                seenUrls.add(raw.url);

                const normalized = normalizeInternPost({
                    source: 'xpress-jobs',
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
            log.error(`xpress-jobs scraper error on page ${pageNumber}`, { error: err.message });
            // Continue rather than crash — site may be temporarily down
        }
    }

    return listings;
}

function buildPageUrl(pageNumber) {
    const url = new URL(XPRESS_BASE_URL);
    url.searchParams.set('q', 'intern IT');
    url.searchParams.set('location', 'Sri Lanka');
    if (pageNumber > 1) {
        url.searchParams.set('page', String(pageNumber));
    }
    return url.toString();
}

function extractPostsFromHtml(html, keywords) {
    const $ = cheerio.load(html);
    const results = [];

    // Xpress.jobs uses card layout for job listings
    $('a[href*="/job/"], a[href*="/vacancy/"], .job-card, .job-listing, div[class*="job"]').each((_, el) => {
        const $el = $(el);
        let $card = $el;

        // Walk up to find the full card container
        for (let i = 0; i < 5; i++) {
            if ($card.find('[class*="company"], [class*="salary"], [class*="location"]').length > 0) break;
            const parent = $card.parent();
            if (!parent.length) break;
            $card = parent;
        }

        const text = $card.text().replace(/\s+/g, ' ').trim();
        if (!text) return;

        // Must reference intern/trainee
        if (!isInternPost(text)) return;

        // Must match IT field
        const itMatch = /\b(?:it|software|developer|programmer|web|data|network|cyber|computer|tech|digital|cloud|devops|qa|tester|ui|ux|design|database|system|engineer)\b/i.test(text);
        if (!itMatch) return;

        // Keyword filtering
        if (keywords.length > 0 && !keywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()))) {
            return;
        }

        const link = $el.is('a') ? $el.attr('href') : $el.find('a[href]').first().attr('href');
        if (!link) return;

        const absoluteUrl = link.startsWith('http') ? link : `https://www.xpress.jobs${link}`;

        const title = $card.find('h1, h2, h3, h4, [class*="title"], [class*="Title"]').first().text().trim()
            || $el.text().trim()
            || 'IT Intern Position';

        const company = $card.find('[class*="company"], [class*="employer"], [class*="Company"]').first().text().trim()
            || extractFirst(text, /(?:company|employer)\s*:?\s*([^\n|,]+)/i);

        results.push({
            url: absoluteUrl,
            title,
            company: company || null,
            salary_raw: extractFirst(text, /(?:Rs\.?|LKR)\s*([\d,]+(?:\s*[-–]\s*[\d,]+)?)/i),
            duration: extractFirst(text, /(\d+\s*(?:month|year|week)s?)/i),
            qualifications: extractQualifications(text),
            location: extractLocation(text),
            field: detectITField(text),
            posted_raw: extractFirst(text, /(\d+\s*(?:hour|day|week|month)s?\s*ago)/i),
            deadline_raw: extractFirst(text, /(?:closing|deadline|expires?)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i),
            raw_text: text.substring(0, 500),
        });
    });

    return results;
}

function isInternPost(text) {
    return /\b(?:intern(?:ship)?|trainee|training|industrial\s*training|undergraduate|placement)\b/i.test(text);
}

function extractQualifications(text) {
    const quals = [];
    const techSkills = [
        'Python', 'Java', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue',
        'Node.js', '.NET', 'C#', 'PHP', 'Laravel', 'Django',
        'SQL', 'MySQL', 'MongoDB', 'AWS', 'Azure', 'Docker',
        'Git', 'Linux', 'Flutter', 'Kotlin', 'Swift', 'HTML', 'CSS',
    ];

    if (/\bb\.?sc\.?\b|bachelor/i.test(text)) quals.push('BSc');
    if (/\bhnd\b/i.test(text)) quals.push('HND');

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
        'Puttalam', 'Kegalle',
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
    if (/\bcyber\s*security/i.test(t)) return 'Cybersecurity';
    if (/\bnetwork/i.test(t)) return 'Networking';
    if (/\bqa\b|quality\s*assurance|test/i.test(t)) return 'QA / Testing';
    if (/\bui\s*\/?\s*ux|design/i.test(t)) return 'UI/UX Design';
    if (/\bai\b|machine\s*learn/i.test(t)) return 'AI / Machine Learning';
    return 'IT General';
}

function extractFirst(text, regex) {
    const match = text.match(regex);
    return match ? match[1] || match[0] : null;
}
