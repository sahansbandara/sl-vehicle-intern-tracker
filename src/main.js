import { Actor, log } from 'apify';
import { runVehicleTracker } from './modes/vehicle-tracker.js';
import { runInternTracker } from './modes/intern-tracker.js';

const DEFAULT_VEHICLE_SITES = ['ikman', 'patpat', 'autodirect', 'cartivate', 'autolanka'];
const DEFAULT_INTERN_SITES = ['topjobs', 'xpress-jobs', 'ikman-jobs', 'itpro', 'linkedin'];
const DEFAULT_INTERN_KEYWORDS = [
    'IT', 'Software', 'Web', 'Mobile', 'Developer', 'Engineering', 'Data',
    'AI', 'Machine Learning', 'DevOps', 'Cloud', 'QA', 'Testing', 'UI', 'UX',
    'Database', 'Networking', 'Cybersecurity', 'Security', 'System Administration',
    'Computer Science', 'Full Stack', 'Frontend', 'Backend', 'Python', 'Java',
    'React', 'Node.js', 'AWS', 'Azure',
];

await Actor.init();

const input = await Actor.getInput() ?? {};

function parseInteger(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function parseBoolean(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;

    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return null;
}

function parseStringArray(value) {
    if (value === null || value === undefined || value === '') return null;
    if (Array.isArray(value)) {
        const cleaned = value.map(v => String(v).trim()).filter(Boolean);
        return cleaned.length > 0 ? cleaned : null;
    }

    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                const cleaned = parsed.map(v => String(v).trim()).filter(Boolean);
                return cleaned.length > 0 ? cleaned : null;
            }
        } catch {
            // Fall through to comma-separated parsing.
        }
    }

    const cleaned = trimmed.split(',').map(part => part.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : null;
}

// Price filters — MIN_PRICE_LKR defaults to 10M, no upper cap.
const MIN_PRICE_LKR = parseInteger(input.MIN_PRICE_LKR) ?? parseInteger(process.env.MIN_PRICE_LKR) ?? 10_000_000;
const MAX_PRICE_LKR = parseInteger(input.MAX_PRICE_LKR)
    ?? parseInteger(input.PRICE_ALERT_THRESHOLD_LKR)
    ?? parseInteger(process.env.MAX_PRICE_LKR)
    ?? parseInteger(process.env.PRICE_ALERT_THRESHOLD_LKR)
    ?? 500_000_000;
const MIN_VEHICLE_YEAR = parseInteger(input.MIN_VEHICLE_YEAR) ?? parseInteger(process.env.MIN_VEHICLE_YEAR) ?? 2022;
const MAX_PAGES_PER_SITE = parseInteger(input.MAX_PAGES_PER_SITE) ?? parseInteger(process.env.MAX_PAGES_PER_SITE) ?? 10;
const SITES_ENABLED = parseStringArray(input.SITES_ENABLED) ?? parseStringArray(process.env.SITES_ENABLED) ?? DEFAULT_VEHICLE_SITES;
const DEALER_BRANDS = parseStringArray(input.DEALER_BRANDS) ?? parseStringArray(process.env.DEALER_BRANDS) ?? [];
const NEWS_ENABLED = parseBoolean(input.NEWS_ENABLED) ?? parseBoolean(process.env.NEWS_ENABLED) ?? true;

// Intern tracker config
const INTERN_MAX_PAGES_PER_SITE = parseInteger(input.INTERN_MAX_PAGES_PER_SITE) ?? parseInteger(process.env.INTERN_MAX_PAGES_PER_SITE) ?? 5;
const INTERN_SITES_ENABLED = parseStringArray(input.INTERN_SITES_ENABLED) ?? parseStringArray(process.env.INTERN_SITES_ENABLED) ?? DEFAULT_INTERN_SITES;
const INTERN_KEYWORDS = parseStringArray(input.INTERN_KEYWORDS) ?? parseStringArray(process.env.INTERN_KEYWORDS) ?? DEFAULT_INTERN_KEYWORDS;
const MODE = input.MODE ?? process.env.MODE ?? 'both';

const {
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_VEHICLE_CHAT_ID,
    TELEGRAM_INTERN_CHAT_ID,
    TELEGRAM_OPS_CHAT_ID,
    TELEGRAM_CHAT_ID,
} = input;

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
                minVehicleYear: MIN_VEHICLE_YEAR,
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
