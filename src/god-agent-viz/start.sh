#!/bin/bash
# God Agent Memory Visualization - Start Script
#
# This script starts the visualization API server and opens the frontend.
# The server queries .god-agent/learning.db to build a graph of:
#   - Agents (who performed tasks)
#   - Task Types (phd.pipeline.*, reasoning.*)
#   - Patterns (learned patterns with weights)
#   - Trajectories (high-quality execution traces)
#
# Usage:
#   ./start.sh          # Start server only
#   ./start.sh --open   # Start server and open browser

set -e

# Get the project root (two directories up from this script)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  God Agent Memory Visualization${NC}"
echo -e "${BLUE}======================================${NC}"

# Kill any existing server on port 3456
if lsof -ti:3456 >/dev/null 2>&1; then
    echo -e "${YELLOW}Stopping existing server on port 3456...${NC}"
    lsof -ti:3456 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Build if needed
if [ ! -f "dist/god-agent-viz/server.js" ]; then
    echo -e "${YELLOW}Building TypeScript...${NC}"
    npm run build
fi

# Check if learning.db exists
LEARNING_DB="$PROJECT_ROOT/.god-agent/learning.db"
if [ ! -f "$LEARNING_DB" ]; then
    echo -e "${YELLOW}Warning: learning.db not found at $LEARNING_DB${NC}"
    echo "The visualization will show empty data."
fi

# Start the server
echo -e "${GREEN}Starting API server...${NC}"
node dist/god-agent-viz/server.js &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Verify server is running
if curl -s http://localhost:3456/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}Server started successfully!${NC}"
    echo ""
    echo -e "  ${BLUE}API Server:${NC}  http://localhost:3456"
    echo -e "  ${BLUE}Frontend:${NC}    file://$SCRIPT_DIR/index.html"
    echo ""
    echo -e "  ${BLUE}Endpoints:${NC}"
    echo "    GET /api/graph       - Full graph data (nodes + edges)"
    echo "    GET /api/stats       - Summary statistics"
    echo "    GET /api/agents      - List unique agents"
    echo "    GET /api/task-types  - List unique task types"
    echo "    GET /api/patterns    - All learned patterns"
    echo "    GET /api/trajectories - Trajectory metadata"
    echo "    GET /api/health      - Health check"
    echo ""

    # Open browser if --open flag is provided
    if [ "$1" = "--open" ]; then
        echo -e "${GREEN}Opening browser...${NC}"
        if command -v open >/dev/null 2>&1; then
            open "$SCRIPT_DIR/index.html"
        elif command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$SCRIPT_DIR/index.html"
        else
            echo "Please open $SCRIPT_DIR/index.html in your browser"
        fi
    else
        echo -e "Run ${YELLOW}open $SCRIPT_DIR/index.html${NC} to view the visualization"
    fi

    echo ""
    echo -e "Press ${YELLOW}Ctrl+C${NC} to stop the server"

    # Keep script running and forward signals to server
    trap "kill $SERVER_PID 2>/dev/null; exit 0" SIGINT SIGTERM
    wait $SERVER_PID
else
    echo -e "${YELLOW}Failed to start server${NC}"
    exit 1
fi
