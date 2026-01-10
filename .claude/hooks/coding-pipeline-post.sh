#!/bin/bash
# coding-pipeline-post.sh
# Triggered AFTER /god-code execution
# Aggregates results and updates XP

set -euo pipefail

COMMAND="$1"
EXIT_CODE="${2:-0}"

# Only intercept /god-code commands
if [[ "$COMMAND" != "/god-code" && "$COMMAND" != "god-code" ]]; then
  exit 0
fi

# Update pipeline state
npx claude-flow memory store \
  "coding/pipeline/state" \
  "{\"status\": \"completed\", \"exitCode\": $EXIT_CODE, \"endTime\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
  --namespace "coding"

# Aggregate XP from all phases
TOTAL_XP=$(npx claude-flow memory retrieve --key "coding/xp/total" 2>/dev/null || echo "0")

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "[HOOK] Coding pipeline completed successfully. XP earned: $TOTAL_XP"
else
  echo "[HOOK] Coding pipeline failed with exit code: $EXIT_CODE"
fi
