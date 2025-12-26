# God Agent - Universal Self-Learning AI System

A sophisticated multi-agent AI system with persistent memory, adaptive learning, and intelligent context management. Features 197 specialized agents across 24 categories with ReasoningBank integration, neural pattern recognition, and unbounded context memory (UCM).

## Table of Contents

- [Features](#features)
- [Quick Setup (Automated)](#quick-setup-automated)
- [Prerequisites (Manual Install)](#prerequisites-manual-install)
- [Installation](#installation)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [Available Commands](#available-commands)
- [Architecture](#architecture)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Features

- **197 Specialized Agents** across 24 categories (research, coding, analysis, etc.)
- **5-Layer Architecture**: Native Core, Reasoning, Memory, Learning, Orchestration
- **Unbounded Context Memory (UCM)**: Intelligent episode storage and retrieval
- **IDESC v2**: Intelligent Dual Embedding Symmetric Chunking with outcome tracking
- **ReasoningBank Integration**: Trajectory linking for reasoning trace injection
- **SoNA Engine**: Self-organizing Neural Architecture for adaptive learning
- **Style Profiles**: Learn and apply writing styles from documents
- **Claude Flow Integration**: Multi-agent swarm coordination

## Quick Setup (Automated)

For a fresh machine, run the automated setup script:

```bash
chmod +x scripts/packaging/setup-god-agent.sh
./scripts/packaging/setup-god-agent.sh
```

This installs everything: NVM, Node.js 22, Claude Code CLI, claude-flow, Python venv, Serena MCP, and configures all MCP servers.

After setup, add to your `~/.bashrc` or `~/.profile`:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm alias default 22
```

Then: `source ~/.bashrc && claude`

## Prerequisites (Manual Install)

- **Node.js**: v22.0.0 or higher (via NVM recommended)
- **npm**: v10.0.0 or higher
- **Python**: 3.11+ (for Serena and embedding server)
- **TypeScript**: v5.0.0 or higher (installed as dev dependency)
- **Git, curl or wget**

### Optional Dependencies

- **Embedding Server**: For vector similarity search (gte-Qwen2-1.5B-instruct, 1536D)
- **Claude Flow MCP**: For swarm coordination (`npx claude-flow@alpha`)

## Installation

### 1. Navigate to Project Directory

```bash
cd god-agent-package  # or your installation directory
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

### 4. Verify Installation

```bash
npx tsx src/god-agent/universal/cli.ts status
```

Expected output:
```
[GodAgent] God Agent initialized in ~70ms
[AgentRegistry] Initialized with 197 agents from 24 categories
[Memory] Connected to memory server
[SoNA] Weights loaded successfully
```

## Configuration

### Environment Variables (Optional)

Create a `.env` file in the project root:

```bash
# Memory Configuration
GOD_AGENT_MEMORY_PATH=/tmp/god-agent-memory.sock
GOD_AGENT_DB_PATH=.god-agent/events.db

# Embedding Server (if using external)
EMBEDDING_SERVER_URL=http://localhost:8080/embed

# Debug Mode
GOD_AGENT_DEBUG=false
```

### Claude Code Integration

Add to your Claude Code settings (`.claude/settings.local.json`):

```json
{
  "permissions": {
    "allow": [
      "Bash(npx tsx src/god-agent/universal/cli.ts status)",
      "Bash(npx tsx src/god-agent/universal/cli.ts ask:*)",
      "Bash(npx tsx src/god-agent/universal/cli.ts code:*)",
      "Bash(npx tsx src/god-agent/universal/cli.ts research:*)",
      "Bash(npx tsx src/god-agent/universal/cli.ts write:*)",
      "Bash(npx tsx src/god-agent/universal/cli.ts learn:*)"
    ]
  }
}
```

## Quick Start

### Check System Status

```bash
npx tsx src/god-agent/universal/cli.ts status
```

### Ask a Question

```bash
npx tsx src/god-agent/universal/cli.ts ask "What is the best approach for implementing a REST API?"
```

### Generate Code

```bash
npx tsx src/god-agent/universal/cli.ts code "Create a TypeScript function to validate email addresses"
```

### Deep Research

```bash
npx tsx src/god-agent/universal/cli.ts research "Compare React vs Vue for enterprise applications"
```

## Available Commands

| Command | Description |
|---------|-------------|
| `status` | Show God Agent status and learning statistics |
| `ask <query>` | Ask questions with DAI-001 agent selection |
| `code <task>` | Generate code with intelligent agent routing |
| `research <topic>` | Deep research with DAI-002 pipeline orchestration |
| `write <task>` | Generate documents/papers |
| `learn <knowledge>` | Store knowledge in the God Agent |
| `learn-style <pdf>` | Learn writing style from PDF documents |
| `style-status` | Show available style profiles |
| `feedback <id>` | Provide feedback for trajectory improvement |
| `query <search>` | Query stored knowledge and patterns |
| `help` | Show all available commands |

### Slash Commands (Claude Code)

When using with Claude Code, these slash commands are available:

- `/god-status` - Show system status
- `/god-ask` - Ask questions
- `/god-code` - Generate code
- `/god-research` - Deep research
- `/god-write` - Generate documents
- `/god-learn` - Store knowledge
- `/god-learn-style` - Learn writing styles
- `/god-style-status` - Show style profiles
- `/god-feedback` - Provide trajectory feedback

## Architecture

### 5-Layer System

```
┌─────────────────────────────────────────────────────┐
│                 ORCHESTRATION LAYER                  │
│     Claude Flow · Swarm Coordination · Routing       │
├─────────────────────────────────────────────────────┤
│                   LEARNING LAYER                     │
│      SoNA Engine · Pattern Recognition · Styles      │
├─────────────────────────────────────────────────────┤
│                    MEMORY LAYER                      │
│     UCM · Episode Storage · Vector Search · IDESC    │
├─────────────────────────────────────────────────────┤
│                  REASONING LAYER                     │
│   ReasoningBank · Trajectory · Mode Selection        │
├─────────────────────────────────────────────────────┤
│                  NATIVE CORE LAYER                   │
│     Agent Registry · Validation · Event System       │
└─────────────────────────────────────────────────────┘
```

### Key Components

| Component | Path | Description |
|-----------|------|-------------|
| God Agent Core | `src/god-agent/core/god-agent.ts` | Main orchestrator |
| Agent Registry | `src/god-agent/core/routing/` | 197 agent definitions |
| UCM System | `src/god-agent/core/ucm/` | Unbounded Context Memory |
| IDESC v2 | `src/god-agent/core/ucm/desc/` | Intelligent DESC |
| ReasoningBank | `src/god-agent/core/reasoning/` | Reasoning traces |
| SoNA Engine | `src/god-agent/core/learning/` | Self-organizing learning |
| Observability | `src/god-agent/observability/` | Metrics and monitoring |

### IDESC v2 Features

- **Outcome Tracking**: Success/failure recording with <10ms p95 latency
- **Confidence Levels**: HIGH/MEDIUM/LOW based on similarity, success rate, age
- **Negative Example Warnings**: Alerts for episodes with <50% success rate
- **Threshold Adjustment**: Automatic bounded adjustment (±5% per 30 days)
- **Quality Monitoring**: Continuous FPR/accuracy alerts

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Core tests
npm test -- --grep "god-agent"

# UCM tests
npm test -- --grep "ucm"

# IDESC tests  
npm test -- --grep "idesc"

# Reasoning tests
npm test -- --grep "reasoning"
```

### Run with Coverage

```bash
npm run test:coverage
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Project Structure

```
god-agent-package/
├── src/
│   └── god-agent/
│       ├── core/                 # Core system
│       │   ├── god-agent.ts      # Main orchestrator
│       │   ├── ucm/              # Unbounded Context Memory
│       │   │   ├── desc/         # IDESC v2 components
│       │   │   └── types.ts      # Type definitions
│       │   ├── reasoning/        # ReasoningBank
│       │   ├── learning/         # SoNA engine
│       │   ├── routing/          # Agent routing
│       │   ├── memory/           # Memory management
│       │   └── validation/       # Input validation
│       ├── observability/        # Metrics & monitoring
│       └── universal/            # CLI interface
├── embedding-api/                # Vector embedding server
│   ├── api_embedder.py           # FastAPI server (1536D)
│   ├── api-embed.sh              # Service controller
│   └── requirements.txt          # Python dependencies
├── .god-agent/                   # Runtime data
│   ├── events.db                 # Event/interaction database
│   ├── sessions/                 # Session state
│   └── weights/                  # SoNA learned weights
├── .ucm/                         # UCM hook configuration
├── .agentdb/                     # Learned knowledge & patterns
├── .claude/
│   ├── agents/                   # 200+ agent definitions
│   ├── commands/                 # Slash commands
│   └── skills/                   # Skills library
├── scripts/
│   ├── packaging/                # Setup & package scripts
│   └── hooks/                    # Claude Code hooks
├── serena/                       # Serena MCP server
├── .serena/                      # Serena config + memories
├── tests/                        # Test suites
├── vector_db_1536/               # ChromaDB storage
├── docs/                         # Documentation
└── package.json
```

## Troubleshooting

### "Cannot find module" Errors

```bash
# Rebuild the project
npm run build

# Or run directly with tsx
npx tsx src/god-agent/universal/cli.ts status
```

### Memory Server Connection Failed

The system uses a Unix socket for memory coordination. If connection fails:

```bash
# Check if socket exists
ls -la /tmp/god-agent-memory.sock

# The system will auto-create it on first use
```

### Permission Denied on Database

```bash
# Ensure .god-agent directory exists and is writable
mkdir -p .god-agent
chmod 755 .god-agent
```

### Tests Failing

Some tests require specific database setup:

```bash
# Run tests with fresh database
rm -f .god-agent/events.db
npm test
```

### Embedding Server Setup

The God Agent uses a local embedding server for vector similarity search. The server uses the **gte-Qwen2-1.5B-instruct** model (1536 dimensions).

#### Prerequisites

```bash
# Create Python virtual environment
python3 -m venv ~/.venv

# Install dependencies
~/.venv/bin/pip install -r embedding-api/requirements.txt
```

#### Start Embedding Server

```bash
# Start ChromaDB + Embedding API
./embedding-api/api-embed.sh start

# Check status
./embedding-api/api-embed.sh status

# View logs
./embedding-api/api-embed.sh logs

# Stop services
./embedding-api/api-embed.sh stop
```

#### Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| Embedding API | http://127.0.0.1:8000 | Vector embeddings |
| ChromaDB | http://127.0.0.1:8001 | Vector storage |

#### Without Embedding Server

The system degrades gracefully without an embedding server:

```bash
export USE_LOCAL_EMBEDDINGS=true
```

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Initialization | <100ms | ~70ms |
| Outcome Recording p95 | <10ms | <5ms |
| shouldInject p95 | <50ms | <30ms |
| Memory Overhead (10K outcomes) | <10MB | ~6MB |
| Agent Loading | <200ms | ~107ms |

## License

MIT License - See LICENSE file for details.

## Contributing

1. Create a feature branch
2. Write tests first (TDD)
3. Implement changes
4. Run full test suite
5. Submit pull request

## Support

For issues and feature requests, please use the project issue tracker.
