# syntax=docker/dockerfile:1
# Production image for Taatom backend (Express JS — no transpile / no build step).
# Node 20 LTS on Debian bookworm-slim (glibc for @ffmpeg-installer / @ffprobe-installer).
# engines: ">=18"; CI uses Node 20.x

# -----------------------------------------------------------------------------
# Stage: production dependencies
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# -----------------------------------------------------------------------------
# Stage: runner
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# curl for HEALTHCHECK; ca-certificates for outbound HTTPS (Atlas, Upstash, Sevalla, APIs)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src
COPY policies ./policies
COPY public ./public

USER node

EXPOSE 3000

# Existing GET /health — no application route changes
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/health || exit 1

CMD ["npm", "start"]
