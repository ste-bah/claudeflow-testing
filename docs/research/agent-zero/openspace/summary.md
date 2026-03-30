# OpenSpace Research Summary

**Repository**: https://github.com/HKUDS/OpenSpace
**Authors**: HKUDS (Hong Kong University Data Science Lab)
**Language**: Python 3.12+
**License**: MIT
**Created**: 2026-03-24 (5 days old at time of research)
**Stars**: ~2,560
**Research Date**: 2026-03-29

---

## 1. Executive Summary

OpenSpace is a **self-evolving skill engine** that plugs into any AI coding agent (Claude Code, Codex, OpenClaw, nanobot, Cursor) via MCP (Model Context Protocol) and makes it learn from its own execution history. The core thesis: agents today are powerful but stateless -- they reason from scratch every time, repeat the same mistakes, and never share knowledge across sessions or agents.

OpenSpace solves this by treating **reusable task patterns ("skills") as living, versionable entities** that are automatically discovered, applied, monitored, analyzed, and evolved based on real execution outcomes. When a skill breaks, it fixes itself. When a new pattern emerges from a successful execution, it gets captured as a new skill. When one agent learns something, all connected agents gain access.

**Key results** (GDPVal benchmark, 50 professional tasks across 6 industries):
- 4.2x higher income vs baseline (same backbone LLM: Qwen 3.5-Plus)
- 46% fewer tokens in Phase 2 (warm rerun) vs Phase 1 (cold start)
- 70.8% average quality (+30pp above best baseline)
- 165 skills autonomously evolved across 50 tasks

The critical insight: **most evolved skills are not domain knowledge but execution resilience patterns** -- fallback chains, error recovery, file format handling, and quality verification workflows.

---

## 2. Architecture

### 2.1 System Components

```
OpenSpace (tool_layer.py)
  |
  +-- GroundingAgent (agents/grounding_agent.py)
  |     |-- LLM Client (reasoning engine)
  |     |-- GroundingClient (tool execution: shell, GUI, MCP, web)
  |     |-- RecordingManager (execution trace capture)
  |     +-- ToolQualityManager (tool health tracking)
  |
  +-- SkillRegistry (skill_engine/registry.py)
  |     |-- Discovery (filesystem scan, SKILL.md parsing)
  |     |-- SkillRanker (BM25 + embedding hybrid ranking)
  |     |-- LLM Selection (quality-weighted skill matching)
  |     +-- Safety Checker (prompt injection / credential filtering)
  |
  +-- ExecutionAnalyzer (skill_engine/analyzer.py)
  |     |-- Recording Artifact Loader
  |     |-- LLM Analysis Agent (with tool access for verification)
  |     +-- Quality Counter Updates
  |
  +-- SkillEvolver (skill_engine/evolver.py)
  |     |-- FIX Evolution (in-place repair)
  |     |-- DERIVED Evolution (enhanced variant)
  |     |-- CAPTURED Evolution (novel pattern extraction)
  |     +-- Anti-loop Guards
  |
  +-- SkillStore (skill_engine/store.py)
  |     +-- SQLite persistence (WAL mode, version DAG)
  |
  +-- Cloud Client (cloud/client.py)
        +-- Upload/Download/Search (community sharing)
```

### 2.2 Integration Model

OpenSpace plugs into host agents via **MCP server** (`mcp_server.py`) exposing exactly 4 tools:

1. **execute_task** -- Delegate a task with full skill lifecycle (select, execute, analyze, evolve)
2. **search_skills** -- Search local + cloud skill registry
3. **fix_skill** -- Manually trigger FIX evolution on a specific skill
4. **upload_skill** -- Publish a local skill to the cloud community

The host agent also receives two SKILL.md files that teach it when and how to delegate:
- `delegate-task/SKILL.md` -- Teaches: execute, fix, upload workflows
- `skill-discovery/SKILL.md` -- Teaches: search and discover skills

### 2.3 Two-Phase Execution Model

Every task runs through a two-phase strategy:

```
Phase 1 (Skill-Guided):
  - Match skills to task via BM25 + embedding + LLM selection
  - Inject matched skill content into agent system prompt
  - Execute with skill guidance
  - If success -> proceed to analysis
  - If failure -> clean workspace artifacts, enter Phase 2

Phase 2 (Tool-Only Fallback):
  - Execute from scratch with no skill context
  - Full iteration budget (not reduced by Phase 1 attempts)
  - Workspace cleaned of Phase 1 artifacts before starting
```

This design means **skills can only help, never hurt** -- a bad skill results in fallback to pure tool execution, and the failure feeds back into the evolution system to fix or deprecate the skill.

---

## 3. Self-Improvement Mechanism (Core Learning Loop)

This is the central innovation. The loop has 5 stages with 3 independent triggers.

### 3.1 The Main Loop (Per-Task)

```
TASK ARRIVES
    |
    v
[1. SKILL SELECTION] -- BM25+embedding pre-filter -> LLM picks 0-2 skills
    |                    (quality-weighted: high-fallback skills filtered out)
    v
[2. EXECUTION] -------- Agent runs task with skill guidance injected
    |                    (all tool calls, conversations recorded to JSONL)
    v
[3. ANALYSIS] --------- LLM reads full execution recording and produces:
    |                    - task_completed: bool
    |                    - skill_judgments: per-skill applied/not-applied + notes
    |                    - tool_issues: tools that malfunctioned
    |                    - evolution_suggestions: FIX/DERIVED/CAPTURED actions
    v
[4. EVOLUTION] -------- For each suggestion, an LLM agent loop:
    |                    - Reads skill content + execution context + codebase
    |                    - Produces targeted edits (SEARCH/REPLACE or full rewrite)
    |                    - Applies with retry (up to 3 attempts)
    |                    - Validates result, persists new version
    v
[5. QUALITY UPDATE] --- Counters updated atomically in SQLite:
                         total_selections++, total_applied++/total_fallbacks++,
                         total_completions++ (if task succeeded)
```

### 3.2 Three Evolution Triggers

**Trigger 1: Post-Execution Analysis (runs after EVERY task)**

The `ExecutionAnalyzer` loads the full execution recording (`conversations.jsonl`, `traj.jsonl`, `metadata.json`), builds an LLM prompt containing:
- Task description
- Skill content that was injected
- Truncated conversation history (up to 80K chars)
- Tool execution records with error details
- Quality stats for involved skills

The analysis LLM (which itself has tool access for verification) produces structured JSON with:
- Per-skill judgments: was the skill actually applied? What happened?
- Evolution suggestions: specific FIX/DERIVED/CAPTURED actions with direction

Key detail: the analyzer runs as an **agent loop** (up to 5 iterations) with tool access, so it can re-run commands or read files to verify its analysis -- it is not just a single LLM call.

**Trigger 2: Tool Degradation (runs when tool success rates drop)**

The `ToolQualityManager` tracks every tool call's success/failure/latency. When a tool's `recent_success_rate` drops below threshold, all skills that depend on that tool are identified via `skill_tool_deps` table and batch-evolved with FIX operations.

Anti-loop mechanism: `_addressed_degradations` dict tracks which skill+tool pairs have already been evolved. Entries are pruned when a tool recovers, so re-degradation triggers fresh evaluation.

**Trigger 3: Periodic Metric Monitor (every 5 executions)**

Scans all active skills for health indicators:
- High fallback rate (>40%)
- Low completion rate (<35%)
- Low effective rate (<55%)

Underperformers that meet minimum selection threshold (5+ selections) are candidates for evolution. The newly evolved skill starts with `total_selections=0`, requiring fresh data before re-evaluation -- this is the anti-loop guard.

### 3.3 Three Evolution Modes

**FIX** -- In-place repair of a broken skill:
- Same skill name and directory
- New `skill_id` and version in the DAG
- Old version marked `is_active=False`
- Previous content preserved in `content_snapshot`
- Example: "Fixed curl parameter format in step 3"

**DERIVED** -- Enhanced variant from 1+ parent skills:
- New skill directory alongside parent(s)
- Both old and new versions remain active (coexist)
- Supports multi-parent merge (combine 2+ skills into 1)
- Example: "Composed weather + geocoding guides into location-aware forecast workflow"

**CAPTURED** -- Brand new skill extracted from a successful execution:
- No parent skills (root node in version DAG)
- Pattern extracted from execution trace
- Example: "Captured PDF-to-DOCX conversion workflow with error recovery"

### 3.4 Evolution Agent Loop

Each evolution action runs as an LLM agent loop (not a single call):

```python
# From evolver.py
_MAX_EVOLUTION_ITERATIONS = 5   # Max tool-calling rounds
_MAX_EVOLUTION_ATTEMPTS = 3     # Max apply-retry attempts per evolution
```

The evolution LLM receives:
- Current skill content (up to 12K chars)
- Recent execution analyses (up to 5)
- Trigger context (tool degradation details, metric summary, etc.)
- Access to tools (file reading, shell, web search, MCP tools)

It then produces edits in one of three formats:
- **FULL**: Complete file rewrite
- **DIFF**: SEARCH/REPLACE blocks
- **PATCH**: Multi-file `*** Begin Patch` format

The patch system (`patch.py`) includes fuzzy matching for SEARCH blocks that don't exactly match the current content, with automatic retry on failure.

### 3.5 Concurrency Model

```python
# Semaphore limits parallel evolution LLM sessions
self._semaphore = asyncio.Semaphore(max_concurrent)  # default: 3
```

- Trigger 1 (post-analysis): runs inline, blocks until complete
- Triggers 2 and 3: launched as `asyncio.Task` background tasks
- All background tasks awaited on shutdown via `wait_background()`

---

## 4. Knowledge Representation

### 4.1 Skills as Files (SKILL.md Format)

Each skill is a directory containing:
```
skill-name/
  SKILL.md        -- YAML frontmatter (name, description) + Markdown body
  .skill_id       -- Persistent unique identifier sidecar
  [auxiliary.py]   -- Optional scripts, configs, examples
```

The SKILL.md body contains natural-language instructions that get injected into the agent's system prompt. This is the key design choice: **knowledge is stored as instructions, not as code or embeddings**.

Skill identity format:
- Imported: `{name}__imp_{uuid8}` (e.g., `weather__imp_a1b2c3d4`)
- Evolved: `{name}__v{generation}_{uuid8}` (e.g., `weather__v3_e5f6g7h8`)

### 4.2 SQLite Database (openspace.db)

Location: `<project_root>/.openspace/openspace.db`

**Tables:**

| Table | Purpose |
|-------|---------|
| `skill_records` | Full skill profiles: identity, lineage, category, visibility, quality counters |
| `skill_lineage_parents` | Many-to-many parent-child relationships (version DAG) |
| `execution_analyses` | One per task: completion status, notes, tool issues, evolution suggestions |
| `skill_judgments` | Per-skill assessments within each analysis |
| `skill_tool_deps` | Which tools each skill depends on (for Trigger 2) |
| `skill_tags` | Auxiliary classification tags |

Database architecture:
- **WAL mode** for concurrent read/write
- Persistent write connection with mutex lock
- Read-only connections per query (no read contention)
- Exponential backoff retry on transient errors
- WAL checkpoint on close for external tool compatibility

### 4.3 Version DAG

Every skill change creates a new `SkillRecord` node in a directed acyclic graph:

```
IMPORTED/CAPTURED --> root node (generation=0, no parents)
FIXED            --> parent.generation + 1 (single parent, same name)
DERIVED          --> max(parents.generation) + 1 (1+ parents, new name)
```

Each node stores:
- `content_snapshot`: Full directory snapshot as `{relative_path: content}` dict
- `content_diff`: Combined unified diff vs parent (empty for multi-parent DERIVED)
- `change_summary`: LLM-generated description of what changed

Only the latest version has `is_active=True`. Historical versions remain in the DB with full content snapshots, enabling lineage inspection and potential rollback.

### 4.4 Quality Metrics Per Skill

Tracked atomically in SQL:

| Metric | Meaning |
|--------|---------|
| `total_selections` | Times selected by LLM for a task |
| `total_applied` | Times actually used by the agent |
| `total_completions` | Times task succeeded when skill was applied |
| `total_fallbacks` | Times skill was not applied and task failed |

Derived rates:
- `applied_rate` = applied / selections
- `completion_rate` = completions / applied
- `effective_rate` = completions / selections (end-to-end)
- `fallback_rate` = fallbacks / selections

These metrics directly influence future skill selection: skills with high fallback rates are filtered out during LLM selection, and persistently failing skills trigger evolution.

### 4.5 Tool Quality Tracking

Separate from skill quality, the `ToolQualityManager` tracks every tool call:

| Field | Purpose |
|-------|---------|
| `total_calls` | Lifetime call count |
| `recent_success_rate` | Rolling window success ratio |
| `llm_flagged_count` | Times the analysis LLM flagged semantic issues |
| `quality_score` | Composite 0-1 score for ranking adjustment |

Tool quality feeds into skill evolution (Trigger 2) and tool ranking during search.

### 4.6 Skill Ranking (BM25 + Embedding Hybrid)

Two-stage retrieval when skill count exceeds threshold (default: 10):

```
Stage 1: BM25 rough-rank (lexical matching)
  - Tokenize query and skill text (name + description + body)
  - Return top_k * 3 candidates

Stage 2: Embedding re-rank (semantic matching)
  - Model: openai/text-embedding-3-small (via OpenRouter)
  - Cosine similarity against query embedding
  - Embeddings cached in pickle file for cross-session reuse
  - Return top_k results
```

Graceful fallback: no embedding API -> BM25-only; both fail -> return first N candidates.

---

## 5. Evaluation and Reward

### 5.1 Task Completion as Primary Signal

The system does NOT use numeric reward scores or reinforcement learning in the traditional sense. The primary feedback signal is binary: **did the task complete successfully?**

This is determined by the `ExecutionAnalyzer` LLM, which reads the full execution trace and judges:
1. `task_completed: bool` -- Overall success
2. Per-skill `skill_applied: bool` -- Whether each injected skill was actually used
3. `execution_note: str` -- Free-text observation about what happened

### 5.2 LLM-as-Judge Analysis

The analysis is not a simple heuristic. It runs as a multi-iteration agent loop with tool access:

```python
_MAX_CONVERSATION_CHARS = 80_000    # Execution trace context
_ANALYSIS_MAX_ITERATIONS = 5        # Max tool-calling rounds
_SKILL_CONTENT_MAX_CHARS = 8_000    # Per-skill content in prompt
```

The analysis LLM can:
- Re-run shell commands to verify outcomes
- Read files in the workspace
- Access MCP tools for investigation
- Cross-reference tool execution records with conversation flow

### 5.3 Evolution Suggestion as Reward Signal

Instead of a numeric reward, the analysis produces **actionable evolution suggestions**:

```python
@dataclass
class EvolutionSuggestion:
    evolution_type: EvolutionType    # FIX, DERIVED, or CAPTURED
    target_skill_ids: List[str]      # Which skill(s) to evolve
    category: Optional[SkillCategory]
    direction: str                   # Free-text: what to change
```

This is more informative than a scalar reward -- it tells the system exactly WHAT to change and HOW.

### 5.4 Cumulative Quality Metrics

Improvement is measured through the quality counters that accumulate over time:
- Rising `effective_rate` = skill is getting better
- Rising `fallback_rate` = skill is degrading
- `generation` counter = how many times a skill has been evolved

The GDPVal benchmark demonstrates improvement by running the same 50 tasks in two phases:
- Phase 1 (Cold Start): Skills accumulate as each task completes
- Phase 2 (Warm Rerun): Same tasks re-executed with the full evolved skill database
- Measured: quality score delta, token consumption delta, income delta

---

## 6. Key Techniques

### 6.1 Skills as Natural-Language Instructions (Not Code)

The most important design decision. Skills are Markdown files with instructions, not executable code or learned embeddings. This means:
- Skills are human-readable and editable
- Any LLM can understand and apply them
- Evolution produces diff-able, reviewable changes
- No training loop or gradient computation required

### 6.2 LLM-as-Evolver (Not RL)

Evolution is driven by LLM reasoning, not reinforcement learning:
- No policy gradient, no reward shaping, no experience replay
- The analysis LLM reads execution traces and reasons about what went wrong
- The evolution LLM reads the skill and analysis, then writes targeted edits
- This is closer to **self-debugging** than to RL

### 6.3 Three-Trigger Cascade

The system does not rely on a single feedback path:
1. Post-execution analysis catches task-specific issues (immediate)
2. Tool degradation catches infrastructure-level issues (periodic)
3. Metric monitoring catches statistical trends (periodic)

Each trigger has independent anti-loop guards to prevent runaway evolution.

### 6.4 LLM Confirmation Gates

Before executing evolution, the system asks the LLM to confirm the action is warranted:

```python
confirmed = await self._llm_confirm_evolution(
    skill_record=skill_record,
    skill_content=content,
    proposed_type=EvolutionType.FIX,
    proposed_direction=direction,
    trigger_context=f"Tool degradation: {issue_summary}",
    recent_analyses=recent,
)
```

This prevents false-positive triggers from wasting LLM calls on unnecessary evolution.

### 6.5 Fuzzy Patch Application

The `patch.py` module includes `fuzzy_find_match()` for SEARCH/REPLACE blocks where the SEARCH content does not exactly match the current file. This is critical because the evolution LLM may slightly misquote the original text.

### 6.6 Safety System

Skills are safety-checked during discovery:
- `check_skill_safety()` scans for prompt injection patterns
- `is_skill_safe()` returns False if dangerous patterns detected
- Blocked skills are never registered or injected

### 6.7 Edit Distance Correction for Skill IDs

LLMs frequently garble hex suffixes in skill IDs. The analyzer includes Levenshtein edit-distance correction:

```python
def _correct_skill_ids(ids, known_ids):
    # For each unknown ID, find closest known ID with same name prefix
    # and edit distance <= 3. Silently replace.
```

### 6.8 Cloud Skill Community

Skills can be shared across agents and users:
- Upload evolved skills to `open-space.cloud`
- Download community skills with one command
- Hybrid search (local BM25 + cloud embedding) across both registries
- Visibility: public, private, or team-only
- Full lineage tracking preserved across upload/download

---

## 7. Relevance to Our System

### 7.1 What OpenSpace Gets Right

1. **Skills as the unit of learning** -- Not weights, not embeddings, not code. Natural-language instructions that any LLM can read and apply. This is the right abstraction for systems where the "brain" is an LLM.

2. **Execution recording as the data source** -- The system learns from complete execution traces (tool calls, conversations, outcomes), not from cherry-picked examples.

3. **LLM-as-judge for evaluation** -- Binary task completion is a coarse signal. Having an LLM read the full trace and produce structured analysis with specific evolution suggestions is far more actionable than a scalar reward.

4. **Three independent evolution triggers** -- Redundancy in the feedback system means problems are caught even if one trigger misses them.

5. **Anti-loop guards** -- Each trigger has independent mechanisms to prevent runaway evolution cycles.

6. **Version DAG with full snapshots** -- Every evolution is tracked, diffable, and rollbackable. This is essential for trust in an autonomous learning system.

### 7.2 Limitations and Gaps

1. **No semantic memory or retrieval-augmented generation** -- Skills are matched by keyword/embedding, but there is no deeper semantic understanding of WHEN a skill applies (e.g., "this skill works for Python projects but not TypeScript").

2. **Binary evaluation** -- Task completion is binary. There is no quality gradient (how well did the task complete? 80% correct? 95% correct?). The GDPVal benchmark shows quality scores but those are external, not used by the evolution loop.

3. **No negative skill learning** -- The system can deprecate low-performing skills but does not explicitly learn "do NOT do X" patterns.

4. **LLM cost** -- Every analysis runs an LLM agent loop (up to 5 iterations). Every evolution runs another (up to 5 iterations with 3 retry attempts). This adds significant cost on top of the task execution itself.

5. **No multi-step planning** -- Skills are selected before execution and injected once. There is no mid-execution skill switching or progressive skill refinement during a task.

### 7.3 Applicability to Dynamic Agent Creation

For our system (dynamic agent spawning with learning), the most transferable ideas are:

- **Skill = reusable agent prompt template** -- Our subagent prompts could be treated as skills that evolve over time
- **Execution recording + LLM analysis** -- We already have execution traces; adding structured analysis is straightforward
- **Quality counters per skill/template** -- Track which prompt patterns lead to successful outcomes
- **Three-trigger evolution** -- Post-task analysis + tool degradation + periodic health check

The key difference: OpenSpace evolves skills for a SINGLE agent. We would need to evolve skills across MULTIPLE agent types in a pipeline, which introduces dependency tracking between skills.

---

## 8. Adaptable Patterns

### Pattern 1: Skill Lifecycle (Discovery -> Selection -> Injection -> Analysis -> Evolution)

```
Adaptable as: Agent Template Lifecycle
- Discovery: scan available agent prompt templates
- Selection: match templates to task type via BM25 + LLM
- Injection: use selected template as agent prompt
- Analysis: evaluate execution outcome and agent performance
- Evolution: fix/derive/capture improved templates
```

### Pattern 2: Quality Counter Schema

```sql
-- Directly adaptable for tracking agent template effectiveness
total_selections   INTEGER  -- Times this template was chosen
total_applied      INTEGER  -- Times agent actually followed the template
total_completions  INTEGER  -- Times task succeeded
total_fallbacks    INTEGER  -- Times template failed and fallback was used
```

Derived metrics (`applied_rate`, `completion_rate`, `effective_rate`, `fallback_rate`) can drive automatic template selection and deprecation.

### Pattern 3: Three-Trigger Evolution

```
Trigger 1: Post-task analysis (immediate, per-task)
  -> "This agent template failed because step 3 assumed Python but project uses TypeScript"
  -> FIX: update step 3 to detect language first

Trigger 2: Tool/infrastructure degradation (periodic)
  -> "The git tool has been failing 60% of the time"
  -> FIX: all templates that use git get updated with retry logic

Trigger 3: Statistical health check (periodic, every N tasks)
  -> "Template X has been selected 20 times but only succeeded 4 times"
  -> DERIVE: create a specialized variant or DEPRECATE
```

### Pattern 4: Version DAG with Content Snapshots

```
Every template change creates a new record:
- content_snapshot: full template text at this version
- content_diff: unified diff vs parent
- change_summary: LLM-generated description
- parent_ids: link to previous version(s)
- generation: distance from original

Benefits:
- Full audit trail of how templates evolved
- Rollback if an evolution makes things worse
- Diffable history for human review
```

### Pattern 5: LLM-as-Judge Analysis Schema

```python
@dataclass
class ExecutionAnalysis:
    task_id: str
    task_completed: bool
    execution_note: str           # What happened
    skill_judgments: List[...]     # Per-template: applied? how?
    tool_issues: List[str]        # Infrastructure problems
    evolution_suggestions: List[...] # Specific actions to take
```

This schema is directly usable. The key insight is that the analysis produces ACTIONABLE SUGGESTIONS, not just a score.

### Pattern 6: Two-Phase Execution (Skill-First, Tool-Fallback)

```
Phase 1: Try with learned template
  - If success: record success, analyze for improvements
  - If failure: clean up, enter Phase 2

Phase 2: Try without template (pure reasoning)
  - Record outcome regardless
  - If success: CAPTURE the successful approach as a new template
```

This ensures learned knowledge can only help, never hurt. A bad template degrades to baseline, not worse.

### Pattern 7: Anti-Loop Guards

```python
# Per-trigger state tracking
_addressed_degradations: Dict[str, Set[str]]  # tool_key -> {evolved_skill_ids}
# Data-driven guard for metrics
min_selections = 5  # New skill needs 5 uses before re-evaluation
# LLM confirmation gate
confirmed = await _llm_confirm_evolution(...)  # Ask before acting
```

Essential for any autonomous learning system to prevent:
- Evolving the same skill repeatedly for the same issue
- Evolving a newly-created skill before it has data
- Acting on false-positive statistical signals

### Pattern 8: Diff-Based Evolution (Not Full Rewrite)

The `patch.py` module supports three edit formats:
- SEARCH/REPLACE blocks (minimal changes)
- Multi-file patch format
- Full rewrite (when changes are too extensive)

With automatic format detection and fuzzy matching for imprecise SEARCH blocks. This is token-efficient (46% savings demonstrated) and produces reviewable diffs.

---

## Appendix: Key Source Files

| File | Role |
|------|------|
| `openspace/tool_layer.py` | Main orchestrator (`OpenSpace` class), execute loop, skill integration |
| `openspace/skill_engine/registry.py` | Skill discovery, BM25+LLM selection, safety checking |
| `openspace/skill_engine/analyzer.py` | Post-execution LLM analysis, quality counter updates |
| `openspace/skill_engine/evolver.py` | Three-trigger evolution, LLM agent loops, anti-loop guards |
| `openspace/skill_engine/store.py` | SQLite persistence, version DAG, atomic counter updates |
| `openspace/skill_engine/types.py` | Data structures: SkillRecord, ExecutionAnalysis, EvolutionSuggestion, SkillLineage |
| `openspace/skill_engine/patch.py` | Multi-format patch application (FULL/DIFF/PATCH), fuzzy matching |
| `openspace/skill_engine/skill_ranker.py` | BM25 + embedding hybrid ranking |
| `openspace/grounding/core/quality/manager.py` | Tool quality tracking, degradation detection |
| `openspace/mcp_server.py` | MCP interface (4 tools exposed to host agents) |
| `openspace/agents/grounding_agent.py` | Task execution agent with skill context injection |
