import axios from 'axios';
import { log } from 'apify';

const TG_API = 'https://api.telegram.org/bot';

/**
 * Escape Telegram MarkdownV2 special characters.
 */
export function escapeMd(text) {
    if (!text) return '';
    return String(text).replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

function formatLKR(n) {
    if (!n) return 'N/A';
    return `LKR ${n.toLocaleString('en-US')}`;
}

function formatKm(n) {
    if (n === null || n === undefined) return 'N/A';
    return `${n.toLocaleString('en-US')} km`;
}

/**
 * Build field-specific hashtag from a field name.
 */
function fieldToHashtag(field) {
    if (!field) return '';
    return '#' + field.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
}

// ── Vehicle Market Alerts ───────────────────────────────────────

export async function sendDealAlert(botToken, chatId, listing) {
    const scoreBar = '█'.repeat(Math.round(listing.deal_score / 10)) + '░'.repeat(10 - Math.round(listing.deal_score / 10));

    const lines = [
        `🚗 *${escapeMd(listing.title)}*`,
        ``,
        `💰 *Price:* ${escapeMd(formatLKR(listing.price_lkr))}`,
        `📅 *Year:* ${escapeMd(String(listing.year || 'N/A'))}`,
        `🛣 *Mileage:* ${escapeMd(formatKm(listing.mileage_km))}`,
        `📍 *Location:* ${escapeMd(listing.location || 'N/A')}`,
        `🏷 *Trim:* ${escapeMd(listing.trim || 'N/A')}`,
        `🔧 *Condition:* ${escapeMd(listing.condition || 'N/A')}`,
        `🏪 *Source:* ${escapeMd(listing.source)}`,
        ``,
        `⭐ *Deal Score:* ${escapeMd(String(listing.deal_score))}/100`,
        `\`${scoreBar}\``,
        ``,
        `[View Listing](${listing.url})`,
        ``,
        `${escapeMd('#vehicle #over10M #' + (listing.source || 'market'))}`,
    ];

    const text = lines.join('\n');
    return sendMessage(botToken, chatId, text, 'MarkdownV2');
}

// ── Official Dealer Alerts ──────────────────────────────────────

export async function sendDealerAlert(botToken, chatId, listing) {
    const lines = [
        `🏭 *${escapeMd(listing.brand || 'Vehicle')} \\- ${escapeMd(listing.model || listing.title)}*`,
        ``,
        `💰 *Price:* ${escapeMd(listing.price_lkr ? formatLKR(listing.price_lkr) : (listing.price_raw || 'Contact dealer'))}`,
        `🏢 *Dealer:* ${escapeMd(listing.source || 'Official')}`,
    ];

    if (listing.url) {
        lines.push(``, `[View on Official Site](${listing.url})`);
    }

    const brandTag = listing.brand ? '#' + listing.brand.replace(/\s+/g, '') : '#dealer';
    lines.push(``, `${escapeMd('#vehicle #official ' + brandTag)}`);

    const text = lines.join('\n');
    return sendMessage(botToken, chatId, text, 'MarkdownV2');
}

// ── Vehicle News Alerts ─────────────────────────────────────────

export async function sendNewsAlert(botToken, chatId, article) {
    const lines = [
        `📰 *${escapeMd(article.title)}*`,
        ``,
    ];

    if (article.summary) {
        lines.push(`${escapeMd(article.summary.substring(0, 250))}`, ``);
    }

    lines.push(
        `📌 *Source:* ${escapeMd(article.source_label || article.source)}`,
    );

    if (article.date) {
        lines.push(`📅 *Date:* ${escapeMd(article.date)}`);
    }

    if (article.url) {
        lines.push(``, `[Read Full Article](${article.url})`);
    }

    const categoryTag = article.category ? '#' + article.category : '#marketupdate';
    lines.push(``, `${escapeMd('#vehiclenews ' + categoryTag)}`);

    const text = lines.join('\n');
    return sendMessage(botToken, chatId, text, 'MarkdownV2');
}

// ── Intern Alerts ───────────────────────────────────────────────

export async function sendInternAlert(botToken, chatId, post) {
    const scoreBar = '█'.repeat(Math.round(post.relevance_score / 10)) + '░'.repeat(10 - Math.round(post.relevance_score / 10));

    const qualsList = post.qualifications && post.qualifications.length > 0
        ? post.qualifications.slice(0, 8).join(', ')
        : 'Not specified';

    const lines = [
        `💼 *${escapeMd(post.title)}*`,
        ``,
        `🏢 *Company:* ${escapeMd(post.company || 'Not specified')}`,
        `💰 *Salary:* ${escapeMd(post.salary_range || 'Not mentioned')}`,
        `⏱ *Duration:* ${escapeMd(post.duration || 'Not specified')}`,
        `📍 *Location:* ${escapeMd(post.location || 'N/A')}`,
        `🎯 *Field:* ${escapeMd(post.field || 'IT')}`,
        `📋 *Skills:* ${escapeMd(qualsList)}`,
    ];

    if (post.deadline) {
        const deadlineDate = new Date(post.deadline).toLocaleDateString('en-LK', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
        lines.push(`📅 *Deadline:* ${escapeMd(deadlineDate)}`);
    }

    lines.push(
        ``,
        `⭐ *Relevance Score:* ${escapeMd(String(post.relevance_score))}/100`,
        `\`${scoreBar}\``,
        ``,
        `🌐 *Source:* ${escapeMd(post.source)}`,
        `[View Posting](${post.url})`,
        ``,
        `${escapeMd('#intern #IT ' + fieldToHashtag(post.field))}`,
    );

    const text = lines.join('\n');
    return sendMessage(botToken, chatId, text, 'MarkdownV2');
}

// ── Ops Alerts ──────────────────────────────────────────────────

export async function sendOpsAlert(botToken, chatId, message) {
    if (!chatId) return;
    // Plain text for ops alerts to avoid markdown escape issues
    return sendMessage(botToken, chatId, message, null);
}

// ── Core Send ───────────────────────────────────────────────────

async function sendMessage(botToken, chatId, text, parseMode) {
    try {
        const payload = {
            chat_id: chatId,
            text,
            disable_web_page_preview: false,
        };
        if (parseMode) payload.parse_mode = parseMode;

        const res = await axios.post(`${TG_API}${botToken}/sendMessage`, payload, {
            timeout: 15000,
            validateStatus: s => s < 500,
        });

        if (res.data && res.data.ok === false) {
            log.warning('Telegram API returned ok=false', { description: res.data.description });
            // Fallback: retry without markdown if parse error
            if (parseMode && /can't parse|entities/i.test(res.data.description || '')) {
                log.info('Retrying Telegram send without markdown');
                return axios.post(`${TG_API}${botToken}/sendMessage`, {
                    chat_id: chatId,
                    text: text.replace(/\\([_*\[\]()~`>#+=|{}.!\\-])/g, '$1'),
                    disable_web_page_preview: false,
                }, { timeout: 15000 });
            }
        }
        return res.data;
    } catch (err) {
        log.error('Telegram send failed', { error: err.message });
        throw err;
    }
}
