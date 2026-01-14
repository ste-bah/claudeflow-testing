#!/bin/bash
# =============================================================================
# GOD-AGENT INSTALLATION VERIFICATION
# Run on both machines and compare the output
# Usage: bash verify-install.sh > fingerprint.txt
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "GOD-AGENT INSTALLATION FINGERPRINT"
echo "Generated: $(date -Iseconds)"
echo "Hostname: $(hostname)"
echo "=============================================="
echo ""

# -----------------------------------------------------------------------------
echo "=== SYSTEM INFO ==="
echo "OS: $(uname -a)"
echo "Python: $(python3 --version 2>&1)"
echo "Node: $(node --version 2>&1)"
echo "npm: $(npm --version 2>&1)"
echo "pdftotext: $(pdftotext -v 2>&1 | head -1)"
echo ""

# -----------------------------------------------------------------------------
echo "=== DIRECTORY STRUCTURE ==="
echo "Project root: $SCRIPT_DIR"
find . -type d \
    -not -path './node_modules*' \
    -not -path './.git*' \
    -not -path './__pycache__*' \
    -not -path './coverage*' \
    -not -path './.run*' \
    -not -path './logs*' \
    -not -path './.phd-sessions*' \
    -not -path './god-learn/runs*' \
    | sort | head -100
echo ""

# -----------------------------------------------------------------------------
echo "=== FILE COUNTS BY DIRECTORY ==="
for dir in src scripts dist embedding-api corpus vector_db_1536 god-learn .claude; do
    if [ -d "$dir" ]; then
        count=$(find "$dir" -type f 2>/dev/null | wc -l)
        echo "$dir: $count files"
    else
        echo "$dir: MISSING"
    fi
done
echo ""

# -----------------------------------------------------------------------------
echo "=== SOURCE CODE CHECKSUMS ==="
echo "src/ checksum:"
find src -type f -name "*.ts" -exec sha256sum {} \; 2>/dev/null | sort | sha256sum | cut -d' ' -f1
echo "scripts/ checksum:"
find scripts -type f \( -name "*.py" -o -name "*.sh" \) -exec sha256sum {} \; 2>/dev/null | sort | sha256sum | cut -d' ' -f1
echo "embedding-api/ checksum:"
find embedding-api -type f -exec sha256sum {} \; 2>/dev/null | sort | sha256sum | cut -d' ' -f1
echo ""

# -----------------------------------------------------------------------------
echo "=== VECTOR DATABASE ==="
if [ -d "vector_db_1536" ]; then
    echo "Size: $(du -sh vector_db_1536 | cut -f1)"
    echo "Files: $(find vector_db_1536 -type f | wc -l)"
    echo "Chroma SQLite checksum:"
    sha256sum vector_db_1536/chroma.sqlite3 2>/dev/null | cut -d' ' -f1 || echo "N/A"
    # Collection count via sqlite
    if command -v sqlite3 &> /dev/null; then
        echo "Collections:"
        sqlite3 vector_db_1536/chroma.sqlite3 "SELECT name, COUNT(*) FROM collections, embeddings WHERE collections.id = embeddings.collection_id GROUP BY collections.id;" 2>/dev/null || echo "  (query failed)"
    fi
else
    echo "MISSING: vector_db_1536/"
fi
echo ""

# -----------------------------------------------------------------------------
echo "=== GOD-LEARN KNOWLEDGE STORE ==="
if [ -f "god-learn/knowledge.jsonl" ]; then
    echo "knowledge.jsonl:"
    echo "  Lines: $(wc -l < god-learn/knowledge.jsonl)"
    echo "  Size: $(du -h god-learn/knowledge.jsonl | cut -f1)"
    echo "  Checksum: $(sha256sum god-learn/knowledge.jsonl | cut -d' ' -f1)"
else
    echo "knowledge.jsonl: MISSING"
fi

if [ -f "god-learn/index.json" ]; then
    echo "index.json:"
    echo "  Entries: $(python3 -c "import json; print(len(json.load(open('god-learn/index.json'))))" 2>/dev/null || echo "N/A")"
    echo "  Checksum: $(sha256sum god-learn/index.json | cut -d' ' -f1)"
else
    echo "index.json: MISSING"
fi
echo ""

# -----------------------------------------------------------------------------
echo "=== CORPUS ==="
if [ -d "corpus" ]; then
    echo "Total files: $(find corpus -type f | wc -l)"
    echo "PDF files: $(find corpus -type f -name '*.pdf' | wc -l)"
    echo "Size: $(du -sh corpus | cut -f1)"
    echo "Subdirectories:"
    for subdir in corpus/*/; do
        if [ -d "$subdir" ]; then
            name=$(basename "$subdir")
            count=$(find "$subdir" -type f | wc -l)
            echo "  $name: $count files"
        fi
    done
else
    echo "MISSING: corpus/"
fi
echo ""

# -----------------------------------------------------------------------------
echo "=== MANIFEST (ingest state) ==="
if [ -f "scripts/ingest/manifest.jsonl" ]; then
    echo "Lines: $(wc -l < scripts/ingest/manifest.jsonl)"
    echo "OK count: $(grep -c '"status": "ok"' scripts/ingest/manifest.jsonl 2>/dev/null || echo 0)"
    echo "Failed count: $(grep -c '"status": "failed"' scripts/ingest/manifest.jsonl 2>/dev/null || echo 0)"
    echo "Checksum: $(sha256sum scripts/ingest/manifest.jsonl | cut -d' ' -f1)"
else
    echo "MISSING"
fi
echo ""

# -----------------------------------------------------------------------------
echo "=== NODE DEPENDENCIES ==="
if [ -f "package-lock.json" ]; then
    echo "package-lock.json checksum: $(sha256sum package-lock.json | cut -d' ' -f1)"
fi
if [ -d "node_modules" ]; then
    echo "node_modules packages: $(ls node_modules | wc -l)"
else
    echo "node_modules: NOT INSTALLED"
fi
echo ""

# -----------------------------------------------------------------------------
echo "=== PYTHON DEPENDENCIES ==="
source ~/.venv/bin/activate 2>/dev/null || true
echo "Installed packages: $(pip list 2>/dev/null | wc -l)"
echo "Key packages:"
for pkg in chromadb anthropic torch sentence-transformers fastapi; do
    ver=$(pip show $pkg 2>/dev/null | grep "^Version:" | cut -d' ' -f2)
    if [ -n "$ver" ]; then
        echo "  $pkg: $ver"
    else
        echo "  $pkg: NOT INSTALLED"
    fi
done
echo ""

# -----------------------------------------------------------------------------
echo "=== CONFIG FILES ==="
for cfg in .env .env.example package.json tsconfig.json; do
    if [ -f "$cfg" ]; then
        echo "$cfg: $(sha256sum "$cfg" | cut -d' ' -f1)"
    else
        echo "$cfg: MISSING"
    fi
done
echo ""

# -----------------------------------------------------------------------------
echo "=== BUILD STATE ==="
if [ -d "dist" ]; then
    echo "dist/ files: $(find dist -type f | wc -l)"
    echo "dist/ checksum: $(find dist -type f -exec sha256sum {} \; 2>/dev/null | sort | sha256sum | cut -d' ' -f1)"
else
    echo "dist/: NOT BUILT"
fi
echo ""

# -----------------------------------------------------------------------------
echo "=== SERVICES STATUS ==="
echo "Embedder (port 8000):"
curl -s -m 2 http://127.0.0.1:8000/ >/dev/null 2>&1 && echo "  RUNNING" || echo "  NOT RUNNING"

echo "Memory server:"
npm run memory:status 2>&1 | grep -E "(running|stopped|error)" | head -1 || echo "  UNKNOWN"

echo "Daemon:"
npm run daemon:status 2>&1 | grep -E "(running|stopped|error)" | head -1 || echo "  UNKNOWN"

echo "UCM:"
npm run ucm:status 2>&1 | grep -E "(running|stopped|error)" | head -1 || echo "  UNKNOWN"
echo ""

echo "=============================================="
echo "END FINGERPRINT"
echo "=============================================="
