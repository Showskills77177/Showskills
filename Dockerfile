FROM node:20-bullseye-slim

# Install ffmpeg and ca-certificates
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
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
