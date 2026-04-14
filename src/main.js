import { Actor, log } from 'apify';
import { runVehicleTracker } from './modes/vehicle-tracker.js';
import { runInternTracker } from './modes/intern-tracker.js';

await Actor.init();

const input = await Actor.getInput() ?? {};

const {
    TELEGRAM_BOT_TOKEN,

    // Separate channel IDs for vehicles and interns
    TELEGRAM_VEHICLE_CHAT_ID,
    TELEGRAM_INTERN_CHAT_ID,
    TELEGRAM_OPS_CHAT_ID,

    // Legacy single chat ID (fallback)
    TELEGRAM_CHAT_ID,

    // Mode selection: "vehicles", "interns", or "both"
    MODE = 'both',

    // Vehicle market tracker config
    MIN_PRICE_LKR: INPUT_MIN_PRICE_LKR,
    MAX_PRICE_LKR: INPUT_MAX_PRICE_LKR,
    PRICE_ALERT_THRESHOLD_LKR,
    MAX_PAGES_PER_SITE = 10,
    SITES_ENABLED = ['ikman', 'patpat', 'autodirect', 'cartivate', 'autolanka'],
    DEALER_BRANDS = [],     // Empty = all 11 brands
    NEWS_ENABLED = true,

    // Intern tracker config
    INTERN_MAX_PAGES_PER_SITE = 5,
    INTERN_SITES_ENABLED = ['topjobs', 'xpress-jobs', 'ikman-jobs', 'itpro', 'linkedin'],
    INTERN_KEYWORDS = [
        'IT', 'Software', 'Web', 'Mobile', 'Developer', 'Engineering', 'Data',
        'AI', 'Machine Learning', 'DevOps', 'Cloud', 'QA', 'Testing', 'UI', 'UX',
        'Database', 'Networking', 'Cybersecurity', 'Security', 'System Administration',
        'Computer Science', 'Full Stack', 'Frontend', 'Backend', 'Python', 'Java',
        'React', 'Node.js', 'AWS', 'Azure',
    ],
} = input;

// Price filters — MIN_PRICE_LKR defaults to 10M, no upper cap
const MIN_PRICE_LKR = INPUT_MIN_PRICE_LKR ?? 10_000_000;
const MAX_PRICE_LKR = INPUT_MAX_PRICE_LKR ?? PRICE_ALERT_THRESHOLD_LKR ?? 500_000_000;

// Local .env fallback
const botToken = TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

// Separate channel IDs: vehicle channel, intern channel, ops channel
const vehicleChatId = TELEGRAM_VEHICLE_CHAT_ID || process.env.TELEGRAM_VEHICLE_CHAT_ID || TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
const internChatId = TELEGRAM_INTERN_CHAT_ID || process.env.TELEGRAM_INTERN_CHAT_ID || TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
const opsChatId = TELEGRAM_OPS_CHAT_ID || process.env.TELEGRAM_OPS_CHAT_ID || vehicleChatId;

if (!botToken || (!vehicleChatId && !internChatId)) {
    throw new Error('TELEGRAM_BOT_TOKEN and at least one channel ID (TELEGRAM_VEHICLE_CHAT_ID or TELEGRAM_INTERN_CHAT_ID) must be provided via Apify INPUT or .env');
}

const mode = (MODE || 'both').toLowerCase().trim();
log.info(`🚀 Running in mode: ${mode}`);

// ── Run Vehicle Tracker ─────────────────────────────────────────
if (mode === 'vehicles' || mode === 'both') {
    if (!vehicleChatId) {
        log.error('TELEGRAM_VEHICLE_CHAT_ID is required for vehicle tracking');
    } else {
        try {
            await runVehicleTracker({
                botToken,
                chatId: vehicleChatId,
                opsChatId,
                minPriceLkr: MIN_PRICE_LKR,
                maxPriceLkr: MAX_PRICE_LKR,
                maxPagesPerSite: MAX_PAGES_PER_SITE,
                sitesEnabled: SITES_ENABLED,
                dealerBrands: DEALER_BRANDS,
                newsEnabled: NEWS_ENABLED,
            });
        } catch (err) {
            log.error('Vehicle tracker failed', { error: err.message });
        }
    }
}

// ── Run Intern Tracker ──────────────────────────────────────────
if (mode === 'interns' || mode === 'both') {
    if (!internChatId) {
        log.error('TELEGRAM_INTERN_CHAT_ID is required for intern tracking');
    } else {
        try {
            await runInternTracker({
                botToken,
                chatId: internChatId,
                opsChatId,
                maxPagesPerSite: INTERN_MAX_PAGES_PER_SITE,
                sitesEnabled: INTERN_SITES_ENABLED,
                keywords: INTERN_KEYWORDS,
            });
        } catch (err) {
            log.error('Intern tracker failed', { error: err.message });
        }
    }
}

if (mode !== 'vehicles' && mode !== 'interns' && mode !== 'both') {
    log.error(`Unknown MODE: "${mode}". Use "vehicles", "interns", or "both".`);
}

await Actor.exit();
