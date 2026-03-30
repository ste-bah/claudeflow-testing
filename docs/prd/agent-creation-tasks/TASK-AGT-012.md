# TASK-AGT-012: `/list-agents` + `/archive-agent` + `/restore-agent`

```
Task ID:       TASK-AGT-012
Status:        BLOCKED
Implements:    REQ-LIST-001, REQ-LIST-002, REQ-ARCHIVE-001, REQ-ARCHIVE-002
Depends On:    TASK-AGT-001 (agent definition format)
Complexity:    Low
Guardrails:    GR-006 (/run-agent confirmation — relevant if archiving a running agent)
NFRs:          NFR-002 (usability — single command), NFR-006 (MemoryGraph resilience)
Security:      Low risk — read-only listing + directory move operations. Verify /list-agents does not expose sensitive metadata (e.g., MemoryGraph keys) without --verbose flag.
```

## Context

As users create agents over time, they need lifecycle management to keep the agent library organized. This task implements three skills:

1. **`/list-agents`** — Show all custom agents with metadata (REQ-LIST-001, REQ-LIST-002)
2. **`/archive-agent`** — Move an agent to the archived directory (REQ-ARCHIVE-001)
3. **`/restore-agent`** — Move an archived agent back to custom/ (REQ-ARCHIVE-002)

These are straightforward file system + MemoryGraph operations with no LLM involvement.

## Scope

### In Scope
- `.claude/skills/list-agents.md` skill file
- `.claude/skills/archive-agent.md` skill file (handles both archive and restore)
- Table output format for /list-agents
- `--verbose` flag: show first 3 lines of agent.md
- `--all` flag: include archived agents
- Archive: move directory + update MemoryGraph
- Restore: move directory back + update MemoryGraph
- Edge cases: 0 agents, corrupted agent, archive while running

### Out of Scope
- `/edit-agent` (out of scope per PRD Section 6)
- Agent deletion (destructive — not supported; use archive instead)
- Agent export/import/sharing
- Agent statistics or analytics beyond what meta.json provides

## Key Design Decisions

1. **Two skill files, not three**: `/archive-agent` and `/restore-agent` share a single skill file (`archive-agent.md`) since the logic is symmetric. The skill file handles both subcommands.
2. **Archive is a directory move, not a copy**: `.claude/agents/custom/{name}/` moves to `.claude/agents/archived/{name}/`. No duplication. Restore moves it back.
3. **MemoryGraph marks as archived**: The agent definition memory in MemoryGraph gets an `archived: true` tag added. On restore, the tag is removed. This allows `/list-agents` to query MemoryGraph for active agents without scanning the file system.
4. **Corrupted agents shown with warning**: If an agent directory exists but has no agent.md, `/list-agents` shows it with an `[INVALID]` flag rather than silently hiding it.

## Detailed Specifications

### Skill File: `.claude/skills/list-agents.md`

```yaml
---
name: list-agents
description: List all custom agents with metadata. Use --verbose for role summaries, --all to include archived.
arguments:
  - name: flags
    description: "--verbose (show role summary), --all (include archived agents)"
    required: false
---
```

### `/list-agents` Output Format

**Standard output (no flags):**

```
## Custom Agents

| # | Name                  | Created    | Last Used  | Invocations | Files | Status |
|---|-----------------------|------------|------------|-------------|-------|--------|
| 1 | sec-filing-analyzer   | 2026-03-30 | 2026-03-30 | 15          | 5     | active |
| 2 | code-reviewer         | 2026-03-28 | 2026-03-29 | 8           | 4     | active |
| 3 | doc-writer            | 2026-03-25 | 2026-03-25 | 2           | 3     | active |
| 4 | broken-agent          | 2026-03-20 | —          | 0           | 1     | [INVALID: missing agent.md] |

4 agents found (3 active, 1 invalid).
```

**Verbose output (`--verbose`):**

```
## Custom Agents

### 1. sec-filing-analyzer
Created: 2026-03-30 | Last Used: 2026-03-30 | Invocations: 15 | Files: 5
> You are a specialized SEC filing analyst. Your primary role is to analyze
> 10-K and 10-Q filings for revenue recognition risks, going concern
> warnings, and material weaknesses in internal controls.

### 2. code-reviewer
Created: 2026-03-28 | Last Used: 2026-03-29 | Invocations: 8 | Files: 4
> You are a code reviewer with deep expertise in TypeScript and Python.
> Focus on correctness, security vulnerabilities, and adherence to the
> project's established patterns.

### 3. doc-writer
Created: 2026-03-25 | Last Used: 2026-03-25 | Invocations: 2 | Files: 3
> You are a technical documentation writer. Generate clear, structured
> documentation from project source code, README patterns, and inline
> comments.

### 4. broken-agent [INVALID: missing agent.md]
Created: 2026-03-20 | Last Used: — | Invocations: 0 | Files: 1
> (agent.md not found — cannot display role summary)

4 agents found (3 active, 1 invalid).
```

**With `--all` (includes archived):**

```
## Custom Agents

| # | Name                  | Created    | Last Used  | Invocations | Files | Status   |
|---|-----------------------|------------|------------|-------------|-------|----------|
| 1 | sec-filing-analyzer   | 2026-03-30 | 2026-03-30 | 15          | 5     | active   |
| 2 | code-reviewer         | 2026-03-28 | 2026-03-29 | 8           | 4     | active   |
| 3 | doc-writer            | 2026-03-25 | 2026-03-25 | 2           | 3     | active   |
| 4 | old-research-agent    | 2026-03-15 | 2026-03-18 | 5           | 4     | archived |

4 agents found (3 active, 1 archived).
To restore an archived agent: /archive-agent restore {name}
```

### `/list-agents` Algorithm

```
FUNCTION list_agents(verbose: bool, show_all: bool) -> str:

  STEP 1: SCAN ACTIVE AGENTS
    active_dir = ".claude/agents/custom/"
    active_agents = []
    FOR dir IN list_subdirectories(active_dir):
      IF dir.name.startswith("_"):
        CONTINUE  # skip _template and other underscore-prefixed dirs
      agent = load_agent_metadata(dir)
      active_agents.append(agent)

  STEP 2: SCAN ARCHIVED AGENTS (if --all)
    archived_agents = []
    IF show_all:
      archived_dir = ".claude/agents/archived/"
      IF archived_dir exists:
        FOR dir IN list_subdirectories(archived_dir):
          agent = load_agent_metadata(dir)
          agent.status = "archived"
          archived_agents.append(agent)

  STEP 3: MERGE AND SORT
    all_agents = active_agents + archived_agents
    all_agents.sort(key=lambda a: a.last_used or a.created, reverse=True)
    # Most recently used first

  STEP 4: CHECK FOR ZERO AGENTS
    IF len(all_agents) == 0:
      RETURN "No custom agents found. Create one with /create-agent."

  STEP 5: FORMAT OUTPUT
    IF verbose:
      format_verbose(all_agents)
    ELSE:
      format_table(all_agents)

  STEP 6: SUMMARY LINE
    n_active = count(a for a in all_agents if a.status == "active")
    n_archived = count(a for a in all_agents if a.status == "archived")
    n_invalid = count(a for a in all_agents if a.status == "invalid")
    parts = []
    IF n_active: parts.append(f"{n_active} active")
    IF n_archived: parts.append(f"{n_archived} archived")
    IF n_invalid: parts.append(f"{n_invalid} invalid")
    RETURN f"{len(all_agents)} agents found ({', '.join(parts)})."


FUNCTION load_agent_metadata(agent_dir: Path) -> AgentListEntry:
  """Load metadata for a single agent directory."""
  name = agent_dir.name
  has_agent_md = (agent_dir / "agent.md").exists()

  IF NOT has_agent_md:
    RETURN AgentListEntry(
      name=name,
      created="—",
      last_used="—",
      invocation_count=0,
      file_count=count_files(agent_dir),
      status="invalid",
      status_detail="missing agent.md",
      role_summary=None
    )

  # Read meta.json for dates and counts
  meta_path = agent_dir / "meta.json"
  IF meta_path.exists():
    TRY:
      meta = json.load(meta_path)
      created = meta.get("created", "—")
      last_used = meta.get("last_used", "—")
      invocation_count = meta.get("invocation_count", 0)
    CATCH JSONDecodeError:
      created = "—"
      last_used = "—"
      invocation_count = 0
  ELSE:
    # Fallback to file system dates
    created = format_date(agent_dir.stat().st_ctime)
    last_used = "—"
    invocation_count = 0

  # Count definition files
  file_count = count_files(agent_dir)  # count .md, .json files only

  # Role summary (for --verbose)
  role_summary = None
  TRY:
    agent_md_text = read_file(agent_dir / "agent.md")
    lines = agent_md_text.strip().split('\n')
    # Skip markdown headers (lines starting with #)
    content_lines = [l for l in lines if not l.startswith('#') and l.strip()]
    role_summary = '\n'.join(content_lines[:3])  # first 3 non-header lines
  CATCH:
    role_summary = "(unable to read agent.md)"

  RETURN AgentListEntry(
    name=name,
    created=format_date_short(created),
    last_used=format_date_short(last_used),
    invocation_count=invocation_count,
    file_count=file_count,
    status="active",
    status_detail=None,
    role_summary=role_summary
  )
```

### Skill File: `.claude/skills/archive-agent.md`

```yaml
---
name: archive-agent
description: Archive or restore a custom agent. Use 'archive' (default) or 'restore' subcommand.
arguments:
  - name: subcommand
    description: "'archive' (default) or 'restore'"
    required: false
    default: "archive"
  - name: agent_name
    description: "Name of the agent to archive or restore"
    required: true
---
```

### `/archive-agent` Algorithm

```
FUNCTION archive_agent(agent_name: str) -> str:

  STEP 1: VALIDATE
    source_dir = ".claude/agents/custom/{agent_name}/"
    IF NOT source_dir exists:
      ERROR: "Agent '{agent_name}' not found in custom agents."

  STEP 2: CHECK FOR RUNNING INVOCATION (EC-ARCHIVE-001)
    # Check if a Task tool subagent is currently running for this agent
    # Heuristic: check if meta.json last_used is within the last 60 seconds
    # (Approximation — Claude Code doesn't expose running subagent state)
    meta = read_json(source_dir + "meta.json")
    IF meta AND meta.last_used:
      last_used_ts = parse_iso(meta.last_used)
      IF (now - last_used_ts).seconds < 60:
        OUTPUT: "Agent '{agent_name}' may have a running invocation (last used {seconds}s ago). Archive anyway? (yes / no)"
        WAIT for confirmation. IF no: RETURN "Archive cancelled."

  STEP 3: CONFIRM
    file_count = count_files(source_dir)
    OUTPUT: "Archive agent '{agent_name}' ({file_count} files)? It will be moved to .claude/agents/archived/. (yes / no)"
    WAIT for confirmation. IF no: RETURN "Archive cancelled."

  STEP 4: MOVE DIRECTORY
    dest_dir = ".claude/agents/archived/{agent_name}/"
    IF dest_dir exists:
      ERROR: "Archived agent '{agent_name}' already exists. Remove or rename the existing archive first."
    mkdir -p ".claude/agents/archived/"
    mv source_dir dest_dir

  STEP 5: UPDATE MEMORYGRAPH
    TRY:
      # Search for the agent definition memory
      results = mcp__memorygraph__search_memories(
        query=f"agent_definition {agent_name}",
        type="general"
      )
      IF results:
        # Update tags to include "archived"
        memory = results[0]
        new_tags = list(set(memory.tags + ["archived"]))
        mcp__memorygraph__update_memory(
          name=memory.name,
          tags=new_tags,
          metadata={...memory.metadata, "archived": true, "archived_at": now_iso()}
        )
    CATCH MemoryGraphError:
      WARN: "MemoryGraph update failed. Agent archived locally but MemoryGraph not updated."

  STEP 6: CONFIRM
    RETURN "Agent '{agent_name}' archived. Restore with: /archive-agent restore {agent_name}"
```

### `/restore-agent` Algorithm (same skill file, subcommand "restore")

```
FUNCTION restore_agent(agent_name: str) -> str:

  STEP 1: VALIDATE
    source_dir = ".claude/agents/archived/{agent_name}/"
    IF NOT source_dir exists:
      ERROR: "Archived agent '{agent_name}' not found. Run /list-agents --all to see archived agents."

  STEP 2: CHECK FOR NAME COLLISION
    dest_dir = ".claude/agents/custom/{agent_name}/"
    IF dest_dir exists:
      ERROR: "Agent '{agent_name}' already exists in custom agents. Rename or archive the existing agent first."

  STEP 3: CONFIRM
    file_count = count_files(source_dir)
    OUTPUT: "Restore agent '{agent_name}' ({file_count} files) to active agents? (yes / no)"
    WAIT for confirmation. IF no: RETURN "Restore cancelled."

  STEP 4: MOVE DIRECTORY
    mv source_dir dest_dir

  STEP 5: UPDATE MEMORYGRAPH
    TRY:
      results = mcp__memorygraph__search_memories(
        query=f"agent_definition {agent_name}",
        type="general"
      )
      IF results:
        memory = results[0]
        new_tags = [t for t in memory.tags if t != "archived"]
        new_metadata = {k: v for k, v in memory.metadata.items() if k != "archived" and k != "archived_at"}
        mcp__memorygraph__update_memory(
          name=memory.name,
          tags=new_tags,
          metadata=new_metadata
        )
    CATCH MemoryGraphError:
      WARN: "MemoryGraph update failed. Agent restored locally but MemoryGraph not updated."

  STEP 6: CONFIRM
    RETURN "Agent '{agent_name}' restored to active agents."
```

### Date Formatting

```
FUNCTION format_date_short(iso_str: str) -> str:
  """Format ISO 8601 timestamp as YYYY-MM-DD for table display."""
  IF iso_str is None or iso_str == "—":
    RETURN "—"
  TRY:
    RETURN iso_str[:10]  # "2026-03-30T14:30:00Z" → "2026-03-30"
  CATCH:
    RETURN "—"
```

## Files to Create

- `.claude/skills/list-agents.md` — `/list-agents` skill with table/verbose output
- `.claude/skills/archive-agent.md` — `/archive-agent` and `/restore-agent` combined skill

## Files to Modify

- None

## Validation Criteria

### Unit Tests

**`/list-agents` tests:**
- [ ] **0 agents**: No directories in .claude/agents/custom/ (or only _template). Output: "No custom agents found. Create one with /create-agent."
- [ ] **1 agent**: Single agent with meta.json. Table shows 1 row with correct name, dates, invocation count.
- [ ] **5 agents**: Multiple agents sorted by last_used (most recent first). Table shows all 5.
- [ ] **Corrupted agent (missing agent.md)**: Agent directory exists but agent.md is missing. Status column shows "[INVALID: missing agent.md]".
- [ ] **Corrupted meta.json**: meta.json exists but contains invalid JSON. Agent still shown with "—" for dates and 0 for invocations.
- [ ] **No meta.json**: Agent has agent.md but no meta.json. Created date falls back to file system ctime. Invocation count shows 0.
- [ ] **--verbose output**: Shows first 3 non-header lines of agent.md as role summary for each agent.
- [ ] **--verbose with empty agent.md**: agent.md exists but is empty. Role summary shows "(empty agent.md)".
- [ ] **--all flag**: Shows both active and archived agents. Archived agents have status "archived".
- [ ] **--all with no archived**: No .claude/agents/archived/ directory. Shows active agents only, no error.
- [ ] **_template directory excluded**: .claude/agents/custom/_template/ exists. Not shown in listing.
- [ ] **Sort order**: Agent used today appears before agent used yesterday.

**`/archive-agent` tests:**
- [ ] **Archive existing agent**: Agent directory moved from custom/ to archived/. MemoryGraph updated with "archived" tag.
- [ ] **Archive non-existent agent**: Error: "Agent 'nonexistent' not found in custom agents."
- [ ] **Archive while potentially running (EC-ARCHIVE-001)**: meta.json last_used is 30 seconds ago. Warning shown. User confirms. Archive proceeds.
- [ ] **Archive when archived/ name already exists**: Error: "Archived agent already exists."
- [ ] **Archive with MemoryGraph unavailable**: Agent archived locally. Warning about MemoryGraph. No crash.
- [ ] **User cancels archive**: User says "no". No files moved.

**`/restore-agent` tests:**
- [ ] **Restore archived agent**: Agent moved from archived/ to custom/. MemoryGraph "archived" tag removed.
- [ ] **Restore non-existent archived agent**: Error: "Archived agent not found."
- [ ] **Restore when active name collision**: Agent with same name already in custom/. Error about collision.
- [ ] **Restore with MemoryGraph unavailable**: Agent restored locally. Warning. No crash.
- [ ] **Archive and restore roundtrip**: Create agent, archive it, verify gone from /list-agents, restore it, verify back in /list-agents with same metadata.

### Sherlock Gates

- [ ] **OPERATIONAL READINESS**: `/list-agents` works in a live Claude Code session with 0 agents and shows the "no agents" message
- [ ] **OPERATIONAL READINESS**: `/list-agents --verbose` shows role summaries for existing agents
- [ ] **OPERATIONAL READINESS**: `/archive-agent test-agent` moves the directory and `/restore-agent test-agent` moves it back
- [ ] **MEMORYGRAPH SYNC**: After archive, `mcp__memorygraph__search_memories` query for the agent includes "archived" tag. After restore, the tag is gone.
- [ ] **ROUNDTRIP INTEGRITY**: Create agent, invoke 3 times (invocation_count=3), archive, restore. Verify invocation_count is still 3 (meta.json preserved through archive/restore).

### Live Smoke Test

- [ ] Create 3 agents via `/create-agent`
- [ ] Run `/list-agents` — verify all 3 shown in table format
- [ ] Run `/list-agents --verbose` — verify role summaries visible
- [ ] Archive 1 agent: `/archive-agent {name}`
- [ ] Run `/list-agents` — verify only 2 agents shown
- [ ] Run `/list-agents --all` — verify all 3 shown, 1 marked as archived
- [ ] Restore the archived agent: `/archive-agent restore {name}`
- [ ] Run `/list-agents` — verify all 3 shown again as active
- [ ] Verify meta.json invocation count preserved through archive/restore cycle

## Test Commands

```bash
# These tests are manual — invoke in a Claude Code session

# Setup: Create test agents
/create-agent --name test-agent-1 --description "First test agent"
/create-agent --name test-agent-2 --description "Second test agent"
/create-agent --name test-agent-3 --description "Third test agent"

# List tests
/list-agents
/list-agents --verbose
/list-agents --all

# Archive test
/archive-agent test-agent-2

# Verify listing
/list-agents            # Should show 2 active
/list-agents --all      # Should show 3 (2 active, 1 archived)

# Restore test
/archive-agent restore test-agent-2

# Verify
/list-agents            # Should show 3 active again

# Edge case: archive non-existent
/archive-agent nonexistent-agent  # Should error

# Edge case: list with no agents (clean up first)
# rm -rf .claude/agents/custom/test-agent-*
# /list-agents  # Should show "No custom agents found"
```
