#!/bin/bash
# leann-batch-index.sh
# Processes queued files and indexes them into LEANN
# Called at session end or manually

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
QUEUE_FILE="$ROOT/.claude/runtime/leann-index-queue.json"
QUEUE_TXT="$ROOT/.claude/runtime/leann-index-queue.txt"

cd "$ROOT"

# Get files to index
FILES=()

if [ -f "$QUEUE_FILE" ]; then
  if command -v jq &> /dev/null; then
    while IFS= read -r file; do
      [ -n "$file" ] && FILES+=("$file")
    done < <(jq -r '.files[]' "$QUEUE_FILE" 2>/dev/null)
  fi
fi

if [ -f "$QUEUE_TXT" ]; then
  while IFS= read -r file; do
    [ -n "$file" ] && FILES+=("$file")
  done < "$QUEUE_TXT"
fi

# Deduplicate
FILES=($(printf '%s\n' "${FILES[@]}" | sort -u))

if [ ${#FILES[@]} -eq 0 ]; then
  echo "[LEANN] No files queued for indexing"
  exit 0
fi

echo "[LEANN] Indexing ${#FILES[@]} files..."

INDEXED=0
FAILED=0

for FILE in "${FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    continue
  fi

  # Get repository name
  REPO_NAME=$(basename "$ROOT")

  # Read file content (skip if > 100KB)
  FILE_SIZE=$(stat -f%z "$FILE" 2>/dev/null || stat -c%s "$FILE" 2>/dev/null || echo "0")
  if [ "$FILE_SIZE" -gt 102400 ]; then
    echo "[LEANN] Skipped (too large): $FILE"
    continue
  fi

  CODE=$(cat "$FILE")

  # Detect language
  case "$FILE" in
    *.ts|*.tsx) LANG="typescript" ;;
    *.js|*.jsx) LANG="javascript" ;;
    *.py) LANG="python" ;;
    *.rs) LANG="rust" ;;
    *.go) LANG="go" ;;
    *.java) LANG="java" ;;
    *) LANG="unknown" ;;
  esac

  # Call embedder API directly (faster than MCP)
  RESPONSE=$(curl -s -X POST http://localhost:8000/embed \
    -H "Content-Type: application/json" \
    -d "{\"texts\": [$(printf '%s' "$CODE" | jq -Rs .)], \"metadata\": {\"filePath\": \"$FILE\", \"repository\": \"$REPO_NAME\", \"language\": \"$LANG\"}}" \
    --max-time 10 2>/dev/null || echo "")

  if [ -n "$RESPONSE" ] && echo "$RESPONSE" | grep -q '"message"'; then
    ((INDEXED++))
    echo "[LEANN] Indexed: $FILE"
  else
    ((FAILED++))
    echo "[LEANN] Failed: $FILE"
  fi
done

echo "[LEANN] Complete: $INDEXED indexed, $FAILED failed"

# Clear the queue
rm -f "$QUEUE_FILE" "$QUEUE_TXT" 2>/dev/null
mkdir -p "$ROOT/.claude/runtime"
echo '{"files":[],"lastUpdated":""}' > "$QUEUE_FILE"

exit 0
