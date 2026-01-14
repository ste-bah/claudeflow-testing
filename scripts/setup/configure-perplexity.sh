#!/usr/bin/env bash
# Configure Perplexity API for grounded research mode
# Usage: ./scripts/setup/configure-perplexity.sh [API_KEY]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

echo "=== Perplexity API Configuration ==="
echo ""

# Check if API key is provided as argument
if [[ $# -ge 1 ]]; then
    API_KEY="$1"
else
    # Prompt for API key
    echo "Get your API key from: https://www.perplexity.ai/settings/api"
    echo ""
    read -p "Enter your Perplexity API key (pplx-...): " API_KEY
fi

# Validate key format
if [[ ! "$API_KEY" =~ ^pplx- ]]; then
    echo "Warning: API key doesn't start with 'pplx-'. Are you sure this is correct?"
    read -p "Continue anyway? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy] ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Create or update .env file
if [[ -f "$ENV_FILE" ]]; then
    # Update existing file
    if grep -q "^PERPLEXITY_API_KEY=" "$ENV_FILE"; then
        # Replace existing key
        sed -i "s/^PERPLEXITY_API_KEY=.*/PERPLEXITY_API_KEY=$API_KEY/" "$ENV_FILE"
        echo "Updated existing PERPLEXITY_API_KEY in .env"
    else
        # Append to file
        echo "PERPLEXITY_API_KEY=$API_KEY" >> "$ENV_FILE"
        echo "Added PERPLEXITY_API_KEY to .env"
    fi
else
    # Create new file
    echo "PERPLEXITY_API_KEY=$API_KEY" > "$ENV_FILE"
    echo "Created .env with PERPLEXITY_API_KEY"
fi

# Add to .gitignore if not already there
GITIGNORE="$PROJECT_ROOT/.gitignore"
if [[ -f "$GITIGNORE" ]]; then
    if ! grep -q "^\.env$" "$GITIGNORE"; then
        echo ".env" >> "$GITIGNORE"
        echo "Added .env to .gitignore"
    fi
else
    echo ".env" > "$GITIGNORE"
    echo "Created .gitignore with .env"
fi

echo ""
echo "=== Configuration Complete ==="
echo ""
echo "To use the API key in your current shell:"
echo "  export PERPLEXITY_API_KEY=$API_KEY"
echo ""
echo "Or add to your shell profile (~/.bashrc or ~/.zshrc):"
echo "  echo 'export PERPLEXITY_API_KEY=$API_KEY' >> ~/.bashrc"
echo ""
echo "Then restart Claude Code to pick up the new configuration."
