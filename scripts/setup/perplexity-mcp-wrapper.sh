#!/usr/bin/env bash
# Wrapper script to start Perplexity MCP server with .env loaded
# This allows the MCP server to access the API key from .env

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load .env if it exists
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | grep -v '^$' | xargs)
fi

# Start the Perplexity MCP server
exec npx -y @perplexity-ai/mcp-server "$@"
