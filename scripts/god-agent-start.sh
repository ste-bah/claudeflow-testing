#!/bin/bash
# God Agent Services - Background Startup
# Starts all 4 daemon services in the background with health checks

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

MEMORY_SOCKET="/tmp/god-agent-memory.sock"
DAEMON_SOCKET="/tmp/godagent-db.sock"
UCM_SOCKET="/tmp/godagent-ucm.sock"
OBSERVE_PID="$HOME/.god-agent/daemon.pid"

is_socket_alive() {
    [ -S "$1" ]
}

is_observe_running() {
    if [ -f "$OBSERVE_PID" ]; then
        local pid
        pid=$(cat "$OBSERVE_PID" 2>/dev/null)
        kill -0 "$pid" 2>/dev/null && return 0
    fi
    return 1
}

start_service() {
    local name="$1"
    local cmd="$2"
    local socket="$3"
    local timeout="${4:-10}"

    if [ -n "$socket" ] && is_socket_alive "$socket"; then
        echo -e "${YELLOW}skip${NC}  $name (already running)"
        return 0
    fi

    # Clean stale socket
    [ -n "$socket" ] && rm -f "$socket" 2>/dev/null

    printf "%-25s" "  $name"
    nohup npx tsx $cmd </dev/null >/dev/null 2>&1 &

    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        sleep 1
        elapsed=$((elapsed + 1))
        if [ -n "$socket" ] && is_socket_alive "$socket"; then
            echo -e "${GREEN}ok${NC} (${elapsed}s)"
            return 0
        fi
    done

    echo -e "${RED}timeout${NC} (${timeout}s)"
    return 1
}

echo "=== God Agent Services ==="

# 1. Memory Server
start_service "Memory Server" "src/god-agent/core/memory-server/memory-daemon.ts start" "$MEMORY_SOCKET" 10

# 2. Core Daemon
start_service "Core Daemon" "src/god-agent/core/daemon/daemon-cli.ts start" "$DAEMON_SOCKET" 10

# 3. UCM Daemon
start_service "UCM Daemon" "src/god-agent/core/ucm/daemon/ucm-cli.ts start" "$UCM_SOCKET" 10

# 4. Observability
if is_observe_running; then
    echo -e "${YELLOW}skip${NC}  Observability (already running)"
else
    printf "%-25s" "  Observability"
    nohup npx tsx src/god-agent/observability/daemon.ts start --daemon </dev/null >/dev/null 2>&1 &
    sleep 2
    if is_observe_running; then
        echo -e "${GREEN}ok${NC}"
    else
        echo -e "${RED}failed${NC}"
    fi
fi

echo "=========================="
