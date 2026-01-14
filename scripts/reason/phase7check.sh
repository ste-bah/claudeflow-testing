#!/usr/bin/env bash
set -euo pipefail

python3 scripts/reason/reason_over_knowledge.py \
  --knowledge god-learn/knowledge.jsonl \
  --out god-reason \
  --top_k_per_unit 12

python3 scripts/reason/verify_reasoning.py \
  --knowledge god-learn/knowledge.jsonl \
  --reasoning god-reason/reasoning.jsonl \
  --strict_order

echo "[PHASE7_CHECK_OK]"
