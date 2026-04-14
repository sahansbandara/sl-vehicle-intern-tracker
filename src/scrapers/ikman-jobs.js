import axios from 'axios';
import { log } from 'apify';
import { normalizeInternPost } from '../utils/normalize.js';

const IKMAN_JOBS_BASE_URL = 'https://ikman.lk/en/ads/sri-lanka/jobs?sort=date';

const IKMAN_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Scrape ikman.lk jobs section for IT intern/trainee positions.
 * Uses the same window.initialData approach as the vehicle scraper.
 */
export async function scrapeIkmanJobs({ maxPages = 5, keywords = [] } = {}) {
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
            log.info(`ikman-jobs page ${pageNumber}: ${ads.length} ads`);
            if (ads.length === 0) break;

            for (const raw of ads.map(ad => mapAdToInternPost(ad, keywords)).filter(Boolean)) {
                if (seenUrls.has(raw.url)) continue;
                seenUrls.add(raw.url);

                const normalized = normalizeInternPost({
                    source: 'ikman-jobs',
                    url: raw.url,
                    title: raw.title,
                    company: raw.company,
                    salary_raw: raw.salary_raw,
                    duration: raw.duration,
                    qualifications: raw.qualifications,
                    location: raw.location,
                    field: raw.field,
                    posted_raw: raw.posted_raw,
                    deadline_raw: null,
                    raw_text: raw.raw_text,
                });

                if (normalized) listings.push(normalized);
            }
        } catch (err) {
            log.error(`ikman-jobs scraper error on page ${pageNumber}`, { error: err.message });
            throw err;
        }
    }

    return listings;
}

function buildPageUrl(pageNumber) {
    const url = new URL(IKMAN_JOBS_BASE_URL);
    if (pageNumber > 1) {
        url.searchParams.set('page', String(pageNumber));
    }
    return url.toString();
}

function extractAdsFromHtml(html) {
    const marker = 'window.initialData = ';
    const start = html.indexOf(marker);
    if (start === -1) {
        log.warning('ikman-jobs: window.initialData not found');
        return [];
    }

    try {
        const scriptStart = start + marker.length;
        const scriptEnd = html.indexOf('</script>', scriptStart);
        if (scriptEnd === -1) {
            log.warning('ikman-jobs: initialData script end not found');
            return [];
        }

        const jsonText = html.slice(scriptStart, scriptEnd).trim();
        const data = JSON.parse(jsonText);
        return data?.serp?.ads?.data?.ads ?? [];
    } catch (err) {
        log.warning('ikman-jobs: failed to parse initialData JSON', { error: err.message });
        return [];
    }
}

function mapAdToInternPost(ad, keywords) {
    if (!ad?.slug) return null;

    const rawText = [
        ad.title,
        ad.description,
        ad.details,
        ad.location,
        ad.shopName,
    ].filter(Boolean).join(' | ');

    const t = rawText.toLowerCase();

    // Must be an intern/trainee post
    if (!/\b(?:intern(?:ship)?|trainee|training|industrial\s*training|undergraduate|placement)\b/.test(t)) {
        return null;
    }

    // Must match IT field if keywords provided, otherwise use broad IT match
    const itMatch = /\b(?:it|software|developer|programmer|web|data|network|cyber|computer|tech|digital|cloud|devops|qa|tester|ui|ux|design|database|system|engineer)\b/.test(t);
    if (!itMatch) return null;

    // Additional keyword filtering
    if (keywords.length > 0 && !keywords.some(kw => t.includes(kw.toLowerCase()))) {
        return null;
    }

    return {
        url: `https://ikman.lk/en/ad/${ad.slug}`,
        title: ad.title || 'Job listing',
        company: ad.shopName || extractCompanyFromText(rawText),
        salary_raw: extractFirst(rawText, /(?:Rs\.?|LKR)\s*([\d,]+(?:\s*[-–]\s*[\d,]+)?)/i),
        duration: extractFirst(rawText, /(\d+\s*(?:month|year|week)s?)/i),
        qualifications: extractQualifications(rawText),
        location: ad.location || null,
        field: detectITField(rawText),
        posted_raw: ad.lastBumpUpDate || ad.timeStamp || null,
        raw_text: rawText.substring(0, 500),
    };
}

function extractCompanyFromText(text) {
    const match = text.match(/(?:company|employer|firm)\s*:?\s*([^\n|,]+)/i);
    return match ? match[1].trim() : null;
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
