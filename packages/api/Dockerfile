# syntax=docker/dockerfile:1

# ============================================================================
# Argus IQ API - Production Dockerfile
# ============================================================================
# Multi-stage build for minimal production image
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: Build dependencies
# ----------------------------------------------------------------------------
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# ----------------------------------------------------------------------------
# Stage 2: Build application
# ----------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Build shared package first
WORKDIR /app/packages/shared
RUN pnpm build

# Build API
WORKDIR /app/packages/api
RUN pnpm build

# ----------------------------------------------------------------------------
# Stage 3: Production image
# ----------------------------------------------------------------------------
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Security: run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 argus

WORKDIR /app

# Copy production dependencies only
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/

# Copy migration files
COPY --from=builder /app/packages/api/src/db/migrations ./packages/api/dist/db/migrations

# Set ownership
RUN chown -R argus:nodejs /app

USER argus

WORKDIR /app/packages/api

# Environment
ENV NODE_ENV=production
ENV PORT=3040

EXPOSE 3040

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3040/health || exit 1

# Start command
CMD ["node", "dist/server.js"]
