#!/bin/bash
# coding-pipeline-post.sh v2
# Triggered AFTER /god-code execution
# ENFORCES feedback submission before allowing completion

set -euo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$PROJECT_ROOT"

# Source enforcement functions if available
if [[ -f ".claude/hooks/god-code-enforcement-v2.sh" ]]; then
  source ".claude/hooks/god-code-enforcement-v2.sh"
fi

echo "═══════════════════════════════════════════════════════════════"
echo "POST-HOOK: Verifying Pipeline Completion Requirements"
echo "═══════════════════════════════════════════════════════════════"

# Step 1: Check if pipeline was active
PIPELINE_STATE=$(npx claude-flow@alpha memory retrieve -k "enforcement/pipeline/active" 2>/dev/null || echo '{}')
PIPELINE_ACTIVE=$(echo "$PIPELINE_STATE" | jq -r '.active // false' 2>/dev/null || echo "false")

if [[ "$PIPELINE_ACTIVE" != "true" ]]; then
  echo "[WARN] No active pipeline detected - skipping enforcement"
  exit 0
fi

PIPELINE_ID=$(echo "$PIPELINE_STATE" | jq -r '.pipelineId // "unknown"' 2>/dev/null)
AGENT_COUNT=$(echo "$PIPELINE_STATE" | jq -r '.agentCount // 0' 2>/dev/null)

echo "[INFO] Pipeline ID: $PIPELINE_ID"
echo "[INFO] Agent Count: $AGENT_COUNT / 47"

# Step 2: GATE - Verify minimum agents were spawned
MIN_AGENTS=19  # Phase 4 start
if [[ "$AGENT_COUNT" -lt "$MIN_AGENTS" ]]; then
  echo ""
  echo "BLOCKED: Insufficient agents spawned"
  echo "   Required: $MIN_AGENTS minimum (Phase 4)"
  echo "   Actual: $AGENT_COUNT"
  echo ""
  echo "   Pipeline cannot complete without proper agent execution."
  echo "═══════════════════════════════════════════════════════════════"
  exit 1
fi

# Step 3: GATE - Verify feedback was submitted
echo "[INFO] Checking feedback submission..."
FEEDBACK_STATUS=$(npx claude-flow@alpha memory retrieve -k "coding/pipeline/feedback-status" 2>/dev/null || echo '{}')
FEEDBACK_VERIFIED=$(echo "$FEEDBACK_STATUS" | jq -r '.verified // false' 2>/dev/null || echo "false")
FEEDBACK_TRAJECTORY=$(echo "$FEEDBACK_STATUS" | jq -r '.trajectoryId // "none"' 2>/dev/null)

if [[ "$FEEDBACK_VERIFIED" != "true" ]]; then
  echo ""
  echo "BLOCKED: Feedback not submitted or not verified"
  echo ""
  echo "   The learning loop MUST be closed before pipeline completes."
  echo ""
  echo "   REQUIRED ACTION:"
  echo "   1. Run: npx tsx src/god-agent/universal/cli.ts code-feedback \"$PIPELINE_ID\" --output \"[output]\" --agent \"pipeline\" --phase 7"
  echo "   2. Run: npx tsx src/god-agent/universal/cli.ts verify-feedback \"$PIPELINE_ID\""
  echo "   3. Store: npx claude-flow@alpha memory store -k \"coding/pipeline/feedback-status\" --value '{\"trajectoryId\":\"$PIPELINE_ID\",\"verified\":true}'"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  exit 1
fi

echo "[OK] Feedback verified for trajectory: $FEEDBACK_TRAJECTORY"

# Step 4: ENFORCE - Process LEANN index queue automatically
echo "[INFO] Checking and processing LEANN index queue..."
LEANN_QUEUE=".claude/runtime/leann-index-queue.json"
if [[ -f "$LEANN_QUEUE" ]]; then
  QUEUE_COUNT=$(jq '.files | length' "$LEANN_QUEUE" 2>/dev/null || echo "0")
  if [[ "$QUEUE_COUNT" -gt 0 ]]; then
    echo "[INFO] $QUEUE_COUNT files pending LEANN indexing - processing now..."

    # Run batch indexer with timeout
    if [[ -x ".claude/hooks/leann-batch-index.sh" ]]; then
      # Capture output but don't fail pipeline on indexing errors
      set +e
      LEANN_OUTPUT=$(timeout 300 .claude/hooks/leann-batch-index.sh 2>&1)
      LEANN_EXIT=$?
      set -e

      echo "$LEANN_OUTPUT" | while read -r line; do
        echo "       $line"
      done

      if [[ $LEANN_EXIT -eq 124 ]]; then
        echo "[WARN] LEANN batch indexing timed out after 300 seconds"
        echo "       Some files may not be searchable in future pipeline runs"
      elif [[ $LEANN_EXIT -ne 0 ]]; then
        echo "[WARN] LEANN batch indexing exited with code $LEANN_EXIT"
        echo "       Some files may not be indexed properly"
      fi

      # Verify queue was processed
      REMAINING=$(jq '.files | length' "$LEANN_QUEUE" 2>/dev/null || echo "0")
      if [[ "$REMAINING" -gt 0 ]]; then
        echo "[WARN] $REMAINING files still pending after batch processing"
        echo "       The embedder service may be unavailable"
      else
        echo "[OK] All $QUEUE_COUNT files indexed successfully"
      fi
    else
      echo "[WARN] LEANN batch indexer not found or not executable at:"
      echo "       .claude/hooks/leann-batch-index.sh"
      echo "       Files will not be searchable in future pipeline runs"
    fi
  else
    echo "[OK] LEANN index queue is empty"
  fi
else
  echo "[INFO] No LEANN queue file found - skipping indexing"
fi

# Step 5: All gates passed - mark complete
echo ""
echo "All completion requirements verified"
echo ""

# Aggregate XP
TOTAL_XP=$(npx claude-flow@alpha memory retrieve -k "coding/xp/total" 2>/dev/null | jq -r '.xp // 0' || echo "0")

# Update final state
npx claude-flow@alpha memory store -k "coding/pipeline/state" --value '{
  "status": "completed",
  "pipelineId": "'"$PIPELINE_ID"'",
  "agentCount": '$AGENT_COUNT',
  "feedbackVerified": true,
  "totalXP": '$TOTAL_XP',
  "completedAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
}' 2>/dev/null

# Deactivate enforcement
if type deactivate_pipeline &>/dev/null; then
  deactivate_pipeline
fi

echo "═══════════════════════════════════════════════════════════════"
echo "PIPELINE COMPLETE"
echo "   Pipeline ID: $PIPELINE_ID"
echo "   Agents: $AGENT_COUNT / 47"
echo "   XP Earned: $TOTAL_XP"
echo "═══════════════════════════════════════════════════════════════"
