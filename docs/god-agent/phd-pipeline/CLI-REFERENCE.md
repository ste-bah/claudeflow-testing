# PhD Pipeline CLI Reference

**Version**: 1.0.0
**CLI Entry Point**: `npx phd-cli` or `node dist/god-agent/cli/phd-cli.js`

---

## Command Summary

| Command | Description |
|---------|-------------|
| `init` | Initialize a new research session |
| `next` | Get the next agent to execute |
| `complete` | Mark current agent as complete |
| `status` | Get session status |
| `list` | List all sessions |
| `resume` | Resume an interrupted session |
| `abort` | Abort a session |
| `validate-agents` | Validate agent file configuration |
| `finalize` | Run Phase 8 final assembly |

---

## phd-cli init

Initialize a new PhD research pipeline session.

### Syntax

```bash
npx phd-cli init <topic> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<topic>` | Yes | Research topic or query (will be converted to slug) |

### Options

| Option | Description |
|--------|-------------|
| `--verbose`, `-v` | Enable verbose output |
| `--json` | Output result as JSON |

### Examples

```bash
# Initialize with a research topic
npx phd-cli init "impact of AI on healthcare outcomes"

# Initialize with verbose output
npx phd-cli init "machine learning in finance" --verbose

# Initialize with JSON output
npx phd-cli init "climate change policy analysis" --json
```

### Output (Standard)

```
PhD Pipeline initialized successfully!

Session ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Topic: impact of AI on healthcare outcomes
Slug: impact-of-ai-on-healthcare-outcomes

First Agent: Self-Ask Decomposer (self-ask-decomposer)
Phase: 1 (Foundation)
Position: 1/46

To proceed, run:
  npx phd-cli next a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Output (JSON)

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "topic": "impact of AI on healthcare outcomes",
  "slug": "impact-of-ai-on-healthcare-outcomes",
  "firstAgent": {
    "key": "self-ask-decomposer",
    "displayName": "Self-Ask Decomposer",
    "phase": 1,
    "position": 1
  },
  "totalAgents": 46
}
```

---

## phd-cli next

Get the next agent to execute in the pipeline.

### Syntax

```bash
npx phd-cli next <session-id> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-id>` | Yes | UUID of the session to advance |

### Options

| Option | Description |
|--------|-------------|
| `--json` | Output result as JSON |
| `--verbose`, `-v` | Enable verbose output |
| `--prompt-only` | Output only the agent prompt |

### Examples

```bash
# Get next agent
npx phd-cli next a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Get next agent with JSON output
npx phd-cli next a1b2c3d4-e5f6-7890-abcd-ef1234567890 --json

# Get only the prompt for the next agent
npx phd-cli next a1b2c3d4-e5f6-7890-abcd-ef1234567890 --prompt-only
```

### Output (Standard)

```
=== NEXT AGENT ===

Agent: Step-Back Analyzer (step-back-analyzer)
Phase: 1 (Foundation)
Position: 2/46

--- PROMPT START ---
## YOUR TASK

[Agent prompt content...]

---

## WORKFLOW CONTEXT

Agent: Step-Back Analyzer (Agent #2/46)
Phase: Foundation (Phase 1/7)
Previous Agent: Self-Ask Decomposer (self-ask-decomposer)
Next Agent: Ambiguity Clarifier (ambiguity-clarifier)

[... rest of 5-part prompt ...]

--- PROMPT END ---

When complete, run:
  npx phd-cli complete a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Output (JSON)

```json
{
  "agent": {
    "key": "step-back-analyzer",
    "displayName": "Step-Back Analyzer",
    "phase": 1,
    "file": "step-back-analyzer.md"
  },
  "prompt": "## YOUR TASK...",
  "agentIndex": 1,
  "totalAgents": 46,
  "phase": {
    "id": 1,
    "name": "Foundation"
  },
  "isLastAgent": false
}
```

### Pipeline Complete Output

When all 46 agents are complete:

```
=== PIPELINE COMPLETE ===

All 46 agents have completed successfully!
Session: a1b2c3d4-e5f6-7890-abcd-ef1234567890

To generate the final dissertation, run:
  npx phd-cli finalize a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

## phd-cli complete

Mark the current agent as complete and advance to the next.

### Syntax

```bash
npx phd-cli complete <session-id> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-id>` | Yes | UUID of the session |

### Options

| Option | Description |
|--------|-------------|
| `--output <path>` | Path to agent output file (optional) |
| `--json` | Output result as JSON |
| `--verbose`, `-v` | Enable verbose output |

### Examples

```bash
# Mark current agent complete
npx phd-cli complete a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Complete with output file reference
npx phd-cli complete a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --output docs/research/my-topic/01-self-ask-decomposer.md

# Complete with JSON output
npx phd-cli complete a1b2c3d4-e5f6-7890-abcd-ef1234567890 --json
```

### Output (Standard)

```
Agent completed: self-ask-decomposer (1/46)

Next agent: step-back-analyzer (2/46)
Phase: 1 (Foundation)

To proceed, run:
  npx phd-cli next a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Output (JSON)

```json
{
  "completedAgent": "self-ask-decomposer",
  "completedIndex": 0,
  "nextAgent": {
    "key": "step-back-analyzer",
    "displayName": "Step-Back Analyzer",
    "phase": 1
  },
  "progress": {
    "completed": 1,
    "total": 46,
    "percentage": 2.17
  }
}
```

---

## phd-cli status

Get the current status of a session.

### Syntax

```bash
npx phd-cli status <session-id> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-id>` | Yes | UUID of the session |

### Options

| Option | Description |
|--------|-------------|
| `--json` | Output result as JSON |
| `--verbose`, `-v` | Show detailed status |

### Examples

```bash
# Get session status
npx phd-cli status a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Get status as JSON
npx phd-cli status a1b2c3d4-e5f6-7890-abcd-ef1234567890 --json
```

### Output (Standard)

```
=== SESSION STATUS ===

Session ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Topic: impact of AI on healthcare outcomes
Status: running

Progress:
  Phase: 2 (Literature)
  Agent: source-tier-classifier (8/46)
  Completed: 7/46 (15.2%)

Completed Agents:
  Phase 1: self-ask-decomposer, step-back-analyzer, ambiguity-clarifier,
           construct-definer, theoretical-framework-analyst, research-planner
  Phase 2: literature-mapper

Timestamps:
  Started: 2026-01-01T10:00:00Z
  Last Activity: 2026-01-01T12:30:00Z
```

### Output (JSON)

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "topic": "impact of AI on healthcare outcomes",
  "status": "running",
  "currentPhase": 2,
  "currentAgentIndex": 7,
  "currentAgent": {
    "key": "source-tier-classifier",
    "displayName": "Source Tier Classifier"
  },
  "progress": {
    "completed": 7,
    "total": 46,
    "percentage": 15.22
  },
  "completedAgents": [
    "self-ask-decomposer",
    "step-back-analyzer",
    "ambiguity-clarifier",
    "construct-definer",
    "theoretical-framework-analyst",
    "research-planner",
    "literature-mapper"
  ],
  "timestamps": {
    "startedAt": "2026-01-01T10:00:00Z",
    "lastActivityAt": "2026-01-01T12:30:00Z"
  }
}
```

---

## phd-cli list

List all PhD pipeline sessions.

### Syntax

```bash
npx phd-cli list [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--json` | Output result as JSON |
| `--status <status>` | Filter by status (active, complete, failed) |

### Examples

```bash
# List all sessions
npx phd-cli list

# List only active sessions
npx phd-cli list --status active

# List as JSON
npx phd-cli list --json
```

### Output (Standard)

```
=== PhD PIPELINE SESSIONS ===

SESSION ID                            STATUS    PROGRESS  TOPIC
a1b2c3d4-e5f6-7890-abcd-ef1234567890  running   15/46     impact of AI on healthcare...
b2c3d4e5-f6a7-8901-bcde-f23456789012  complete  46/46     machine learning in finance
c3d4e5f6-a7b8-9012-cdef-345678901234  paused    23/46     climate change policy...

Total: 3 sessions (1 running, 1 complete, 1 paused)
```

---

## phd-cli resume

Resume an interrupted session.

### Syntax

```bash
npx phd-cli resume <session-id> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-id>` | Yes | UUID of the session to resume |

### Options

| Option | Description |
|--------|-------------|
| `--json` | Output result as JSON |
| `--verbose`, `-v` | Enable verbose output |

### Examples

```bash
# Resume a paused session
npx phd-cli resume a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Output

```
Session resumed: a1b2c3d4-e5f6-7890-abcd-ef1234567890

Current position: 15/46
Current agent: adversarial-reviewer
Phase: 7 (Quality)

To continue, run:
  npx phd-cli next a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

## phd-cli abort

Abort a session (marks as failed).

### Syntax

```bash
npx phd-cli abort <session-id> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-id>` | Yes | UUID of the session to abort |

### Options

| Option | Description |
|--------|-------------|
| `--reason <reason>` | Reason for aborting |
| `--json` | Output result as JSON |

### Examples

```bash
# Abort a session
npx phd-cli abort a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Abort with reason
npx phd-cli abort a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --reason "Research direction changed"
```

---

## phd-cli validate-agents

Validate that all 46 agent files exist and are properly formatted.

### Syntax

```bash
npx phd-cli validate-agents [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--verbose`, `-v` | Show detailed validation results |
| `--json` | Output result as JSON |

### Examples

```bash
# Validate agents
npx phd-cli validate-agents

# Validate with verbose output
npx phd-cli validate-agents --verbose

# Validate with JSON output
npx phd-cli validate-agents --json
```

### Output (Standard)

```
=== AGENT VALIDATION ===

Agents Directory: .claude/agents/phdresearch/
Total Agents: 46
Found: 46
Missing: 0
Invalid: 0

Status: VALID
All 46 agent files found and valid.
```

### Output (Verbose)

```
=== AGENT VALIDATION (VERBOSE) ===

Agents Directory: .claude/agents/phdresearch/

Validating Phase 1 (Foundation):
  [OK] self-ask-decomposer.md (2.4 KB)
  [OK] step-back-analyzer.md (1.8 KB)
  [OK] ambiguity-clarifier.md (1.2 KB)
  [OK] construct-definer.md (1.5 KB)
  [OK] theoretical-framework-analyst.md (2.1 KB)
  [OK] research-planner.md (3.2 KB)

Validating Phase 2 (Literature):
  [OK] literature-mapper.md (2.0 KB)
  ...

[46/46 agents validated]

Status: VALID
```

### Output (JSON)

```json
{
  "valid": true,
  "totalAgents": 46,
  "foundAgents": 46,
  "missingAgents": [],
  "invalidAgents": [],
  "agentsDirectory": ".claude/agents/phdresearch",
  "errors": []
}
```

### Validation Errors

If validation fails:

```
=== AGENT VALIDATION ===

Agents Directory: .claude/agents/phdresearch/
Total Agents: 46
Found: 44
Missing: 2
Invalid: 0

MISSING AGENTS:
  - citation-validator (expected: citation-validator.md)
  - reproducibility-checker (expected: reproducibility-checker.md)

Status: INVALID
Fix: Create missing files in .claude/agents/phdresearch/
```

---

## phd-cli finalize

Run Phase 8 final assembly using the FinalStageOrchestrator.

### Syntax

```bash
npx phd-cli finalize <session-id> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-id>` | Yes | UUID of the completed session |

### Options

| Option | Description |
|--------|-------------|
| `--force` | Overwrite existing final output |
| `--dry-run` | Run mapping without generating output |
| `--threshold <n>` | Semantic similarity threshold (default: 0.30) |
| `--sequential` | Write chapters sequentially (slower but more stable) |
| `--skip-validation` | Skip final validation checks |
| `--verbose`, `-v` | Enable verbose output |
| `--json` | Output result as JSON |

### Examples

```bash
# Run final assembly
npx phd-cli finalize a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Dry run to check mapping
npx phd-cli finalize a1b2c3d4-e5f6-7890-abcd-ef1234567890 --dry-run

# Force overwrite existing output
npx phd-cli finalize a1b2c3d4-e5f6-7890-abcd-ef1234567890 --force

# With custom similarity threshold
npx phd-cli finalize a1b2c3d4-e5f6-7890-abcd-ef1234567890 --threshold 0.25
```

### Output (Standard)

```
=== PHASE 8: FINAL ASSEMBLY ===

Session: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Topic: impact of AI on healthcare outcomes

[INITIALIZING] Loading chapter structure...
[SCANNING] Found 45/46 output files
[SUMMARIZING] Extracting summaries from 45 files...
[MAPPING] Mapping sources to 8 chapters...
[WRITING] Writing Chapter 1: Introduction (4,523 words)
[WRITING] Writing Chapter 2: Literature Review (11,245 words)
...
[COMBINING] Generating table of contents...
[COMBINING] Combining chapters into final paper...
[VALIDATING] Running quality checks...
[COMPLETED] Final paper generated!

OUTPUT:
  Final Paper: docs/research/impact-of-ai-on-healthcare-outcomes/final/final-paper.md
  Chapters: docs/research/impact-of-ai-on-healthcare-outcomes/final/chapters/
  Metadata: docs/research/impact-of-ai-on-healthcare-outcomes/final/metadata.json

STATISTICS:
  Total Words: 52,345
  Total Citations: 312
  Chapters: 8
  Execution Time: 4m 23s
```

### Output (JSON)

```json
{
  "success": true,
  "dryRun": false,
  "outputPath": "docs/research/impact-of-ai-on-healthcare-outcomes/final/final-paper.md",
  "totalWords": 52345,
  "totalCitations": 312,
  "chaptersGenerated": 8,
  "warnings": [],
  "errors": [],
  "exitCode": 0
}
```

---

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Partial success (warnings present) |
| 2 | Research directory not found |
| 3 | Token budget exceeded |
| 4 | No sources found / mapping failed |
| 5 | Validation failed |
| 6 | Security violation |
| 7 | Constitution violation |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PHD_CLI_DEBUG` | Enable debug logging |
| `PHD_SESSIONS_DIR` | Custom sessions directory (default: `.phd-sessions`) |
| `PHD_AGENTS_DIR` | Custom agents directory (default: `.claude/agents/phdresearch`) |

### Example

```bash
# Enable debug mode
PHD_CLI_DEBUG=1 npx phd-cli next <session-id>
```

---

## Configuration Files

### Session Files

Location: `.phd-sessions/<session-id>.json`

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "query": "impact of AI on healthcare outcomes",
  "currentPhase": 2,
  "currentAgentIndex": 7,
  "completedAgents": ["self-ask-decomposer", "..."],
  "startTime": 1704067200000,
  "lastActivityTime": 1704076200000,
  "status": "active"
}
```

### Pipeline Configuration

Location: `src/god-agent/cli/phd-pipeline-config.ts`

Contains:
- `PHD_AGENTS`: Array of 46 agent configurations
- `PHD_PHASES`: Array of 7 phase definitions
- `DEFAULT_CONFIG`: Default pipeline settings
