#!/bin/bash
# coding-pipeline-pre.sh
# Triggered BEFORE /god-code execution
# Stores initial context and validates pipeline readiness

set -euo pipefail

COMMAND="$1"
ARGS="${@:2}"

# Only intercept /god-code commands
if [[ "$COMMAND" != "/god-code" && "$COMMAND" != "god-code" ]]; then
  exit 0
fi

# Extract task description from args
TASK_DESC="$ARGS"

# Store initial context in memory
npx claude-flow memory store \
  "coding/context/task" \
  "{\"description\": \"$TASK_DESC\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"status\": \"initialized\"}" \
  --namespace "coding"

# Store requirements placeholder
npx claude-flow memory store \
  "coding/context/requirements" \
  "{\"functional\": [], \"nonfunctional\": [], \"constraints\": [], \"extracted\": false}" \
  --namespace "coding"

# Initialize pipeline state
npx claude-flow memory store \
  "coding/pipeline/state" \
  "{\"currentPhase\": 0, \"completedPhases\": [], \"failedPhases\": [], \"startTime\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
  --namespace "coding"

echo "[HOOK] Coding pipeline initialized for task: $TASK_DESC"
