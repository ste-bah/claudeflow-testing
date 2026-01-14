#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/dalton/projects/claudeflow-testing/corpus"
DEFAULT_QUERY="phantasia and action"

QUERY="${1:-$DEFAULT_QUERY}"

python3 scripts/ingest/audit_ingest.py --root "$ROOT"
python3 scripts/ingest/verify_ingest.py --root "$ROOT"
python3 scripts/retrieval/verify_phase4.py "$QUERY"
