#!/usr/bin/env bash
# God-Learn Unified CLI wrapper
# Run from project root: ./god <command> [options]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/scripts/god" "$@"
