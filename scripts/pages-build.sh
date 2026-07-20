#!/usr/bin/env bash
# Cloudflare Pages build: ensure Vite (devDependency) is installed, skip native
# postinstall scripts (better-sqlite3 compile, ffmpeg/ffprobe binary downloads),
# then run the SPA build. API/EOF stay on Vercel.
#
# Dashboard:
#   SKIP_DEPENDENCY_INSTALL=1
#   Build command: bash scripts/pages-build.sh
#   Output directory: dist
#   Production branch: staging
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[pages-build] node $(node -v) npm $(npm -v)"

# --include=dev: Vite is a devDependency; NODE_ENV=production would skip it.
# --ignore-scripts: skip better-sqlite3 node-gyp + ffmpeg/ffprobe downloads (not needed for Vite).
# Do NOT use --omit=optional: Vite 8 / Rolldown platform bindings are optionalDependencies.
npm install --include=dev --ignore-scripts
npm run build
echo "[pages-build] wrote dist/"
