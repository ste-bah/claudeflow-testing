#!/bin/bash
#===============================================================================
# God Agent Embedding API Service Controller
#
# Manages ChromaDB and the Embedding API server for God Agent.
# This version uses configurable paths for deployment flexibility.
#
# Usage: ./api-embed.sh {start|stop|status|restart|logs}
#
# Environment Variables (optional):
#   PROJECT_DIR  - Base directory (default: script's parent's parent)
#   VENV_DIR     - Python venv directory (default: $HOME/.venv)
#   CHROMA_PORT  - ChromaDB port (default: 8001)
#   API_PORT     - Embedding API port (default: 8000)
#===============================================================================

set -e

# --- CONFIGURATION ---
# Auto-detect project directory (two levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Virtual environment - check multiple locations
if [ -n "$VENV_DIR" ] && [ -d "$VENV_DIR" ]; then
    VENV_BIN="$VENV_DIR/bin"
elif [ -d "$HOME/.venv" ]; then
    VENV_BIN="$HOME/.venv/bin"
elif [ -d "$PROJECT_DIR/.venv" ]; then
    VENV_BIN="$PROJECT_DIR/.venv/bin"
else
    echo "Error: No Python virtual environment found."
    echo "Please create one: python3 -m venv ~/.venv && ~/.venv/bin/pip install -r $PROJECT_DIR/embedding-api/requirements.txt"
    exit 1
fi

# Paths
EMBED_DIR="$PROJECT_DIR/embedding-api"
SCRIPT="$EMBED_DIR/api_embedder.py"
DB_DIR="$PROJECT_DIR/vector_db"

# Runtime files
PID_DIR="$PROJECT_DIR/.run"
API_PID="$PID_DIR/embedder.pid"
CHROMA_PID="$PID_DIR/chroma.pid"

# Logs
LOG_DIR="$PROJECT_DIR/logs"
API_LOG="$LOG_DIR/embedder.log"
CHROMA_LOG="$LOG_DIR/chroma.log"

# Ports (configurable via environment)
CHROMA_PORT="${CHROMA_PORT:-8001}"
API_PORT="${API_PORT:-8000}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Ensure directories exist
mkdir -p "$PID_DIR" "$LOG_DIR" "$DB_DIR"

start_services() {
    echo -e "${YELLOW}Starting God Agent Embedding Services...${NC}"

    # 1. Start ChromaDB Server
    if [ -f "$CHROMA_PID" ] && kill -0 $(cat "$CHROMA_PID") 2>/dev/null; then
        echo -e "${GREEN}ChromaDB already running (PID: $(cat $CHROMA_PID))${NC}"
    else
        echo "Starting ChromaDB on port $CHROMA_PORT..."

        # Export environment for ChromaDB
        export CHROMA_HOST="127.0.0.1"
        export CHROMA_PORT="$CHROMA_PORT"

        nohup "$VENV_BIN/chroma" run \
            --path "$DB_DIR" \
            --port "$CHROMA_PORT" \
            --host 127.0.0.1 \
            > "$CHROMA_LOG" 2>&1 &
        echo $! > "$CHROMA_PID"

        # Wait for ChromaDB to be ready
        echo -n "Waiting for ChromaDB..."
        for i in {1..10}; do
            if curl -s "http://127.0.0.1:$CHROMA_PORT/api/v1/heartbeat" > /dev/null 2>&1; then
                echo -e " ${GREEN}Ready${NC}"
                break
            fi
            echo -n "."
            sleep 1
        done
    fi

    # 2. Start Embedding API Server
    if [ -f "$API_PID" ] && kill -0 $(cat "$API_PID") 2>/dev/null; then
        echo -e "${GREEN}Embedding API already running (PID: $(cat $API_PID))${NC}"
    else
        echo "Starting Embedding API on port $API_PORT..."

        # Export environment for API
        export CHROMA_HOST="127.0.0.1"
        export CHROMA_PORT="$CHROMA_PORT"
        export API_HOST="127.0.0.1"
        export API_PORT="$API_PORT"
        export COLLECTION_NAME="god_agent_vectors"

        nohup "$VENV_BIN/python3" -u "$SCRIPT" > "$API_LOG" 2>&1 &
        echo $! > "$API_PID"

        # Wait for API to be ready
        echo -n "Waiting for Embedding API..."
        for i in {1..15}; do
            if curl -s "http://127.0.0.1:$API_PORT/" > /dev/null 2>&1; then
                echo -e " ${GREEN}Ready${NC}"
                break
            fi
            echo -n "."
            sleep 1
        done
    fi

    # Final status check
    echo ""
    show_status
}

stop_services() {
    echo -e "${YELLOW}Stopping God Agent Embedding Services...${NC}"

    if [ -f "$API_PID" ]; then
        if kill -0 $(cat "$API_PID") 2>/dev/null; then
            kill $(cat "$API_PID")
            echo -e "${GREEN}Embedding API stopped${NC}"
        fi
        rm -f "$API_PID"
    else
        echo "Embedding API not running"
    fi

    if [ -f "$CHROMA_PID" ]; then
        if kill -0 $(cat "$CHROMA_PID") 2>/dev/null; then
            kill $(cat "$CHROMA_PID")
            echo -e "${GREEN}ChromaDB stopped${NC}"
        fi
        rm -f "$CHROMA_PID"
    else
        echo "ChromaDB not running"
    fi
}

show_status() {
    echo -e "${YELLOW}=== Embedding Service Status ===${NC}"

    # ChromaDB status
    if [ -f "$CHROMA_PID" ] && kill -0 $(cat "$CHROMA_PID") 2>/dev/null; then
        echo -e "ChromaDB:      ${GREEN}Running${NC} (PID: $(cat $CHROMA_PID), Port: $CHROMA_PORT)"

        # Try to get item count
        COUNT=$(curl -s "http://127.0.0.1:$CHROMA_PORT/api/v1/collections" 2>/dev/null | grep -o '"count":[0-9]*' | head -1 | cut -d: -f2 || echo "?")
        echo "  Collections: $COUNT"
    else
        echo -e "ChromaDB:      ${RED}Stopped${NC}"
    fi

    # Embedding API status
    if [ -f "$API_PID" ] && kill -0 $(cat "$API_PID") 2>/dev/null; then
        echo -e "Embedding API: ${GREEN}Running${NC} (PID: $(cat $API_PID), Port: $API_PORT)"

        # Try to get health info
        INFO=$(curl -s "http://127.0.0.1:$API_PORT/" 2>/dev/null)
        if [ -n "$INFO" ]; then
            ITEMS=$(echo "$INFO" | grep -o '"database_items":[0-9]*' | cut -d: -f2 || echo "?")
            echo "  Vector Items: $ITEMS"
        fi
    else
        echo -e "Embedding API: ${RED}Stopped${NC}"
    fi

    echo ""
    echo "Endpoints:"
    echo "  Embedding API: http://127.0.0.1:$API_PORT"
    echo "  ChromaDB:      http://127.0.0.1:$CHROMA_PORT"
    echo ""
    echo "Logs:"
    echo "  API:    $API_LOG"
    echo "  Chroma: $CHROMA_LOG"
}

show_logs() {
    echo -e "${YELLOW}=== Recent Logs ===${NC}"
    echo ""
    echo "--- Embedding API (last 20 lines) ---"
    tail -20 "$API_LOG" 2>/dev/null || echo "(no logs)"
    echo ""
    echo "--- ChromaDB (last 20 lines) ---"
    tail -20 "$CHROMA_LOG" 2>/dev/null || echo "(no logs)"
}

case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 2
        start_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start ChromaDB and Embedding API"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  status  - Show service status"
        echo "  logs    - Show recent log output"
        echo ""
        echo "Environment Variables:"
        echo "  PROJECT_DIR  - Base directory (default: auto-detect)"
        echo "  VENV_DIR     - Python venv (default: ~/.venv)"
        echo "  CHROMA_PORT  - ChromaDB port (default: 8001)"
        echo "  API_PORT     - API port (default: 8000)"
        exit 1
        ;;
esac
