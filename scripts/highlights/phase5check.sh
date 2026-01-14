#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/dalton/projects/claudeflow-testing/corpus

python3 scripts/ingest/audit_ingest.py --root "$ROOT"
python3 scripts/ingest/verify_ingest.py --root "$ROOT"
python3 scripts/retrieval/verify_phase4.py "phantasia and action"

# Phase 5 sanity: show diffable outputs
python3 scripts/retrieval/query_chunks.py "phantasia and action" --k 12 > /tmp/no_hl.txt
python3 scripts/retrieval/query_chunks.py "phantasia and action" --k 12 --use_highlights > /tmp/with_hl.txt

echo "[OK] Wrote:"
echo "  /tmp/no_hl.txt"
echo "  /tmp/with_hl.txt"
echo "Diff (first 120 lines):"
diff -u /tmp/no_hl.txt /tmp/with_hl.txt | head -n 120 || true
