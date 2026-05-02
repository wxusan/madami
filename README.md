# madami.uz

Marketing site for Madami Consulting. Static `index.html` + a single
Vercel serverless function (`/api/lead`) that forwards lead-form
submissions to the company Telegram group.

The bot token lives **only** in the Vercel environment — it's never
shipped to the browser.

---

## Local preview

You have two options.

### Option A — full preview, including the form (recommended)

This emulates Vercel locally so `/api/lead` actually works.

```bash
# 1. one-time: install Node 18+ and the Vercel CLI
npm i -g vercel

# 2. inside the project folder
cd madami-fixed
cp .env.example .env.local
# open .env.local and paste the values from the table below
vercel dev
```

Open <http://localhost:3000>. The form will POST to your local
`/api/lead`, which reads the env vars from `.env.local` and forwards
the message to your real Telegram group.

### Option B — visual-only preview (no working form)

If you just want to look at the page, no Node, no Vercel:

```bash
cd madami-fixed
python3 -m http.server 8000
# then open http://localhost:8000
```

Or simply double-click `index.html`. Submitting the form will show
*"Form faqat HTTP server orqali ishlaydi…"* — that's expected, since
there's no `/api/lead` endpoint without Vercel.

---

## Environment variables — what to paste into Vercel

In **Vercel → Project → Settings → Environment Variables**, add the
following. Tick **Production**, **Preview**, and **Development** so
they're available everywhere.

| Name                 | Value                                                 | Required? |
| -------------------- | ----------------------------------------------------- | --------- |
| `TELEGRAM_BOT_TOKEN` | your new token from @BotFather                         | ✅ yes    |
| `TELEGRAM_CHAT_ID`   | `-1002347061578`                                      | ✅ yes    |
| `ALLOWED_ORIGIN`     | `https://madami.uz`                                   | optional  |
| `RATE_LIMIT_PER_MIN` | `5`                                                   | optional  |
| `TURNSTILE_SECRET_KEY` | *(leave unset until you wire Cloudflare Turnstile)* | optional  |

After saving, **trigger a redeploy** (env-var changes don't auto-deploy
serverless functions): in the Vercel dashboard, go to the latest
deployment and hit **Redeploy** — or run `vercel --prod` from your
machine.

> ⚠️ The old `TELEGRAM_BOT_TOKEN` was previously hard-coded in
> `index.html`, so it should be treated as public/burned. Rotate it with
> @BotFather and paste only the new value into Vercel. Do not commit the
> real token to this repo.

---

## Local `.env.local` (for `vercel dev`)

`.env.example` shows the full list. Quick copy/paste:

```env
TELEGRAM_BOT_TOKEN=your-new-token-from-botfather
TELEGRAM_CHAT_ID=-1002347061578
ALLOWED_ORIGIN=http://localhost:3000
RATE_LIMIT_PER_MIN=20
```

> Note `ALLOWED_ORIGIN=http://localhost:3000` for local dev (the API
> only sets the CORS header for that origin). Bump `RATE_LIMIT_PER_MIN`
> while you're testing so you don't lock yourself out.

`.env.local` is already in `.gitignore` — never commit it.

---

## Deploy

```bash
# Preview (every push gets its own URL)
vercel

# Production
vercel --prod
```

`vercel.json` configures security headers (CSP, HSTS, X-Frame-Options,
Referrer-Policy, Permissions-Policy) and year-long cache for `/assets/*`.

---

## Runbook — rotating the Telegram bot token

1. **Revoke the old token.** Telegram → @BotFather → `/revoke` →
   pick `Madamiconsultingbot`. The old token is immediately invalidated.
2. **Get a new token.** `/token` (same bot, new token) or `/newbot`
   (start fresh — then add the new bot to the Telegram group as admin
   with "post messages" rights).
3. **Update Vercel.** Project → Settings → Environment Variables →
   edit `TELEGRAM_BOT_TOKEN` → paste new value.
4. **Redeploy.** `vercel --prod` (or click Redeploy in dashboard).
5. **Smoke-test.** Submit a junk lead from the site, confirm it arrives
   in the Telegram group.

---

## Runbook — adding Cloudflare Turnstile (anti-spam) later

When you decide to lock down spam:

1. <https://dash.cloudflare.com> → Turnstile → Add site → get
   **Site key** (public) and **Secret key** (private).
2. Add `TURNSTILE_SECRET_KEY` to Vercel env vars.
3. In `index.html`, before `</head>`, add:
   ```html
   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
   ```
4. Inside the `<form id="leadForm">`, just before the submit button, add:
   ```html
   <div class="cf-turnstile"
        data-sitekey="YOUR_SITE_KEY"
        data-theme="light"
        data-size="flexible"
        style="margin-top:14px"></div>
   ```
5. In `assets/js/main.js`, add this line near the top of the submit
   handler (before the `fetch`):
   ```js
   const turnstileToken = form.querySelector('input[name="cf-turnstile-response"]')?.value || '';
   ```
   and include `turnstileToken` in the JSON body.
6. Redeploy. The API handler already verifies the token when
   `TURNSTILE_SECRET_KEY` is set.

---

## Files

```
.
├── api/
│   └── lead.js              # POST endpoint — Telegram forwarder
├── assets/
│   ├── css/main.css         # all page styles
│   ├── js/main.js           # all page scripts
│   ├── *.webp / *.jpg / *.png / *.svg
│   └── og-cover.png         # social-share image (1200×630)
├── index.html               # marketing page
├── privacy.html             # /privacy
├── terms.html               # /terms
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── vercel.json              # security headers + cache rules
├── package.json             # for `vercel dev`
├── .env.example
└── .gitignore
```
