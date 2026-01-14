#!/bin/bash
# =============================================================================
# GOD-AGENT TRANSFER SETUP SCRIPT
# Run this on the target WSL Ubuntu machine after extracting the archive
# Usage: bash setup-target.sh
# =============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "  GOD-AGENT SETUP - WSL Ubuntu Target"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_step() { echo -e "${GREEN}[STEP]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# 1. System Dependencies
# =============================================================================
log_step "Installing system dependencies..."

sudo apt-get update -qq
sudo apt-get install -y -qq \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    poppler-utils \
    curl \
    git \
    sqlite3 \
    graphviz

# =============================================================================
# 2. Node.js (via nvm for reliability)
# =============================================================================
log_step "Setting up Node.js v22..."

if ! command -v node &> /dev/null || [[ "$(node -v)" != v22* ]]; then
    if [ ! -d "$HOME/.nvm" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    fi
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
    nvm alias default 22
else
    echo "  Node.js v22 already installed: $(node -v)"
fi

# Ensure nvm is loaded for rest of script
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# =============================================================================
# 3. Python Virtual Environment
# =============================================================================
log_step "Setting up Python virtual environment..."

VENV_PATH="$HOME/.venv"

if [ ! -d "$VENV_PATH" ]; then
    python3 -m venv "$VENV_PATH"
fi

source "$VENV_PATH/bin/activate"

# Upgrade pip
pip install --upgrade pip -q

# Install Python dependencies
log_step "Installing Python dependencies (this may take a few minutes)..."
pip install -r requirements-full.txt -q

# =============================================================================
# 4. Node.js Dependencies
# =============================================================================
log_step "Installing Node.js dependencies..."

npm install --silent

# =============================================================================
# 5. Build TypeScript
# =============================================================================
log_step "Building TypeScript..."

npm run build

# =============================================================================
# 6. Create necessary directories
# =============================================================================
log_step "Creating directories..."

mkdir -p logs .run .phd-sessions god-learn/runs

# =============================================================================
# 7. Environment setup
# =============================================================================
log_step "Setting up environment..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_warn "Created .env from .env.example - PLEASE EDIT WITH YOUR API KEYS"
    else
        cat > .env << 'EOF'
# God Agent Configuration
# Add your API keys here

# Anthropic API Key (required)
ANTHROPIC_API_KEY=

# Perplexity API Key (optional, for web search)
PERPLEXITY_API_KEY=
EOF
        log_warn "Created .env template - PLEASE EDIT WITH YOUR API KEYS"
    fi
fi

# =============================================================================
# 8. Create convenience scripts
# =============================================================================
log_step "Creating convenience scripts..."

cat > start-embedder.sh << 'EOF'
#!/bin/bash
source ~/.venv/bin/activate
nohup python3 -u embedding-api/api_embedder.py > logs/embedder.log 2>&1 &
echo $! > .run/embedder.pid
echo "Embedder started with PID $(cat .run/embedder.pid)"
sleep 3
curl -s http://127.0.0.1:8000/ && echo "Embedder is responding!" || echo "Warning: Embedder may not be ready yet"
EOF
chmod +x start-embedder.sh

cat > stop-embedder.sh << 'EOF'
#!/bin/bash
if [ -f .run/embedder.pid ]; then
    kill $(cat .run/embedder.pid) 2>/dev/null && echo "Embedder stopped" || echo "Embedder was not running"
    rm -f .run/embedder.pid
else
    echo "No embedder PID file found"
fi
EOF
chmod +x stop-embedder.sh

cat > god-compile.sh << 'EOF'
#!/bin/bash
source ~/.venv/bin/activate
python3 scripts/god_learn/god_learn.py compile --no-run-dir "$@"
EOF
chmod +x god-compile.sh

cat > god-update.sh << 'EOF'
#!/bin/bash
source ~/.venv/bin/activate
python3 scripts/god_learn/god_learn.py update --no-run-dir "$@"
EOF
chmod +x god-update.sh

# =============================================================================
# 9. Add shell profile helpers
# =============================================================================
log_step "Adding shell profile helpers..."

PROFILE_SNIPPET='
# God-Agent Environment
export GOD_AGENT_HOME="'"$SCRIPT_DIR"'"
alias god-activate="source ~/.venv/bin/activate && cd $GOD_AGENT_HOME"
alias god-embed-start="$GOD_AGENT_HOME/start-embedder.sh"
alias god-embed-stop="$GOD_AGENT_HOME/stop-embedder.sh"
'

if ! grep -q "GOD_AGENT_HOME" ~/.bashrc 2>/dev/null; then
    echo "$PROFILE_SNIPPET" >> ~/.bashrc
    echo "  Added aliases to ~/.bashrc"
fi

# =============================================================================
# DONE
# =============================================================================
echo ""
echo "=============================================="
echo -e "${GREEN}  SETUP COMPLETE!${NC}"
echo "=============================================="
echo ""
echo "Quick start:"
echo "  1. Edit .env and add your ANTHROPIC_API_KEY"
echo "  2. Restart your shell or run: source ~/.bashrc"
echo "  3. Start embedder: ./start-embedder.sh"
echo "  4. Run compile: ./god-compile.sh"
echo ""
echo "Aliases available after shell restart:"
echo "  god-activate     - Activate venv and cd to project"
echo "  god-embed-start  - Start the embedding server"
echo "  god-embed-stop   - Stop the embedding server"
echo ""
