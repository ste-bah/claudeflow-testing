# God Agent: Universal Development Guide

## GOLDEN RULE: 99.9% Sequential Execution
## ALWAYS USE GOD AGENT's REASONINGBANK & INTERACTIONSTORE!
## CRITICAL: Forward-Looking Subagent Coordination

## Memory System Overview

The God Agent uses its **OWN** memory systems - NOT claude-flow:

| System | Purpose | Storage Location |
|--------|---------|------------------|
| **InteractionStore** | Knowledge entries, interactions | `.agentdb/universal/session-knowledge.json` |
| **ReasoningBank** | Pattern matching, causal reasoning | VectorDB + CausalMemory |
| **TrajectoryTracker** | Learning feedback tracking | Integrated with SonaEngine |

## CRITICAL: Correct Memory APIs

### InteractionStore (Knowledge Storage)

```typescript
// STORE knowledge (via UniversalAgent wrapper)
await agent.storeKnowledge({
  content: '{"endpoints": [...]}',
  category: 'api-schema',
  domain: 'project/api',
  tags: ['api', 'endpoints', 'schema']
});

// Or DIRECT InteractionStore API
interactionStore.addKnowledge({
  id: `schema-${Date.now()}`,
  content: '{"endpoints": [...]}',
  category: 'api-schema',
  domain: 'project/api',
  tags: ['api', 'endpoints', 'schema'],
  quality: 1.0,
  usageCount: 0,
  lastUsed: Date.now(),
  createdAt: Date.now()
});

// RETRIEVE knowledge
const knowledge = interactionStore.getKnowledgeByDomain('project/api');
const filtered = knowledge.filter(k => k.tags?.includes('schema'));
```

### ReasoningBank (Pattern Reasoning)

```typescript
// QUERY patterns (hybrid reasoning)
const result = await reasoningBank.query({
  query: embedVector,
  type: 'hybrid',  // pattern-match + causal + contextual
  maxResults: 10,
  confidenceThreshold: 0.7
});

// PROVIDE FEEDBACK (learning)
await reasoningBank.provideFeedback({
  trajectoryId: trajectoryId,
  quality: 0.95,  // 0-1 score
  userFeedback: 'Schema generated successfully',
  outcome: 'positive'
});
```

### CLI Commands

```bash
# Store knowledge via God Agent CLI
npx tsx src/god-agent/universal/cli.ts learn "Your knowledge content here"

# Query knowledge (programmatic - not CLI)
# Use agent.ask() or agent.query() methods

# Check status
npx tsx src/god-agent/universal/cli.ts status
```

**Can Task B start BEFORE Task A finishes?**
- **NO (99.9%)** → Sequential (separate messages)
- **YES (0.1% - read-only only)** → Parallel (single message)

**When prompting subagents, ALWAYS include:**
1. **Future agent context** - What agents spawn after this
2. **Downstream requirements** - What future agents need
3. **Memory guidance** - What to store for future utility
4. **Domain strategy** - Which domain/category to use

**Common Dependencies** (require sequential):
- Backend → Frontend integration
- API schema → Client implementation
- Database schema → Backend → Frontend
- Event structure → Handlers → UI
- File modification → Tests

**Parallel ONLY when**:
- Read-only analysis
- Independent linters/formatters
- Zero modifications

## Essential Setup

```typescript
// Initialize God Agent
import { UniversalAgent } from './src/god-agent/universal';

const agent = new UniversalAgent({ verbose: true });
await agent.initialize();

// Check status
const status = await agent.getStatus();
console.log(`Patterns: ${status.patternCount}, Domains: ${status.domainCount}`);
console.log(`Knowledge: ${status.knowledgeEntries}, Interactions: ${status.totalInteractions}`);
```

## Forward-Looking Subagent Coordination

### Critical: Subagents Have No Memory

Each subagent starts clean. They can't see previous work unless you:
1. Tell them which domain to query in InteractionStore
2. Tell them what to store for future agents

### Optimal Subagent Prompt Pattern

When spawning ANY subagent, include 4-part context:

```bash
Task("[agent-type]", `
  ## YOUR TASK
  [Primary task]

  ## WORKFLOW CONTEXT
  Agent #N of M | Previous: [what, which domain] | Next: [who, what they need]

  ## MEMORY RETRIEVAL (God Agent InteractionStore)
  Retrieve from domain: "project/[namespace]"
  Filter by tags: ['schema', 'api', etc.]

  Code:
  const knowledge = interactionStore.getKnowledgeByDomain('project/[namespace]');
  const relevant = knowledge.filter(k => k.tags?.includes('[tag]'));

  ## MEMORY STORAGE (For Next Agents)
  Store to domain: "project/[ns]"
  With tags: ['[tag1]', '[tag2]']
  Category: '[category]'

  Code:
  await agent.storeKnowledge({
    content: JSON.stringify(yourData),
    category: '[category]',
    domain: 'project/[ns]',
    tags: ['[tag1]', '[tag2]']
  });

  ## STEPS
  1. Query InteractionStore for previous context
  2. Validate data
  3. Execute task
  4. Store results in InteractionStore
  5. Provide feedback to ReasoningBank

  ## SUCCESS
  - Task complete
  - Knowledge stored in InteractionStore
  - Feedback provided to ReasoningBank
  - Next agents have what they need
`)
```

### Example: 4-Agent Feature Workflow

```bash
# TodoWrite - batch all todos
TodoWrite({ todos: [
  {id: "1", content: "Backend: Implement feature", status: "pending"},
  {id: "2", content: "Integration: Add types", status: "pending"},
  {id: "3", content: "UI: Build component", status: "pending"},
  {id: "4", content: "Tests: Integration tests", status: "pending"}
]})

# Agent 1: Backend (Message 1)
Task("backend-dev", `
  ## TASK: Implement backend feature
  ## CONTEXT: Agent #1/4 | Next: Integration (needs schema), UI (needs viz), Tests (needs endpoints)

  ## RETRIEVAL: Query InteractionStore
  const analysis = interactionStore.getKnowledgeByDomain('project/analysis');

  ## STORAGE:
  1. For Integration: domain "project/events", tags ['schema', 'typescript']
  2. For UI: domain "project/frontend", tags ['requirements', 'viz']
  3. For Tests: domain "project/api", tags ['endpoints', 'test-scenarios']

  await agent.storeKnowledge({
    content: JSON.stringify(schemaData),
    category: 'event-schema',
    domain: 'project/events',
    tags: ['schema', 'typescript', 'backend']
  });
`)

# Agent 2: Integration (Message 2 - WAIT)
Task("coder", `
  ## TASK: Update integration types
  ## CONTEXT: Agent #2/4 | Previous: Backend ✓ | Next: UI, Tests

  ## RETRIEVAL:
  const schemas = interactionStore.getKnowledgeByDomain('project/events');
  const eventSchema = schemas.find(k => k.tags?.includes('schema'));

  ## STORAGE: For UI - domain "project/frontend", tags ['handler', 'subscription']
`)

# Agent 3: UI (Message 3 - WAIT)
Task("coder", `
  ## TASK: Build UI component
  ## CONTEXT: Agent #3/4 | Previous: Backend, Integration ✓ | Next: Tests

  ## RETRIEVAL:
  const requirements = interactionStore.getKnowledgeByDomain('project/frontend');
  const vizReqs = requirements.filter(k => k.tags?.includes('requirements'));
  const handler = requirements.filter(k => k.tags?.includes('handler'));

  ## STORAGE: For Tests - domain "project/frontend", tags ['component', 'selectors']
`)

# Agent 4: Tests (Message 4 - WAIT)
Task("tester", `
  ## TASK: Integration tests
  ## CONTEXT: Agent #4/4 (FINAL) | Previous: All ✓

  ## RETRIEVAL: Query all domains from agents 1-3
  const api = interactionStore.getKnowledgeByDomain('project/api');
  const events = interactionStore.getKnowledgeByDomain('project/events');
  const frontend = interactionStore.getKnowledgeByDomain('project/frontend');

  ## STORAGE: domain "project/tests", tags ['coverage', 'results']

  ## FEEDBACK: Provide learning feedback
  await reasoningBank.provideFeedback({
    trajectoryId: trajectoryId,
    quality: testPassRate,
    outcome: allPassed ? 'positive' : 'negative'
  });
`)
```

### Why Forward-Looking Works: 88% vs 60%

**Without**: Agents ask for info → delays, rework, 60% success, 2.5x slower
**With**: Agents store what's needed → 0 questions, 88% success, 1.85x faster

## Memory Domain Convention

```
project/events/[type]      # Event schemas
project/api/[endpoint]     # API schemas
project/database/[table]   # DB schemas
project/frontend/[comp]    # Frontend patterns
project/performance/[ana]  # Performance data
project/bugs/[issue]       # Bug analysis
project/tests/[feature]    # Test docs
project/docs/[name]        # Documentation metadata
```

**Handoff Pattern**: Store → Wait → Query

## Key Agents (66+ available)

| Agent | Use |
|-------|-----|
| `backend-dev` | APIs, events, routes |
| `coder` | Components, stores, UI |
| `code-analyzer` | Analysis, architecture |
| `tester` | Integration tests |
| `perf-analyzer` | Profiling, bottlenecks |
| `system-architect` | Architecture, data flow |
| `tdd-london-swarm` | TDD workflows |
| `researcher` | Research, analysis |
| `reviewer` | Code review, validation |

**Coordinators**: `hierarchical-coordinator` (4-6 agents), `mesh-coordinator` (7+), `adaptive-coordinator` (dynamic)

## Critical Rules

### ALWAYS
1. Sequential by default (99.9%)
2. Use God Agent's InteractionStore and ReasoningBank (NOT claude-flow)
3. Forward-looking prompts (tell agents about future needs)
4. Store schemas in InteractionStore with proper domains/tags
5. Memory coordination (Backend → Frontend)
6. Batch TodoWrite (5-10+ todos)
7. Provide feedback to ReasoningBank after tasks
8. Include WORKFLOW CONTEXT in every Task()

### NEVER
1. Use `npx claude-flow memory` commands (use God Agent memory)
2. Parallel backend + frontend (missing schemas)
3. Skip memory coordination (type mismatches)
4. Frontend before backend (missing contracts)
5. Prompt without future context (60% success, delays)
6. Forget to specify domain/tags for retrieval (blind agents)

## Common Mistakes & Fixes

| Mistake | Fix |
|---------|-----|
| Using claude-flow memory | Use InteractionStore: `agent.storeKnowledge()` |
| Parallel backend + frontend | Sequential: Backend stores → Frontend queries |
| No contract in memory | Store with domain/tags: `storeKnowledge({domain: 'project/api'})` |
| Uncoordinated DB changes | Schema-first: Design → Store → Backend → Frontend |
| No future context | Include WORKFLOW CONTEXT in prompts |
| Missing retrieval info | Explicit domain/tags: `getKnowledgeByDomain('project/api')` |
| No learning feedback | Call `reasoningBank.provideFeedback()` after tasks |

## Performance

| Technique | Speedup | When | Risk |
|-----------|---------|------|------|
| Sequential + InteractionStore | 1.85x | Always | Safe |
| ReasoningBank patterns | 1.85x | Always | Safe |
| Forward-looking prompts | 1.85x | Always | Safe |
| Parallel | 2.8-4.4x | Read-only ONLY | HIGH |

**WARNING**: Parallel with dependencies = failure

## Quick Reference

```typescript
// 1. INIT God Agent
import { UniversalAgent } from './src/god-agent/universal';
const agent = new UniversalAgent({ verbose: true });
await agent.initialize();

// 2. STORE KNOWLEDGE
await agent.storeKnowledge({
  content: JSON.stringify(data),
  category: 'schema',
  domain: 'project/api',
  tags: ['endpoints', 'backend']
});

// 3. QUERY KNOWLEDGE
const knowledge = agent.interactionStore.getKnowledgeByDomain('project/api');
const schemas = knowledge.filter(k => k.tags?.includes('schema'));

// 4. PROVIDE FEEDBACK (Learning)
await agent.reasoningBank.provideFeedback({
  trajectoryId: id,
  quality: 0.95,
  outcome: 'positive'
});

// 5. TASK PROMPT TEMPLATE
Task("[type]", `
  CONTEXT: Agent #N/M | Previous: [agents] | Next: [agents + needs]
  RETRIEVAL: getKnowledgeByDomain('project/[domain]').filter(tags)
  TASK: [task]
  STORAGE: storeKnowledge({domain: 'project/[ns]', tags: [...]})
  FEEDBACK: provideFeedback({trajectoryId, quality, outcome})
`)

// 6. DOMAINS
project/events, project/api, project/database,
project/frontend, project/performance, project/bugs, project/tests, project/docs

// 7. RULES
✅ Sequential (99.9%), Forward-looking, InteractionStore, ReasoningBank feedback
❌ claude-flow memory, Parallel backend+frontend, Skip context
```

## Truth & Quality Protocol

**Principle 0: Radical Candor - Truth Above All**

Subagents MUST be brutally honest. No lies, simulations, or illusions of functionality.

### Core Requirements:
1. **Absolute Truthfulness** - State only verified, factual information
2. **No Fallbacks** - Don't invent workarounds unless user approves
3. **No Illusions** - Never mislead about what works/doesn't work
4. **Fail Honestly** - If infeasible, state facts clearly

### Self-Assessment (Required)
- After each task: Rate 1-100 vs user intent
- If < 100: Document gaps, iterate to 100
- Don't proceed until perfect score
- Provide feedback to ReasoningBank for learning

### Verification
- Spawn "reviewer" subagent to:
  - Verify intent match
  - Check edge cases
  - Validate success criteria
  - Suggest improvements

## Subagent Memory & Response Protocol

### Critical: Maximum God Agent Memory Utilization

**All subagents spawned by Claude Code MUST:**

1. **Use God Agent's Memory Systems**
   - InteractionStore for knowledge storage
   - ReasoningBank for pattern retrieval and feedback
   - TrajectoryTracker for learning

2. **Save EVERYTHING to Memory & Docs**
   - **InteractionStore**: Store ALL findings, decisions, schemas, analyses
   - **./docs/ Directory**: Save ALL .md files to `/docs/` directory (NEVER root)
   - **ReasoningBank**: Provide feedback for continuous learning

3. **Memory Storage Requirements**
   ```typescript
   // Store every significant finding
   await agent.storeKnowledge({
     content: JSON.stringify(findings),
     category: '[category]',
     domain: 'project/[area]',
     tags: ['relevant', 'tags']
   });

   // Save documentation files to docs/
   Write("./docs/[descriptive-name].md", content);

   // Store file metadata in InteractionStore
   await agent.storeKnowledge({
     content: JSON.stringify({
       path: './docs/[name].md',
       description: '...'
     }),
     category: 'documentation',
     domain: 'project/docs',
     tags: ['doc', '[topic]']
   });

   // Provide learning feedback
   await agent.reasoningBank.provideFeedback({
     trajectoryId: trajectoryId,
     quality: successScore,
     outcome: success ? 'positive' : 'negative'
   });
   ```

4. **Concise Response Format (REQUIRED)**

   When subagents complete their work, they MUST respond with:

   ```
   ## TASK COMPLETION SUMMARY

   **What I Did**: [1-2 sentence summary]

   **Files Created/Modified**:
   - `./docs/[filename].md` - [Brief description]
   - `./src/[filename].ts` - [Brief description]

   **InteractionStore Entries** (for orchestration):
   - Domain: `project/[area]`, Tags: `[tag1, tag2]` - [What it contains, why next agents need it]
   - Domain: `project/[area]`, Tags: `[tag1, tag2]` - [What it contains, why next agents need it]

   **ReasoningBank Feedback**:
   - Trajectory: `[id]` - Quality: `[0-1]`, Outcome: `[positive/negative]`

   **Query Commands**:
   ```typescript
   // Retrieve this agent's findings
   const knowledge = interactionStore.getKnowledgeByDomain('project/[area]');
   const relevant = knowledge.filter(k => k.tags?.includes('[tag]'));
   ```

   **Next Agent Guidance**: [What future agents should query/know]
   ```

5. **Why This Matters**
   - **Context Window Management**: Main Claude Code orchestrates efficiently
   - **Precise Agent Targeting**: Main agent can direct future subagents to EXACT domains/tags
   - **Zero Redundancy**: Future agents query only what they need
   - **Full Traceability**: All work documented with clear access patterns
   - **Continuous Learning**: ReasoningBank improves over time

### Example Subagent Response

```
## TASK COMPLETION SUMMARY

**What I Did**: Analyzed Example backend event structure and documented SSE payload schemas for all 6 workflow stages.

**Files Created/Modified**:
- `./docs/app-event-schemas.md` - Complete SSE event payload specifications
- `./docs/app-backend-analysis.md` - Backend event emission patterns and timing

**InteractionStore Entries** (for orchestration):
- Domain: `project/events`, Tags: `['app-schema', 'sse', 'payload']` - All 6 stage SSE payload structures (for Frontend integration)
- Domain: `project/api`, Tags: `['app-endpoints', 'backend']` - Backend endpoint contracts (for Testing)
- Domain: `project/performance`, Tags: `['event-timing', 'metrics']` - Event emission timing data (for Optimization)

**ReasoningBank Feedback**:
- Trajectory: `trj_abc123` - Quality: `0.95`, Outcome: `positive`

**Query Commands**:
```typescript
// Retrieve event schemas
const events = interactionStore.getKnowledgeByDomain('project/events');
const appSchemas = events.filter(k => k.tags?.includes('app-schema'));

// View documentation
cat ./docs/app-event-schemas.md
```

**Next Agent Guidance**: Frontend agents should query domain `project/events` with tag `app-schema` to implement TypeScript interfaces. Testing agents need domain `project/api` with tag `app-endpoints` for integration tests.
```

### Enforcement Checklist

Every subagent MUST verify before responding:
- [ ] Used God Agent InteractionStore for storage (NOT claude-flow)
- [ ] Stored ALL findings with proper domain/category/tags
- [ ] Saved ALL .md files to `./docs/` directory
- [ ] Response includes exact domain/tag paths
- [ ] Response includes query code examples
- [ ] Provided feedback to ReasoningBank
- [ ] Response includes next agent guidance
- [ ] Response is concise (not verbose)
- [ ] Main agent can route future work efficiently

**Result**: Main Claude Code can orchestrate subagents with surgical precision, directing them to exact InteractionStore domains without context overload.

---

## Claude Code Hooks: Automatic Memory Coordination (HKS-001)

### Overview

Claude Code Hooks automatically manage memory coordination between subagents. **Users do NOT need to add anything to their prompts** - the hooks run transparently on every Task() call.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Claude Code Task() Lifecycle                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Task() Called → Pre-Task Hook → Execute → Post-Task Hook           │
│                      │                          │                   │
│                      ▼                          ▼                   │
│              Query InteractionStore     Extract Summary             │
│              Inject Context             Store Findings              │
│                                        Submit Feedback              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### How It Works

**Pre-Task Hook** (runs before every Task()):
1. Detects agent type from prompt patterns (backend-dev, coder, tester, etc.)
2. Queries InteractionStore by inferred domain and tags
3. Formats retrieved knowledge as `## MEMORY CONTEXT` section
4. Injects context into the prompt automatically

**Post-Task Hook** (runs after every Task()):
1. Parses output for `## TASK COMPLETION SUMMARY`
2. Extracts structured data (files, domains, tags, guidance)
3. Stores findings in InteractionStore with quality score
4. Submits feedback to ReasoningBank for continuous learning

### TASK COMPLETION SUMMARY Format (Automatic Extraction)

For **optimal** memory coordination, subagents should emit this format. The post-task hook will automatically extract and store the data:

```markdown
## TASK COMPLETION SUMMARY

**What I Did**: [1-2 sentence summary]

**Files Created/Modified**:
- `./src/[filename].ts` - [Brief description]

**InteractionStore Entries** (for orchestration):
- Domain: `project/[area]`, Tags: `['tag1', 'tag2']` - [Description]

**ReasoningBank Feedback**:
- Trajectory: `trj_[id]` - Quality: `0.95`, Outcome: `positive`

**Next Agent Guidance**: [Instructions for future agents]
```

**Note**: If no TASK COMPLETION SUMMARY is found, the hook uses heuristic parsing to extract what it can from the output.

### Quality Estimation

The post-task hook automatically estimates quality (0-1 score):

| Criterion | Points |
|-----------|--------|
| Has TASK COMPLETION SUMMARY | +0.3 |
| Has InteractionStore entries | +0.2 |
| Has ReasoningBank feedback | +0.1 |
| No error messages in output | +0.2 |
| Has file modifications | +0.1 |
| Has next agent guidance | +0.1 |

### Configuration

Hooks are configured in `.claude/hooks/config.json`:

```json
{
  "performance": {
    "preTaskBudgetMs": 500,
    "postTaskBudgetMs": 500,
    "totalBudgetMs": 1000
  },
  "memory": {
    "domains": ["project/*"],
    "maxContextSize": 10000
  }
}
```

### Debugging

```bash
# Enable verbose logging
export HOOKS_VERBOSE=true

# Test pre-task hook
./.claude/hooks/pre-task.sh "Test prompt" 2>&1

# Test post-task hook
echo "## TASK COMPLETION SUMMARY\n**What I Did**: Test" | ./.claude/hooks/post-task.sh 2>&1
```

### Exit Codes

| Code | Name | Meaning |
|------|------|---------|
| 0 | SUCCESS | Hook completed normally |
| 1 | ERROR | General error occurred |
| 2 | VALIDATION_FAILURE | Input validation failed |
| 3 | TIMEOUT | Hook exceeded time budget |

### File Locations

```
.claude/hooks/
├── pre-task.sh           # Pre-task shell wrapper
├── post-task.sh          # Post-task shell wrapper
└── config.json           # Hook configuration

scripts/hooks/
├── context-injector.ts   # Pre-task context service
├── output-extractor.ts   # Post-task extraction service
├── feedback-submitter.ts # ReasoningBank feedback
├── hook-types.ts         # TypeScript interfaces
└── hook-logger.ts        # JSON logging
```

### Key Benefits

1. **Zero User Effort**: Hooks run automatically on every Task() call
2. **Automatic Context Injection**: Subagents receive relevant prior knowledge
3. **Automatic Learning**: ReasoningBank feedback submitted automatically
4. **Forward-Looking Memory**: Each agent's findings available to next agents
5. **Quality Tracking**: All tasks get quality scores for pattern learning

---

## Key Takeaways

1. **99.9% Sequential** - Dependencies require it
2. **God Agent Memory** - Use InteractionStore and ReasoningBank (NOT claude-flow)
3. **Forward-Looking** - Tell agents about future needs (88% vs 60%)
4. **Memory Coordination** - Backend → Frontend flow via domains/tags
5. **Batch TodoWrite** - 5-10+ todos
6. **WORKFLOW CONTEXT** - Every Task() needs it
7. **Learning Feedback** - Always call `provideFeedback()` after tasks
8. **If Uncertain** - Sequential (safer)

**Remember**: Sequential by default. Forward-looking prompts. God Agent memory (InteractionStore + ReasoningBank). Claude Code executes.

---

## 🚨 CRITICAL: Claude Code Orchestrator Responsibilities

**This section is for CLAUDE CODE ITSELF (the orchestrator), not subagents.**

The orchestrator (Claude Code) MUST manage God Agent memory at the workflow level, not just delegate to subagents.

### Orchestrator Memory Protocol

#### BEFORE Starting ANY Multi-Step Workflow:

```bash
# 1. Check God Agent status
npx tsx src/god-agent/universal/cli.ts status

# 2. Query existing knowledge for this project/feature
npx tsx src/god-agent/universal/cli.ts query -d "project/[feature]" -n 20
```

**In your orchestration logic:**
```typescript
// Check if there's prior work on this feature
const priorWork = interactionStore.getKnowledgeByDomain('project/[feature-name]');
if (priorWork.length > 0) {
  // Include summary in first subagent prompt
  console.log(`Found ${priorWork.length} prior entries for this feature`);
}
```

#### AFTER Each Subagent Completes:

**The orchestrator (Claude Code) MUST:**

1. **Extract key findings** from subagent response
2. **Store in InteractionStore** (orchestrator stores, not just subagent):
   ```bash
   npx tsx src/god-agent/universal/cli.ts learn "[Summary of subagent findings]" \
     -d "project/[workflow-phase]" \
     -c "[phase-type]" \
     -t "[agent-type],[task-type],[workflow-id]"
   ```

3. **Provide feedback** for learning:
   ```bash
   npx tsx src/god-agent/universal/cli.ts feedback [trajectory-id] [0-1 quality score] \
     --notes "[Success/failure notes]"
   ```

#### AFTER Entire Workflow Completes:

```bash
# Store workflow summary
npx tsx src/god-agent/universal/cli.ts learn "[Complete workflow summary with outcomes]" \
  -d "project/workflows" \
  -c "workflow-completion" \
  -t "[workflow-type],[success/failure],[date]"

# Provide final feedback
npx tsx src/god-agent/universal/cli.ts feedback [workflow-trajectory] [final-quality] \
  --notes "Workflow complete: [summary]"
```

---

## Orchestrator Pre-Flight Checklist

**Before starting ANY multi-step workflow, verify:**

```
□ God Agent status checked (npx tsx .../cli.ts status)
□ Prior knowledge queried for this feature/project
□ TodoWrite called with FULL task list (5-10+ items)
□ Workflow phases documented with memory domains
□ Each phase has assigned domain/tags for storage
```

**After EVERY subagent response, verify:**

```
□ Key findings extracted from response
□ Knowledge stored via CLI: npx tsx .../cli.ts learn "..."
□ Feedback provided via CLI: npx tsx .../cli.ts feedback ...
□ Next agent prompt includes retrieval instructions
□ Todo item marked complete
```

**After workflow completion, verify:**

```
□ Workflow summary stored in InteractionStore
□ Final feedback provided to ReasoningBank
□ All todo items marked complete
□ Documentation files saved to ./docs/
```

---

## Multi-Phase Workflow Memory Pattern

### Standard Phases and Their Domains

| Phase | Domain | Tags | Category |
|-------|--------|------|----------|
| **Plan** | `project/plans` | `['plan', 'workflow-name', 'phase-0']` | `planning` |
| **Specs** | `project/specs` | `['spec', 'workflow-name', 'phase-1']` | `specification` |
| **Review** | `project/reviews` | `['review', 'approval-status', 'phase-2']` | `review` |
| **Tasks** | `project/tasks` | `['breakdown', 'workflow-name', 'phase-3']` | `task-breakdown` |
| **Implement** | `project/implementations` | `['impl', 'component', 'phase-4']` | `implementation` |
| **Audit** | `project/audits` | `['audit', 'quality-score', 'phase-5']` | `audit` |
| **Report** | `project/reports` | `['report', 'final', 'phase-6']` | `report` |

### Example: 8-Phase Development Workflow

```bash
# Phase 1: Plan
Task("planner", "Create implementation plan...")
# AFTER: Orchestrator stores
npx tsx src/god-agent/universal/cli.ts learn "Plan: [summary]" -d "project/plans" -t "plan,attention-mechanism"

# Phase 2: Specs
Task("backend-dev", "Write specifications...")
# Retrieve prior: project/plans
# AFTER: Orchestrator stores
npx tsx src/god-agent/universal/cli.ts learn "Spec: [summary]" -d "project/specs" -t "spec,attention-mechanism"

# Phase 3: Review
Task("reviewer", "Review specifications...")
# Retrieve prior: project/specs
# AFTER: Orchestrator stores
npx tsx src/god-agent/universal/cli.ts learn "Review: APPROVED/REVISE" -d "project/reviews" -t "review,approved"

# Phase 4: Tasks
Task("task-breakdown-specialist", "Break into tasks...")
# Retrieve prior: project/specs, project/reviews
# AFTER: Orchestrator stores
npx tsx src/god-agent/universal/cli.ts learn "Tasks: 14 tasks created" -d "project/tasks" -t "breakdown,14-tasks"

# Phase 5: Implement
Task("backend-dev", "Implement tasks...")
# Retrieve prior: project/tasks
# AFTER: Orchestrator stores
npx tsx src/god-agent/universal/cli.ts learn "Impl: 302 tests passing" -d "project/implementations" -t "impl,attention"

# Phase 6: Audit
Task("code-analyzer", "Audit implementation...")
# Retrieve prior: project/implementations
# AFTER: Orchestrator stores
npx tsx src/god-agent/universal/cli.ts learn "Audit: 9.5/10 APPROVED" -d "project/audits" -t "audit,9.5"

# Phase 7: Report
# Orchestrator reads audit, generates summary
npx tsx src/god-agent/universal/cli.ts learn "Report: Complete, production-ready" -d "project/reports" -t "report,final"

# Phase 8: Fix
Task("tester", "Fix audit findings...")
# AFTER: Final orchestrator storage
npx tsx src/god-agent/universal/cli.ts learn "Fixes: All 2 minor issues resolved" -d "project/fixes" -t "fix,complete"

# FINAL: Workflow feedback
npx tsx src/god-agent/universal/cli.ts feedback trj_workflow_123 0.95 --notes "8-phase workflow complete"
```

---

## Orchestrator CLI Quick Reference

### Check Status
```bash
npx tsx src/god-agent/universal/cli.ts status
```

### Store Knowledge (Orchestrator Level)
```bash
npx tsx src/god-agent/universal/cli.ts learn "[content]" \
  -d "project/[domain]" \
  -c "[category]" \
  -t "tag1,tag2,tag3"
```

### Query Knowledge
```bash
npx tsx src/god-agent/universal/cli.ts query -d "project/[domain]" -t "tag1" -n 10
```

### Provide Feedback
```bash
npx tsx src/god-agent/universal/cli.ts feedback [trajectory-id] [0-1] --notes "[notes]"
```

### Common Domains for Orchestrator
```
project/plans          # Phase 0: Planning documents
project/specs          # Phase 1: Specifications
project/reviews        # Phase 2: Review outcomes
project/tasks          # Phase 3: Task breakdowns
project/implementations # Phase 4: Implementation results
project/audits         # Phase 5: Audit results
project/reports        # Phase 6: Final reports
project/workflows      # Workflow summaries and learnings
```

---

## Why Orchestrator Memory Matters

### Without Orchestrator Memory:
- ❌ Each session starts from scratch
- ❌ No learning between workflows
- ❌ Repeated analysis of same codebase
- ❌ No pattern recognition across projects
- ❌ 60% success rate

### With Orchestrator Memory:
- ✅ Prior work instantly available
- ✅ Patterns improve over time
- ✅ Feedback enhances ReasoningBank
- ✅ Context preserved across sessions
- ✅ 88%+ success rate

---

## Enforcement: Orchestrator Checklist

**Copy this checklist at the START of every multi-phase workflow:**

```markdown
## Orchestrator Memory Checklist

### Pre-Workflow
- [ ] `npx tsx .../cli.ts status` - God Agent initialized
- [ ] Queried prior knowledge for this feature
- [ ] TodoWrite with full task list (5-10+ items)
- [ ] Documented phase→domain mappings

### Per-Phase (repeat for each)
- [ ] Subagent spawned with retrieval instructions
- [ ] Subagent response received
- [ ] Key findings extracted
- [ ] `npx tsx .../cli.ts learn "..."` - Knowledge stored
- [ ] `npx tsx .../cli.ts feedback ...` - Learning feedback
- [ ] Todo marked complete

### Post-Workflow
- [ ] Workflow summary stored
- [ ] Final feedback provided
- [ ] All todos complete
- [ ] Documentation in ./docs/
```

**Result**: God Agent learns from every workflow, improving future performance.
