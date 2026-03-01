#!/bin/bash

# FunnyPixels - Stop All Services
# Usage: ./stop-all.sh [--include-docker] [--force]

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$PROJECT_ROOT/.pids"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

INCLUDE_DOCKER=false
FORCE=false

for arg in "$@"; do
  case $arg in
    --include-docker|--all) INCLUDE_DOCKER=true ;;
    --force) FORCE=true ;;
    --help|-h)
      echo "Usage: ./stop-all.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --include-docker  Also stop ALL Docker services (PostgreSQL, Redis, pgAdmin, monitoring)"
      echo "  --all             Same as --include-docker"
      echo "  --force           Force kill processes (SIGKILL instead of SIGTERM)"
      echo "  -h, --help        Show this help message"
      exit 0
      ;;
  esac
done

log_info() {
  printf "${GREEN}[INFO]${NC} %s\n" "$1"
}

log_warn() {
  printf "${YELLOW}[WARN]${NC} %s\n" "$1"
}

log_error() {
  printf "${RED}[ERROR]${NC} %s\n" "$1"
}

echo ""
printf "${CYAN}Stopping FunnyPixels services...${NC}\n"
echo ""

STOPPED=0

# Stop a service by PID file
stop_service() {
  local name=$1
  local pid_file="$PID_DIR/$name.pid"

  if [ ! -f "$pid_file" ]; then
    return 1
  fi

  local pid
  pid=$(cat "$pid_file")

  if ! kill -0 "$pid" 2>/dev/null; then
    log_warn "$name (PID: $pid) is not running. Cleaning up PID file."
    rm -f "$pid_file"
    return 1
  fi

  if [ "$FORCE" = true ]; then
    log_info "Force killing $name (PID: $pid)..."
    kill -9 "$pid" 2>/dev/null
    # Also kill child processes
    pkill -9 -P "$pid" 2>/dev/null
  else
    log_info "Stopping $name (PID: $pid)..."
    kill "$pid" 2>/dev/null
    # Also send SIGTERM to child processes
    pkill -P "$pid" 2>/dev/null

    # Wait up to 5 seconds for graceful shutdown
    local elapsed=0
    while kill -0 "$pid" 2>/dev/null && [ $elapsed -lt 5 ]; do
      sleep 1
      elapsed=$((elapsed + 1))
    done

    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
      log_warn "$name did not stop gracefully. Force killing..."
      kill -9 "$pid" 2>/dev/null
      pkill -9 -P "$pid" 2>/dev/null
    fi
  fi

  rm -f "$pid_file"
  log_info "$name stopped."
  STOPPED=$((STOPPED + 1))
}

# Stop Node.js services
stop_service "backend"
stop_service "frontend"
stop_service "admin-frontend"

# Also kill any orphaned processes on known ports (if PID files were lost)
kill_port_process() {
  local port=$1
  local name=$2
  local pid
  pid=$(lsof -ti :"$port" 2>/dev/null)
  if [ -n "$pid" ]; then
    log_warn "Found orphaned $name process on port $port (PID: $pid). Stopping..."
    if [ "$FORCE" = true ]; then
      kill -9 $pid 2>/dev/null
    else
      kill $pid 2>/dev/null
    fi
    STOPPED=$((STOPPED + 1))
  fi
}

# Only clean up orphan processes if no PID files existed
if [ ! -d "$PID_DIR" ] || [ -z "$(ls -A "$PID_DIR" 2>/dev/null)" ]; then
  kill_port_process 3001 "Backend"
  kill_port_process 5173 "Frontend"
  kill_port_process 8000 "Admin Frontend"
fi

# Stop Docker services (ALL containers in docker-compose.yml)
if [ "$INCLUDE_DOCKER" = true ]; then
  echo ""
  log_info "Stopping ALL Docker services (postgres, redis, pgadmin, monitoring)..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" down 2>/dev/null \
    || docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down 2>/dev/null
  log_info "Docker services stopped and removed."
  STOPPED=$((STOPPED + 1))
fi

# Stop Homebrew redis-server if running (avoid port conflict on next start)
if brew services list 2>/dev/null | grep -q "redis.*started"; then
  echo ""
  log_info "Stopping Homebrew redis-server (should use Docker redis)..."
  brew services stop redis 2>/dev/null
  log_info "Homebrew redis-server stopped."
  STOPPED=$((STOPPED + 1))
fi

# Summary
echo ""
if [ $STOPPED -gt 0 ]; then
  printf "${GREEN}All services stopped.${NC}\n"
else
  printf "${YELLOW}No running services found.${NC}\n"
fi
echo ""
