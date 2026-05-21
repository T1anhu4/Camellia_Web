#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# LLM Gateway — Production Deployment Script v2.0
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.production.yml"
BACKUP_DIR="$PROJECT_DIR/backups"
HEALTH_RETRIES=30
HEALTH_INTERVAL=2

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

# ============================================================
# Pre-flight checks
# ============================================================
preflight() {
    info "Running pre-flight checks..."

    command -v docker &>/dev/null || err "Docker is not installed."
    docker compose version &>/dev/null || err "Docker Compose v2 required."

    if [ ! -f "$PROJECT_DIR/.env" ]; then
        warn ".env not found. Copying from .env.example..."
        cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
        warn ">>> Edit .env with production values before re-running!"
        exit 0
    fi

    # Source .env and check required values
    set -a; source "$PROJECT_DIR/.env"; set +a
    local required=("DOMAIN" "JWT_SECRET" "ENCRYPTION_KEY" "DB_PASSWORD")
    local missing=()
    for key in "${required[@]}"; do
        val="${!key:-}"
        if [[ "$val" == "changeme" || "$val" == "replace-"* || -z "$val" ]]; then
            missing+=("$key")
        fi
    done
    if [ ${#missing[@]} -gt 0 ]; then
        err "Required .env values missing: ${missing[*]}"
    fi

    log "Pre-flight checks passed."
}

# ============================================================
# Build images
# ============================================================
build() {
    info "Building Docker images..."
    cd "$PROJECT_DIR"
    docker compose -f "$COMPOSE_FILE" build \
        --build-arg "VERSION=${VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}" \
        --parallel
    log "Build complete."
}

# ============================================================
# Standard deploy
# ============================================================
start() {
    info "Starting services..."
    cd "$PROJECT_DIR"
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
    wait_for_healthy
    show_status
}

# ============================================================
# Blue-Green deploy (zero-downtime)
# ============================================================
blue_green() {
    info "Starting blue-green deployment..."
    cd "$PROJECT_DIR"

    # Scale up new instances alongside old ones
    docker compose -f "$COMPOSE_FILE" up -d \
        --scale gateway=4 --scale frontend=4 \
        --no-recreate

    wait_for_healthy

    # Scale down old instances
    docker compose -f "$COMPOSE_FILE" up -d \
        --scale gateway=2 --scale frontend=2

    log "Blue-green deployment complete."
    show_status
}

# ============================================================
# Stop
# ============================================================
stop() {
    info "Stopping services..."
    cd "$PROJECT_DIR"
    docker compose -f "$COMPOSE_FILE" down --timeout 30
    log "Services stopped."
}

# ============================================================
# Restart
# ============================================================
restart() {
    stop
    start
}

# ============================================================
# Rollback to previous version
# ============================================================
rollback() {
    warn "Rolling back to previous deployment..."
    cd "$PROJECT_DIR"

    # Check for previous image tags
    local prev_tag="${1:-previous}"

    # Pull previous images
    docker compose -f "$COMPOSE_FILE" pull gateway frontend 2>/dev/null || true

    # Restart with previous version
    TAG="$prev_tag" docker compose -f "$COMPOSE_FILE" up -d --force-recreate gateway frontend

    wait_for_healthy
    log "Rollback complete."
    show_status
}

# ============================================================
# Health check verification
# ============================================================
wait_for_healthy() {
    info "Waiting for health checks (${HEALTH_RETRIES}x${HEALTH_INTERVAL}s)..."

    local retries=$HEALTH_RETRIES
    while [ $retries -gt 0 ]; do
        local all_healthy=true

        # Check gateway
        if ! curl -sf http://localhost:8080/health/ready &>/dev/null; then
            all_healthy=false
        fi

        # Check frontend
        if ! curl -sf http://localhost:3000/ &>/dev/null; then
            all_healthy=false
        fi

        if $all_healthy; then
            log "All services healthy!"
            return 0
        fi

        sleep $HEALTH_INTERVAL
        retries=$((retries - 1))
    done

    err "Health check failed after ${HEALTH_RETRIES} attempts. Check logs: ./deploy.sh logs"
}

# ============================================================
# Database backup
# ============================================================
backup() {
    info "Creating database backup..."
    mkdir -p "$BACKUP_DIR"

    local timestamp=$(date -u +%Y%m%d-%H%M%S)
    local file="$BACKUP_DIR/backup-${timestamp}.sql.gz"

    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        pg_dump -U "${DB_USER:-llmgateway}" "${DB_NAME:-llmgateway}" \
        | gzip > "$file"

    log "Backup saved: $file ($(du -h "$file" | cut -f1))"

    # Keep only last 7 daily backups
    ls -t "$BACKUP_DIR"/backup-*.sql.gz 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true
}

# ============================================================
# Restore database
# ============================================================
restore() {
    local file="${1:-}"
    if [ -z "$file" ]; then
        # Use latest backup
        file=$(ls -t "$BACKUP_DIR"/backup-*.sql.gz 2>/dev/null | head -1)
    fi
    if [ ! -f "$file" ]; then
        err "Backup file not found: ${file:-none}. Run './deploy.sh backup' first."
    fi

    warn "This will OVERWRITE the database. Continue? (y/N)"
    read -r confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        err "Aborted."
    fi

    info "Restoring from: $file"
    gzip -dc "$file" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "${DB_USER:-llmgateway}" "${DB_NAME:-llmgateway}"

    log "Restore complete."
}

# ============================================================
# Migrate database
# ============================================================
migrate() {
    info "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "${DB_USER:-llmgateway}" -d "${DB_NAME:-llmgateway}" \
        -f /docker-entrypoint-initdb.d/001_init.up.sql
    log "Migrations applied."
}

# ============================================================
# Logs
# ============================================================
logs() {
    cd "$PROJECT_DIR"
    docker compose -f "$COMPOSE_FILE" logs -f "${1:-}" --tail="${2:-200}"
}

# ============================================================
# Status
# ============================================================
show_status() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Frontend:  https://${DOMAIN:-yourdomain.com}${NC}"
    echo -e "${GREEN}  API:       https://${API_DOMAIN:-api.yourdomain.com}/v1${NC}"
    echo -e "${GREEN}  Health:    https://${DOMAIN:-yourdomain.com}/health${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo ""
    cd "$PROJECT_DIR"
    docker compose -f "$COMPOSE_FILE" ps
}

# ============================================================
# CLI Router
# ============================================================
case "${1:-}" in
    build)       preflight; build ;;
    start|up)    preflight; build; start ;;
    deploy)      preflight; build; blue_green ;;
    stop|down)   stop ;;
    restart)     restart ;;
    rollback)    rollback "${2:-}" ;;
    backup)      backup ;;
    restore)     restore "${2:-}" ;;
    migrate)     migrate ;;
    logs)        logs "${2:-}" "${3:-}" ;;
    status|ps)   show_status ;;
    health)      wait_for_healthy ;;
    *)
        cat << 'EOF'
Usage: ./deploy.sh {command}

Commands:
  build       Build all Docker images
  start       Full deploy: build + start
  deploy      Blue-green zero-downtime deploy
  stop        Stop all services
  restart     Stop then start
  rollback    Rollback to previous version
  backup      Backup PostgreSQL database
  restore     Restore from backup (optional: path)
  migrate     Run database migrations
  logs        Tail logs (optional: service, lines)
  status      Show service status
  health      Run health checks
EOF
        exit 1 ;;
esac
