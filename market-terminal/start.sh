#!/bin/bash

# Market Terminal Startup Script
# Starts both backend and frontend services

set -e

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
HEALTH_ENDPOINT="http://localhost:${BACKEND_PORT}/api/health"
RUN_DIR="$SCRIPT_DIR/.run"
MAX_WAIT_SECONDS=30

# PID files (absolute paths — safe across cd)
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

# Cleanup function for graceful shutdown
cleanup() {
    log_info "Shutting down Market Terminal..."

    # Kill backend if running
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            log_info "Stopping backend (PID: $BACKEND_PID)..."
            kill "$BACKEND_PID" 2>/dev/null || true
            sleep 1
            kill -9 "$BACKEND_PID" 2>/dev/null || true
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    # Kill frontend if running
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            log_info "Stopping frontend (PID: $FRONTEND_PID)..."
            kill "$FRONTEND_PID" 2>/dev/null || true
            sleep 1
            kill -9 "$FRONTEND_PID" 2>/dev/null || true
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    log_info "Market Terminal stopped."
    exit 0
}

# Set trap for Ctrl+C
trap cleanup SIGINT SIGTERM

# Check Python version
check_python() {
    log_info "Checking Python version..."

    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed."
        exit 1
    fi

    PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

    if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 11 ]); then
        log_error "Python 3.11+ is required. Found: $PYTHON_VERSION"
        exit 1
    fi

    log_info "Python version: $PYTHON_VERSION ✓"
}

# Check Node.js version
check_node() {
    log_info "Checking Node.js version..."

    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed."
        exit 1
    fi

    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

    if [ "$NODE_MAJOR" -lt 18 ]; then
        log_error "Node.js 18+ is required. Found: $NODE_VERSION"
        exit 1
    fi

    log_info "Node.js version: $NODE_VERSION ✓"
}

# Setup environment file
setup_env() {
    log_info "Setting up environment..."

    if [ -f ".env.example" ]; then
        if [ ! -f ".env" ]; then
            log_info "Creating .env from .env.example..."
            cp .env.example .env
        else
            log_info ".env already exists, skipping."
        fi
    else
        log_warn ".env.example not found, skipping environment setup."
    fi
}

# Create run directory
create_run_dir() {
    log_info "Creating run directory..."
    mkdir -p "$RUN_DIR"
}

# Start backend server
start_backend() {
    log_info "Starting backend server on port $BACKEND_PORT..."

    cd "$SCRIPT_DIR/backend"

    # Check if requirements are installed
    if [ -f "requirements.txt" ]; then
        log_info "Installing backend dependencies..."
        pip install -r requirements.txt -q
    fi

    # Start uvicorn in background
    python -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" &
    BACKEND_PID=$!

    echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
    log_info "Backend started (PID: $BACKEND_PID)"

    cd "$SCRIPT_DIR"
}

# Wait for backend health check
wait_for_backend() {
    log_info "Waiting for backend health check..."

    COUNTER=0
    while [ $COUNTER -lt $MAX_WAIT_SECONDS ]; do
        if curl -s "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
            log_info "Backend is healthy!"
            return 0
        fi
        sleep 1
        COUNTER=$((COUNTER + 1))
        echo -n "."
    done

    echo ""
    log_error "Backend health check failed after ${MAX_WAIT_SECONDS} seconds"
    return 1
}

# Start frontend server
start_frontend() {
    log_info "Starting frontend server on port $FRONTEND_PORT..."

    cd "$SCRIPT_DIR/frontend"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi

    # Start dev server in background
    npm run dev &
    FRONTEND_PID=$!

    echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
    log_info "Frontend started (PID: $FRONTEND_PID)"

    cd "$SCRIPT_DIR"
}

# Open browser
open_browser() {
    log_info "Opening browser..."

    # Try common methods to open browser
    if command -v open &> /dev/null; then
        # macOS
        open "http://localhost:$FRONTEND_PORT"
    elif command -v xdg-open &> /dev/null; then
        # Linux
        xdg-open "http://localhost:$FRONTEND_PORT"
    elif command -v start &> /dev/null; then
        # Windows
        start "http://localhost:$FRONTEND_PORT"
    else
        log_warn "Could not detect browser. Please open http://localhost:$FRONTEND_PORT manually."
    fi
}

# Main execution
main() {
    echo "========================================="
    echo "  Market Terminal Startup"
    echo "========================================="
    echo ""

    # Pre-flight checks
    check_python
    check_node

    # Setup
    setup_env
    create_run_dir

    # Start services
    echo ""
    start_backend
    wait_for_backend || exit 1

    echo ""
    start_frontend

    echo ""
    echo "========================================="
    log_info "Market Terminal is running!"
    log_info "Backend:  http://localhost:$BACKEND_PORT"
    log_info "Frontend: http://localhost:$FRONTEND_PORT"
    echo "========================================="
    echo ""

    # Open browser
    open_browser

    log_info "Press Ctrl+C to stop the servers."

    # Wait indefinitely (trap will handle shutdown)
    while true; do
        sleep 1
    done
}

main "$@"
