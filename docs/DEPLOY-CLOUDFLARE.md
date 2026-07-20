# Cloudflare Pages (staging / preview only)

SPA-only dual deploy. **API, Postgres/Neon, EOF Production, admin auth, and Vercel crons stay on Vercel.** Do **not** point `showskills.co.uk` at this Pages project.

## Why builds failed

Vite **8** requires Node `^20.19.0 || >=22.12.0`. Cloudflare Pages **v2** defaults to Node **18.17.1**, so `npm run build` fails (engine / Vite binary). This repo pins Node via `.nvmrc` / `.node-version` (`22.16.0`).

Secondary failure modes:

- `NODE_ENV=production` → npm skips `devDependencies` → `vite: not found`
- Optional `ffmpeg-static` / `ffprobe-static` (~400MB) → install OOM/timeout on Pages (not needed for the SPA)

Use the Pages build script below so install always includes Vite and skips native postinstall scripts (SQLite compile / ffmpeg downloads). **Do not** use `npm install --omit=optional` — Vite 8’s Rolldown platform bindings are optionalDependencies and must be installed.

## Dashboard settings (preview-only)

| Setting | Value |
|--------|--------|
| Git repo | `Showskills77177/Showskills` |
| **Production branch** | **`staging`** (not `main`) |
| Framework preset | Vite (or None) |
| Build command | `bash scripts/pages-build.sh` |
| Build output directory | `dist` |
| Root directory | `/` (repo root) |
| Build system | **v3** preferred (default Node 22) |
| Custom domain | **none** for production site — use `*.pages.dev` only |

### Environment variables (Pages → Settings → Environment variables)

Apply to **Production** and **Preview** for this project (both are staging-class):

| Name | Value |
|------|--------|
| `NODE_VERSION` | `22.16.0` (belt-and-suspenders with `.nvmrc`) |
| `SKIP_DEPENDENCY_INSTALL` | `1` |
| `VERCEL_API_ORIGIN` | Your **Vercel staging** origin, e.g. `https://<project>-….vercel.app` (no trailing slash) |
| `VITE_BLOCK_SEARCH_INDEXING` | `1` (optional; staging branch already injects noindex) |

Do **not** copy payment/DB secrets into Pages — the Function only proxies `/api` to Vercel.

### Branch / production safety

1. Production branch = **`staging`** so pushes to `main` do not become this project’s “production” deploy.
2. Optionally disable automatic deployments for all branches except `staging` (Settings → Builds & deployments).
3. Never add `showskills.co.uk` (or `www`) as a custom domain on this project.

## How `/api` works

1. Browser calls same-origin `/api/...` (existing `apiFetch` / relative paths).
2. Pages Function `functions/api/[[path]].js` proxies to `VERCEL_API_ORIGIN`.
3. Cookies (`credentials: 'include'`) stay first-party on the Pages host.

Alternative (no Function): set build-time `VITE_API_BASE` to the Vercel staging URL. Prefer the proxy — CORS + cookie credentials are already wired for same-origin.

## Local check

```bash
node -v   # should be 20.19+ or 22.12+
bash scripts/pages-build.sh
```

Vercel deploy is unchanged (`npm run build`, `api/`, `vercel.json` crons).

## After you pull this commit

1. Cloudflare → Workers & Pages → Create / open the **staging** Pages project.
2. Connect GitHub `Showskills77177/Showskills`, production branch **`staging`**.
3. Set build command, output `dist`, env vars above (especially `VERCEL_API_ORIGIN` + `SKIP_DEPENDENCY_INSTALL=1`).
4. Retry deployment; open the `*.pages.dev` URL and confirm `/api/payment-config` (or similar) returns JSON via the proxy.
