#!/usr/bin/env bash
# Test Perplexity API connection
# Usage: ./scripts/setup/test-perplexity.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Perplexity API Connection Test ==="
echo ""

# Load .env if it exists
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
    echo "Loaded .env file"
fi

# Check if API key is set
if [[ -z "${PERPLEXITY_API_KEY:-}" ]]; then
    echo "ERROR: PERPLEXITY_API_KEY is not set"
    echo ""
    echo "Run: ./scripts/setup/configure-perplexity.sh"
    exit 1
fi

# Mask the API key for display
MASKED_KEY="${PERPLEXITY_API_KEY:0:8}...${PERPLEXITY_API_KEY: -4}"
echo "API Key: $MASKED_KEY"
echo ""

# Test the API with a simple request
echo "Testing API connection..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
    --request POST \
    --url https://api.perplexity.ai/chat/completions \
    --header "Authorization: Bearer $PERPLEXITY_API_KEY" \
    --header "Content-Type: application/json" \
    --data '{
        "model": "sonar",
        "messages": [
            {"role": "user", "content": "Say hello in exactly 3 words."}
        ],
        "max_tokens": 20
    }')

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "200" ]]; then
    echo "SUCCESS: API connection working"
    echo ""
    # Extract the response content
    CONTENT=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])" 2>/dev/null || echo "$BODY")
    echo "Response: $CONTENT"
    echo ""
    echo "Perplexity API is ready for grounded research mode!"
elif [[ "$HTTP_CODE" == "401" ]]; then
    echo "ERROR: Invalid API key (401 Unauthorized)"
    echo "Please check your API key at https://www.perplexity.ai/settings/api"
    exit 1
elif [[ "$HTTP_CODE" == "429" ]]; then
    echo "WARNING: Rate limited (429 Too Many Requests)"
    echo "API key is valid but you've hit the rate limit. Wait and try again."
    exit 0
else
    echo "ERROR: Unexpected response (HTTP $HTTP_CODE)"
    echo "$BODY"
    exit 1
fi
