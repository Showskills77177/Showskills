# Cloudflare Pages (staging / preview only)

SPA-only dual deploy. **API, Postgres/Neon, EOF Production, admin auth, and Vercel crons stay on Vercel.** Do **not** point `showskills.co.uk` at this Pages project.

## Why builds failed

Three failure modes hit this repo on Pages:

1. **Wrong Node** — Vite **8** needs Node `^20.19.0 || >=22.12.0`. Pages **build system v2** still defaults to Node **18.17.1**, so `vite` dies immediately. Pin via `.nvmrc` / `.node-version` (`22.16.0`) **and** dashboard `NODE_VERSION`, and prefer **build system v3** (default Node 22.16.0).
2. **Vite missing** — With `NODE_ENV=production`, npm skips `devDependencies`. If the build command is plain `npm run build` (Vite framework preset default) and Vite was only a devDependency, you get `vite: not found`. SPA build tools are now in **`dependencies`** so a default install still gets Vite; the Pages script also forces `--include=dev`.
3. **Install OOM / timeout** — Root `optionalDependencies` used to include `ffprobe-static` (~343MB of multi-arch binaries in the tarball). Pages’ default `npm install` (before your build command) can blow memory/disk. `ffprobe-static` was removed (EOF never imports it). `ffmpeg-static` stays optional for Vercel EOF; the Pages script uses `--ignore-scripts` so its postinstall binary download is skipped.

Use `bash scripts/pages-build.sh` so install always includes Vite, skips native postinstalls (SQLite compile / ffmpeg download), and fails fast on old Node. **Do not** use `npm install --omit=optional` — Vite 8’s Rolldown platform bindings are optionalDependencies and must be installed.

## Dashboard settings (preview-only) — set exactly

| Setting | Value |
|--------|--------|
| Git repo | `Showskills77177/Showskills` |
| **Production branch** | **`staging`** (not `main`) |
| Framework preset | **None** (avoid Vite preset overwriting the build command) |
| **Build command** | **`bash scripts/pages-build.sh`** |
| **Build output directory** | **`dist`** |
| Root directory | `/` (repo root) |
| **Build system version** | **v3** (Settings → Builds & deployments). If stuck on v2, `NODE_VERSION` below is required. |
| Custom domain | **none** for production site — use `*.pages.dev` only |

### Environment variables (Pages → Settings → Environment variables)

Apply to **both Production and Preview** for this project (both are staging-class):

| Name | Value | Required? |
|------|--------|-----------|
| **`SKIP_DEPENDENCY_INSTALL`** | **`1`** | **Yes** — stops Pages’ pre-build `npm install` (OOM risk + wrong flags) |
| **`NODE_VERSION`** | **`22.16.0`** | **Yes** on build system v2; recommended on v3 too |
| **`VERCEL_API_ORIGIN`** | Your **Vercel staging** origin, e.g. `https://<project>-….vercel.app` (no trailing slash) | **Yes** for `/api` proxy |
| `VITE_BLOCK_SEARCH_INDEXING` | `1` | Optional (staging branch already injects noindex) |

Do **not** copy payment/DB secrets into Pages — the Function only proxies `/api` to Vercel.

### If the deploy still fails, check the build log for

| Log snippet | Fix |
|-------------|-----|
| `Node 18.17.1` / Vite engine error | Set `NODE_VERSION=22.16.0` and/or switch build system to **v3** |
| `vite: not found` / `vite binary missing` | Build command must be `bash scripts/pages-build.sh`; set `SKIP_DEPENDENCY_INSTALL=1` |
| OOM / killed during `npm install` | Confirm `SKIP_DEPENDENCY_INSTALL=1` and that the command is the script (not a second full install with scripts) |
| Wrong output / empty site | Output directory must be `dist` |
| Production branch `main` | Change Production branch to **`staging`** |

## Branch / production safety

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
node -v   # should be 20.19+ or 22.12+ (repo pins 22.16.0)
# Mimic Pages: skip a prior install, production NODE_ENV, then the script
SKIP_DEPENDENCY_INSTALL=1 NODE_ENV=production CF_PAGES=1 CF_PAGES_BRANCH=staging \
  bash scripts/pages-build.sh
```

Vercel deploy is unchanged (`npm run build`, `api/`, `vercel.json` crons).

## After you pull this commit

1. Cloudflare → Workers & Pages → open the **staging** Pages project (create if needed).
2. Connect GitHub `Showskills77177/Showskills`, production branch **`staging`**.
3. Set **Framework preset = None**, build command **`bash scripts/pages-build.sh`**, output **`dist`**, build system **v3**.
4. Set env vars above on **Production and Preview** (`SKIP_DEPENDENCY_INSTALL`, `NODE_VERSION`, `VERCEL_API_ORIGIN`).
5. Retry deployment; open the `*.pages.dev` URL and confirm `/api/payment-config` (or similar) returns JSON via the proxy.
