# ============================================================
# Gateway Dockerfile — Multi-stage, multi-arch, hardened
# Build:  docker buildx build --platform linux/amd64,linux/arm64 -t llmgw-gateway:latest ./gateway
# ============================================================

# --- Build Stage ---
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder

ARG TARGETOS
ARG TARGETARCH
ARG BUILDKIT_SBOM_SCAN_STAGE=true

RUN apk add --no-cache git ca-certificates

WORKDIR /build

# Dependency caching layer
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download -x

# Source code
COPY . .

# Build with stripping and static linking
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath \
      -ldflags="-s -w -extldflags '-static' \
                -X main.Version=${VERSION:-dev} \
                -X main.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
                -X main.GitCommit=${GIT_COMMIT:-unknown}" \
      -o /build/gateway ./cmd/server

# --- Runtime Stage ---
FROM --platform=$TARGETPLATFORM alpine:3.20

# Runtime dependencies only
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    && rm -rf /var/cache/apk/*

ENV TZ=Asia/Shanghai

# Create non-root user
RUN addgroup -g 1000 app && \
    adduser -u 1000 -G app -s /bin/sh -D app

WORKDIR /app

# Copy binary and migrations
COPY --from=builder /build/gateway .
COPY --from=builder /build/migrations ./migrations

# Set ownership
RUN chown -R app:app /app

# Drop root
USER app

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -sf http://localhost:8080/health || exit 1

# Labels
LABEL org.opencontainers.image.title="LLM Gateway"
LABEL org.opencontainers.image.description="High-performance LLM API gateway with load balancing and billing"
LABEL org.opencontainers.image.vendor="LLM Gateway"
LABEL org.opencontainers.image.source="https://github.com/llmgateway/gateway"

ENTRYPOINT ["./gateway"]
