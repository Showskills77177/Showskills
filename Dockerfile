FROM node:20-bullseye-slim

# Install ffmpeg, ca-certificates, and the yt-dlp standalone binary (video-footage pipeline).
# yt-dlp only ever runs here (Railway worker) — never on Vercel.
# Debian's mirror network occasionally resets connections mid-fetch on Railway's build
# infra; retry apt itself (Acquire::Retries) and retry the whole install a few times so a
# single flaky package fetch doesn't fail the entire image build.
RUN apt-get update \
  && apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=30 install -y --no-install-recommends \
       ffmpeg ca-certificates curl \
  || apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=30 install -y --no-install-recommends \
       ffmpeg ca-certificates curl \
  || (apt-get update && apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=30 install -y --no-install-recommends \
       ffmpeg ca-certificates curl) \
  && curl --retry 5 --retry-connrefused -L \
       https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

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
