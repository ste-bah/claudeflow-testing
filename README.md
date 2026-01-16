# God Agent - Universal Self-Learning AI System

A sophisticated multi-agent AI system with persistent memory, adaptive learning, and intelligent context management. Features 197 specialized agents across 24 categories with ReasoningBank integration, neural pattern recognition, and unbounded context memory (UCM).

**Version**: 2.0.0 | **Status**: Production-Ready | **Last Updated**: December 2024

## Table of Contents

- [Features](#features)
- [Quick Setup (Automated)](#quick-setup-automated)
- [Prerequisites (Manual Install)](#prerequisites-manual-install)
- [Installation](#installation)
- [Configuration](#configuration)
- [Daemon Services](#daemon-services)
- [PhD Research Pipeline (45 Agents)](#phd-research-pipeline-45-agents)
- [Coding Pipeline (47 Agents)](#coding-pipeline-47-agents)
- [Observability Dashboard](#observability-dashboard)
- [Memory Visualization Tool](#memory-visualization-tool)
- [Learning System](#learning-system)
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
- **GNN Training**: Graph Neural Network training with EWC regularization
- **40+ Attention Mechanisms**: Flash, Sparse, Linear, Performer, Longformer, and more
- **SQLite Persistence**: All learning data persisted (no more memory loss on restart)

## What's New in v2.0.0

### Learning System Remediation

The learning system has been completely overhauled to fix critical issues where learning data was lost on restart and components were disconnected:

| Issue | Before | After |
|-------|--------|-------|
| **Episode Storage** | In-memory Map (lost on restart) | SQLite persistence |
| **Trajectory Capture** | Not connected to Task() | Full output capture |
| **Quality Assessment** | Evaluated prompts, not results | Evaluates actual output |
| **Feedback Loop** | Disconnected | End-to-end connected |
| **GNN Training** | Incomplete implementation | Full EWC regularization |

### New Components

- **GNN Trainer** (`src/god-agent/core/reasoning/gnn-trainer.ts`): Contrastive learning with Elastic Weight Consolidation (EWC) to prevent catastrophic forgetting
- **Vector Validation** (`src/god-agent/core/validation/vector-validation.ts`): Validates embedding dimensions, normalization, and similarity thresholds
- **40+ Attention Mechanisms** (`src/god-agent/core/attention/mechanisms/`): Including Flash Attention, Sparse Transformer, Linformer, Performer, Longformer, Hyena, and more
- **UCM Daemon Services**: Context, Health, Recovery, and DESC services with JSON-RPC 2.0 interface
- **Hooks System** (`src/god-agent/core/hooks/`): Extensible hooks framework with handlers:
  - Quality Assessment Trigger: Automatic quality evaluation after task completion
  - Auto-Injection: Automatic DESC context injection into prompts
  - Task Result Capture: Captures task outputs for learning pipeline
- **Hook Runner** (`src/god-agent/core/executor/hook-runner.ts`): Safe hook execution with timeout and sandboxing
- **Agent Execution System** (`src/god-agent/core/agents/`):
  - Agent Selector: Intelligent agent selection based on task requirements
  - Task Executor: Executes tasks with proper agent coordination
- **Capability Index Caching**: 76x faster CLI startup with hash-based agent definition caching
- **Two-Phase Execution Model** (`/god-code`, `/god-write`):
  - Phase 1: CLI prepares task, creates trajectory, stores in SQLite
  - Phase 2: Task subagent executes with full context
  - Enables feedback collection across process boundaries
- **Cross-Session Trajectory Feedback** (TASK-TRAJ-001, TASK-TRAJ-002):
  - SQLite fallback for trajectory lookup (no more "Trajectory not found" errors)
  - Null-safe response access for SQLite-loaded trajectories
  - Graceful degradation when trajectory has minimal data
- **Core Daemon JSON-RPC 2.0** (TASK-DAEMON-002):
  - Newline-delimited message parsing with `handleData()`
  - JSON parsing/validation with `processMessage()`
  - Service routing (health.status, health.ping) with `routeRequest()`
  - Proper JSON serialization with `sendResponse()`
- **MBTI-Based Writing Agent Routing** (TASK-WRITING-001):
  - `creative-writer` (ENFP + Type 7) - poems, stories, humor
  - `professional-writer` (ESTJ + Type 3) - formal, business
  - `academic-writer` (INTJ + Type 1) - scholarly, research
  - `casual-writer` (ESFP + Type 7) - social, conversational
  - `technical-writer` (ISTJ + Type 5) - documentation
- **Unified Quality Estimator** (TASK-QUAL-001):
  - Hook delegates to universal `assessQuality()` (no duplicate logic)
  - Mode-aware scoring: prose (ask/research) vs structured (code/write)
  - RULE-035 compliant threshold: 0.5 for positive (was 0.7)
  - IT Governance prose responses now score 0.5+ (was 0.2)
  - 42 new tests with regression coverage

### Architecture Improvements

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                          │
│              CLI / Slash Commands / Claude Code              │
├─────────────────────────────────────────────────────────────┤
│                    TASK EXECUTION                            │
│     god-agent ask/code/research → Task() → Output            │
│                           ↓ (NEW: captures output)           │
├─────────────────────────────────────────────────────────────┤
│                  QUALITY ASSESSMENT                          │
│     QualityEstimator evaluates ACTUAL OUTPUT (not prompt)    │
│                           ↓                                  │
├─────────────────────────────────────────────────────────────┤
│                   LEARNING PIPELINE                          │
│     TrajectoryTracker → ReasoningBank → SoNA → GNN           │
│                           ↓                                  │
├─────────────────────────────────────────────────────────────┤
│                 PERSISTENT STORAGE                           │
│     SQLite: episodes, trajectories, patterns, outcomes       │
│     File: .agentdb/sona/, .god-agent/weights/                │
└─────────────────────────────────────────────────────────────┘
```

### Here's how the God Agent learns from stored knowledge:

  ##Learning Flow
```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                        KNOWLEDGE STORAGE                             │
  │  /god-learn "Factory pattern enables flexible object creation"      │
  │                               ↓                                      │
  │  ┌──────────────────────────────────────────────────────────────┐   │
  │  │ storeKnowledge()                                              │   │
  │  │  1. Generate embedding vector (OpenAI text-embedding-3-small) │   │
  │  │  2. Chunk if >2000 chars (Sprint 13)                          │   │
  │  │  3. Store in AgentDB with metadata (domain, tags, quality)    │   │
  │  │  4. Track domain expertise counter                            │   │
  │  └──────────────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────────────┘
                                    ↓
  ┌─────────────────────────────────────────────────────────────────────┐
  │                     SEMANTIC RETRIEVAL                               │
  │  /god-ask "How do I create objects flexibly?"                       │
  │                               ↓                                      │
  │  ┌──────────────────────────────────────────────────────────────┐   │
  │  │ retrieveRelevant()                                            │   │
  │  │  1. Embed the query                                           │   │
  │  │  2. Vector similarity search (minSimilarity: 0.3)             │   │
  │  │  3. Return top-k matches with provenance                      │   │
  │  │  4. Increment usageCount for retrieved patterns               │   │
  │  └──────────────────────────────────────────────────────────────┘   │
  │                               ↓                                      │
  │  Context injected into LLM prompt → Better response                 │
  └─────────────────────────────────────────────────────────────────────┘
                                    ↓
  ┌─────────────────────────────────────────────────────────────────────┐
  │                      FEEDBACK LOOP                                   │
  │  /god-feedback <trajectory-id> --rating 0.9 --useful                │
  │                               ↓                                      │
  │  ┌──────────────────────────────────────────────────────────────┐   │
  │  │ feedback()                                                    │   │
  │  │  rating > 0.7: reinforcePattern() → verdict: 'positive'       │   │
  │  │  rating < 0.3: weakenPattern()    → verdict: 'negative'       │   │
  │  │                                                               │   │
  │  │ SonaEngine (SONA-weighted update):                            │   │
  │  │  - Adjusts pattern weights based on feedback                  │   │
  │  │  - Higher weights = retrieved more often                      │   │
  │  │  - Creates new patterns from successful interactions          │   │
  │  └──────────────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────────────┘
```
##  Key Methods (universal-agent.ts)

  | Method             | Line | Purpose                                |
  |--------------------|------|----------------------------------------|
  | storeKnowledge()   | 2278 | Store + chunk + embed knowledge        |
  | retrieveRelevant() | 2357 | Vector search for relevant knowledge   |
  | feedback()         | 2146 | User feedback triggers learning        |
  | reinforcePattern() | 2233 | Boost patterns with positive feedback  |
  | weakenPattern()    | 2256 | Demote patterns with negative feedback |

  Learning Signals

  1. Usage tracking - Retrieved patterns get usageCount++
  2. Quality scoring - Auto-assessed (0.0-1.0) based on response characteristics
  3. Explicit feedback - /god-feedback manually adjusts weights
  4. Domain expertise - Tracks knowledge density per domain

  The more you use and rate knowledge, the better it surfaces relevant context in future queries.


## Quick Setup (Automated) ⚡ RECOMMENDED

**For a fresh machine, the setup script handles everything automatically:**

```bash
# Clone or download the repository first, then:
cd god-agent-package

# Run the complete setup
chmod +x scripts/packaging/setup-god-agent.sh
./scripts/packaging/setup-god-agent.sh
```

### What the Setup Script Installs

| Component | Purpose |
|-----------|---------|
| **NVM + Node.js 22** | JavaScript runtime (required) |
| **Claude Code CLI** | Anthropic's official CLI tool |
| **claude-flow@alpha** | Multi-agent swarm coordination |
| **ruv-swarm** | Enhanced swarm capabilities |
| **Python 3.11+ venv** | For Serena and embedding server |
| **Serena MCP** | Language server protocol integration |
| **Embedding API** | Vector similarity search (1536D) |
| **.mcp.json** | MCP server configuration |

### Setup Options

```bash
# Full installation (recommended)
./scripts/packaging/setup-god-agent.sh

# Skip specific components
./scripts/packaging/setup-god-agent.sh --skip-nvm       # Already have Node.js 22
./scripts/packaging/setup-god-agent.sh --skip-python    # Already have Python 3.11+
./scripts/packaging/setup-god-agent.sh --skip-serena    # Don't need Serena MCP
./scripts/packaging/setup-god-agent.sh --skip-embedding # Don't need embedding server

# Minimal install (core only)
./scripts/packaging/setup-god-agent.sh --minimal

# Show all options
./scripts/packaging/setup-god-agent.sh --help
```

### Post-Setup Configuration

After the script completes, add to your `~/.bashrc` or `~/.profile`:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm alias default 22
```

Then reload and start:

```bash
source ~/.bashrc
claude  # Start Claude Code CLI
```

### Verify Installation

```bash
# Check all components
node --version          # Should be v22.x.x
claude --version        # Claude Code CLI version
npx claude-flow@alpha --version
python3 --version       # Should be 3.11+

# Test God Agent
npx tsx src/god-agent/universal/cli.ts status
```

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

## Daemon Services

The God Agent system uses multiple background daemons for memory, context management, and observability. Use these commands to manage all services:

### Start All Services

```bash
npm run god-agent:start
```

This starts all four daemons in order:
1. **Memory Daemon** - Persistent memory and vector storage
2. **Core Daemon** - Main event processing and IPC
3. **UCM Daemon** - Unbounded Context Memory management
4. **Observability Daemon** - Dashboard and metrics (http://localhost:3847)

### Stop All Services

```bash
npm run god-agent:stop
```

### Check Service Status

```bash
npm run god-agent:status
```

### Individual Service Control

| Service | Start | Stop | Status |
|---------|-------|------|--------|
| Memory | `npm run memory:start` | `npm run memory:stop` | `npm run memory:status` |
| Core Daemon | `npm run daemon:start` | `npm run daemon:stop` | `npm run daemon:status` |
| UCM | `npm run ucm:start` | `npm run ucm:stop` | `npm run ucm:status` |
| Observability | `npm run observe:start` | `npm run observe:stop` | `npm run observe:status` |

### Open Dashboard

```bash
npm run observe:open
```

Opens the observability dashboard at http://localhost:3847 showing active agents, pipelines, and activity stream.

## PhD Research Pipeline (45 Agents)

The God Agent includes a comprehensive 45-agent pipeline for academic research, dissertation writing, and systematic literature reviews. Each agent specializes in a specific phase of the research process.

### Running the Pipeline

```bash
# Via slash command in Claude Code
/god-research "Your research topic here"

# Via CLI
npx tsx src/god-agent/cli/phd-cli.ts start "Your research topic"
npx tsx src/god-agent/cli/phd-cli.ts next <session-id>    # Advance to next agent
npx tsx src/god-agent/cli/phd-cli.ts complete <session-id> <agent-name>  # Mark agent complete
npx tsx src/god-agent/cli/phd-cli.ts status <session-id>  # Check progress
```

### Pipeline Phases & Agents

| Phase | Agents | Description |
|-------|--------|-------------|
| **Foundation (1-5)** | ambiguity-clarifier, step-back-analyzer, self-ask-decomposer, research-planner, construct-definer | Problem framing, question decomposition, planning |
| **Literature (6-12)** | literature-mapper, source-tier-classifier, systematic-reviewer, quality-assessor, bias-detector, evidence-synthesizer, pattern-analyst | Systematic review, quality assessment, evidence synthesis |
| **Theory (13-17)** | thematic-synthesizer, theory-builder, theoretical-framework-analyst, contradiction-analyzer, gap-hunter | Theme synthesis, theory building, gap analysis |
| **Design (18-25)** | hypothesis-generator, model-architect, method-designer, sampling-strategist, instrument-developer, validity-guardian, ethics-reviewer, analysis-planner | Research design, methodology, ethics |
| **Writing (26-35)** | dissertation-architect, abstract-writer, introduction-writer, literature-review-writer, methodology-writer, results-writer, discussion-writer, conclusion-writer, apa-citation-specialist, citation-extractor | Document structure, section writing, citations |
| **QA (36-45)** | adversarial-reviewer, confidence-quantifier, citation-validator, reproducibility-checker, risk-analyst, opportunity-identifier, context-tier-manager, file-length-manager, consistency-validator | Quality assurance, validation, final checks |

### Rolling Context Windows & DESC

The pipeline uses **Unbounded Context Memory (UCM)** with **DESC (Dual Embedding Symmetric Chunking)** to manage context across the 45 agents:

#### How It Works

1. **Episode Storage**: Each agent's work is stored as an "episode" with:
   - Input context and task description
   - Agent outputs and decisions
   - Outcome tracking (success/failure)
   - Vector embeddings for semantic search

2. **Rolling Context Window**: As agents complete:
   - Recent episodes are kept in "hot" tier (immediate access)
   - Older episodes move to "warm" tier (vector-searchable)
   - Archived episodes go to "cold" tier (on-demand retrieval)

3. **DESC Injection**: Before each agent runs:
   - System queries UCM for relevant prior episodes
   - Injects summarized context from previous agents
   - Provides confidence scores based on past outcomes
   - Warns about negative examples (past failures)

4. **Context Flow**:
```
Agent 1 → Episode 1 → UCM Store
                ↓
Agent 2 ← DESC Inject (Episode 1 summary) → Episode 2 → UCM Store
                                                  ↓
Agent 3 ← DESC Inject (Episodes 1-2 summaries) → Episode 3 → UCM Store
                                                        ↓
                        ... continues through 45 agents ...
```

#### Key Benefits

- **No Context Loss**: Work from early agents preserved and accessible
- **Semantic Retrieval**: Later agents can query for specific information
- **Outcome Learning**: System learns from successes and failures
- **Automatic Summarization**: Long outputs compressed intelligently

### Final Paper Generation (Phase 8)

After all agents complete, the pipeline combines individual chapter outputs into a final paper:

```bash
# Automatic: Phase 8 triggers when all agents complete
npx tsx src/god-agent/cli/phd-cli.ts complete <session-id> <final-agent>

# Manual: Use the chapter combiner script
npx tsx scripts/combine-chapters.ts docs/research/<your-topic>
```

The **PaperCombiner** component:
- Generates title page with metadata (word count, date, citations)
- Creates table of contents with anchor links
- Combines all chapters with proper separators
- Validates cross-references between chapters
- Outputs `final-paper.md` and `metadata.json`

### PDF Export

Convert the final markdown to PDF:

```bash
# Install md-to-pdf (one time)
npm install -g md-to-pdf

# Generate PDF
cd docs/research/<your-topic>/final
md-to-pdf final-paper.md --pdf-options '{"format": "A4", "margin": {"top": "20mm", "bottom": "20mm", "left": "25mm", "right": "25mm"}}'
```

## Coding Pipeline (47 Agents)

The God Agent includes a comprehensive 47-agent coding pipeline for software development tasks. The pipeline uses a 7-phase DAG-based architecture with forensic review agents that gate phase progression.

### Running the Pipeline

```bash
# Via slash command in Claude Code
/god-code "Implement a user authentication system"

# The pipeline automatically triggers for coding tasks via hooks
```

### Pipeline Architecture

The pipeline consists of **40 core development agents** plus **7 Sherlock forensic reviewers** (47 total):

| Phase | Core Agents | Description |
|-------|-------------|-------------|
| **Phase 1: Understanding (5)** | task-analyzer*, requirement-extractor, scope-definer, context-gatherer, constraint-analyzer | Task parsing, requirements extraction, scope definition |
| **Phase 2: Exploration (5)** | solution-explorer, pattern-matcher, analogy-finder, prior-art-searcher, feasibility-assessor | Solution space exploration, pattern matching |
| **Phase 3: Architecture (6)** | architecture-designer, component-specifier, interface-designer, dependency-mapper, consistency-checker*, type-system-designer | System design, interface contracts |
| **Phase 4: Implementation (8)** | type-generator, algorithm-implementer, data-structure-builder, api-implementer, integration-coder, error-handler, config-generator, utility-generator | Code generation, API implementation |
| **Phase 5: Testing (8)** | test-planner, unit-test-writer, integration-test-writer, edge-case-tester, mock-generator, test-runner, bug-fixer, coverage-analyzer | Test creation, execution, coverage |
| **Phase 6: Optimization (4)** | performance-optimizer, refactoring-agent, security-auditor, code-quality-checker | Performance tuning, security audit |
| **Phase 7: Delivery (4)** | documentation-writer, code-reviewer, release-preparer, sign-off-approver* | Documentation, review, release |

*\* = Critical agents that halt pipeline on failure*

### Sherlock Forensic Reviewers

Each phase is gated by a Sherlock forensic reviewer that performs quality verification:

| Agent # | Agent | Phase Reviewed | Verdict Types |
|---------|-------|----------------|---------------|
| #41 | phase-1-reviewer | Understanding | INNOCENT / GUILTY / INSUFFICIENT_EVIDENCE |
| #42 | phase-2-reviewer | Exploration | INNOCENT / GUILTY / INSUFFICIENT_EVIDENCE |
| #43 | phase-3-reviewer | Architecture | INNOCENT / GUILTY / INSUFFICIENT_EVIDENCE |
| #44 | phase-4-reviewer | Implementation | INNOCENT / GUILTY / INSUFFICIENT_EVIDENCE |
| #45 | phase-5-reviewer | Testing | INNOCENT / GUILTY / INSUFFICIENT_EVIDENCE |
| #46 | phase-6-reviewer | Optimization | INNOCENT / GUILTY / INSUFFICIENT_EVIDENCE |
| #47 | recovery-agent | Delivery + Recovery | Orchestrates remediation on failures |

All forensic reviewers are **CRITICAL** - they gate pipeline progression to ensure quality.

### USACF Algorithms

Each agent uses specialized algorithms from the USACF (Universal Search Algorithm for Claude Flow) framework:

| Algorithm | Use Case |
|-----------|----------|
| **LATS** | Language Agent Tree Search - Complex algorithmic tasks |
| **ReAct** | Reasoning + Acting - Tool-heavy tasks |
| **Self-Debug** | Self-debugging - Test-driven tasks |
| **Reflexion** | Pattern learning - Error recovery |
| **PoT** | Program of Thought - Mathematical tasks |
| **ToT** | Tree of Thought - Design decisions |

### Hook Integration

The pipeline integrates with Claude Code via hooks in `.claude/hooks/`:

```json
{
  "hooks": [
    {
      "name": "coding-pipeline-pre",
      "event": "PreToolUse",
      "matcher": { "tool": "Skill", "args": { "skill": "god-code" } },
      "command": ".claude/hooks/coding-pipeline-pre.sh"
    },
    {
      "name": "coding-pipeline-post",
      "event": "PostToolUse",
      "matcher": { "tool": "Skill", "args": { "skill": "god-code" } },
      "command": ".claude/hooks/coding-pipeline-post.sh"
    }
  ]
}
```

### Memory Coordination

The pipeline uses namespaced memory for agent coordination:

```
coding/
├── understanding/  # Phase 1 artifacts
├── exploration/    # Phase 2 artifacts
├── architecture/   # Phase 3 artifacts
├── implementation/ # Phase 4 artifacts
├── testing/        # Phase 5 artifacts
├── optimization/   # Phase 6 artifacts
├── delivery/       # Phase 7 artifacts
└── pipeline/       # Pipeline state and XP tracking
```

### Pipeline Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    47-AGENT CODING PIPELINE                      │
├─────────────────────────────────────────────────────────────────┤
│  Phase 1 (5 agents) → Sherlock #41 → Phase 2 (5 agents)        │
│           ↓                                    ↓                │
│  Sherlock #42 → Phase 3 (6 agents) → Sherlock #43              │
│           ↓                                    ↓                │
│  Phase 4 (8 agents) → Sherlock #44 → Phase 5 (8 agents)        │
│           ↓                                    ↓                │
│  Sherlock #45 → Phase 6 (4 agents) → Sherlock #46              │
│           ↓                                    ↓                │
│  Phase 7 (4 agents) → Sherlock #47 (Recovery) → COMPLETE       │
└─────────────────────────────────────────────────────────────────┘

On GUILTY verdict: Recovery Agent (#47) orchestrates remediation
Checkpoints created at: Understanding, Exploration, Architecture,
                        Implementation, Testing (for rollback support)
```

## Observability Dashboard

The dashboard at **http://localhost:3847** provides real-time monitoring of the God Agent system.

### Dashboard Panels

| Panel | Description |
|-------|-------------|
| **Active Agents** | Currently running agents with status (idle/busy/error) |
| **Pipelines** | Active PhD pipelines showing progress (X/45 steps completed) |
| **Activity Stream** | Real-time event log of agent operations |
| **UCM & IDESC** | Episodes stored, context size, injection rates |
| **Token Budget** | Context usage percentage, warnings, summarization count |
| **Daemon Health** | Service uptime, events processed, memory usage |
| **Agent Registry** | Total agents available, categories, selection stats |
| **Memory Panels** | Reasoning traces, episodes, hyperedges, interactions |

### Real-Time Updates

The dashboard uses:
- **Server-Sent Events (SSE)** for live activity streaming
- **5-second polling** for agents, pipelines, and metrics
- **WebSocket IPC** for daemon communication

### Screenshot Guide

```
┌─────────────────────────────────────────────────────────────┐
│  GOD AGENT OBSERVABILITY DASHBOARD                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Active Agents  │    Pipelines    │    Activity Stream      │
│  ┌───────────┐  │  ┌───────────┐  │  • Agent started: X     │
│  │ agent-1 ◉ │  │  │ PhD-001   │  │  • Step completed: Y    │
│  │ agent-2 ◎ │  │  │ 18/45 ███ │  │  • Episode stored       │
│  └───────────┘  │  └───────────┘  │  • Context injected     │
├─────────────────┴─────────────────┴─────────────────────────┤
│  UCM & IDESC    │  Token Budget   │  Daemon Health          │
│  Episodes: 142  │  Usage: 14.2%   │  Status: Healthy        │
│  Injections: 89 │  Warnings: 0    │  Uptime: 2h 15m         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Memory Visualization Tool

An interactive graph visualization tool for exploring God Agent memory structures, showing relationships between agents, task types, patterns, trajectories, events, token usage, feedback, and sessions.

### Quick Start

```bash
# Terminal 1: Start the API server
cd src/god-agent-viz
npx tsx server.ts
# Server runs on http://localhost:3456

# Terminal 2: Open the visualization
open src/god-agent-viz/index.html
```

Or use the start script:
```bash
cd src/god-agent-viz
./start.sh
```

### Features

- **Interactive Graph Visualization**: Cytoscape.js with force-directed layout showing all memory relationships
- **8 Node Types**: Agents, Task Types, Patterns, Trajectories, Events, Token Usage, Feedback, Sessions
- **Advanced Filtering**: Filter by node type, task type, status, date range, and limits
- **Real-time Stats**: Live counts of nodes and edges with filter indicators
- **Click-to-Explore**: Select nodes to see full details and connections in sidebar
- **Legend with Counts**: Color-coded legend showing node type distribution

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/graph` | Full graph data with filtering support |
| `GET /api/filters` | Available filter options |
| `GET /api/stats` | Node and edge statistics |
| `GET /api/events` | Event data with pagination |
| `GET /api/token-usage` | Token consumption metrics |
| `GET /api/feedback` | User feedback data |
| `GET /api/health` | Server health check |

### Query Parameters

```
?includeTrajectories=all|recent|none
&includeEvents=true|false
&includeTokenUsage=true|false
&includeFeedback=true|false
&taskType=<type>
&status=<status>
&dateFrom=YYYY-MM-DD
&dateTo=YYYY-MM-DD
&limit=<number>
```

### Node Types & Colors

| Type | Color | Description |
|------|-------|-------------|
| Agent | Blue (#3b82f6) | AI agent identifiers |
| Task Type | Green (#10b981) | Types of tasks (code, research, ask, write) |
| Pattern | Purple (#8b5cf6) | Learned patterns with success rates |
| Trajectory | Amber (#f59e0b) | Learning trajectories with outcomes |
| Event | Red (#ef4444) | System events and interactions |
| Token Usage | Cyan (#06b6d4) | Token consumption records |
| Feedback | Pink (#ec4899) | User feedback with ratings |
| Session | Yellow (#eab308) | Session identifiers |

### Tech Stack

- **Backend**: Express.js + TypeScript + better-sqlite3
- **Frontend**: React 18 (CDN) + Cytoscape.js (CDN) + Babel
- **Database**: SQLite (`.god-agent/*.db` files)

## Learning System

The God Agent continuously learns and improves through multiple mechanisms: explicit knowledge storage, style learning, outcome tracking, and neural pattern recognition.

### Learning Commands

#### Store Knowledge Directly

```bash
# Via CLI
npx tsx src/god-agent/universal/cli.ts learn "TypeScript best practice: Always use strict mode and explicit return types for better type safety"

# Via slash command
/god-learn "Your knowledge here"

# Store with metadata
npx tsx src/god-agent/universal/cli.ts learn "Factory pattern enables flexible object creation" \
  --domain patterns --category pattern --tags "design,factory,creational"

# Store from file (large documents)
npx tsx src/god-agent/universal/cli.ts learn --file ./docs/learnings.md --domain "project/docs"
```

Knowledge is stored with:
- Vector embeddings for semantic retrieval
- Metadata (timestamp, source, category)
- Confidence scoring based on usage patterns
- **Automatic chunking** for content >2000 characters (OpenAI 8191 token limit compliance)

#### Large Content Handling (Sprint 13)

Content exceeding 2000 characters is automatically chunked using SymmetricChunker:

| Feature | Description |
|---------|-------------|
| **Symmetric Chunking** | Same algorithm for storage AND retrieval (RULE-064) |
| **Semantic Boundaries** | Preserves code blocks, tables, Task() calls |
| **Parent Tracking** | Each chunk references parent for reconstruction |
| **Content-Aware Tokens** | PROSE=1.3x, CODE=1.5x, TABLE=2.0x, CITATION=1.4x |
| **Minimum Merge** | Chunks <200 chars merged with adjacent chunks |
| **Backward Compatible** | Legacy entries work seamlessly with new chunked entries |

```bash
# Query stored knowledge (chunks auto-reconstructed)
npx tsx src/god-agent/universal/cli.ts query --domain "patterns" --tags "factory" --limit 5
```

#### Learn Writing Styles from Documents

```bash
# Learn style from a PDF
npx tsx src/god-agent/universal/cli.ts learn-style /path/to/document.pdf --profile "academic-formal"

# Check available style profiles
npx tsx src/god-agent/universal/cli.ts style-status

# Via slash commands
/god-learn-style /path/to/document.pdf
/god-style-status
```

Style profiles capture:
- Vocabulary patterns and word frequency
- Sentence structure preferences
- Tone and formality level
- Domain-specific terminology

#### Provide Feedback on Outputs

```bash
# After receiving an output, provide feedback
npx tsx src/god-agent/universal/cli.ts feedback <trajectory-id> --rating good --comment "Excellent analysis"

# Via slash command
/god-feedback <trajectory-id>
```

Feedback ratings: `excellent`, `good`, `acceptable`, `poor`, `failure`

### How Learning Works Over Time

#### 1. ReasoningBank & Trajectory Tracking

Every interaction is recorded as a "trajectory":

```
┌─────────────────────────────────────────────────────────────┐
│  TRAJECTORY RECORD                                          │
├─────────────────────────────────────────────────────────────┤
│  Input: "How do I implement authentication?"                │
│  Agent Selected: security-architect                         │
│  Reasoning Mode: systematic                                 │
│  Output: [detailed response]                                │
│  Outcome: success (user feedback: good)                     │
│  Duration: 4.2s                                             │
│  Tokens Used: 2,847                                         │
└─────────────────────────────────────────────────────────────┘
```

These trajectories enable:
- **Reasoning Trace Injection**: Similar past successes inform new responses
- **Agent Selection Learning**: System learns which agents perform best for query types
- **Failure Avoidance**: Past failures are flagged to prevent repetition

#### 2. SoNA Engine (Self-organizing Neural Architecture)

The SoNA engine maintains adaptive weights that evolve based on outcomes:

```
┌─────────────────────────────────────────────────────────────┐
│  SONA WEIGHT ADJUSTMENT                                     │
├─────────────────────────────────────────────────────────────┤
│  Agent: code-analyzer                                       │
│  Query Type: "code review"                                  │
│                                                             │
│  Before: weight = 0.72                                      │
│  Outcome: success (excellent rating)                        │
│  After:  weight = 0.76 (+0.04)                              │
│                                                             │
│  Next similar query → code-analyzer more likely selected    │
└─────────────────────────────────────────────────────────────┘
```

Weight updates follow:
- **Positive outcomes**: Increase agent weight for similar queries
- **Negative outcomes**: Decrease weight, boost alternatives
- **Decay factor**: Old weights gradually normalize (prevents over-fitting)

#### 3. IDESC Outcome Tracking

Every episode records success/failure for future injection decisions:

| Metric | Purpose |
|--------|---------|
| **Success Rate** | Episodes with >70% success rate get priority injection |
| **Confidence Score** | HIGH/MEDIUM/LOW based on similarity + success + recency |
| **Negative Warnings** | Episodes with <50% success flagged as "avoid this approach" |
| **Threshold Adjustment** | Injection thresholds auto-adjust ±5% based on FPR/accuracy |

#### 4. Pattern Recognition

The system identifies recurring patterns across interactions:

```bash
# Query learned patterns
npx tsx src/god-agent/universal/cli.ts query "authentication patterns"
```

Patterns include:
- **Solution Templates**: Common problem-solution pairs
- **Error Patterns**: Frequently failing approaches
- **Domain Clusters**: Related concepts grouped together
- **Causal Chains**: "If X then Y" relationships from hyperedge analysis

### Learning Lifecycle

```
User Query → Agent Selection (SoNA weights) → Response Generation
                                                      │
                                                      ▼
                                              Trajectory Stored
                                                      │
                    ┌─────────────────────────────────┴───────────────────────────────┐
                    │                                                                 │
                    ▼                                                                 ▼
            User Feedback                                                     Implicit Signal
            (explicit rating)                                              (task completion,
                    │                                                       follow-up queries)
                    │                                                                 │
                    └─────────────────────────────────┬───────────────────────────────┘
                                                      │
                                                      ▼
                                              Outcome Recorded
                                                      │
                    ┌─────────────────────────────────┼───────────────────────────────┐
                    │                                 │                               │
                    ▼                                 ▼                               ▼
            SoNA Weights                      ReasoningBank                    IDESC Thresholds
              Updated                           Updated                          Adjusted
                    │                                 │                               │
                    └─────────────────────────────────┴───────────────────────────────┘
                                                      │
                                                      ▼
                                          Future Queries Improved
```

### Viewing Learning Statistics

```bash
# Full system status including learning stats
npx tsx src/god-agent/universal/cli.ts status

# Output includes:
# - Total trajectories recorded
# - Success rate trends
# - Top-performing agents
# - Pattern clusters identified
# - Style profiles available
```

### Data Storage Locations

| Component | Location | Contents |
|-----------|----------|----------|
| Events DB | `.god-agent/events.db` | Trajectories, outcomes, interactions |
| SoNA Weights | `.god-agent/weights/` | Learned agent selection weights |
| Vector Store | `.agentdb/` | Knowledge embeddings, patterns |
| Style Profiles | `.god-agent/styles/` | Learned writing styles |
| UCM Episodes | `.ucm/` | Context episodes, tier metadata |

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
│   ├── migration/                # Vector dimension migration
│   └── hooks/                    # Claude Code hooks
├── serena/                       # Serena MCP server
├── .serena/                      # Serena config + memories
├── tests/                        # Test suites
├── vector_db_1536/               # ChromaDB storage
├── docs/                         # Documentation
└── package.json
```

## Migration

### Vector Dimension Migration (768 → 1536)

If upgrading from an older version that used 768-dimension embeddings to the current 1536-dimension format:

```bash
# Detect current vector dimensions in your database
npx tsx scripts/migration/detect-vector-dimensions.ts

# Migrate vectors from 768 to 1536 dimensions
npx tsx scripts/migration/migrate-768-to-1536.ts
```

The migration script:
- Backs up existing data before migration
- Converts 768D vectors to 1536D using zero-padding or interpolation
- Updates all episode stores, trajectory data, and pattern embeddings
- Validates migrated vectors for correctness

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
