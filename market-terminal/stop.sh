#!/bin/bash

# Market Terminal Stop Script
# Stops both backend and frontend services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load ports from .env (fall back to defaults)
if [ -f "$SCRIPT_DIR/.env" ]; then
    _bp=$(grep -m1 '^BACKEND_PORT=' "$SCRIPT_DIR/.env" | cut -d= -f2)
    _fp=$(grep -m1 '^FRONTEND_PORT=' "$SCRIPT_DIR/.env" | cut -d= -f2)
fi
BACKEND_PORT="${_bp:-8000}"
FRONTEND_PORT="${_fp:-3000}"

# Configuration
RUN_DIR="$SCRIPT_DIR/.run"
BACKEND_PID_FILE="${RUN_DIR}/backend.pid"
FRONTEND_PID_FILE="${RUN_DIR}/frontend.pid"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Kill a process by PID file
kill_process() {
    local pid_file=$1
    local service_name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")

        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping $service_name (PID: $pid)..."

            # Try graceful kill first
            kill "$pid" 2>/dev/null

            # Wait up to 5 seconds for graceful shutdown
            local count=0
            while [ $count -lt 5 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                count=$((count + 1))
            done

            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                log_warn "$service_name did not stop gracefully, forcing..."
                kill -9 "$pid" 2>/dev/null
            fi

            log_info "$service_name stopped."
        else
            log_warn "$service_name (PID: $pid) is not running."
        fi

        # Remove PID file
        rm -f "$pid_file"
    else
        log_warn "PID file for $service_name not found."
    fi
}

# Kill by port (fallback method)
kill_by_port() {
    local port=$1
    local service_name=$2

    # Find process using the port
    local pid=$(lsof -ti:$port 2>/dev/null)

    if [ -n "$pid" ]; then
        log_info "Stopping $service_name on port $port (PID: $pid)..."
        kill "$pid" 2>/dev/null

        local count=0
        while [ $count -lt 5 ] && kill -0 "$pid" 2>/dev/null; do
            sleep 1
            count=$((count + 1))
        done

        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null
        fi

        log_info "$service_name stopped."
    else
        log_warn "No process found on port $port."
    fi
}

# Main execution
main() {
    echo "========================================="
    echo "  Market Terminal Stop"
    echo "========================================="
    echo ""

    # Check if run directory exists
    if [ ! -d "$RUN_DIR" ]; then
        log_warn "Run directory does not exist. Nothing to stop."
        exit 0
    fi

    # Stop backend
    kill_process "$BACKEND_PID_FILE" "backend"

    # Stop frontend
    kill_process "$FRONTEND_PID_FILE" "frontend"

    # Fallback: kill by port if PID file method failed
    kill_by_port "$BACKEND_PORT" "backend"
    kill_by_port "$FRONTEND_PORT" "frontend"

    echo ""
    log_info "Market Terminal stopped successfully."
    echo "========================================="
}

main "$@"
