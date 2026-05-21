# ============================================================
# Frontend Dockerfile — Next.js standalone, multi-arch, hardened
# Build:  docker buildx build --platform linux/amd64,linux/arm64 -t llmgw-frontend:latest ./frontend
# ============================================================

# --- Build Stage ---
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /build

# Dependency caching layer
COPY package.json package-lock.json* ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev 2>/dev/null || npm install --no-audit --no-fund

# Source + build args
COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-https://api.yourdomain.com}

ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-https://yourdomain.com}

# Build with standalone output
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/build/.next/cache \
    npm run build

# --- Runtime Stage ---
FROM --platform=$TARGETPLATFORM node:20-alpine

RUN apk add --no-cache curl tzdata ca-certificates \
    && rm -rf /var/cache/apk/*

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Asia/Shanghai

# Non-root user
RUN addgroup -g 1001 nextjs && \
    adduser -u 1001 -G nextjs -s /bin/sh -D nextjs

WORKDIR /app

# Copy standalone output (Next.js 14 standalone mode)
COPY --from=builder /build/next.config.js ./
COPY --from=builder /build/public ./public

# Standalone output has its own node_modules with only prod deps
COPY --from=builder /build/.next/standalone ./
COPY --from=builder /build/.next/static ./.next/static

RUN chown -R nextjs:nextjs /app

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:3000/ || exit 1

LABEL org.opencontainers.image.title="LLM Gateway Frontend"
LABEL org.opencontainers.image.description="Next.js frontend for LLM Gateway"
LABEL org.opencontainers.image.source="https://github.com/llmgateway/gateway"

CMD ["node", "server.js"]
