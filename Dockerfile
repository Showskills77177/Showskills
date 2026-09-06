FROM node:22-bookworm-slim

# Install ffmpeg, ca-certificates, and the yt-dlp standalone binary (video-footage pipeline).
# yt-dlp only ever runs here (Railway worker) — never on Vercel.
# Refresh package metadata on every retry. Bullseye's security repository started
# returning 404s for superseded ffmpeg dependencies, and retrying install against
# the same stale package lists could never recover.
#
# IMPORTANT: fetch `yt-dlp_linux`, NOT the bare `yt-dlp` release asset. The bare asset is a
# ~3MB Python zipapp that requires a `python3` interpreter on PATH to run at all -- this
# slim Node base image has no Python3, so that binary downloads and chmods
# fine but fails every single invocation at runtime with "python3: not found", which
# isYtDlpAvailable() correctly reports as unavailable. `yt-dlp_linux` is a self-contained
# PyInstaller build (~20MB) with zero external interpreter dependency.
#
# The trailing `--version`/`-version` checks make a broken binary fail the BUILD itself,
# instead of shipping silently and only surfacing as a boot-time log line nobody watches.
RUN set -eux; \
  for attempt in 1 2 3; do \
    rm -rf /var/lib/apt/lists/*; \
    apt-get update; \
    if apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=30 install -y --no-install-recommends \
         ffmpeg ca-certificates curl; then \
      break; \
    fi; \
    if [ "$attempt" -eq 3 ]; then exit 1; fi; \
    sleep 5; \
  done; \
  curl --fail --show-error --retry 5 --retry-connrefused -L \
       https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp; \
  rm -rf /var/lib/apt/lists/*; \
  /usr/local/bin/yt-dlp --version; \
  ffmpeg -version >/dev/null

WORKDIR /app

# Copy package files first for dependency install
COPY package.json package-lock.json* ./

# Default to production install; Railway can override with ARG
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Install dependencies (omit dev to reduce build-time cache issues)
RUN npm ci --omit=dev

# Copy app
COPY . .

# Expose port used by worker
EXPOSE 8080

# Run the worker script
CMD ["node", "./scripts/eof-railway-worker.mjs"]
