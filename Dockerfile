FROM node:20-bullseye-slim

# Install ffmpeg, ca-certificates, and the yt-dlp standalone binary (video-footage pipeline).
# yt-dlp only ever runs here (Railway worker) — never on Vercel.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
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
