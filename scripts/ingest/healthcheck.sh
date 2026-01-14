#!/usr/bin/env bash
set -euo pipefail

ROOT=""
MANIFEST=""
CHROMA_DIR=""
COLLECTION=""

# parse args once
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    --manifest) MANIFEST="$2"; shift 2 ;;
    --chroma_dir) CHROMA_DIR="$2"; shift 2 ;;
    --collection) COLLECTION="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# required for both
[[ -n "$ROOT" ]] || { echo "--root required"; exit 2; }
[[ -n "$MANIFEST" ]] || { echo "--manifest required"; exit 2; }

# audit: manifest + filesystem only
python3 scripts/ingest/audit_ingest.py \
  --root "$ROOT" \
  --manifest "$MANIFEST"

# verify: needs chroma
[[ -n "$CHROMA_DIR" ]] || { echo "--chroma_dir required for verify"; exit 2; }
[[ -n "$COLLECTION" ]] || { echo "--collection required for verify"; exit 2; }

python3 scripts/ingest/verify_ingest.py \
  --root "$ROOT" \
  --manifest "$MANIFEST" \
  --chroma_dir "$CHROMA_DIR" \
  --collection "$COLLECTION"
