#!/usr/bin/env bash
# Patch claude-flow memory.js to fix undefined namespace bug
# The store and retrieve commands don't default namespace to 'default',
# causing UNIQUE constraint failures and entries stored under 'undefined'.
#
# Usage: ./scripts/patch-claude-flow-memory.sh

set -euo pipefail

echo "🔧 Patching claude-flow memory.js namespace bug..."

# Find the memory.js file in npx cache
MEMORY_JS=$(find ~/.npm/_npx -path "*/claude-flow/*/commands/memory.js" 2>/dev/null | head -1)

if [ -z "$MEMORY_JS" ]; then
  echo "❌ claude-flow memory.js not found in npx cache."
  echo "   Run 'npx claude-flow@alpha memory list' first to populate cache, then retry."
  exit 1
fi

echo "📍 Found: $MEMORY_JS"

# Count occurrences of the bug pattern
BUG_COUNT=$(grep -c 'const namespace = ctx\.flags\.namespace;' "$MEMORY_JS" 2>/dev/null || echo 0)

if [ "$BUG_COUNT" -eq 0 ]; then
  echo "✅ Already patched (no unfixed occurrences found)."
  exit 0
fi

echo "🐛 Found $BUG_COUNT unfixed namespace assignments."

# Apply patch: add || 'default' fallback to all bare namespace assignments
sed -i.bak "s/const namespace = ctx\.flags\.namespace;/const namespace = ctx.flags.namespace || 'default';/g" "$MEMORY_JS"

# Verify
REMAINING=$(grep -c 'const namespace = ctx\.flags\.namespace;' "$MEMORY_JS" 2>/dev/null || echo 0)

if [ "$REMAINING" -eq 0 ]; then
  echo "✅ Patched $BUG_COUNT occurrences. All namespace defaults set to 'default'."
  rm -f "${MEMORY_JS}.bak"
else
  echo "⚠️  $REMAINING occurrences still unfixed. Restoring backup."
  mv "${MEMORY_JS}.bak" "$MEMORY_JS"
  exit 1
fi

# Quick verification
echo ""
echo "🧪 Verifying..."
npx claude-flow@alpha memory store -k "patch/verify" -v '{"patched":true}' 2>&1 | grep -E "Storing in|OK" || true
npx claude-flow@alpha memory delete -k "patch/verify" 2>/dev/null || true
echo ""
echo "✅ Patch complete."
