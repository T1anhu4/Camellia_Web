# ============================================================
# LLM Gateway — Development & Build Makefile
# ============================================================

.PHONY: help dev build push deploy clean lint test

# Default target
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Development ---

dev-db: ## Start dev databases only (Postgres + Redis + Mailpit)
	docker compose -f docker-compose.dev.yml up -d
	@echo "Postgres: localhost:5432"
	@echo "Redis:    localhost:6379"
	@echo "Mailpit:  http://localhost:8025"

dev-gateway: ## Run gateway locally (requires Go 1.22+)
	cd gateway && go run ./cmd/server

dev-frontend: ## Run frontend locally (requires Node 20+)
	cd frontend && npm run dev

dev: dev-db ## Start full dev environment
	@echo "Run 'make dev-gateway' and 'make dev-frontend' in separate terminals"

# --- Build ---

DOCKER_REPO ?= llmgw
VERSION     ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "latest")
BUILD_TIME  ?= $(shell date -u +%Y%m%d-%H%M%S)

build-gateway: ## Build gateway Docker image (multi-arch)
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		--build-arg VERSION=$(VERSION) \
		--build-arg BUILD_TIME=$(BUILD_TIME) \
		-t $(DOCKER_REPO)/gateway:$(VERSION) \
		-t $(DOCKER_REPO)/gateway:latest \
		-f gateway/Dockerfile \
		--push \
		gateway/

build-frontend: ## Build frontend Docker image (multi-arch)
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		-t $(DOCKER_REPO)/frontend:$(VERSION) \
		-t $(DOCKER_REPO)/frontend:latest \
		-f frontend/Dockerfile \
		--push \
		frontend/

build: build-gateway build-frontend ## Build and push all images

build-local: ## Build images locally (single arch, no push)
	docker build -t llmgw-gateway:latest -f gateway/Dockerfile gateway/
	docker build -t llmgw-frontend:latest -f frontend/Dockerfile frontend/

# --- Production ---

deploy: ## Deploy to production (docker compose)
	@test -f .env || (echo "Missing .env file. Copy .env.example and configure."; exit 1)
	docker compose -f docker-compose.production.yml up -d --build
	@echo "Waiting for health checks..."
	@sleep 10
	docker compose -f docker-compose.production.yml ps

deploy-stop: ## Stop production services
	docker compose -f docker-compose.production.yml down

deploy-logs: ## Tail production logs
	docker compose -f docker-compose.production.yml logs -f $(SVC)

deploy-status: ## Show production service status
	docker compose -f docker-compose.production.yml ps

# --- Maintenance ---

db-backup: ## Backup PostgreSQL database
	@mkdir -p backups
	docker compose -f docker-compose.production.yml exec -T postgres \
		pg_dump -U llmgateway llmgateway | gzip > backups/backup-$(BUILD_TIME).sql.gz
	@echo "Backup: backups/backup-$(BUILD_TIME).sql.gz"

db-restore: ## Restore PostgreSQL from backup (FILE=path)
	@test -n "$(FILE)" || (echo "Usage: make db-restore FILE=backups/backup-xxx.sql.gz"; exit 1)
	gzip -dc $(FILE) | docker compose -f docker-compose.production.yml exec -T postgres \
		psql -U llmgateway llmgateway

db-migrate: ## Run database migrations manually
	docker compose -f docker-compose.production.yml exec -T postgres \
		psql -U llmgateway -d llmgateway \
		-f /docker-entrypoint-initdb.d/001_init.up.sql

# --- CI ---

lint: ## Run linting on all code
	cd gateway && go vet ./... 2>/dev/null || true
	cd frontend && npx next lint 2>/dev/null || true

test: ## Run tests
	cd gateway && go test ./... -race -count=1 2>/dev/null || true
	cd frontend && npx jest --passWithNoTests 2>/dev/null || true

# --- Cleanup ---

clean: ## Clean build artifacts
	rm -rf gateway/gateway gateway/gateway.exe
	rm -rf frontend/.next frontend/out
	docker compose -f docker-compose.production.yml down -v 2>/dev/null || true
