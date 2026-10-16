# Deploying on Vercel (Hobby plan)

For a **Cloudflare Pages staging SPA** alongside this Vercel API (preview only, not `showskills.co.uk`), see [DEPLOY-CLOUDFLARE.md](./DEPLOY-CLOUDFLARE.md).

For **Railway EOF ffmpeg worker** (staging Short encodes off Vercel), see [DEPLOY-RAILWAY-EOF.md](./DEPLOY-RAILWAY-EOF.md).

EOF's **Krea video** tab calls Krea from the authenticated Vercel API. Set
`KREA_API_KEY` in the **Vercel staging server environment** to enable generation;
it is not needed on the Railway render worker. The EOF Script AI chooses a Krea
model, then the tab submits the original prompt unchanged to the selected endpoint,
polls the Krea job, and supports preview, download, and handoff to EOF Upload Studio.
The EOF Script AI selects among Krea's Seedance Fast, Seedance 2 Mini, and Wan 3.0
models and reads the requested duration from the chat prompt. Krea's current API
limits a single job to 30 seconds (model-specific limits are lower); longer
single-job durations are rejected with that limit explained. Model selection uses
the existing EOF Script AI credentials configured on Vercel.

Model references: [Seedance Fast](https://www.krea.ai/docs/api-reference/video/seedance-10-pro-fast.md),
[Seedance 2 Mini](https://www.krea.ai/docs/api-reference/video/seedance-20-mini.md),
and [Wan 3.0](https://www.krea.ai/docs/api-reference/video/wan-30.md).

The same tab also has a **Video enhancer** panel. It stages source videos directly
to Vercel Blob using multipart browser uploads, then sends the Blob URL to Krea's
SeedVR 2 (economy/fast, up to 4K) or Topaz Video Upscale (quality, up to 8K)
enhancer. Configure a Vercel Blob store and add its server-only
`BLOB_READ_WRITE_TOKEN` alongside `KREA_API_KEY`. Also set
`EOF_KREA_ENHANCER_MAX_UPLOAD_BYTES` only if you need to override the default
1 GiB per-file cap; choose a value that fits the Blob store, account quota, and
your operational policy (positive integer up to 5 TiB). The UI displays the
active cap and rejects larger selections before transfer.
Staging Blob URLs are public, unguessable URLs so Krea can retrieve the source;
an expiring server-signed ownership token binds upload and cleanup to the EOF
user who initiated the upload. Completed jobs trigger best-effort source
cleanup. Krea's API documentation does not publish comparable per-model prices,
so the UI does not claim an exact cheapest model or display an invented price.

Enhancement currently processes one source per Krea job. The Railway worker has
durable Postgres-backed production jobs and FFmpeg, but its code has no enhancer
job path or Blob/Krea integration. Krea's enhancer OpenAPI schemas also do not
document an input duration or file-size limit from which a safe segment size can
be derived. Long-video segmentation/stitching and native FFmpeg Lanczos/4K
finishing are therefore not enabled. Unlimited duration, file sizes, or account
quota are not promised.

## Serverless function limit (12 max)

API routing uses **five** serverless functions (under the Hobby 12-function limit), all dispatching via `lib/vercelApiDispatch.mjs`:

| File | Paths |
|------|--------|
| `api/[[...slug]].js` | Flat routes, e.g. `/api/payment-config`, `/api/record-cashflows-payment` |
| `api/entries/[...slug].js` | `/api/entries/paid-quiz`, resume quiz, etc. |
| `api/admin/[...slug].js` | `/api/admin/login`, tickets, draw, … |
| `api/auth/[...slug].js` | `/api/auth/register`, login, profile, password reset, … |
| `api/submissions/[...slug].js` | `/api/submissions/kickups` |
| `api/submissions/world-cup-ball/[...slug].js` | `/api/submissions/world-cup-ball/start`, submit, claim, claim-status, send-claim-link |
| `api/newsletter/[...slug].js` | `/api/newsletter/subscribe`, unsubscribe, preferences |
| `api/analytics/[...slug].js` | `/api/analytics/page-view` |
| `api/visitor/[...slug].js` | `/api/visitor/region` (geo + locale for the site shell) |

YouTube OAuth callback uses flat route `/api/youtube-oauth-callback` via root `api/[[...slug]].js` (multi-segment `/api/youtube/oauth/callback` is not reliable on Vercel).

Do **not** add other `.js` files under `api/` without checking the function count. Handler logic lives in `backend/api/` and the route table in `lib/vercelApiDispatch.mjs`. The `archive/` folder is excluded via `.vercelignore`.

**Why not one catch-all?** On Vercel (non-Next), `api/[[...slug]].js` only reliably matches a **single** segment after `/api/`. Deeper paths (e.g. quiz save) return platform `NOT_FOUND` unless routed through a prefix catch-all above.

If deploy still fails with “more than 12 functions”, check the Vercel project for old files on the branch being deployed and ensure `api/stripe-webhook.js` and other legacy stubs are deleted.

## Cashflows + Apple Pay

1. Set `CASHFLOWS_*` and `VITE_CASHFLOWS_ENABLED=1` in Vercel env.
2. In **Cashflows Portal** → Configuration → Payment methods → Card: enable **Apple Pay** and add your domain (`showskills.co.uk`, not `www` unless you use it).
3. Email **implementations@cashflows.com** for the Apple Pay domain verification file. Place it at `public/.well-known/apple-developer-merchantid-domain-association` (copied into `dist` on build). It must return **200** as `text/plain`, not the SPA `index.html` — `vercel.json` excludes `/.well-known/` from the SPA rewrite.
4. **Mac Safari:** needs a card in **Wallet on this Mac** (or iPhone nearby with “Allow payments on Mac”). If the domain file is missing, Cashflows hides the Apple Pay button and only card iframes show — Safari autofill on the card field is **not** the same as Apple Pay and may prompt to add card details.
5. Apple Pay appears on Safari / iOS when the device and domain are fully set up; localhost will not show Apple Pay.
6. **Google Pay:** enable in Cashflows Portal, complete Google Pay Business Console, set `CASHFLOWS_GOOGLE_PAY_MERCHANT_ID` on Vercel. Shown on supported Android / Chrome when Cashflows returns ready.
7. **Samsung Pay** is not part of embedded checkout — see `docs/CASHFLOWS-TESTING.md`.

## PayPal

- **Embedded checkout (on-site card fields)** does not include PayPal in Cashflows’ JS library — only card, Apple Pay, and Google Pay.
- **PayPal button on our site** uses PayPal’s SDK and a **PayPal business account** (`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`). Funds settle in PayPal unless you use PayPal payouts manually.
- **Single settlement via Cashflows only**: use card / Apple Pay; skip PayPal env vars. For PayPal with Cashflows as acquirer, ask Cashflows about **Hosted Checkout** (redirect) with PayPal enabled in the portal.
