#!/bin/bash
# fix-memory-ghosts.sh - Removes soft-deleted memory entries that block new inserts
# Run this before batch operations or add to SessionStart hook

DB_PATH=".swarm/memory.db"

if [ -f "$DB_PATH" ]; then
  DELETED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM memory_entries WHERE status='deleted';")
  if [ "$DELETED" -gt 0 ]; then
    sqlite3 "$DB_PATH" "DELETE FROM memory_entries WHERE status='deleted';"
    echo "[fix-memory-ghosts] Purged $DELETED ghost entries"
  fi
fi
