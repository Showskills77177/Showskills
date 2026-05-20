# Vercel Firewall — setup for ShowSkills

Vercel Firewall is configured in the **Vercel Dashboard**, not in this repo. Use it together with the app’s rate limits and Stripe webhook.

## Prerequisites

- Project deployed on Vercel (Production domain on HTTPS).
- **Pro** plan or higher for full **Web Application Firewall (WAF)** rules; all plans can use basic **Attack Challenge Mode**.

## 1. Attack Challenge Mode (quick win)

1. Open [vercel.com](https://vercel.com) → your **showskills** project.
2. **Settings** → **Security** (or **Firewall** depending on UI).
3. Enable **Attack Challenge Mode** (or **Bot Protection** / challenge suspicious traffic).
4. Save. Suspicious clients see a challenge before your site loads.

Good for: generic bots, casual scraping, some DDoS noise.

## 2. Firewall rules (Pro / Enterprise WAF)

Path: **Project → Firewall** (or **Security → Firewall**).

Suggested rules (adjust host to your domain):

| Rule | Condition | Action |
|------|-----------|--------|
| Block bad bots | User-Agent contains known scraper patterns you don’t need | Block |
| Challenge admin | Path starts with `/admin` AND country not in {GB, IE} (optional) | Challenge or Log |
| Rate limit API | Path starts with `/api/` | Rate limit (e.g. 100 req/min per IP) |
| Allow Stripe webhook | Path equals `/api/stripe-webhook` | Allow (no challenge) |

**Important:** Do **not** challenge or block Stripe’s webhook IPs. Stripe sends webhooks from fixed IP ranges — in WAF, **allow** `POST /api/stripe-webhook` or use Stripe’s [webhook IP list](https://stripe.com/docs/ips).

## 3. IP allowlist for `/admin` (optional, strict)

If only you access admin from a known home/office IP:

1. Firewall → **Add rule**.
2. **If** path matches `/admin*` **and** IP is **not** in your allowlist → **Deny**.
3. Add your home/mobile carrier IPs (they may change — use sparingly).

Email OTP login (Resend) still protects admin even without IP allowlist.

## 4. Environment variables (already on Vercel)

Confirm **Production** has:

- `STRIPE_WEBHOOK_SECRET` — you added this ✓
- `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`
- `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `ADMIN_JWT_SECRET` (32+ chars)
- Admin 2FA email: `RESEND_API_KEY`, `ADMIN_EMAIL` (free Resend tier)
- `SITE_URL` or `ALLOWED_ORIGINS` — your live site URL

Redeploy after any env change.

## 5. Verify Stripe webhook

1. Stripe Dashboard → **Developers** → **Webhooks**.
2. Endpoint: `https://YOUR_DOMAIN/api/stripe-webhook`
3. Event: `payment_intent.succeeded`
4. Signing secret = same as `STRIPE_WEBHOOK_SECRET` in Vercel.
5. Send test event → Vercel **Functions** logs should show `200`.

## 6. DDoS / edge

Vercel includes platform-level DDoS mitigation on all plans. Firewall rules add app-specific control on top.

## 7. What Firewall does *not* replace

- Strong **admin password** + **email verification code** (Resend, free tier).
- Server-side **payment amount** checks (already in code).
- **Stripe Radar** for card fraud.
- Keeping **E2E_MODE** unset in production.

## Links

- [Vercel Firewall docs](https://vercel.com/docs/security/vercel-firewall)
- [Stripe webhook IPs](https://stripe.com/docs/ips)
- [ShowSkills SECURITY.md](./SECURITY.md)
