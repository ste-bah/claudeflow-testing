#!/bin/bash
#===============================================================================
# God Agent Embedding API Service Controller (1536D - Dual Backend)
#
# Manages ChromaDB and the Embedding API server for God Agent.
# Supports both LOCAL (gte-Qwen2-1.5B-instruct) and OPENAI (text-embedding-ada-002).
#
# Usage: ./api-embed.sh {start|stop|status|restart|logs}
#
# Environment Variables:
#   EMBEDDING_BACKEND  - "local" (default) or "openai"
#   OPENAI_API_KEY     - Required if using openai backend
#   PROJECT_DIR        - Base directory (default: script's parent's parent)
#   VENV_DIR           - Python venv directory (default: $HOME/.venv)
#===============================================================================

set -e

# --- CONFIGURATION ---
# Auto-detect project directory (parent of embedding-api)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

# Embedding backend (default: local)
EMBEDDING_BACKEND="${EMBEDDING_BACKEND:-local}"

# Virtual environment - check multiple locations
if [ -n "$VENV_DIR" ] && [ -d "$VENV_DIR" ]; then
    VENV_BIN="$VENV_DIR/bin"
elif [ -d "$HOME/.venv" ]; then
    VENV_BIN="$HOME/.venv/bin"
elif [ -d "$PROJECT_DIR/.venv" ]; then
    VENV_BIN="$PROJECT_DIR/.venv/bin"
else
    echo "Error: No Python virtual environment found."
    echo "Please create one: python3 -m venv ~/.venv"
    echo "Then install: ~/.venv/bin/pip install -r $SCRIPT_DIR/requirements.txt"
    exit 1
fi

SCRIPT="$SCRIPT_DIR/api_embedder.py"

# 1536D model uses separate database to not mix with 768D vectors
DB_DIR="$PROJECT_DIR/vector_db_1536"

# Runtime files
PID_DIR="$PROJECT_DIR/.run"
API_PID="$PID_DIR/embedder.pid"
CHROMA_PID="$PID_DIR/chroma.pid"

# Logs
LOG_DIR="$PROJECT_DIR/logs"
API_LOG="$LOG_DIR/embedder.log"
CHROMA_LOG="$LOG_DIR/chroma.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Ensure directories exist
mkdir -p "$PID_DIR" "$LOG_DIR" "$DB_DIR"

start_services() {
    echo -e "${YELLOW}Starting God Agent Embedding Services (1536D)...${NC}"
    echo -e "Backend: ${CYAN}${EMBEDDING_BACKEND}${NC}"

    # Validate OpenAI backend requirements
    if [ "$EMBEDDING_BACKEND" = "openai" ]; then
        if [ -z "$OPENAI_API_KEY" ]; then
            echo -e "${RED}Error: OPENAI_API_KEY not set but EMBEDDING_BACKEND=openai${NC}"
            echo "Set it with: export OPENAI_API_KEY=sk-your-key-here"
            exit 1
        fi
        echo -e "OpenAI API Key: ${GREEN}configured${NC}"
    fi

    # 1. Start ChromaDB Server
    if [ -f "$CHROMA_PID" ] && kill -0 $(cat "$CHROMA_PID") 2>/dev/null; then
        echo -e "${GREEN}ChromaDB already running (PID: $(cat $CHROMA_PID))${NC}"
    else
        echo "Starting ChromaDB on port 8001..."
        nohup "$VENV_BIN/chroma" run --path "$DB_DIR" --port 8001 --host 127.0.0.1 > "$CHROMA_LOG" 2>&1 &
        echo $! > "$CHROMA_PID"

        # Wait for ChromaDB to be ready
        echo -n "Waiting for ChromaDB..."
        for i in {1..10}; do
            if curl -s "http://127.0.0.1:8001/api/v1/heartbeat" > /dev/null 2>&1; then
                echo -e " ${GREEN}Ready${NC}"
                break
            fi
            echo -n "."
            sleep 1
        done
    fi

    # 2. Start API Server with backend environment
    if [ -f "$API_PID" ] && kill -0 $(cat "$API_PID") 2>/dev/null; then
        echo -e "${GREEN}Embedding API already running (PID: $(cat $API_PID))${NC}"
    else
        MODEL_NAME="gte-Qwen2-1.5B-instruct"
        [ "$EMBEDDING_BACKEND" = "openai" ] && MODEL_NAME="text-embedding-ada-002"
        echo "Starting Embedding API ($MODEL_NAME)..."

        # Export environment variables for the Python process
        export EMBEDDING_BACKEND
        export OPENAI_API_KEY

        nohup "$VENV_BIN/python3" -u "$SCRIPT" > "$API_LOG" 2>&1 &
        echo $! > "$API_PID"

        # Wait time depends on backend (local needs model loading)
        WAIT_TIME=30
        [ "$EMBEDDING_BACKEND" = "openai" ] && WAIT_TIME=10

        echo -n "Waiting for Embedding API..."
        for i in $(seq 1 $WAIT_TIME); do
            if curl -s "http://127.0.0.1:8000/" > /dev/null 2>&1; then
                echo -e " ${GREEN}Ready${NC}"
                break
            fi
            echo -n "."
            sleep 2
        done
    fi

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
    echo -e "${YELLOW}=== Embedding Service Status (1536D) ===${NC}"

    # ChromaDB status
    if [ -f "$CHROMA_PID" ] && kill -0 $(cat "$CHROMA_PID") 2>/dev/null; then
        echo -e "ChromaDB:      ${GREEN}Running${NC} (PID: $(cat $CHROMA_PID), Port: 8001)"
    else
        echo -e "ChromaDB:      ${RED}Stopped${NC}"
    fi

    # Embedding API status
    if [ -f "$API_PID" ] && kill -0 $(cat "$API_PID") 2>/dev/null; then
        echo -e "Embedding API: ${GREEN}Running${NC} (PID: $(cat $API_PID), Port: 8000)"

        # Try to get health info including backend
        INFO=$(curl -s "http://127.0.0.1:8000/" 2>/dev/null)
        if [ -n "$INFO" ]; then
            BACKEND=$(echo "$INFO" | grep -o '"backend":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
            MODEL=$(echo "$INFO" | grep -o '"model":"[^"]*"' | cut -d'"' -f4 || echo "?")
            ITEMS=$(echo "$INFO" | grep -o '"database_items":[0-9]*' | cut -d: -f2 || echo "?")
            echo -e "  Backend: ${CYAN}$BACKEND${NC}"
            echo "  Model: $MODEL"
            echo "  Vector Items: $ITEMS"
        fi
    else
        echo -e "Embedding API: ${RED}Stopped${NC}"
    fi

    echo ""
    echo "Endpoints:"
    echo "  Embedding API: http://127.0.0.1:8000"
    echo "  Backend Info:  http://127.0.0.1:8000/backend"
    echo "  ChromaDB:      http://127.0.0.1:8001"
    echo ""
    echo "Logs:"
    echo "  API:    $API_LOG"
    echo "  Chroma: $CHROMA_LOG"
    echo ""
    echo "Switch Backend:"
    echo "  Local:  EMBEDDING_BACKEND=local ./api-embed.sh restart"
    echo "  OpenAI: EMBEDDING_BACKEND=openai OPENAI_API_KEY=sk-... ./api-embed.sh restart"
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
        echo "Backends (1536 dimensions):"
        echo "  local  - gte-Qwen2-1.5B-instruct (default, runs on GPU/CPU)"
        echo "  openai - text-embedding-ada-002 (requires OPENAI_API_KEY)"
        echo ""
        echo "Examples:"
        echo "  ./api-embed.sh start                                    # Use local model"
        echo "  EMBEDDING_BACKEND=openai OPENAI_API_KEY=sk-... ./api-embed.sh start"
        echo ""
        echo "Database: $DB_DIR"
        exit 1
        ;;
esac
