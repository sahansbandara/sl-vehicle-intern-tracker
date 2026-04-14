/**
 * Calculate deal_score for each vehicle listing in [0, 100].
 *
 * deal_score = (max_price - price) / max_price * 40
 *            + (1 - mileage / 100000) * 30
 *            + (year - 2024) * 10
 *            + (trim === "Premium" ? 10 : 0)
 *            + (condition === "new" ? 10 : condition === "recon" ? 5 : 0)
 *
 * Missing fields default conservatively (mileage=50000, year=2024).
 */
export function scoreListings(listings) {
    if (listings.length === 0) return listings;

    const prices = listings.map(l => l.price_lkr).filter(Boolean);
    const maxPrice = Math.max(...prices);

    return listings.map(l => {
        const price = l.price_lkr || maxPrice;
        const mileage = l.mileage_km ?? 50000;
        const year = l.year ?? 2024;
        const trim = l.trim || 'unknown';
        const condition = l.condition || 'unknown';

        const priceComponent = maxPrice > 0 ? ((maxPrice - price) / maxPrice) * 40 : 0;
        const mileageComponent = Math.max(0, (1 - mileage / 100000)) * 30;
        const yearComponent = Math.max(0, (year - 2024)) * 10;
        const trimComponent = trim === 'Premium' ? 10 : 0;
        const conditionComponent = condition === 'new' ? 10 : condition === 'recon' ? 5 : 0;

        const score = priceComponent + mileageComponent + yearComponent + trimComponent + conditionComponent;
        const clamped = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

        return {
            ...l,
            deal_score: clamped,
            score_breakdown: {
                price: Math.round(priceComponent * 10) / 10,
                mileage: Math.round(mileageComponent * 10) / 10,
                year: Math.round(yearComponent * 10) / 10,
                trim: trimComponent,
                condition: conditionComponent,
            },
        };
    });
}

/**
 * Calculate relevance_score for each intern post in [0, 100].
 *
 * Scoring:
 *   - Field specificity: Software Engineering = 20, other specific fields = 15, IT General = 5
 *   - Company named: +15
 *   - Has salary info: +10
 *   - Has duration info: +10
 *   - Qualification count: min(quals.length * 3, 15)
 *   - Has deadline (still active): +10
 *   - Has location: +5
 *   - Recency bonus: posted within 7 days = +15, 14 days = +10, 30 days = +5
 */
export function scoreInternPosts(posts) {
    if (posts.length === 0) return posts;

    const now = Date.now();

    return posts.map(post => {
        let score = 0;
        const breakdown = {};

        // Field specificity
        const fieldScores = {
            'Software Engineering': 20,
            'Web Development': 18,
            'Mobile Development': 18,
            'Data Science': 18,
            'AI / Machine Learning': 18,
            'DevOps / Cloud': 16,
            'Cybersecurity': 16,
            'QA / Testing': 14,
            'UI/UX Design': 14,
            'Database': 14,
            'Networking': 12,
            'IT General': 5,
        };
        breakdown.field = fieldScores[post.field] || 5;
        score += breakdown.field;

        // Company named
        breakdown.company = post.company ? 15 : 0;
        score += breakdown.company;

        // Salary info
        breakdown.salary = post.salary_range ? 10 : 0;
        score += breakdown.salary;

        // Duration info
        breakdown.duration = post.duration ? 10 : 0;
        score += breakdown.duration;

        // Qualifications richness
        const qualCount = post.qualifications?.length || 0;
        breakdown.qualifications = Math.min(qualCount * 3, 15);
        score += breakdown.qualifications;

        // Deadline (still active)
        if (post.deadline) {
            const deadlineTime = new Date(post.deadline).getTime();
            breakdown.deadline = deadlineTime > now ? 10 : 0;
        } else {
            breakdown.deadline = 0;
        }
        score += breakdown.deadline;

        // Location info
        breakdown.location = post.location ? 5 : 0;
        score += breakdown.location;

        // Recency bonus
        if (post.posted_date) {
            const postedTime = new Date(post.posted_date).getTime();
            const daysSince = (now - postedTime) / (1000 * 60 * 60 * 24);
            if (daysSince <= 7) breakdown.recency = 15;
            else if (daysSince <= 14) breakdown.recency = 10;
            else if (daysSince <= 30) breakdown.recency = 5;
            else breakdown.recency = 0;
        } else {
            breakdown.recency = 0;
        }
        score += breakdown.recency;

        const clamped = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

        return {
            ...post,
            relevance_score: clamped,
            score_breakdown: breakdown,
        };
    });
}
