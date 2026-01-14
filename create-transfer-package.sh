#!/bin/bash
# =============================================================================
# CREATE TRANSFER PACKAGE
# Creates a complete archive for transferring to another WSL Ubuntu machine
# =============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ARCHIVE_NAME="god-agent-transfer-${TIMESTAMP}.tar.gz"
OUTPUT_DIR="${1:-$HOME}"

echo "=============================================="
echo "  Creating God-Agent Transfer Package"
echo "=============================================="
echo ""

# Stop any running services first
echo "[1/4] Stopping running services..."
if [ -f .run/embedder.pid ]; then
    kill $(cat .run/embedder.pid) 2>/dev/null || true
fi

# Create the archive
echo "[2/4] Creating archive (this may take a minute)..."
echo "  Including: source, scripts, configs, vector_db, corpus, god-learn data"

tar -czf "${OUTPUT_DIR}/${ARCHIVE_NAME}" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='.run/*.pid' \
    --exclude='__pycache__' \
    --exclude='.pytest_cache' \
    --exclude='coverage' \
    --exclude='.god-agent/*.db-shm' \
    --exclude='.god-agent/*.db-wal' \
    --exclude='*.pyc' \
    --exclude='.DS_Store' \
    --exclude='*.tar.gz' \
    -C "$(dirname "$SCRIPT_DIR")" \
    "$(basename "$SCRIPT_DIR")"

# Get size
ARCHIVE_SIZE=$(du -h "${OUTPUT_DIR}/${ARCHIVE_NAME}" | cut -f1)

echo "[3/4] Archive created: ${OUTPUT_DIR}/${ARCHIVE_NAME}"
echo "  Size: ${ARCHIVE_SIZE}"

# Create checksum
echo "[4/4] Creating checksum..."
cd "${OUTPUT_DIR}"
sha256sum "${ARCHIVE_NAME}" > "${ARCHIVE_NAME}.sha256"

echo ""
echo "=============================================="
echo "  TRANSFER PACKAGE READY"
echo "=============================================="
echo ""
echo "Files created:"
echo "  ${OUTPUT_DIR}/${ARCHIVE_NAME}"
echo "  ${OUTPUT_DIR}/${ARCHIVE_NAME}.sha256"
echo ""
echo "To transfer:"
echo "  1. Copy both files to target Windows PC"
echo "  2. In WSL on target: mkdir -p ~/projects && cd ~/projects"
echo "  3. Extract: tar -xzf ${ARCHIVE_NAME}"
echo "  4. Run setup: cd claudeflow-testing && bash setup-target.sh"
echo ""
echo "Verify integrity on target (optional):"
echo "  sha256sum -c ${ARCHIVE_NAME}.sha256"
echo ""
