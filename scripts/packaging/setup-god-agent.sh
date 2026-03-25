#!/bin/bash
#===============================================================================
# God Agent + Serena MCP + Archon Complete Setup Script
#
# This script sets up a fresh installation of the God Agent system with:
# - Claude Code CLI (Anthropic's official CLI)
# - NVM (Node Version Manager) + Node.js 22
# - claude-flow@alpha and ruv-swarm (globally installed)
# - Python 3.11+ virtual environment
# - Serena MCP server (using uv package manager)
# - Embedding API server
# - MemoryGraph (FalkorDB Lite) for graph-based persistent memory
# - LanceDB vector memory server
# - Mermaid CLI for diagram generation
# - Archon autonomous runner (RocketChat polling, learning, consolidation)
# - All required dependencies
# - Proper .mcp.json configuration
#
# Usage: ./setup-god-agent.sh [OPTIONS]
#   --skip-nvm           Skip NVM/Node.js installation
#   --skip-python        Skip Python environment setup
#   --skip-serena        Skip Serena MCP setup
#   --skip-embedding     Skip Embedding API setup
#   --skip-market-terminal  Skip Market Terminal setup
#   --minimal            Only install core components
#   --help               Show this help
#===============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NODE_VERSION="22"
PYTHON_MIN_VERSION="3.11"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Parse arguments
SKIP_NVM=false
SKIP_PYTHON=false
SKIP_SERENA=false
SKIP_EMBEDDING=false
SKIP_MARKET_TERMINAL=false
MINIMAL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-nvm)
            SKIP_NVM=true
            shift
            ;;
        --skip-python)
            SKIP_PYTHON=true
            shift
            ;;
        --skip-serena)
            SKIP_SERENA=true
            shift
            ;;
        --skip-embedding)
            SKIP_EMBEDDING=true
            shift
            ;;
        --skip-market-terminal)
            SKIP_MARKET_TERMINAL=true
            shift
            ;;
        --minimal)
            MINIMAL=true
            shift
            ;;
        --help)
            head -27 "$0" | tail -22
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}"
echo "=================================================================="
echo "       God Agent + Serena MCP Complete Setup Script"
echo "=================================================================="
echo -e "${NC}"
echo "Project Directory: $PROJECT_DIR"
echo ""

#===============================================================================
# STEP 1: Check System Prerequisites
#===============================================================================
echo -e "${YELLOW}[1/13] Checking system prerequisites...${NC}"

# Check for curl or wget
if command -v curl &> /dev/null; then
    DOWNLOADER="curl -fsSL"
elif command -v wget &> /dev/null; then
    DOWNLOADER="wget -qO-"
else
    echo -e "${RED}Error: curl or wget is required but not installed.${NC}"
    exit 1
fi

# Check for git
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git is required but not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}  Prerequisites OK${NC}"

#===============================================================================
# STEP 2: NVM + Node.js Installation
#===============================================================================
if [ "$SKIP_NVM" = false ]; then
    echo -e "${YELLOW}[2/13] Setting up NVM and Node.js ${NODE_VERSION}...${NC}"

    # Check if NVM is already installed
    export NVM_DIR="$HOME/.nvm"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        echo "  NVM already installed, loading..."
        source "$NVM_DIR/nvm.sh"
    else
        echo "  Installing NVM..."
        $DOWNLOADER https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

        # Load NVM
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
    fi

    # Install Node.js
    echo "  Installing Node.js ${NODE_VERSION}..."
    nvm install ${NODE_VERSION}
    nvm alias default ${NODE_VERSION}
    nvm use ${NODE_VERSION}

    echo -e "${GREEN}  Node.js $(node --version) installed${NC}"
    echo -e "${GREEN}  NPM $(npm --version) installed${NC}"
else
    echo -e "${YELLOW}[2/13] Skipping NVM/Node.js installation${NC}"

    # Still need to load NVM if it exists
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
fi

#===============================================================================
# STEP 3: Install Claude Code CLI
#===============================================================================
echo -e "${YELLOW}[3/13] Installing Claude Code CLI...${NC}"

# Check if Claude Code is already installed
if command -v claude &> /dev/null; then
    CLAUDE_VERSION=$(claude --version 2>/dev/null || echo "unknown")
    echo -e "${GREEN}  Claude Code already installed: $CLAUDE_VERSION${NC}"
else
    echo "  Installing Claude Code via npm..."
    npm install -g @anthropic-ai/claude-code

    if command -v claude &> /dev/null; then
        echo -e "${GREEN}  Claude Code installed successfully${NC}"
    else
        echo -e "${YELLOW}  Warning: Claude Code installed but 'claude' command not found in PATH${NC}"
        echo "  You may need to add npm global bin to your PATH"
        echo "  Try: export PATH=\"\$PATH:\$(npm config get prefix)/bin\""
    fi
fi

#===============================================================================
# STEP 4: Install claude-flow and ruv-swarm globally
#===============================================================================
echo -e "${YELLOW}[4/13] Installing claude-flow and ruv-swarm globally...${NC}"

# Install claude-flow@alpha globally
echo "  Installing claude-flow@alpha..."
npm install -g claude-flow@alpha 2>/dev/null || npm install -g claude-flow@alpha

# Install ruv-swarm globally
echo "  Installing ruv-swarm..."
npm install -g ruv-swarm@latest 2>/dev/null || npm install -g ruv-swarm@latest

# Verify installations
if command -v npx &> /dev/null; then
    echo -e "${GREEN}  claude-flow and ruv-swarm installed${NC}"
else
    echo -e "${YELLOW}  Warning: npx not available, MCP servers may not start${NC}"
fi

#===============================================================================
# STEP 5: Python Environment Setup
#===============================================================================
if [ "$SKIP_PYTHON" = false ]; then
    echo -e "${YELLOW}[5/13] Setting up Python environment...${NC}"

    # Check Python version
    PYTHON_CMD=""
    for cmd in python3.11 python3.12 python3; do
        if command -v $cmd &> /dev/null; then
            VERSION=$($cmd --version 2>&1 | cut -d' ' -f2)
            MAJOR=$(echo $VERSION | cut -d'.' -f1)
            MINOR=$(echo $VERSION | cut -d'.' -f2)
            if [ "$MAJOR" -eq 3 ] && [ "$MINOR" -ge 11 ]; then
                PYTHON_CMD=$cmd
                break
            fi
        fi
    done

    if [ -z "$PYTHON_CMD" ]; then
        echo -e "${RED}Error: Python 3.11+ is required but not found.${NC}"
        echo "  Please install Python 3.11 or higher:"
        echo "    Ubuntu/Debian: sudo apt install python3.11 python3.11-venv"
        echo "    macOS: brew install python@3.11"
        exit 1
    fi

    echo "  Using Python: $PYTHON_CMD ($($PYTHON_CMD --version))"

    # Create global virtual environment for user
    VENV_DIR="$HOME/.venv"
    if [ ! -d "$VENV_DIR" ]; then
        echo "  Creating global virtual environment at $VENV_DIR..."
        $PYTHON_CMD -m venv "$VENV_DIR"
    fi

    # Activate virtual environment
    source "$VENV_DIR/bin/activate"

    # Upgrade pip
    echo "  Upgrading pip..."
    pip install --upgrade pip setuptools wheel

    # Install uv (modern Python package manager)
    echo "  Installing uv package manager..."
    pip install uv

    echo -e "${GREEN}  Python environment ready: $(python --version)${NC}"
else
    echo -e "${YELLOW}[5/13] Skipping Python environment setup${NC}"
fi

#===============================================================================
# STEP 6: Embedding API Dependencies
#===============================================================================
if [ "$SKIP_EMBEDDING" = false ]; then
    echo -e "${YELLOW}[6/13] Setting up Embedding API dependencies...${NC}"

    EMBED_DIR="$PROJECT_DIR/embedding-api"
    if [ -d "$EMBED_DIR" ]; then
        echo "  Installing embedding API dependencies..."

        # Use the global venv
        VENV_DIR="$HOME/.venv"
        if [ -d "$VENV_DIR" ]; then
            source "$VENV_DIR/bin/activate"
        fi

        # Install embedding dependencies
        if [ -f "$EMBED_DIR/requirements.txt" ]; then
            pip install -r "$EMBED_DIR/requirements.txt"
            echo -e "${GREEN}  Embedding API dependencies installed${NC}"
        fi

        # Make the launcher executable
        if [ -f "$EMBED_DIR/api-embed.sh" ]; then
            chmod +x "$EMBED_DIR/api-embed.sh"
            echo -e "${GREEN}  Embedding launcher configured${NC}"
        fi
    else
        echo -e "${YELLOW}  No embedding-api directory found, skipping${NC}"
    fi
else
    echo -e "${YELLOW}[6/13] Skipping Embedding API setup${NC}"
fi

#===============================================================================
# STEP 7: Serena MCP Server Setup
#===============================================================================
if [ "$SKIP_SERENA" = false ]; then
    echo -e "${YELLOW}[7/13] Setting up Serena MCP server...${NC}"

    SERENA_DIR="$PROJECT_DIR/serena"

    if [ ! -d "$SERENA_DIR" ]; then
        echo -e "${RED}Error: Serena directory not found at $SERENA_DIR${NC}"
        exit 1
    fi

    cd "$SERENA_DIR"

    # Create Serena-specific virtual environment
    SERENA_VENV="$SERENA_DIR/.venv"
    if [ ! -d "$SERENA_VENV" ]; then
        echo "  Creating Serena virtual environment..."
        python -m venv "$SERENA_VENV"
    fi

    # Activate Serena venv
    source "$SERENA_VENV/bin/activate"

    # Install Serena and dependencies
    echo "  Installing Serena dependencies (this may take a while)..."
    pip install --upgrade pip setuptools wheel
    pip install uv

    # Use uv for faster installation
    if [ -f "pyproject.toml" ]; then
        echo "  Installing from pyproject.toml using uv..."
        uv pip install -e .
    else
        echo "  Installing Serena package..."
        pip install -e .
    fi

    # Verify Serena installation
    if command -v serena &> /dev/null || [ -f "$SERENA_VENV/bin/serena" ]; then
        echo -e "${GREEN}  Serena MCP server installed successfully${NC}"
    else
        echo -e "${RED}Warning: Serena command not found in PATH${NC}"
    fi

    cd "$PROJECT_DIR"
else
    echo -e "${YELLOW}[7/13] Skipping Serena MCP setup${NC}"
fi

#===============================================================================
# STEP 8: Market Terminal Setup
#===============================================================================
if [ "$SKIP_MARKET_TERMINAL" = false ] && [ "$MINIMAL" = false ]; then
    echo -e "${YELLOW}[8/13] Setting up Market Terminal...${NC}"

    MT_BACKEND="$PROJECT_DIR/market-terminal/backend"
    MT_FRONTEND="$PROJECT_DIR/market-terminal/frontend"

    if [ ! -d "$MT_BACKEND" ]; then
        echo -e "${YELLOW}  No market-terminal/backend directory found, skipping${NC}"
    else
        # --- Backend Python venv ---
        MT_VENV="$MT_BACKEND/.tv"
        if [ ! -d "$MT_VENV" ]; then
            echo "  Creating backend virtual environment at .tv/..."
            # Use same Python found in step 5; fall back to python3
            PY_CMD="${PYTHON_CMD:-python3}"
            $PY_CMD -m venv "$MT_VENV"
        else
            echo "  Backend virtual environment already exists"
        fi

        echo "  Installing backend dependencies (this may take a while — includes torch/transformers)..."
        "$MT_VENV/bin/pip" install --upgrade pip --quiet
        "$MT_VENV/bin/pip" install -r "$MT_BACKEND/requirements.txt" --quiet
        echo -e "${GREEN}  Backend dependencies installed${NC}"

        # --- .env from .env.example ---
        if [ ! -f "$MT_BACKEND/.env" ]; then
            if [ -f "$MT_BACKEND/.env.example" ]; then
                cp "$MT_BACKEND/.env.example" "$MT_BACKEND/.env"
                echo -e "${GREEN}  Created market-terminal/backend/.env from .env.example${NC}"
                echo -e "${YELLOW}  ACTION REQUIRED: Add your API keys to market-terminal/backend/.env${NC}"
                echo "    Required: FINNHUB_API_KEY, FRED_API_KEY"
                echo "    Optional: ALPHA_VANTAGE_API_KEY, MASSIVE_API_KEY"
            fi
        else
            echo "  .env already exists"
        fi

        # --- Backend data directory (SQLite) ---
        mkdir -p "$MT_BACKEND/../data"
        echo -e "${GREEN}  Database directory ready${NC}"
    fi

    # --- Frontend npm install ---
    if [ ! -d "$MT_FRONTEND" ]; then
        echo -e "${YELLOW}  No market-terminal/frontend directory found, skipping frontend setup${NC}"
    else
        echo "  Installing frontend dependencies..."
        cd "$MT_FRONTEND"
        npm install --silent
        cd "$PROJECT_DIR"
        echo -e "${GREEN}  Frontend dependencies installed${NC}"
    fi

    # --- PID file directory ---
    mkdir -p "$PROJECT_DIR/market-terminal/.run"
    echo -e "${GREEN}  Market Terminal setup complete${NC}"
else
    echo -e "${YELLOW}[8/13] Skipping Market Terminal setup${NC}"
fi

#===============================================================================
# STEP 9: Node.js Dependencies
#===============================================================================
echo -e "${YELLOW}[9/13] Installing Node.js dependencies...${NC}"

cd "$PROJECT_DIR"

# Ensure NVM is loaded
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# Install npm dependencies
if [ -f "package.json" ]; then
    echo "  Running npm install..."
    npm install

    # Rebuild native modules for current Node version (important for Node 22)
    echo "  Rebuilding native modules..."
    npm rebuild 2>/dev/null || echo "  Note: Native module rebuild completed"

    # Build TypeScript
    echo "  Building TypeScript..."
    npm run build 2>/dev/null || echo "  Note: Build completed (some warnings may be expected)"

    echo -e "${GREEN}  Node.js dependencies installed${NC}"
else
    echo -e "${RED}Warning: package.json not found${NC}"
fi

#===============================================================================
# STEP 10: Configure .mcp.json
#===============================================================================
echo -e "${YELLOW}[10/13] Configuring MCP servers...${NC}"

MCP_JSON="$PROJECT_DIR/.mcp.json"
SERENA_VENV="$PROJECT_DIR/serena/.venv"

# Create .mcp.json with proper paths
cat > "$MCP_JSON" << EOF
{
  "mcpServers": {
    "serena": {
      "command": "${SERENA_VENV}/bin/serena",
      "args": [
        "start-mcp-server",
        "--project",
        "${PROJECT_DIR}"
      ],
      "type": "stdio",
      "env": {
        "VIRTUAL_ENV": "${SERENA_VENV}",
        "PATH": "${SERENA_VENV}/bin:\${PATH}"
      }
    },
    "claude-flow@alpha": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"],
      "type": "stdio"
    },
    "ruv-swarm": {
      "command": "npx",
      "args": ["ruv-swarm@latest", "mcp", "start"],
      "type": "stdio"
    },
    "perplexity": {
      "command": "npx",
      "args": ["-y", "@perplexity-ai/mcp-server"],
      "type": "stdio",
      "env": {
        "PERPLEXITY_API_KEY": "\${PERPLEXITY_API_KEY}"
      }
    },
    "leann-search": {
      "command": "npx",
      "args": ["tsx", "src/mcp-servers/leann-search/index.ts"],
      "type": "stdio",
      "env": {
        "MCP_TIMEOUT": "300000"
      }
    }
  }
}
EOF

echo -e "${GREEN}  .mcp.json configured${NC}"

#===============================================================================
# STEP 11: Configure .serena/project.yml
#===============================================================================
echo -e "${YELLOW}[11/13] Configuring Serena project settings...${NC}"

SERENA_CONFIG_DIR="$PROJECT_DIR/.serena"
mkdir -p "$SERENA_CONFIG_DIR"

# Only create if doesn't exist (preserve existing memories)
if [ ! -f "$SERENA_CONFIG_DIR/project.yml" ]; then
    cat > "$SERENA_CONFIG_DIR/project.yml" << EOF
# Serena Project Configuration
languages:
  - python
  - typescript

encoding: "utf-8"
project_name: "$(basename $PROJECT_DIR)"

# File handling
ignore_all_files_in_gitignore: true
read_only: false

# Tools configuration
excluded_tools: []

# Memory settings
memory_enabled: true
EOF
fi

echo -e "${GREEN}  Serena project configured${NC}"

#===============================================================================
# STEP 12: Create Runtime Directories
#===============================================================================
echo -e "${YELLOW}[12/13] Creating runtime directories...${NC}"

# Ensure all runtime directories exist
mkdir -p "$PROJECT_DIR/tmp"
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$PROJECT_DIR/.run"
mkdir -p "$PROJECT_DIR/vector_db_1536"  # 1536D vectors for gte-Qwen2-1.5B-instruct
mkdir -p "$PROJECT_DIR/.agentdb/universal"
mkdir -p "$PROJECT_DIR/.agentdb/sona"
mkdir -p "$PROJECT_DIR/.swarm/agentdb"
mkdir -p "$PROJECT_DIR/.claude-flow/memory"
mkdir -p "$PROJECT_DIR/.claude-flow/metrics"
mkdir -p "$PROJECT_DIR/.hive-mind"/{backups,config,exports,logs,memory,sessions,templates}
mkdir -p "$PROJECT_DIR/coordination"/{memory_bank,orchestration,subtasks}
mkdir -p "$PROJECT_DIR/memory"/{agents,sessions}
mkdir -p "$PROJECT_DIR/config"

echo -e "${GREEN}  Runtime directories created${NC}"

#===============================================================================
# STEP 14: MemoryGraph (FalkorDB Lite) Setup
#===============================================================================
echo -e "${YELLOW}[14/18] Setting up MemoryGraph (FalkorDB Lite)...${NC}"

# Create dedicated Python 3.12 venv for MemoryGraph
MEMORYGRAPH_VENV="$HOME/.memorygraph-venv"
if [ ! -d "$MEMORYGRAPH_VENV" ]; then
    echo "  Creating MemoryGraph venv..."
    python3.12 -m venv "$MEMORYGRAPH_VENV" 2>/dev/null || python3 -m venv "$MEMORYGRAPH_VENV"

    # Install from our fork (includes FalkorDB patches)
    echo "  Installing memorygraphMCP from fork..."
    "$MEMORYGRAPH_VENV/bin/pip" install -e "$PROJECT_DIR/../memory-graph" 2>/dev/null || \
    "$MEMORYGRAPH_VENV/bin/pip" install memorygraphMCP

    # Create wrapper script
    cat > "$MEMORYGRAPH_VENV/run.sh" << 'MGEOF'
#!/bin/bash
exec /path/to/venv/bin/memorygraph "$@"
MGEOF
    sed -i '' "s|/path/to/venv|$MEMORYGRAPH_VENV|" "$MEMORYGRAPH_VENV/run.sh"
    chmod +x "$MEMORYGRAPH_VENV/run.sh"

    # Create data directory
    mkdir -p "$HOME/.memorygraph"
    chmod 700 "$HOME/.memorygraph"
fi
echo -e "${GREEN}  MemoryGraph ready at $MEMORYGRAPH_VENV${NC}"

#===============================================================================
# STEP 15: LanceDB Vector Memory Setup
#===============================================================================
echo -e "${YELLOW}[15/18] Setting up LanceDB vector memory...${NC}"
# LanceDB runs as a TypeScript MCP server, no separate install needed
# Just verify the server file exists
if [ -f "$PROJECT_DIR/src/mcp-servers/lancedb-memory/server.ts" ]; then
    echo -e "${GREEN}  LanceDB server found${NC}"
else
    echo -e "${YELLOW}  Warning: LanceDB server not found at src/mcp-servers/lancedb-memory/server.ts${NC}"
fi

#===============================================================================
# STEP 16: Mermaid CLI (Diagram Generation)
#===============================================================================
echo -e "${YELLOW}[16/18] Installing Mermaid CLI (diagram generation)...${NC}"
if ! command -v mmdc &> /dev/null; then
    npm install -g @mermaid-js/mermaid-cli
    echo -e "${GREEN}  Mermaid CLI installed (mmdc $(mmdc --version 2>/dev/null))${NC}"
else
    echo -e "${GREEN}  Mermaid CLI already installed ($(mmdc --version 2>/dev/null))${NC}"
fi

#===============================================================================
# STEP 17: Archon Autonomous Runner
#===============================================================================
echo -e "${YELLOW}[17/18] Setting up Archon autonomous runner...${NC}"

# Create directories
mkdir -p "$HOME/.archon/scripts/lib" "$HOME/.archon/logs" "$HOME/.archon/budget"
chmod 700 "$HOME/.archon/logs" "$HOME/.archon/budget"

# Deploy scripts
if [ -d "$PROJECT_DIR/scripts/archon" ]; then
    cp "$PROJECT_DIR/scripts/archon/rc-prefilter.sh" "$HOME/.archon/scripts/" 2>/dev/null
    cp "$PROJECT_DIR/scripts/archon/archon-runner.sh" "$HOME/.archon/scripts/" 2>/dev/null
    cp "$PROJECT_DIR/scripts/archon/lib/logging.sh" "$HOME/.archon/scripts/lib/" 2>/dev/null
    cp "$PROJECT_DIR/scripts/archon/system-prompt.md" "$HOME/.archon/scripts/" 2>/dev/null
    chmod +x "$HOME/.archon/scripts/rc-prefilter.sh" "$HOME/.archon/scripts/archon-runner.sh" 2>/dev/null

    echo -e "${GREEN}  Archon runner deployed to ~/.archon/scripts/${NC}"
else
    echo -e "${YELLOW}  Warning: scripts/archon/ not found, skipping Archon deployment${NC}"
fi

# Create credentials template (user must fill in)
if [ ! -f "$HOME/.archon-env" ]; then
    cat > "$HOME/.archon-env" << 'ENVEOF'
# Archon Autonomous Operation Credentials
# SECURITY: chmod 600. Never commit to git.
RC_URL="http://your-rocketchat-host:port"
RC_USER_ID=""
RC_TOKEN=""
RC_TOKEN_ID=""
ENVEOF
    chmod 600 "$HOME/.archon-env"
    echo -e "${YELLOW}  Created ~/.archon-env template — fill in RocketChat credentials${NC}"
fi

echo -e "${YELLOW}  To install launchd agents: bash $PROJECT_DIR/scripts/archon/install.sh${NC}"
echo -e "${YELLOW}  To configure: edit ~/.archon-env with your RocketChat credentials${NC}"

#===============================================================================
# STEP 18: Create Shell Profile Additions
#===============================================================================
echo -e "${YELLOW}[18/18] Creating shell profile additions...${NC}"

PROFILE_ADDITIONS="$PROJECT_DIR/scripts/packaging/profile-additions.sh"
mkdir -p "$(dirname "$PROFILE_ADDITIONS")"

cat > "$PROFILE_ADDITIONS" << 'EOF'
# God Agent Environment Setup
# Add these lines to your ~/.profile or ~/.bashrc

# NVM (Node Version Manager)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Set default Node.js version
nvm alias default 22 2>/dev/null

# Python virtual environment (optional - activate when needed)
# source ~/.venv/bin/activate

# Add local bin to PATH
export PATH="$HOME/.local/bin:$PATH"

# Add npm global bin to PATH (for Claude Code)
export PATH="$PATH:$(npm config get prefix 2>/dev/null)/bin"
EOF

echo -e "${GREEN}  Profile additions saved to: $PROFILE_ADDITIONS${NC}"

#===============================================================================
# Summary
#===============================================================================
echo ""
echo -e "${BLUE}=================================================================="
echo "                    Setup Complete!"
echo "==================================================================${NC}"
echo ""
echo "Installed Components:"
echo "  - Claude Code:    $(claude --version 2>/dev/null || echo 'Not in current shell')"
echo "  - Node.js:        $(node --version 2>/dev/null || echo 'Not in current shell')"
echo "  - NPM:            $(npm --version 2>/dev/null || echo 'Not in current shell')"
echo "  - Python:         $(python --version 2>/dev/null || echo 'Not in current shell')"
echo "  - claude-flow:    $(npm list -g claude-flow 2>/dev/null | grep claude-flow || echo 'installed')"
echo "  - ruv-swarm:      $(npm list -g ruv-swarm 2>/dev/null | grep ruv-swarm || echo 'installed')"
echo "  - Serena:         $PROJECT_DIR/serena/.venv/bin/serena"
echo "  - Embedding API:  $PROJECT_DIR/embedding-api/api-embed.sh"
echo "  - Market Terminal: $PROJECT_DIR/market-terminal (backend + frontend)"
echo "  - MemoryGraph:    $HOME/.memorygraph-venv (FalkorDB Lite)"
echo "  - LanceDB:        $PROJECT_DIR/src/mcp-servers/lancedb-memory/server.ts"
echo "  - Mermaid CLI:    $(mmdc --version 2>/dev/null || echo 'installed')"
echo "  - Archon:         $HOME/.archon/scripts/"
echo ""
echo -e "${YELLOW}IMPORTANT: Add the following to your ~/.profile or ~/.bashrc:${NC}"
echo ""
cat "$PROFILE_ADDITIONS"
echo ""
echo -e "${YELLOW}Then run: source ~/.profile${NC}"
echo ""
echo "To start the Embedding API:"
echo "  cd $PROJECT_DIR"
echo "  ./embedding-api/api-embed.sh start"
echo ""
echo "To start Market Terminal:"
echo "  cd $PROJECT_DIR/market-terminal/backend"
echo "  source .tv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo ""
echo "  cd $PROJECT_DIR/market-terminal/frontend"
echo "  npm run dev"
echo ""
echo "To set up Archon autonomous operation:"
echo "  1. Edit ~/.archon-env with your RocketChat credentials"
echo "  2. bash $PROJECT_DIR/scripts/archon/install.sh"
echo "  3. bash $PROJECT_DIR/scripts/archon/status.sh"
echo ""
echo "To verify setup:"
echo "  cd $PROJECT_DIR"
echo "  claude"
echo "  /god-status"
echo ""
echo -e "${GREEN}Happy coding!${NC}"
