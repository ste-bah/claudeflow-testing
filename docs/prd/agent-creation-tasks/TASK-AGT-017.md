# TASK-AGT-017: Periodic Health Monitoring + Anti-Loop Guards

```
Task ID:       TASK-AGT-017
Status:        BLOCKED
Implements:    REQ-LEARN-009, REQ-LEARN-010, REQ-LEARN-014
Depends On:    TASK-AGT-014 (post-task analysis)
Complexity:    Medium
Guardrails:    GR-009 (evolution requires user approval), GR-010 (max 1 evolution per invocation), GR-011 (counter reset post-evolution)
NFRs:          NFR-005 (cost — Haiku for LLM confirmation gate)
Security:      LOW — health monitoring is read-only analysis of quality counters. LLM confirmation gate is a single Haiku call with no tool access. No file modifications without user approval.
```

## Context

Periodic health monitoring is Trigger 3 from OpenSpace's three-trigger cascade. Every 5 invocations of any agent, the system checks quality metrics against thresholds and flags underperformers for evolution. This catches statistical trends that individual post-task analyses might miss — an agent could have plausible-looking individual analyses but still show a pattern of degradation over time.

Before triggering evolution from periodic monitoring (or the tool degradation trigger), the system runs an LLM confirmation gate — a brief Haiku call that reviews the evidence and confirms the evolution is warranted. This prevents false-positive triggers from wasting user review time.

This task also consolidates all anti-loop guards and defines the tool quality tracking schema (COULD priority — schema defined but implementation may be deferred).

## Scope

### In Scope
- Health check utility invoked every 5 invocations (modular, attached to meta.json Write 1)
- Three health thresholds with minimum selection requirement
- LLM confirmation gate (Haiku prompt-in/JSON-out)
- Anti-loop guard consolidation (max 1 per invocation, counter reset, addressed-degradations tracking)
- Tool quality tracking schema (COULD priority — define schema, stub implementation)
- User notification for flagged agents
- Integration with evolution pipeline (TASK-AGT-015)

### Out of Scope
- Evolution execution (TASK-AGT-015 handles actual FIX/DERIVED/CAPTURED)
- `/evolve-agent` skill (TASK-AGT-018)
- Full tool quality tracking implementation (COULD priority — schema only in this task)

## Key Design Decisions

1. **Health check fires at invocation 5, 10, 15, etc.**: The check runs when `invocation_count % 5 == 0` during the Write 1 phase of `/run-agent`. It is a lightweight computation (read meta.json counters, compare to thresholds) that adds negligible latency.

2. **Three independent thresholds**: Any single threshold breach flags the agent. Multiple breaches result in a single flag (not multiple). The thresholds are:
   - `fallback_rate > 0.40` (40%+ of invocations fail)
   - `completion_rate < 0.35` (fewer than 35% succeed)
   - `effective_rate < 0.55` (fewer than 55% end-to-end success)

3. **Minimum selection guard**: All thresholds require `total_selections >= 5`. This prevents flagging agents that have been evolved recently (counter reset → 0 selections → skip). Combined with the counter reset anti-loop, this means at least 5 fresh invocations must accumulate before re-evaluation.

4. **LLM confirmation gate for Triggers 2 and 3 ONLY**: Post-task analysis (Trigger 1) already has full execution context and produces specific suggestions. Triggers 2 (tool degradation) and 3 (periodic metrics) are statistical — they benefit from an LLM sanity check before bothering the user.

5. **User notification, not automatic evolution**: Health monitoring flags agents and notifies the user. It does NOT automatically execute evolution. The user can then run `/evolve-agent` or ignore the flag.

## Detailed Specifications

### Health Check Trigger Logic

```
# Runs during /run-agent, after Write 1 (TASK-AGT-013) completes

def check_agent_health(meta: dict) -> Optional[str]:
    """Check if agent health warrants evolution.
    Returns a notification message if flagged, None otherwise."""

    invocation_count = meta["invocation_count"]

    # Only check every 5 invocations
    if invocation_count % 5 != 0:
        return None

    quality = meta["quality"]
    total_selections = quality["total_selections"]

    # Minimum selection guard
    if total_selections < 5:
        return None

    # Check thresholds
    flags = []

    if quality["fallback_rate"] > 0.40:
        flags.append(f"fallback_rate={quality['fallback_rate']:.0%} (threshold: >40%)")

    if quality["completion_rate"] < 0.35:
        flags.append(f"completion_rate={quality['completion_rate']:.0%} (threshold: <35%)")

    if quality["effective_rate"] < 0.55:
        flags.append(f"effective_rate={quality['effective_rate']:.0%} (threshold: <55%)")

    if not flags:
        return None

    return flags
```

### Health Notification to User

When flags are detected, the orchestrator displays:

```
---
Agent Health Alert: '{agent_name}' has been underperforming.

Metrics (over {total_selections} invocations):
- {flag_1}
- {flag_2}

Options:
1. Run /evolve-agent {agent_name} to review and apply evolution suggestions
2. Manually edit the agent definition files
3. Archive with /archive-agent {agent_name} and recreate
4. Ignore (the agent will be re-evaluated after 5 more invocations)
---
```

Special case (EC-LEARN-008): If `total_completions == 0` (agent has NEVER succeeded):

```
---
Agent Health Alert: '{agent_name}' has never succeeded (0/{total_selections}).

This agent has failed every invocation since its last evolution (or creation).
Consider:
(a) /evolve-agent {agent_name} — review analyses and try FIX evolution
(b) Delete and recreate — the current definition may be fundamentally flawed
(c) Manually edit — open .claude/agents/custom/{agent_name}/ and revise
---
```

### LLM Confirmation Gate

Before presenting a health-monitoring-triggered or tool-degradation-triggered evolution suggestion to the user, the system asks Haiku to confirm it is warranted.

**Confirmation gate prompt:**

System prompt:

```
You are a quality assurance reviewer for AI agent evolution. You decide whether a proposed evolution action is warranted based on the evidence.

Respond with ONLY valid JSON: {"confirmed": true/false, "reason": "brief explanation"}
```

User message:

```
## Agent: {agent_name}
## Current Definition Summary:
Role: {first 200 chars of agent.md}
Context: {first 500 chars of context.md}

## Quality Metrics:
Total invocations: {total_selections}
Completion rate: {completion_rate}
Fallback rate: {fallback_rate}
Effective rate: {effective_rate}

## Trigger: {trigger_type}
{trigger_details}

## Proposed Action: {evolution_type} evolution
Direction: {direction}

## Recent Analysis History (last 3):
{analysis_summaries}

## Question: Is this evolution warranted, or are the metrics misleading?
Consider:
- Could the failures be due to bad task descriptions rather than agent issues?
- Is the sample size (total_selections) large enough to draw conclusions?
- Are the recent analyses consistent in identifying the same issue?
```

**Response schema:**

```json
{
  "confirmed": true,
  "reason": "Agent has consistent EDGAR API failures across 8 invocations with the same root cause identified in 3 analyses."
}
```

**Gate behavior:**
```
IF confirmed == true:
  Present evolution suggestion to user (normal flow)
IF confirmed == false:
  Log to MemoryGraph: {"type": "evolution_gate_rejected", "agent_name": "...",
    "reason": "...", "trigger": "...", "timestamp": "..."}
  Do NOT notify user about this specific suggestion
  Log (debug): "LLM gate rejected evolution for {agent_name}: {reason}"
```

**Gate scope:**
- Applies to: Trigger 2 (tool degradation) and Trigger 3 (periodic health monitoring)
- Does NOT apply to: Trigger 1 (post-task analysis) — already has full context
- Does NOT apply to: User-initiated `/evolve-agent` — user already decided to review

### Anti-Loop Guards (Consolidated)

**Guard 1: Max 1 evolution per invocation** (from TASK-AGT-015, consolidated here for reference)

```
Per-invocation flag: _evolution_applied = False

Before any evolution execution:
  IF _evolution_applied:
    Queue suggestion in MemoryGraph (tag: "queued-evolution")
    RETURN "queued"
  Execute evolution
  IF approved and applied:
    _evolution_applied = True
```

**Guard 2: Quality counter reset post-evolution** (from TASK-AGT-015, consolidated here)

```
After ANY evolution is applied:
  meta.quality = {
    total_selections: 0,
    total_completions: 0,
    total_fallbacks: 0,
    applied_rate: 1.0,
    completion_rate: 0.0,
    effective_rate: 0.0,
    fallback_rate: 0.0
  }
```

This means `total_selections < 5` → health check skipped → minimum 5 fresh invocations required.

**Guard 3: LLM confirmation gate** (this task)

Prevents false-positive triggers from Triggers 2 and 3. See above.

**Guard 4: Addressed-degradations tracking** (for Trigger 2, tool degradation)

```
# In-memory (session-level) tracking
addressed_degradations: dict[str, set[str]] = {}
# key: tool_name, value: set of agent names already evolved for this tool's degradation

Before proposing tool-degradation-triggered evolution:
  IF agent_name in addressed_degradations.get(tool_name, set()):
    Skip — already addressed this agent for this tool issue
    RETURN

After evolution applied:
  addressed_degradations.setdefault(tool_name, set()).add(agent_name)

On tool recovery (success rate returns above threshold):
  del addressed_degradations[tool_name]
  # Allows re-evaluation if tool degrades again
```

### Tool Quality Tracking Schema (COULD Priority)

This section defines the schema for tracking dynamic tool health. Full implementation is deferred (COULD priority per REQ-LEARN-010), but the schema is defined here for forward compatibility.

**Tool quality record (MemoryGraph):**

```json
{
  "name": "tool_quality_{tool_name}",
  "type": "tool_quality",
  "metadata": {
    "tool_name": "calculate_risk_score",
    "total_calls": 50,
    "total_successes": 42,
    "total_failures": 8,
    "recent_success_rate": 0.75,
    "recent_window_size": 20,
    "llm_flagged_count": 2,
    "quality_score": 0.78,
    "dependent_agents": ["sec-filing-analyzer", "risk-report-writer"],
    "last_updated": "2026-03-30T14:30:00Z"
  },
  "tags": ["tool-quality", "calculate_risk_score"]
}
```

**Degradation threshold**: `recent_success_rate < 0.60` (60%) with `total_calls >= 10`

**Trigger 2 flow (when implemented):**
```
1. After any dynamic tool call completes, update tool quality record
2. If recent_success_rate drops below 0.60:
   a. Identify dependent agents (from dependent_agents field)
   b. For each dependent agent NOT in addressed_degradations:
      - Run LLM confirmation gate
      - If confirmed: propose FIX evolution targeting tools.md
3. If recent_success_rate recovers above 0.60:
   - Clear addressed_degradations for this tool
```

**Stub implementation for this task**: Record the schema in a constants file. Hook into the tool factory's execution path with a no-op logger that writes a debug message: "Tool quality tracking: {tool_name} call {success|failure} (tracking not yet active)". This ensures the integration point exists for future implementation.

### Integration with /run-agent Flow

The health check slots into the existing `/run-agent` flow:

```
1. Task tool invocation → output displayed
2. Execution recording + Write 1 (TASK-AGT-013)
3. Health check (THIS TASK):
   - IF invocation_count % 5 == 0 AND total_selections >= 5:
     - Evaluate thresholds
     - IF flagged: display health notification
4. Post-task analysis (TASK-AGT-014)
5. Evolution execution if suggestions exist (TASK-AGT-015)
```

The health check runs BETWEEN Write 1 and analysis. This is intentional — it uses the freshly-updated counters from Write 1, and its notification is displayed before the analysis runs (so the user sees the health alert while analysis is processing).

## Files to Create

None (all logic integrates into existing skill)

## Files to Modify

- `.claude/skills/run-agent.md` — Add health check section after Write 1, before analysis

## Validation Criteria

### Unit Tests

- [ ] **Health check fires at invocation 5**: Simulate 5 invocations with 3 failures → health check runs at invocation 5
- [ ] **Health check fires at invocation 10**: Simulate 10 invocations → check runs at 10
- [ ] **Health check fires at invocation 15**: Simulate 15 invocations → check runs at 15
- [ ] **Health check skipped at invocation 4**: No check at invocation 4
- [ ] **Health check skipped at invocation 6**: No check at invocation 6
- [ ] **Minimum selection guard**: total_selections=3 at invocation 5 → no flags (post-evolution scenario)
- [ ] **Fallback rate threshold**: fallback_rate=0.41 → flagged; fallback_rate=0.40 → NOT flagged (strictly >)
- [ ] **Completion rate threshold**: completion_rate=0.34 → flagged; completion_rate=0.35 → NOT flagged (strictly <)
- [ ] **Effective rate threshold**: effective_rate=0.54 → flagged; effective_rate=0.55 → NOT flagged (strictly <)
- [ ] **Multiple flags combined**: Agent with all 3 thresholds breached gets a single notification with all flags listed
- [ ] **Zero success special case**: total_completions=0, total_selections=5 → "never succeeded" message (EC-LEARN-008)
- [ ] **LLM gate confirms**: Haiku returns `confirmed: true` → suggestion presented to user
- [ ] **LLM gate rejects**: Haiku returns `confirmed: false` → suggestion suppressed, rejection logged in MemoryGraph
- [ ] **LLM gate JSON parse failure**: If Haiku returns invalid JSON → default to confirmed=true (fail-open to avoid suppressing valid suggestions)
- [ ] **LLM gate not applied to Trigger 1**: Post-task analysis suggestions bypass the gate
- [ ] **Anti-loop: second evolution blocked**: First suggestion applied → second queued (inherits from TASK-AGT-015)
- [ ] **Anti-loop: counter reset verified**: After evolution, total_selections=0 → next health check at invocation 5 post-evolution skipped (total_selections < 5)
- [ ] **Addressed-degradations tracking**: Same tool+agent pair not re-triggered after evolution
- [ ] **Addressed-degradations cleared on recovery**: Tool success rate recovers → tracking cleared → re-evaluation possible
- [ ] **Tool quality schema stored**: Tool quality MemoryGraph record matches defined schema

### Sherlock Gates

- [ ] **OPERATIONAL READINESS**: Run agent 5 times with 3+ failures → health notification displayed
- [ ] **OPERATIONAL READINESS**: Health notification includes specific metric values and thresholds
- [ ] **THRESHOLD PARITY**: All thresholds match REQ-LEARN-009 exactly (40%, 35%, 55%, min 5)
- [ ] **GATE PARITY**: LLM gate applies only to Trigger 2/3, not Trigger 1, per REQ-LEARN-014
- [ ] **COST CHECK**: LLM gate uses Haiku model

### Live Smoke Test

- [ ] Create deliberately weak agent (e.g., agent that always fails at its task)
- [ ] Run 5 times → verify health alert appears with correct metrics
- [ ] Verify the alert message lists the specific thresholds breached
- [ ] Run `/evolve-agent` to address the issue (if suggestions exist)
- [ ] Run 5 more times → verify counter reset prevents immediate re-flagging
- [ ] After 5 fresh invocations post-evolution → verify health check re-evaluates

## Test Commands

```bash
# Manual test flow:
# 1. Create weak agent
/create-agent "An agent that always claims it cannot complete the task"

# 2. Run 5 times to trigger health check
/run-agent always-fails-agent "Do task 1"
/run-agent always-fails-agent "Do task 2"
/run-agent always-fails-agent "Do task 3"
/run-agent always-fails-agent "Do task 4"
/run-agent always-fails-agent "Do task 5"
# Expect: health alert after invocation 5

# 3. Check meta.json
cat .claude/agents/custom/always-fails-agent/meta.json | python3 -m json.tool
# Verify quality.fallback_rate > 0.40

# 4. If evolution applied, run 5 more times
# Verify health check does NOT fire immediately (counter reset)
```
