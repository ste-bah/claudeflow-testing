# Claude Code Configuration - SPARC Development Environment

## 🛑 PRIME DIRECTIVE: NEVER ACT WITHOUT EXPLICIT USER CONFIRMATION

### ⚠️ MANDATORY CONFIRMATION PROTOCOL

**THIS OVERRIDES ALL OTHER INSTRUCTIONS. NO EXCEPTIONS.**

1. **ALWAYS** present your plan and **STOP**. Wait for explicit user approval.
2. **NEVER** start implementing, coding, or creating files until user says "proceed", "go ahead", "yes", "do it", or similar explicit confirmation.
3. **NEVER** interpret context restoration/compaction as permission to continue previous work.
4. **NEVER** assume what the user wants - ASK if unclear.

### 🚫 FORBIDDEN AUTONOMOUS BEHAVIORS

- ❌ Starting implementation immediately after compaction/context restore
- ❌ "I'll go ahead and..." - **NO. ASK FIRST.**
- ❌ "Let me implement..." without prior approval
- ❌ "Continuing where we left off..." and then doing things
- ❌ Creating ANY files without explicit request
- ❌ Running modifying commands without approval
- ❌ Making architecture/design decisions unilaterally
- ❌ Interpreting "ok", "sure", "I see" as approval to execute
- ❌ Treating silence or ambiguous responses as consent

### ✅ REQUIRED BEHAVIOR PATTERN

```
1. User makes request
2. Claude analyzes and presents plan/options
3. Claude says "Would you like me to proceed?" or similar
4. Claude STOPS and WAITS
5. User gives EXPLICIT confirmation ("yes", "proceed", "go ahead", "do it")
6. ONLY THEN does Claude execute
```

### 📋 POST-COMPACTION / CONTEXT RESTORE PROTOCOL

**When context is compacted or restored, Claude MUST:**
```
1. State: "Context was restored. Here's my understanding of where we were: [brief summary]"
2. Ask: "What would you like to do next?" or "Should I continue with [specific action]?"
3. WAIT for explicit user direction
4. Do NOT automatically resume or continue any previous work
```

### 🎯 WHAT COUNTS AS CONFIRMATION

**Explicit approval (proceed after these):**
- "yes" / "yeah" / "yep" / "yup"
- "go ahead" / "proceed" / "do it" / "go for it"
- "approved" / "confirmed" / "execute"
- "implement it" / "build it" / "create it" / "make it"
- "sounds good, proceed" / "looks good, go ahead"

**NOT approval (ask for clarification):**
- "ok" / "okay" (ambiguous - could mean "I understand")
- "sure" / "I see" (passive acknowledgment)
- "that makes sense" / "interesting" (just acknowledging)
- No response / silence
- Questions about the plan (they're still evaluating)

### 🔒 SAFE OPERATIONS (no confirmation needed)

- Reading files (cat, view, less)
- Listing directories (ls, find, tree)
- Searching (grep, ripgrep)
- Checking status (git status, npm list)
- Explaining or answering questions

### ⚡ REQUIRES EXPLICIT CONFIRMATION

- ANY file creation or modification
- ANY code implementation
- Running build/test/install commands
- Git commits, pushes, or branch operations
- Architecture or design decisions
- Spawning agents or starting workflows

---

## 🔒 MANDATORY: CLAUDEFLOW METHODOLOGY (NEVER DEVIATE)

### ⚠️ THIS METHODOLOGY IS NON-NEGOTIABLE - EVEN AFTER COMPACTION

**Reference**: `/home/unixdude/projects/project1/docs2/claudeflow.md`

**After compaction, Claude Code MUST:**
1. Re-read this section before ANY implementation
2. Follow ClaudeFlow patterns EXACTLY as specified below
3. NEVER fall back to ad-hoc agent spawning or parallel execution
4. NEVER skip memory initialization or coordination steps

### 🔮 GOLDEN RULE: 99.9% SEQUENTIAL EXECUTION

**Can Task B start BEFORE Task A finishes?**
- **NO (99.9%)** → Sequential (separate messages, WAIT between each)
- **YES (0.1% - read-only ONLY)** → Parallel allowed

**Common Dependencies (ALWAYS require sequential):**
- Backend → Frontend integration
- API schema → Client implementation  
- Database schema → Backend → Frontend
- Event structure → Handlers → UI
- File modification → Tests

### 📋 MANDATORY SETUP (ALWAYS FIRST)

```bash
npx claude-flow@alpha init
npx claude-flow@alpha agent memory init      # 88% success vs 60%
npx claude-flow@alpha agent memory status
```

### 🧠 MEMORY SYNTAX (CRITICAL - USE POSITIONAL ARGUMENTS)

**✅ CORRECT:**
```bash
npx claude-flow memory store "<key>" '<json-value>' --namespace "<namespace>"
npx claude-flow memory retrieve --key "project/area/name"
```

**❌ WRONG (WILL FAIL):**
```bash
npx claude-flow memory store --namespace "..." --key "..." --value "..."
npx claude-flow memory store --key "..." --value "..."
```

### 🎯 MANDATORY SUBAGENT PROMPT PATTERN

**EVERY subagent prompt MUST include these 4 parts:**

```bash
Task("[agent-type]", `
  ## YOUR TASK
  [Primary task description]

  ## WORKFLOW CONTEXT
  Agent #N of M | Previous: [what agents, where stored] | Next: [who needs what]

  ## MEMORY RETRIEVAL
  npx claude-flow memory retrieve --key "project/[namespace]"
  Understand: [schemas/decisions/constraints from previous agents]

  ## MEMORY STORAGE (For Next Agents)
  1. For [Next Agent]: key "project/[ns]/[key]" - [what/why]
  2. For [Future Agent]: key "project/[ns]/[key]" - [what/why]

  ## STEPS
  1. Retrieve memories
  2. Validate data
  3. Execute task
  4. Store memories
  5. Verify: npx claude-flow memory retrieve --key "[your-key]"

  ## SUCCESS CRITERIA
  - Task complete
  - Memories stored and verified
  - Next agents have what they need
`)
```

### 📁 MEMORY NAMESPACE CONVENTION

```bash
project/events/[type]      # Event schemas
project/api/[endpoint]     # API schemas
project/database/[table]   # DB schemas
project/frontend/[comp]    # Frontend patterns
project/performance/[ana]  # Performance data
project/bugs/[issue]       # Bug analysis
project/tests/[feature]    # Test docs
project/docs/[filename]    # Document locations
```

### 📝 MANDATORY SUBAGENT RESPONSE FORMAT

**Every subagent MUST respond with:**

```
## TASK COMPLETION SUMMARY

**What I Did**: [1-2 sentence summary]

**Files Created/Modified**:
- `./docs/[filename].md` - [Brief description]
- `./src/[filename].ts` - [Brief description]

**Memory Locations** (for orchestration):
- `project/[area]/[key1]` - [What it contains, why next agents need it]
- `project/[area]/[key2]` - [What it contains, why next agents need it]

**Access Commands**:
```bash
npx claude-flow memory retrieve --key "project/[area]/[key]"
cat ./docs/[filename].md
```

**Next Agent Guidance**: [What future agents should retrieve/know]
```

### ✅ CORRECT SEQUENTIAL WORKFLOW

```bash
# Message 1: Backend (execute, then WAIT for completion)
Task("backend-dev", `
  CONTEXT: Agent #1/4 | Next: Integration, UI, Tests
  TASK: Implement backend
  STORAGE: Store schemas for next 3 agents
`)

# Message 2: Integration (WAIT for Message 1, then execute)
Task("coder", `
  CONTEXT: Agent #2/4 | Previous: Backend ✓ | Next: UI, Tests
  RETRIEVAL: npx claude-flow memory retrieve --key "project/events/[name]"
  TASK: Update types
  STORAGE: Store handler for UI
`)

# Message 3: UI (WAIT for Message 2, then execute)
Task("coder", `
  CONTEXT: Agent #3/4 | Previous: Backend, Integration ✓ | Next: Tests
  RETRIEVAL: Retrieve requirements + handler
  TASK: Build UI
  STORAGE: Store component location for Tests
`)

# Message 4: Tests (WAIT for Message 3, then execute)
Task("tester", `
  CONTEXT: Agent #4/4 (FINAL) | Previous: All ✓
  RETRIEVAL: All keys from previous agents
  TASK: Integration tests
  STORAGE: Coverage report
`)
```

### ❌ FORBIDDEN PATTERNS

- ❌ Spawning multiple implementation agents in parallel
- ❌ Skipping memory retrieval/storage steps
- ❌ Not including WORKFLOW CONTEXT in prompts
- ❌ Using flag-based memory syntax instead of positional
- ❌ Proceeding to next agent before previous completes
- ❌ Ad-hoc agent spawning without the 4-part prompt structure
- ❌ Forgetting to store document locations in memory

### 🔍 TRUTH & QUALITY PROTOCOL

**Subagents MUST be brutally honest:**
- State only verified, factual information
- No fallbacks or workarounds without user approval
- No illusions about what works/doesn't work
- If infeasible, state facts clearly
- Self-assess 1-100 vs user intent; iterate until 100

### 📏 CODE STRUCTURE LIMITS

- Files: < 500 lines (refactor if larger)
- Functions: < 50 lines, single responsibility
- Classes: < 100 lines, single concept
- ALL .md files go in `./docs/` directory (NEVER root)

### 🔑 KEY AGENTS

| Agent | Use |
|-------|-----|
| `backend-dev` | APIs, events, routes |
| `coder` | Components, stores, UI |
| `code-analyzer` | Analysis, architecture |
| `tester` | Integration tests |
| `perf-analyzer` | Profiling, bottlenecks |
| `system-architect` | Architecture, data flow |
| `reviewer` | Code review, verification |

### ⚠️ POST-COMPACTION CLAUDEFLOW CHECKLIST

**After ANY compaction/context restore, before implementing:**
- [ ] Re-read this ClaudeFlow section
- [ ] Run `npx claude-flow@alpha agent memory status` to check state
- [ ] Retrieve relevant memories before proceeding
- [ ] Confirm methodology with user before executing
- [ ] Use sequential execution (99.9% of cases)
- [ ] Include 4-part context in ALL subagent prompts

---

## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories
4. **USE CLAUDE CODE'S TASK TOOL** for spawning agents concurrently, not just MCP

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool (Claude Code)**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### 🎯 CRITICAL: Claude Code Task Tool for Agent Execution

**Claude Code's Task tool is the PRIMARY way to spawn agents:**
```javascript
// ✅ CORRECT: Use Claude Code's Task tool for parallel agent execution
[Single Message]:
  Task("Research agent", "Analyze requirements and patterns...", "researcher")
  Task("Coder agent", "Implement core features...", "coder")
  Task("Tester agent", "Create comprehensive tests...", "tester")
  Task("Reviewer agent", "Review code quality...", "reviewer")
  Task("Architect agent", "Design system architecture...", "system-architect")
```

**MCP tools are ONLY for coordination setup:**
- `mcp__claude-flow__swarm_init` - Initialize coordination topology
- `mcp__claude-flow__agent_spawn` - Define agent types for coordination
- `mcp__claude-flow__task_orchestrate` - Orchestrate high-level workflows

### 📁 File Organization Rules

**NEVER save to root folder. Use these directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/docs` - Documentation and markdown files
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

## Project Overview

This project uses SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with Claude-Flow orchestration for systematic Test-Driven Development.

## SPARC Commands

### Core Commands
- `npx claude-flow sparc modes` - List available modes
- `npx claude-flow sparc run <mode> "<task>"` - Execute specific mode
- `npx claude-flow sparc tdd "<feature>"` - Run complete TDD workflow
- `npx claude-flow sparc info <mode>` - Get mode details

### Batchtools Commands
- `npx claude-flow sparc batch <modes> "<task>"` - Parallel execution
- `npx claude-flow sparc pipeline "<task>"` - Full pipeline processing
- `npx claude-flow sparc concurrent <mode> "<tasks-file>"` - Multi-task processing

### Build Commands
- `npm run build` - Build project
- `npm run test` - Run tests
- `npm run lint` - Linting
- `npm run typecheck` - Type checking

## SPARC Workflow Phases

1. **Specification** - Requirements analysis (`sparc run spec-pseudocode`)
2. **Pseudocode** - Algorithm design (`sparc run spec-pseudocode`)
3. **Architecture** - System design (`sparc run architect`)
4. **Refinement** - TDD implementation (`sparc tdd`)
5. **Completion** - Integration (`sparc run integration`)

## Code Style & Best Practices

- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Test-First**: Write tests before implementation
- **Clean Architecture**: Separate concerns
- **Documentation**: Keep updated

## 🚀 Available Agents (54 Total)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `collective-intelligence-coordinator`, `swarm-memory-manager`

### Consensus & Distributed
`byzantine-coordinator`, `raft-manager`, `gossip-coordinator`, `consensus-builder`, `crdt-synchronizer`, `quorum-manager`, `security-manager`

### Performance & Optimization
`perf-analyzer`, `performance-benchmarker`, `task-orchestrator`, `memory-coordinator`, `smart-agent`

### GitHub & Repository
`github-modes`, `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`, `project-board-sync`, `repo-architect`, `multi-repo-swarm`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`, `refinement`

### Specialized Development
`backend-dev`, `mobile-dev`, `ml-developer`, `cicd-engineer`, `api-docs`, `system-architect`, `code-analyzer`, `base-template-generator`

### Testing & Validation
`tdd-london-swarm`, `production-validator`

### Migration & Planning
`migration-planner`, `swarm-init`

## 🎯 Claude Code vs MCP Tools

### Claude Code Handles ALL EXECUTION:
- **Task tool**: Spawn and run agents concurrently for actual work
- File operations (Read, Write, Edit, MultiEdit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- Implementation work
- Project navigation and analysis
- TodoWrite and task management
- Git operations
- Package management
- Testing and debugging

### MCP Tools ONLY COORDINATE:
- Swarm initialization (topology setup)
- Agent type definitions (coordination patterns)
- Task orchestration (high-level planning)
- Memory management
- Neural features
- Performance tracking
- GitHub integration

**KEY**: MCP coordinates the strategy, Claude Code's Task tool executes with real agents.

## 🚀 Quick Setup

```bash
# Add MCP servers (Claude Flow required, others optional)
claude mcp add claude-flow npx claude-flow@alpha mcp start
claude mcp add ruv-swarm npx ruv-swarm mcp start  # Optional: Enhanced coordination
claude mcp add flow-nexus npx flow-nexus@latest mcp start  # Optional: Cloud features
```

## MCP Tool Categories

### Coordination
`swarm_init`, `agent_spawn`, `task_orchestrate`

### Monitoring
`swarm_status`, `agent_list`, `agent_metrics`, `task_status`, `task_results`

### Memory & Neural
`memory_usage`, `neural_status`, `neural_train`, `neural_patterns`

### GitHub Integration
`github_swarm`, `repo_analyze`, `pr_enhance`, `issue_triage`, `code_review`

### System
`benchmark_run`, `features_detect`, `swarm_monitor`

### Flow-Nexus MCP Tools (Optional Advanced Features)
Flow-Nexus extends MCP capabilities with 70+ cloud-based orchestration tools:

**Key MCP Tool Categories:**
- **Swarm & Agents**: `swarm_init`, `swarm_scale`, `agent_spawn`, `task_orchestrate`
- **Sandboxes**: `sandbox_create`, `sandbox_execute`, `sandbox_upload` (cloud execution)
- **Templates**: `template_list`, `template_deploy` (pre-built project templates)
- **Neural AI**: `neural_train`, `neural_patterns`, `seraphina_chat` (AI assistant)
- **GitHub**: `github_repo_analyze`, `github_pr_manage` (repository management)
- **Real-time**: `execution_stream_subscribe`, `realtime_subscribe` (live monitoring)
- **Storage**: `storage_upload`, `storage_list` (cloud file management)

**Authentication Required:**
- Register: `mcp__flow-nexus__user_register` or `npx flow-nexus@latest register`
- Login: `mcp__flow-nexus__user_login` or `npx flow-nexus@latest login`
- Access 70+ specialized MCP tools for advanced orchestration

## 🚀 Agent Execution Flow with Claude Code

### The Correct Pattern:

1. **Optional**: Use MCP tools to set up coordination topology
2. **REQUIRED**: Use Claude Code's Task tool to spawn agents that do actual work
3. **REQUIRED**: Each agent runs hooks for coordination
4. **REQUIRED**: Batch all operations in single messages

### Example Full-Stack Development:

```javascript
// Single message with all agent spawning via Claude Code's Task tool
[Parallel Agent Execution]:
  Task("Backend Developer", "Build REST API with Express. Use hooks for coordination.", "backend-dev")
  Task("Frontend Developer", "Create React UI. Coordinate with backend via memory.", "coder")
  Task("Database Architect", "Design PostgreSQL schema. Store schema in memory.", "code-analyzer")
  Task("Test Engineer", "Write Jest tests. Check memory for API contracts.", "tester")
  Task("DevOps Engineer", "Setup Docker and CI/CD. Document in memory.", "cicd-engineer")
  Task("Security Auditor", "Review authentication. Report findings via hooks.", "reviewer")
  
  // All todos batched together
  TodoWrite { todos: [...8-10 todos...] }
  
  // All file operations together
  Write "backend/server.js"
  Write "frontend/App.jsx"
  Write "database/schema.sql"
```

## 📋 Agent Coordination Protocol

### Every Agent Spawned via Task Tool MUST:

**1️⃣ BEFORE Work:**
```bash
npx claude-flow@alpha hooks pre-task --description "[task]"
npx claude-flow@alpha hooks session-restore --session-id "swarm-[id]"
```

**2️⃣ DURING Work:**
```bash
npx claude-flow@alpha hooks post-edit --file "[file]" --memory-key "swarm/[agent]/[step]"
npx claude-flow@alpha hooks notify --message "[what was done]"
```

**3️⃣ AFTER Work:**
```bash
npx claude-flow@alpha hooks post-task --task-id "[task]"
npx claude-flow@alpha hooks session-end --export-metrics true
```

## 🎯 Concurrent Execution Examples

### ✅ CORRECT WORKFLOW: MCP Coordinates, Claude Code Executes

```javascript
// Step 1: MCP tools set up coordination (optional, for complex tasks)
[Single Message - Coordination Setup]:
  mcp__claude-flow__swarm_init { topology: "mesh", maxAgents: 6 }
  mcp__claude-flow__agent_spawn { type: "researcher" }
  mcp__claude-flow__agent_spawn { type: "coder" }
  mcp__claude-flow__agent_spawn { type: "tester" }

// Step 2: Claude Code Task tool spawns ACTUAL agents that do the work
[Single Message - Parallel Agent Execution]:
  // Claude Code's Task tool spawns real agents concurrently
  Task("Research agent", "Analyze API requirements and best practices. Check memory for prior decisions.", "researcher")
  Task("Coder agent", "Implement REST endpoints with authentication. Coordinate via hooks.", "coder")
  Task("Database agent", "Design and implement database schema. Store decisions in memory.", "code-analyzer")
  Task("Tester agent", "Create comprehensive test suite with 90% coverage.", "tester")
  Task("Reviewer agent", "Review code quality and security. Document findings.", "reviewer")
  
  // Batch ALL todos in ONE call
  TodoWrite { todos: [
    {id: "1", content: "Research API patterns", status: "in_progress", priority: "high"},
    {id: "2", content: "Design database schema", status: "in_progress", priority: "high"},
    {id: "3", content: "Implement authentication", status: "pending", priority: "high"},
    {id: "4", content: "Build REST endpoints", status: "pending", priority: "high"},
    {id: "5", content: "Write unit tests", status: "pending", priority: "medium"},
    {id: "6", content: "Integration tests", status: "pending", priority: "medium"},
    {id: "7", content: "API documentation", status: "pending", priority: "low"},
    {id: "8", content: "Performance optimization", status: "pending", priority: "low"}
  ]}
  
  // Parallel file operations
  Bash "mkdir -p app/{src,tests,docs,config}"
  Write "app/package.json"
  Write "app/src/server.js"
  Write "app/tests/server.test.js"
  Write "app/docs/API.md"
```

### ❌ WRONG (Multiple Messages):
```javascript
Message 1: mcp__claude-flow__swarm_init
Message 2: Task("agent 1")
Message 3: TodoWrite { todos: [single todo] }
Message 4: Write "file.js"
// This breaks parallel coordination!
```

## Performance Benefits

- **84.8% SWE-Bench solve rate**
- **32.3% token reduction**
- **2.8-4.4x speed improvement**
- **27+ neural models**

## Hooks Integration

### Pre-Operation
- Auto-assign agents by file type
- Validate commands for safety
- Prepare resources automatically
- Optimize topology by complexity
- Cache searches

### Post-Operation
- Auto-format code
- Train neural patterns
- Update memory
- Analyze performance
- Track token usage

### Session Management
- Generate summaries
- Persist state
- Track metrics
- Restore context
- Export workflows

## Advanced Features (v2.0.0)

- 🚀 Automatic Topology Selection
- ⚡ Parallel Execution (2.8-4.4x speed)
- 🧠 Neural Training
- 📊 Bottleneck Analysis
- 🤖 Smart Auto-Spawning
- 🛡️ Self-Healing Workflows
- 💾 Cross-Session Memory
- 🔗 GitHub Integration

## Integration Tips

1. Start with basic swarm init
2. Scale agents gradually
3. Use memory for context
4. Monitor progress regularly
5. Train patterns from success
6. Enable hooks automation
7. Use GitHub tools first

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues
- Flow-Nexus Platform: https://flow-nexus.ruv.io (registration required for cloud features)

---

Remember: **Claude Flow coordinates, Claude Code creates!**

# important-instruction-reminders

## 🛑 PRIME DIRECTIVE REMINDER
**STOP AND ASK before doing anything. Never act autonomously after compaction.**

## 🔒 CLAUDEFLOW REMINDER  
**NEVER deviate from ClaudeFlow methodology. Re-read the ClaudeFlow section after every compaction.**

## Core Rules
1. Do what has been asked; nothing more, nothing less.
2. **ALWAYS wait for explicit user confirmation before executing any plan.**
3. NEVER create files unless explicitly requested AND confirmed.
4. ALWAYS prefer editing an existing file to creating a new one.
5. NEVER proactively create documentation files (*.md) or README files.
6. Never save working files, text/mds and tests to the root folder.
7. **After compaction: summarize state, ask what's next, WAIT for response.**
8. **"I'll go ahead and..." is FORBIDDEN. Ask first, always.**
9. When in doubt, ask. When not in doubt, still ask.
10. Treat every session start and context restore as a fresh conversation requiring new confirmation.
11. **ALWAYS use ClaudeFlow sequential execution (99.9% of cases).**
12. **ALWAYS include 4-part context in subagent prompts (TASK, CONTEXT, RETRIEVAL, STORAGE).**
13. **ALWAYS use positional arguments for memory store commands.**
14. **NEVER spawn parallel implementation agents - sequential ONLY.**
15. **After compaction: run `npx claude-flow@alpha agent memory status` before proceeding.**
