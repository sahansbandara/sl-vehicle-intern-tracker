import { Actor, log } from 'apify';
import { scrapeTopjobs } from '../scrapers/topjobs.js';
import { scrapeIkmanJobs } from '../scrapers/ikman-jobs.js';
import { scrapeXpressJobs } from '../scrapers/xpress-jobs.js';
import { scrapeItproJobs } from '../scrapers/itpro-jobs.js';
import { scrapeLinkedinJobs } from '../scrapers/linkedin-jobs.js';
import { dedupeInternPosts } from '../utils/dedupe.js';
import { scoreInternPosts } from '../utils/score.js';
import { sendInternAlert, sendOpsAlert } from '../utils/telegram.js';
import { persistInternDataset, persistInternSnapshot } from '../utils/storage.js';

/**
 * Default IT keywords covering all fields including Networking and Cybersecurity.
 */
const DEFAULT_KEYWORDS = [
    'IT', 'Software', 'Web', 'Mobile', 'Developer', 'Engineering', 'Data',
    'AI', 'Machine Learning', 'DevOps', 'Cloud', 'QA', 'Testing', 'UI', 'UX',
    'Database', 'Networking', 'Cybersecurity', 'Security', 'System Administration',
    'Computer Science', 'Full Stack', 'Frontend', 'Backend', 'Python', 'Java',
    'React', 'Node.js', 'AWS', 'Azure', 'Programmer', 'Analyst', 'Tech',
    'Information Technology', 'ICT', 'Help Desk', 'Network', 'Infrastructure',
];

/**
 * Run the IT intern tracker.
 * Scrapes 5 Sri Lankan IT job sites for intern/trainee positions.
 */
export async function runInternTracker({
    botToken,
    chatId,
    opsChatId,
    maxPagesPerSite = 5,
    sitesEnabled = ['topjobs', 'xpress-jobs', 'ikman-jobs', 'itpro', 'linkedin'],
    keywords = DEFAULT_KEYWORDS,
}) {
    log.info('Starting IT intern tracker', {
        sites: sitesEnabled,
        maxPagesPerSite,
        keywordCount: keywords.length,
    });

    const scraperMap = {
        'topjobs': scrapeTopjobs,
        'ikman-jobs': scrapeIkmanJobs,
        'xpress-jobs': scrapeXpressJobs,
        'itpro': scrapeItproJobs,
        'linkedin': scrapeLinkedinJobs,
    };

    const allPosts = [];
    const scraperReport = {};

    for (const site of sitesEnabled) {
        const scraper = scraperMap[site];
        if (!scraper) {
            log.warning(`Unknown intern site: ${site}`);
            continue;
        }
        try {
            log.info(`Scraping ${site} for IT interns...`);
            const posts = await scraper({
                maxPages: maxPagesPerSite,
                keywords,
            });
            scraperReport[site] = posts.length;
            log.info(`${site}: ${posts.length} intern posts`);
            allPosts.push(...posts);

            if (posts.length === 0) {
                await sendOpsAlert(botToken, opsChatId, `⚠️ ${site} returned 0 intern posts — may need selector update`);
            }
        } catch (err) {
            log.error(`${site} intern scraper failed`, { error: err.message });
            scraperReport[site] = `ERROR: ${err.message}`;
            await sendOpsAlert(botToken, opsChatId, `🔥 ${site} intern scraper failed: ${err.message}`);
        }
    }

    log.info(`Total raw intern posts: ${allPosts.length}`);

    if (allPosts.length === 0) {
        log.warning('Zero intern posts across all sites.');
        await sendOpsAlert(botToken, opsChatId, `❌ All intern scrapers returned 0 posts. Check selectors.`);
        return { scraperReport, alertsSent: 0 };
    }

    // Dedupe
    const deduped = dedupeInternPosts(allPosts);
    log.info(`After dedupe: ${deduped.length} unique intern posts`);

    // Score
    const scored = scoreInternPosts(deduped);

    // Sort by relevance (highest first)
    scored.sort((a, b) => b.relevance_score - a.relevance_score);

    // Persist
    await persistInternDataset(scored);
    await persistInternSnapshot(scored);

    // Dedupe against already-alerted posts
    const kv = await Actor.openKeyValueStore('alerted-intern-posts');
    const alreadyAlerted = (await kv.getValue('ids')) || {};

    const newAlerts = scored.filter(p => !alreadyAlerted[p.id]);
    log.info(`New intern alerts (not previously sent): ${newAlerts.length}`);

    let alertsSent = 0;
    for (const post of newAlerts) {
        try {
            await sendInternAlert(botToken, chatId, post);
            alreadyAlerted[post.id] = {
                alerted_at: new Date().toISOString(),
                score: post.relevance_score,
                company: post.company,
            };
            await new Promise(r => setTimeout(r, 2500));
            alertsSent++;
        } catch (err) {
            log.error(`Failed to send intern alert for ${post.id}`, { error: err.message });
        }
    }

    // Prune alerted log older than 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const [id, meta] of Object.entries(alreadyAlerted)) {
        if (new Date(meta.alerted_at).getTime() < cutoff) delete alreadyAlerted[id];
    }
    await kv.setValue('ids', alreadyAlerted);

    // Summary ops message
    const summary = [
        `✅ IT Intern tracker run complete`,
        ``,
        `📊 Sources:`,
        ...Object.entries(scraperReport).map(([site, count]) => `  • ${site}: ${count}`),
        ``,
        `🔢 Raw: ${allPosts.length} → Unique: ${deduped.length}`,
        `🔔 New alerts sent: ${alertsSent}`,
        `💾 Dataset + snapshot persisted`,
    ].join('\n');
    log.info(summary);
    await sendOpsAlert(botToken, opsChatId, summary);

    return { scraperReport, alertsSent };
}
