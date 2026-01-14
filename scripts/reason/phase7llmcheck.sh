#!/usr/bin/env bash
set -euo pipefail

# 7A: build deterministic candidates
python3 scripts/reason/build_candidates.py \
  --knowledge god-learn/knowledge.jsonl \
  --out god-reason \
  --top_k_candidates 25 \
  --min_jaccard 0.03 \
  --min_shared_ngrams 20

echo "[Phase7A_OK] wrote god-reason/candidates.jsonl"
echo ""
echo "NEXT: create annotations.jsonl (ChatGPT output) and run:"
echo "  python3 scripts/reason/apply_annotations.py --annotations /path/to/annotations.jsonl"
echo ""

# NOTE: 7B + 7C run once you have annotations and optional selections.
