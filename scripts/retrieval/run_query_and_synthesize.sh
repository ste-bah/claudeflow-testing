#!/usr/bin/env bash
set -euo pipefail

QUERY="${1:-}"
if [[ -z "$QUERY" ]]; then
  echo "Usage: $0 \"your query here\""
  exit 1
fi

K="${K:-8}"
OVERFETCH="${OVERFETCH:-8}"
WHERE_JSON="${WHERE_JSON:-{\"collection\":\"rhetorical_ontology\"}}"

TMP_JSON="/tmp/retrieval.json"

python3 scripts/retrieval/query_chunks.py \
  "$QUERY" \
  --k "$K" \
  --overfetch "$OVERFETCH" \
  --where "$WHERE_JSON" \
  --include_docs \
  --print_json > "$TMP_JSON"

python3 scripts/retrieval/synthesize_cited.py "$TMP_JSON" --take "$K"
