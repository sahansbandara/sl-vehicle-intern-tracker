import crypto from 'crypto';

/**
 * Normalize a raw scraped listing into the unified schema.
 * Returns null if essential fields (price or url) are missing.
 */
export function normalizeListing(raw) {
    if (!raw.url) return null;

    const price_lkr = parsePrice(raw.price_raw);
    if (!price_lkr) return null;

    const mileage_km = parseMileage(raw.mileage_raw);
    const condition = detectCondition(raw.raw_text, mileage_km);
    const trim = detectTrim(raw.title, raw.raw_text);
    const seller_type = detectSellerType(raw.raw_text);
    const posted_date = parsePostedDate(raw.posted_raw);

    const id = crypto.createHash('sha1')
        .update(`${raw.source}|${raw.url}`)
        .digest('hex')
        .substring(0, 16);

    return {
        id,
        source: raw.source,
        url: raw.url,
        title: (raw.title || 'Vehicle listing').trim().substring(0, 200),
        price_lkr,
        year: raw.year || null,
        mileage_km,
        location: cleanLocation(raw.location),
        condition,
        trim,
        images: raw.images || [],
        seller_type,
        posted_date,
        scraped_at: new Date().toISOString(),
        deal_score: 0, // Filled in by scoreListings
    };
}

/**
 * Normalize a raw scraped intern/job post into the unified intern schema.
 * Returns null if essential fields (url or title) are missing.
 */
export function normalizeInternPost(raw) {
    if (!raw.url || !raw.title) return null;

    const id = crypto.createHash('sha1')
        .update(`${raw.source}|${raw.url}`)
        .digest('hex')
        .substring(0, 16);

    const posted_date = parsePostedDate(raw.posted_raw);
    const deadline = parseDeadline(raw.deadline_raw);
    const salary_range = parseSalaryRange(raw.salary_raw);

    return {
        id,
        source: raw.source,
        url: raw.url,
        title: raw.title.trim().substring(0, 200),
        company: raw.company ? raw.company.trim().substring(0, 100) : null,
        salary_range,
        duration: raw.duration || null,
        qualifications: raw.qualifications || [],
        location: cleanLocation(raw.location),
        field: raw.field || 'IT General',
        posted_date,
        deadline,
        scraped_at: new Date().toISOString(),
        relevance_score: 0, // Filled in by scoreInternPosts
        raw_text: (raw.raw_text || '').substring(0, 500),
    };
}

/**
 * Parse Sri Lankan price strings: "Rs. 20,500,000", "21.7Mn", "LKR 15,000,000"
 * Returns integer LKR or null.
 */
export function parsePrice(raw) {
    if (!raw) return null;
    const s = String(raw).replace(/,/g, '').trim();

    // Handle "Mn" / "Million" suffixes
    const mnMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:Mn|Million)/i);
    if (mnMatch) {
        return Math.round(parseFloat(mnMatch[1]) * 1_000_000);
    }

    const numMatch = s.match(/(\d+)/);
    if (!numMatch) return null;

    const n = parseInt(numMatch[1]);
    // Broad sanity bounds for Sri Lankan car listings
    if (n < 100_000 || n > 500_000_000) return null;
    return n;
}

/**
 * Parse salary range strings like "25,000 - 40,000" or "Rs. 30,000"
 * Returns a formatted string or null.
 */
export function parseSalaryRange(raw) {
    if (!raw) return null;
    const s = String(raw).trim();

    // Range: "25,000 - 40,000"
    const rangeMatch = s.match(/([\d,]+)\s*[-–]\s*([\d,]+)/);
    if (rangeMatch) {
        const low = parseInt(rangeMatch[1].replace(/,/g, ''));
        const high = parseInt(rangeMatch[2].replace(/,/g, ''));
        if (low > 0 && high > 0) {
            return `LKR ${low.toLocaleString('en-US')} - ${high.toLocaleString('en-US')}`;
        }
    }

    // Single value: "30,000"
    const singleMatch = s.match(/([\d,]+)/);
    if (singleMatch) {
        const val = parseInt(singleMatch[1].replace(/,/g, ''));
        if (val > 0 && val < 10_000_000) {
            return `LKR ${val.toLocaleString('en-US')}`;
        }
    }

    return null;
}

/**
 * Parse deadline dates from various formats.
 */
export function parseDeadline(raw) {
    if (!raw) return null;
    const s = String(raw).trim();

    // DD/MM/YYYY or DD-MM-YYYY
    const dateMatch = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateMatch) {
        let [, day, month, year] = dateMatch;
        if (year.length === 2) year = `20${year}`;
        const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(d.getTime())) return d.toISOString();
    }

    return null;
}

export function parseMileage(raw) {
    if (!raw) return null;
    const s = String(raw).replace(/,/g, '').trim();
    const m = s.match(/(\d+)/);
    if (!m) return null;
    const km = parseInt(m[1]);
    if (km < 0 || km > 1_000_000) return null;
    return km;
}

export function detectCondition(text, mileage) {
    if (!text) return 'unknown';
    const t = text.toLowerCase();
    if (/\bbrand\s*new\b/.test(t)) return 'new';
    if (/\brecon(?:ditioned)?\b|\bimport(?:ed)?\b/.test(t)) return 'recon';
    if (/\bused\b/.test(t)) return 'used';
    // Heuristic on mileage
    if (mileage !== null && mileage !== undefined) {
        if (mileage === 0) return 'new';
        if (mileage < 5000) return 'new';
    }
    return 'unknown';
}

export function detectTrim(title, text) {
    const combined = `${title || ''} ${text || ''}`.toLowerCase();
    if (/\bpremium\b|\bawd\b|\b4wd\b/.test(combined)) return 'Premium';
    if (/\bsuperior\b|\bfwd\b/.test(combined)) return 'Superior';
    return 'unknown';
}

export function detectSellerType(text) {
    if (!text) return 'unknown';
    const t = text.toLowerCase();
    if (/\bdealer\b|\bshowroom\b|\bauto\b.*\bpvt\b|\bjkcg\b|\bjohn keells\b/.test(t)) return 'dealer';
    if (/\bindividual\b|\bprivate\b|\bowner\b/.test(t)) return 'individual';
    return 'unknown';
}

export function parsePostedDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    const now = new Date();

    if (s === 'today' || /just now/.test(s)) return now.toISOString();
    if (s === 'yesterday') {
        const d = new Date(now); d.setDate(d.getDate() - 1); return d.toISOString();
    }

    const rel = s.match(/(\d+)\s*(hour|day|week|month)s?\s*ago/);
    if (rel) {
        const n = parseInt(rel[1]);
        const unit = rel[2];
        const d = new Date(now);
        if (unit === 'hour') d.setHours(d.getHours() - n);
        if (unit === 'day') d.setDate(d.getDate() - n);
        if (unit === 'week') d.setDate(d.getDate() - n * 7);
        if (unit === 'month') d.setMonth(d.getMonth() - n);
        return d.toISOString();
    }

    // "Apr 3" style
    const monMatch = raw.match(/([A-Z][a-z]{2})\s+(\d{1,2})/);
    if (monMatch) {
        const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
        const mo = months[monMatch[1]];
        if (mo !== undefined) {
            let year = now.getFullYear();
            const d = new Date(year, mo, parseInt(monMatch[2]));
            if (d > now) d.setFullYear(year - 1);
            return d.toISOString();
        }
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dateMatch = String(raw).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateMatch) {
        let [, day, month, year] = dateMatch;
        if (year.length === 2) year = `20${year}`;
        const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(d.getTime())) return d.toISOString();
    }

    return null;
}

export function cleanLocation(loc) {
    if (!loc) return null;
    return loc.replace(/\s+/g, ' ').replace(/[·•]/g, '').trim().substring(0, 80);
}
