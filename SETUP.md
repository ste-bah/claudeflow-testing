# God Agent - Setup Guide

This guide helps you set up the God Agent system on your local machine.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | v22.0.0+ | Use NVM for version management |
| npm | v10.0.0+ | Comes with Node.js |
| Python | 3.11+ | For embedding server and Serena |
| Git | Any | For version control |

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/claudeflow-testing.git
cd claudeflow-testing
```

### 2. Install Node Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your API keys (required)
nano .env  # or use your preferred editor
```

**Required API Keys:**
- `PERPLEXITY_API_KEY` - Get from [Perplexity Settings](https://www.perplexity.ai/settings/api)
- `ANTHROPIC_API_KEY` - Get from [Anthropic Console](https://console.anthropic.com/settings/keys)

### 4. Build the Project

```bash
npm run build
```

### 5. Verify Installation

```bash
npx tsx src/god-agent/universal/cli.ts status
```

---

## Claude Code Integration (Optional)

If using with [Claude Code CLI](https://github.com/anthropics/claude-code):

### 1. Copy Settings Template

```bash
cp .claude/settings.local.json.example .claude/settings.local.json
```

### 2. Configure MCP Servers

The project includes several MCP (Model Context Protocol) servers:
- **serena** - Code intelligence and analysis
- **claude-flow** - Swarm coordination and memory
- **perplexity** - External research capabilities

These are configured in `.claude/mcp.json` and enabled via `settings.local.json`.

---

## Python Environment Setup (Optional)

Required for the embedding server and advanced features:

### 1. Create Virtual Environment

```bash
python3 -m venv .venv
source .venv/bin/activate  # Linux/macOS
# or: .venv\Scripts\activate  # Windows
```

### 2. Install Dependencies

```bash
pip install -r requirements-full.txt
```

### 3. Set Up Serena MCP

```bash
cd serena
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cd ..
```

---

## Starting Services

### All Services (Recommended)

```bash
npm run god-agent:start
```

This starts:
- Memory daemon
- Core daemon
- UCM (Universal Concept Memory) daemon
- Observability dashboard

### Individual Services

| Service | Command | Description |
|---------|---------|-------------|
| Memory Daemon | `npm run memory:start` | Persistent memory storage |
| Core Daemon | `npm run daemon:start` | Main god-agent service |
| UCM Daemon | `npm run ucm:start` | Concept memory system |
| Observability | `npm run observe:start` | Metrics and monitoring |

### Embedding Server

```bash
./embedding-api/api-embed.sh start
```

---

## Directory Structure

After setup, your project will have:

```
claudeflow-testing/
├── .env                      # Your local environment config
├── .venv/                    # Python virtual environment
├── node_modules/             # Node dependencies
├── dist/                     # Build output
├── src/                      # Source code
│   └── god-agent/            # God Agent implementation
├── scripts/                  # Utility scripts
├── tests/                    # Test suites
├── .claude/                  # Claude Code configuration
│   ├── agents/               # Agent definitions (197 agents)
│   ├── commands/             # Slash commands
│   ├── skills/               # Skills library
│   └── hooks/                # Hook scripts
├── embedding-api/            # Local embedding server
├── serena/                   # Serena MCP server
└── god-learn/                # Learning system
    └── config/               # Learning configuration
```

---

## Corpus Setup (Optional)

The God Agent can work with a personal research corpus:

### 1. Create Corpus Directory

```bash
mkdir -p corpus
```

### 2. Add Documents

Place PDF documents in the `corpus/` directory. Supported formats:
- PDF files (`.pdf`)
- Text files (`.txt`)

### 3. Ingest Documents

```bash
./god ingest corpus/
```

### 4. Verify Ingestion

```bash
./god audit
```

---

## Troubleshooting

### Node Version Issues

```bash
# Check Node version
node --version  # Should be v22+

# If using NVM
nvm install 22
nvm use 22
```

### Python Virtual Environment Issues

```bash
# Recreate virtual environment
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-full.txt
```

### Port Conflicts

```bash
# Check if ports are in use
ss -tlnp | grep -E '8000|8001'

# Kill conflicting processes
pkill -f "api-embed"
```

### Permission Errors

```bash
# Fix script permissions
chmod +x ./god
chmod +x ./embedding-api/api-embed.sh
chmod +x ./scripts/god
```

---

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build TypeScript to JavaScript |
| `npm run test` | Run test suite |
| `npm run god-agent:start` | Start all services |
| `npx tsx src/god-agent/universal/cli.ts ask "query"` | Ask the God Agent |
| `./god status` | Check system status |
| `./god ingest <path>` | Ingest documents |
| `./god query "question"` | Query knowledge base |

---

## Getting Help

- Check the main [README.md](./README.md) for detailed documentation
- Review agent definitions in `.claude/agents/`
- Examine example scripts in `scripts/`

---

## License

See [LICENSE](./LICENSE) for licensing information.
