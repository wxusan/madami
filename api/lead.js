// /api/lead.js — Vercel Node.js Serverless Function
//
// Purpose: receive a contact-form POST from the website, validate it,
// verify the user passed Cloudflare Turnstile, rate-limit by IP, and
// forward the message to the company Telegram group via the bot API.
//
// SECURITY NOTES
//   * The Telegram bot token NEVER ships to the browser. It lives only
//     in TELEGRAM_BOT_TOKEN as a Vercel environment variable.
//   * Cloudflare Turnstile keeps drive-by spam out (server-verified).
//   * A simple in-memory token-bucket rate-limiter blocks bursts from a
//     single IP. For production scale, swap this for Upstash Redis.
//   * All inputs are length-capped and HTML-escaped before being sent
//     to Telegram (we use parse_mode: HTML so unescaped < > & would let
//     a submitter inject markup into the channel).
//
// REQUIRED ENV VARS
//   TELEGRAM_BOT_TOKEN     – the new bot token (after rotation)
//   TELEGRAM_CHAT_ID       – e.g. -1002347061578
//
// OPTIONAL ENV VARS
//   TURNSTILE_SECRET_KEY   – from Cloudflare Turnstile dashboard.
//                            If unset, captcha is disabled (faster
//                            launch but more spam risk).
//   ALLOWED_ORIGIN         – defaults to https://madami.uz
//   RATE_LIMIT_PER_MIN     – defaults to 5

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://madami.uz';
const RATE_LIMIT_PER_MIN = parseInt(process.env.RATE_LIMIT_PER_MIN || '5', 10);

// ── In-memory rate limiter ────────────────────────────────────────────
const buckets = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const b = buckets.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > b.resetAt) {
    b.count = 0;
    b.resetAt = now + windowMs;
  }
  b.count += 1;
  buckets.set(ip, b);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  }
  return b.count <= RATE_LIMIT_PER_MIN;
}

// ── Helpers ───────────────────────────────────────────────────────────
const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const cap = (s, n) => String(s || '').slice(0, n).trim();

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

async function verifyTurnstile(token, ip) {
  // If no Turnstile secret is configured, skip the check (captcha disabled).
  if (!process.env.TURNSTILE_SECRET_KEY) return true;
  const params = new URLSearchParams();
  params.set('secret', process.env.TURNSTILE_SECRET_KEY);
  params.set('response', token || '');
  if (ip) params.set('remoteip', ip);
  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body: params }
  );
  const data = await res.json().catch(() => ({}));
  return data && data.success === true;
}

// ── Handler ───────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot — bots fill every field; humans never see this one.
  if (body.company) {
    res.status(200).json({ ok: true });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  const ok = await verifyTurnstile(body.turnstileToken, ip);
  if (!ok) {
    res.status(400).json({ error: 'Captcha failed' });
    return;
  }

  const name    = cap(body.name, 80);
  const ageRaw  = cap(body.age, 4);
  const phone   = cap(body.phone, 30);
  const tg      = cap(body.tg, 40);
  const country = cap(body.country, 30);
  const ielts   = cap(body.ielts, 10);
  const edu     = cap(body.edu, 20);
  const comment = cap(body.comment, 1000);
  if (!name || !phone || !tg || !country) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  const age = parseInt(ageRaw, 10);
  if (!Number.isFinite(age) || age < 14 || age > 80) {
    res.status(400).json({ error: 'Invalid age' });
    return;
  }
  if (!/^\+?[\d\s().-]{6,}$/.test(phone)) {
    res.status(400).json({ error: 'Invalid phone' });
    return;
  }
  const allowedCountries = ['🇺🇸 USA', '🇬🇧 UK', '🇨🇦 Canada'];
  if (!allowedCountries.includes(country)) {
    res.status(400).json({ error: 'Invalid country' });
    return;
  }

  const num = Math.floor(1000 + Math.random() * 9000);
  const lines = [
    `🏢 <b>№ ${num}</b>`,
    `ℹ️ <b>Source:</b> madami.uz`,
    `👤 User: ${escapeHtml(name)}`,
    `🕐 Yoshi: ${age}`,
    `💻 Ielts: ${escapeHtml(ielts)}`,
    `📞 Aloqa: ${escapeHtml(phone)}`,
    `✈️ Telegram username: ${escapeHtml(tg)}`,
    `🌍 Yo'nalish: ${escapeHtml(country)}`,
  ];
  if (edu)     lines.push(`🏛 Talim turi: ${escapeHtml(edu)}`);
  if (comment) lines.push(`📱 Qo'shimcha izoh: ${escapeHtml(comment)}`);
  lines.push(`🛰 IP: ${escapeHtml(ip)}`);

  const text = lines.join('\n');

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );
    const data = await tgRes.json().catch(() => ({}));
    if (!data.ok) {
      console.error('Telegram error', data);
      res.status(502).json({ error: 'Upstream failed' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Telegram fetch failed', err);
    res.status(502).json({ error: 'Upstream failed' });
  }
};
