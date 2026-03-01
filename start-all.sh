#!/bin/bash

# FunnyPixels - Start All Services
# Usage: ./start-all.sh [--skip-docker] [--skip-frontend] [--skip-admin] [--skip-migrate]

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$PROJECT_ROOT/.pids"
LOG_DIR="$PROJECT_ROOT/.logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_DOCKER=false
SKIP_FRONTEND=false
SKIP_ADMIN=false
SKIP_MIGRATE=false
SKIP_MONITORING=false

for arg in "$@"; do
  case $arg in
    --skip-docker) SKIP_DOCKER=true ;;
    --skip-frontend) SKIP_FRONTEND=true ;;
    --skip-admin) SKIP_ADMIN=true ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
    --skip-monitoring) SKIP_MONITORING=true ;;
    --help|-h)
      echo "Usage: ./start-all.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-docker       Skip Docker services (PostgreSQL, Redis, pgAdmin, monitoring)"
      echo "  --skip-frontend     Skip frontend dev server"
      echo "  --skip-admin        Skip admin-frontend dev server"
      echo "  --skip-migrate      Skip database migrations"
      echo "  --skip-monitoring   Skip monitoring services (Grafana, Prometheus, Alertmanager)"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
  esac
done

# Ensure directories exist
mkdir -p "$PID_DIR" "$LOG_DIR"

log_info() {
  printf "${GREEN}[INFO]${NC} %s\n" "$1"
}

log_warn() {
  printf "${YELLOW}[WARN]${NC} %s\n" "$1"
}

log_error() {
  printf "${RED}[ERROR]${NC} %s\n" "$1"
}

log_section() {
  printf "\n${CYAN}=== %s ===${NC}\n" "$1"
}

# Check if a service is already running via PID file
check_running() {
  local name=$1
  local pid_file="$PID_DIR/$name.pid"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      log_warn "$name is already running (PID: $pid). Skipping."
      return 0
    else
      rm -f "$pid_file"
    fi
  fi
  return 1
}

# Wait for a TCP port to be available
wait_for_port() {
  local port=$1
  local name=$2
  local timeout=${3:-30}
  local elapsed=0

  while ! nc -z localhost "$port" 2>/dev/null; do
    if [ $elapsed -ge $timeout ]; then
      log_warn "$name did not start within ${timeout}s on port $port"
      return 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 0
}

printf "${BLUE}"
echo "  ______                        ____  _          _     "
echo " |  ____|                      |  _ \(_)        | |    "
echo " | |__ _   _ _ __  _ __  _   _| |_) |___  _____| |___ "
echo " |  __| | | | '_ \| '_ \| | | |  __/| \ \/ / _ \ / __|"
echo " | |  | |_| | | | | | | | |_| | |   | |>  <  __/ \__ \\"
echo " |_|   \__,_|_| |_|_| |_|\__, |_|   |_/_/\_\___|_|___/"
echo "                           __/ |                        "
echo "                          |___/                         "
printf "${NC}\n"
printf "${GREEN}Starting all services...${NC}\n"
echo ""

# ============================================
# 1. Docker Services
# ============================================
if [ "$SKIP_DOCKER" = false ]; then
  log_section "Docker Services"

  if ! command -v docker &>/dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
  fi

  # Warn if Homebrew PostgreSQL is running (should use Docker postgres)
  if brew services list 2>/dev/null | grep -q "postgresql.*started"; then
    log_warn "Homebrew PostgreSQL is running on port 5432, will conflict with Docker postgres."
    log_warn "Stopping Homebrew PostgreSQL..."
    brew services stop postgresql@16 2>/dev/null || brew services stop postgresql 2>/dev/null
    sleep 1
  fi

  # Warn if Homebrew redis is running (should use Docker redis)
  if brew services list 2>/dev/null | grep -q "redis.*started"; then
    log_warn "Homebrew redis-server is running on port 6379, will conflict with Docker redis."
    log_warn "Stopping Homebrew redis-server..."
    brew services stop redis 2>/dev/null
    sleep 1
  fi

  # Core services: postgres, redis, pgadmin
  CORE_SERVICES="postgres redis pgadmin"

  # Monitoring services: grafana, prometheus, alertmanager
  if [ "$SKIP_MONITORING" = false ]; then
    ALL_SERVICES="$CORE_SERVICES grafana prometheus alertmanager"
  else
    ALL_SERVICES="$CORE_SERVICES"
  fi

  POSTGRES_RUNNING=$(docker ps --filter "name=funnypixels_postgres" --filter "status=running" -q)
  REDIS_RUNNING=$(docker ps --filter "name=funnypixels_redis" --filter "status=running" -q)
  PGADMIN_RUNNING=$(docker ps --filter "name=funnypixels_pgadmin" --filter "status=running" -q)

  if [ -n "$POSTGRES_RUNNING" ] && [ -n "$REDIS_RUNNING" ] && [ -n "$PGADMIN_RUNNING" ]; then
    log_info "Core services (PostgreSQL, Redis, pgAdmin) are already running."
  else
    # Remove stale stopped containers that would block creation
    for svc in funnypixels_postgres funnypixels_redis funnypixels_pgadmin funnypixels_grafana funnypixels_prometheus funnypixels_alertmanager; do
      STALE=$(docker ps -a --filter "name=^/${svc}$" --filter "status=exited" -q 2>/dev/null)
      if [ -n "$STALE" ]; then
        log_warn "Removing stale container: $svc"
        docker rm "$svc" 2>/dev/null
      fi
    done

    log_info "Starting Docker services: $ALL_SERVICES ..."
    docker compose -f "$PROJECT_ROOT/docker-compose.yml" up -d $ALL_SERVICES 2>/dev/null \
      || docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d $ALL_SERVICES

    log_info "Waiting for PostgreSQL to be ready..."
    PG_READY=false
    PG_ELAPSED=0
    while [ "$PG_READY" = false ] && [ $PG_ELAPSED -lt 30 ]; do
      if docker exec funnypixels_postgres pg_isready -U postgres -q 2>/dev/null; then
        PG_READY=true
      else
        sleep 1
        PG_ELAPSED=$((PG_ELAPSED + 1))
      fi
    done
    if [ "$PG_READY" = true ]; then
      log_info "PostgreSQL is ready."
    else
      log_warn "PostgreSQL did not become ready within 30s"
    fi

    log_info "Waiting for Redis to be ready..."
    if wait_for_port 6379 "Redis" 15; then
      log_info "Redis is ready."
    fi
  fi
else
  log_section "Docker Services (skipped)"
fi

# ============================================
# 2. Backend
# ============================================
log_section "Backend (Node.js)"

if check_running "backend"; then
  : # already running
else
  # Check dependencies
  if [ ! -d "$PROJECT_ROOT/backend/node_modules" ]; then
    log_info "Installing backend dependencies..."
    (cd "$PROJECT_ROOT/backend" && npm install)
  fi

  # Run migrations
  if [ "$SKIP_MIGRATE" = false ]; then
    log_info "Running database migrations..."
    (cd "$PROJECT_ROOT/backend" && npx knex migrate:latest 2>&1) || log_warn "Migration had warnings (may already be up to date)"
  fi

  # Start backend
  log_info "Starting backend on port 3001..."
  (cd "$PROJECT_ROOT/backend" && npm run dev > "$LOG_DIR/backend.log" 2>&1) &
  BACKEND_PID=$!
  echo "$BACKEND_PID" > "$PID_DIR/backend.pid"

  if wait_for_port 3001 "Backend" 15; then
    log_info "Backend started successfully (PID: $BACKEND_PID)"
  else
    log_warn "Backend may still be starting (PID: $BACKEND_PID)"
  fi
fi

# ============================================
# 3. Frontend
# ============================================
if [ "$SKIP_FRONTEND" = false ]; then
  log_section "Frontend (React/Vite)"

  if check_running "frontend"; then
    : # already running
  else
    if [ ! -d "$PROJECT_ROOT/frontend/node_modules" ]; then
      log_info "Installing frontend dependencies..."
      (cd "$PROJECT_ROOT/frontend" && npm install)
    fi

    log_info "Starting frontend on port 5173..."
    (cd "$PROJECT_ROOT/frontend" && npm run dev > "$LOG_DIR/frontend.log" 2>&1) &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"

    if wait_for_port 5173 "Frontend" 15; then
      log_info "Frontend started successfully (PID: $FRONTEND_PID)"
    else
      log_warn "Frontend may still be starting (PID: $FRONTEND_PID)"
    fi
  fi
else
  log_section "Frontend (skipped)"
fi

# ============================================
# 4. Admin Frontend
# ============================================
if [ "$SKIP_ADMIN" = false ]; then
  log_section "Admin Frontend (React/Vite)"

  if check_running "admin-frontend"; then
    : # already running
  else
    if [ ! -d "$PROJECT_ROOT/admin-frontend/node_modules" ]; then
      log_info "Installing admin-frontend dependencies..."
      (cd "$PROJECT_ROOT/admin-frontend" && npm install)
    fi

    log_info "Starting admin-frontend on port 8000..."
    (cd "$PROJECT_ROOT/admin-frontend" && npm run dev > "$LOG_DIR/admin-frontend.log" 2>&1) &
    ADMIN_PID=$!
    echo "$ADMIN_PID" > "$PID_DIR/admin-frontend.pid"

    if wait_for_port 8000 "Admin Frontend" 15; then
      log_info "Admin Frontend started successfully (PID: $ADMIN_PID)"
    else
      log_warn "Admin Frontend may still be starting (PID: $ADMIN_PID)"
    fi
  fi
else
  log_section "Admin Frontend (skipped)"
fi

# ============================================
# Summary
# ============================================
echo ""
printf "${CYAN}============================================${NC}\n"
printf "${GREEN}All services started!${NC}\n"
printf "${CYAN}============================================${NC}\n"
echo ""
printf "  ${BLUE}Backend API${NC}:      http://localhost:3001\n"
printf "  ${BLUE}WebSocket${NC}:        ws://localhost:3001\n"
if [ "$SKIP_FRONTEND" = false ]; then
  printf "  ${BLUE}Frontend${NC}:         http://localhost:5173\n"
fi
if [ "$SKIP_ADMIN" = false ]; then
  printf "  ${BLUE}Admin Panel${NC}:      http://localhost:8000\n"
fi
if [ "$SKIP_DOCKER" = false ]; then
  printf "  ${BLUE}PostgreSQL${NC}:       localhost:5432\n"
  printf "  ${BLUE}Redis${NC}:            localhost:6379\n"
  printf "  ${BLUE}pgAdmin${NC}:          http://localhost:5050\n"
  if [ "$SKIP_MONITORING" = false ]; then
    printf "  ${BLUE}Grafana${NC}:          http://localhost:3000\n"
    printf "  ${BLUE}Prometheus${NC}:       http://localhost:9090\n"
    printf "  ${BLUE}Alertmanager${NC}:     http://localhost:9093\n"
  fi
fi
echo ""
printf "  ${YELLOW}Logs${NC}:   %s/\n" "$LOG_DIR"
printf "  ${YELLOW}PIDs${NC}:   %s/\n" "$PID_DIR"
echo ""
printf "  Stop all:  ${GREEN}./stop-all.sh${NC}\n"
printf "  View logs: ${GREEN}tail -f %s/backend.log${NC}\n" "$LOG_DIR"
echo ""
