# ===== BASE BUILD (heavy, temporary) =====
FROM node:24-bookworm AS builder

RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    libvips-dev \
    openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

# Copy only deps first (cache friendly)
# pnpm-workspace.yaml is required for pnpm 10 allowBuilds config
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# Rebuild native modules for the current Linux platform
RUN pnpm rebuild sharp youtube-dl-exec

# Copy source
COPY . .

ENV DATABASE_URL="mongodb://localhost:27017/db"

# Prisma generate (build-time only)
RUN npx prisma generate

# Build app
RUN pnpm build

# Remove dev dependencies to slim down node_modules
RUN pnpm prune --prod


# ===== RUNTIME (super clean & kecil) =====
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

# Install only runtime dependencies (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    libvips \
    openssl \
    ffmpeg \
    tini \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/gallery-dl \
    && /opt/gallery-dl/bin/pip install --no-cache-dir --upgrade pip gallery-dl \
    && /opt/gallery-dl/bin/pip install --no-cache-dir --upgrade --pre "yt-dlp[default]"

ENV PATH="/opt/gallery-dl/bin:${PATH}"

# Copy the compiled build output and production node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production

# 🔥 Auto-skip the 'dev' session when loading from DB.
# Override at runtime with -e EXCLUDE_SESSIONS="" or -e INCLUDE_SESSIONS="prod,staging"
# ENV EXCLUDE_SESSIONS=dev
# ENV EXCLUDE_SESSIONS=default
ENV INCLUDE_SESSIONS=default

# ─── Instagram Cookies (yt-dlp) ──────────────────────────────────────
# Di Coolify / Docker, mount cookies.txt sebagai file mount:
#   Host path:  /var/coolify/cookies.txt (atau path file yg kamu upload)
#   Container:  /app/cookies.txt
# Lalu set env var:
#   INSTAGRAM_DL_COOKIES=/app/cookies.txt
# Atau otomatis set default path di sini:
ENV INSTAGRAM_DL_COOKIES=/app/cookies.txt

# Use tini as PID 1 for proper signal forwarding (SIGINT/SIGTERM)
ENTRYPOINT ["/usr/bin/tini", "--"]

# Default: run all non-dev sessions from DB
# Override at runtime:
#   docker run <image> npm run start:dev      -> only dev session
#   docker run <image> npm run start:new -- --session=foo --force-clear
CMD ["node", "dist/index.js"]
