#!/usr/bin/env bash
# Cloudflare Pages build: ensure Vite is installed, skip native postinstall
# scripts (better-sqlite3 compile, ffmpeg binary download), then run the SPA
# build. API / EOF / crons stay on Vercel.
#
# Required dashboard settings (Production + Preview for this project):
#   Build command:          bash scripts/pages-build.sh
#   Build output directory: dist
#   Production branch:      staging
#   Build system version:   v3  (or set NODE_VERSION below on v2)
#   SKIP_DEPENDENCY_INSTALL=1
#   NODE_VERSION=22.16.0
#   VERCEL_API_ORIGIN=https://<your-vercel-staging>.vercel.app
#
# SKIP_DEPENDENCY_INSTALL is mandatory: without it, Pages runs a default
# npm install first (often NODE_ENV=production + postinstall scripts) which
# can OOM on optional natives or skip Vite before this script runs.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[pages-build] node $(node -v) npm $(npm -v)"
echo "[pages-build] NODE_ENV=${NODE_ENV:-} CF_PAGES=${CF_PAGES:-} CF_PAGES_BRANCH=${CF_PAGES_BRANCH:-}"

# Vite 8 requires Node ^20.19.0 || >=22.12.0 (see package.json engines).
node_ok="$(
  node <<'EOF'
const [maj, min] = process.versions.node.split('.').map(Number)
const ok = (maj === 20 && min >= 19) || maj >= 22
process.stdout.write(ok ? '1' : '0')
if (!ok) {
  console.error(
    `[pages-build] Node ${process.versions.node} is too old for Vite 8. ` +
      `Set Pages env NODE_VERSION=22.16.0 and/or Build system version v3 ` +
      `(repo has .nvmrc / .node-version = 22.16.0).`
  )
}
EOF
)"
if [[ "$node_ok" != "1" ]]; then
  exit 1
fi

# CF / npm often set NODE_ENV=production, which omits devDependencies.
# Unset for the install step only; --include=dev is belt-and-suspenders.
# --ignore-scripts: skip better-sqlite3 node-gyp + ffmpeg-static download
#   (SPA build does not need them; keeps Pages under memory/disk limits).
# Do NOT use --omit=optional: Vite 8 Rolldown platform bindings are optionalDeps.
if [[ -f package-lock.json ]]; then
  echo "[pages-build] npm ci --include=dev --ignore-scripts"
  env -u NODE_ENV -u NPM_CONFIG_PRODUCTION npm ci --include=dev --ignore-scripts
else
  echo "[pages-build] npm install --include=dev --ignore-scripts"
  env -u NODE_ENV -u NPM_CONFIG_PRODUCTION npm install --include=dev --ignore-scripts
fi

if [[ ! -x node_modules/.bin/vite ]]; then
  echo "[pages-build] ERROR: vite binary missing after install." >&2
  echo "[pages-build] Confirm SKIP_DEPENDENCY_INSTALL=1 and build command is:" >&2
  echo "[pages-build]   bash scripts/pages-build.sh" >&2
  echo "[pages-build] (not plain npm run build)." >&2
  exit 1
fi

# Prefer a larger heap on constrained Pages builders (large client chunk).
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=4096"

echo "[pages-build] vite $(node_modules/.bin/vite --version 2>/dev/null || echo unknown)"
NODE_ENV=production npm run build
echo "[pages-build] wrote dist/"
ls -la dist | head -20
