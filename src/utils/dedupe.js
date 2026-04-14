import levenshtein from 'fast-levenshtein';

/**
 * Deduplicate vehicle listings across sources.
 * Two listings are duplicates if:
 *   - Levenshtein distance of normalized titles < 8
 *   - Price differs by less than 5%
 *   - Same normalized location (if both have locations)
 *
 * When duplicates found, prefer the one with: more complete data, then lower source priority (ikman > riyasewana > patpat).
 */
export function dedupeListings(listings) {
    const sourcePriority = { ikman: 0, riyasewana: 1, patpat: 2 };
    return dedupeGeneric(listings, isVehicleDuplicate, vehicleCompletenessScore, sourcePriority);
}

/**
 * Deduplicate intern posts across sources.
 * Two posts are duplicates if:
 *   - Levenshtein distance of normalized titles < 10
 *   - Same company name (if both have companies)
 *   - Same location (if both have locations)
 */
export function dedupeInternPosts(posts) {
    const sourcePriority = { topjobs: 0, 'ikman-jobs': 1, 'xpress-jobs': 2 };
    return dedupeGeneric(posts, isInternDuplicate, internCompletenessScore, sourcePriority);
}

function dedupeGeneric(items, isDuplicateFn, completenessScoreFn, sourcePriority) {
    const kept = [];

    for (const item of items) {
        let duplicateOf = null;
        for (let i = 0; i < kept.length; i++) {
            if (isDuplicateFn(item, kept[i])) {
                duplicateOf = i;
                break;
            }
        }

        if (duplicateOf === null) {
            kept.push(item);
        } else {
            // Replace if new item is better
            const existing = kept[duplicateOf];
            if (completenessScoreFn(item) > completenessScoreFn(existing)
                || (completenessScoreFn(item) === completenessScoreFn(existing)
                    && (sourcePriority[item.source] ?? 99) < (sourcePriority[existing.source] ?? 99))) {
                kept[duplicateOf] = item;
            }
        }
    }

    return kept;
}

// ── Vehicle duplicate detection ─────────────────────────────────

function isVehicleDuplicate(a, b) {
    if (!a.price_lkr || !b.price_lkr) return false;

    const priceDiff = Math.abs(a.price_lkr - b.price_lkr) / a.price_lkr;
    if (priceDiff >= 0.05) return false;

    const ta = normalizeTitle(a.title);
    const tb = normalizeTitle(b.title);
    const dist = levenshtein.get(ta, tb);
    if (dist >= 8) return false;

    // Location check (lenient: only fail if both have locations and they differ)
    if (a.location && b.location) {
        const la = normalizeLocation(a.location);
        const lb = normalizeLocation(b.location);
        if (la !== lb && !la.includes(lb) && !lb.includes(la)) return false;
    }

    // Year check (if both have years and they differ, not a dup)
    if (a.year && b.year && a.year !== b.year) return false;

    return true;
}

function vehicleCompletenessScore(l) {
    let score = 0;
    if (l.price_lkr) score += 1;
    if (l.year) score += 1;
    if (l.mileage_km !== null && l.mileage_km !== undefined) score += 1;
    if (l.location) score += 1;
    if (l.trim && l.trim !== 'unknown') score += 1;
    if (l.condition && l.condition !== 'unknown') score += 1;
    if (l.images && l.images.length > 0) score += 1;
    if (l.posted_date) score += 1;
    return score;
}

// ── Intern duplicate detection ──────────────────────────────────

function isInternDuplicate(a, b) {
    const ta = normalizeTitle(a.title);
    const tb = normalizeTitle(b.title);
    const dist = levenshtein.get(ta, tb);
    if (dist >= 10) return false;

    // Company check: if both have companies and they're very different, not a dup
    if (a.company && b.company) {
        const ca = normalizeTitle(a.company);
        const cb = normalizeTitle(b.company);
        const compDist = levenshtein.get(ca, cb);
        if (compDist >= 5) return false;
    }

    // Location check (lenient)
    if (a.location && b.location) {
        const la = normalizeLocation(a.location);
        const lb = normalizeLocation(b.location);
        if (la !== lb && !la.includes(lb) && !lb.includes(la)) return false;
    }

    return true;
}

function internCompletenessScore(l) {
    let score = 0;
    if (l.company) score += 2;
    if (l.salary_range) score += 1;
    if (l.duration) score += 1;
    if (l.qualifications && l.qualifications.length > 0) score += 1;
    if (l.location) score += 1;
    if (l.field && l.field !== 'IT General') score += 1;
    if (l.posted_date) score += 1;
    if (l.deadline) score += 1;
    return score;
}

// ── Shared helpers ──────────────────────────────────────────────

function normalizeTitle(t) {
    return (t || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
}

function normalizeLocation(l) {
    return (l || '').toLowerCase().split(/[·•,\s]+/)[0] || '';
}
