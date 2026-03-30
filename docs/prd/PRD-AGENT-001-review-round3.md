# PRD-AGENT-001 Review: Round 3 (Adversarial)

**Reviewer**: Code Review Agent (Opus 4.6)
**Date**: 2026-03-30
**PRD Version Reviewed**: 3.0.0
**Round 2 Issues**: 7 (0 critical, 0 high, 2 medium, 5 low)
**Round 3 Focus**: Feature 7 (Agent Self-Improvement / Autolearn)

---

## Part 1: Feature 7 Assessment

### 1.1 OpenSpace Pattern Fidelity

The PRD captures the following OpenSpace patterns faithfully:

| OpenSpace Pattern | PRD Mapping | Assessment |
|-------------------|-------------|------------|
| Execution recording (JSONL traces) | REQ-LEARN-001 (MemoryGraph records) | ADAPTED. OpenSpace records full JSONL traces (conversations, tool calls, trajectories). The PRD stores a summary record, not the full trace. This is a pragmatic choice given MemoryGraph's storage model, but it means the analysis LLM has less raw data to work with. See ISSUE-R3-001. |
| LLM-as-judge analysis | REQ-LEARN-003 (Haiku post-task analysis) | FAITHFUL. Structured judgment with per-field assessments and evolution suggestions mirrors OpenSpace's `ExecutionAnalysis` dataclass. |
| Three triggers | REQ-LEARN-003 (T1: post-task), REQ-LEARN-009 (T3: periodic health), REQ-LEARN-010 (T2: tool degradation) | FAITHFUL but T2 is COULD priority. OpenSpace treats all three triggers as core to the system. Demoting tool degradation to COULD is acceptable for Phase 1 but should be noted as a known gap. |
| Three evolution modes | REQ-LEARN-005 (FIX/DERIVED/CAPTURED) | FAITHFUL. All three modes match OpenSpace's semantics. |
| Version DAG | REQ-LEARN-011 (MemoryGraph version records with EVOLVED_FROM) | FAITHFUL. Content snapshots and parent links match OpenSpace's `skill_lineage_parents` table. |
| Two-phase execution | REQ-LEARN-007 (--fallback flag) | FAITHFUL. Phase 1 skill-guided, Phase 2 bare reasoning, CAPTURED extraction on Phase 2 success. Matches OpenSpace exactly. |
| Anti-loop guards | REQ-LEARN-006 (max 1 per invocation, counter reset) | PARTIALLY FAITHFUL. See ISSUE-R3-002 for missing LLM confirmation gate. |
| Quality counters | REQ-LEARN-002 (meta.json quality block) | FAITHFUL. Schema matches OpenSpace's 4 counters plus derived rates. |

**Patterns missed or underspecified:**

1. **OpenSpace's analysis agent has tool access.** OpenSpace's `ExecutionAnalyzer` runs as an agent loop (up to 5 iterations) with tool access -- it can re-run commands, read files, and verify outcomes. The PRD's REQ-LEARN-003 describes a single Haiku analysis call with structured output. It does not specify whether the analysis subagent has tool access. This matters because a pure LLM call cannot verify file existence, check output correctness, or re-run tests. See ISSUE-R3-003.

2. **OpenSpace's evolution agent has tool access and retry.** OpenSpace's evolver runs as an agent loop (`_MAX_EVOLUTION_ITERATIONS=5`, `_MAX_EVOLUTION_ATTEMPTS=3`) with file reading and shell access. The PRD's REQ-LEARN-005 says "the evolution LLM reads the current file + analysis + recent execution traces" and "produces targeted SEARCH/REPLACE edits" but does not specify whether the evolution LLM runs as a Task subagent with tools or as a single LLM call. If it is a single call, it cannot read the actual file -- it only sees whatever was passed in the prompt. See ISSUE-R3-004.

3. **OpenSpace's BM25+embedding skill ranking.** OpenSpace uses a two-stage retrieval system to match skills to tasks. The PRD has no equivalent for selecting which agent to suggest or which evolution suggestions to prioritize. This is acceptable because the PRD's system is user-driven (the user chooses which agent to run), not auto-selected. No issue raised.

4. **OpenSpace's cloud skill sharing.** Intentionally out of scope per Section 6. No issue.

5. **OpenSpace's safety checker (prompt injection filtering).** The PRD has no equivalent safety check for evolved agent definitions. A FIX evolution could theoretically inject prompt-override patterns into agent.md. The user approval gate (GR-009) is the mitigation, but there is no automated pre-check. See ISSUE-R3-005.

6. **OpenSpace's tool quality tracking per-tool.** OpenSpace tracks `recent_success_rate` and `llm_flagged_count` per tool. The PRD's REQ-LEARN-010 (COULD) references tool degradation but does not define what "degraded success rates" means or how tool-level metrics are tracked. This is acceptable at COULD priority.

7. **OpenSpace's concurrency model.** OpenSpace uses `asyncio.Semaphore(max_concurrent=3)` for parallel evolution. The PRD does not discuss concurrency for evolution actions -- but since all evolutions require user approval (serial by nature), concurrency is not needed. No issue.

### 1.2 Testability of Requirements

| Requirement | Testable? | Notes |
|-------------|-----------|-------|
| REQ-LEARN-001 | YES | Verify MemoryGraph record exists with correct schema after /run-agent |
| REQ-LEARN-002 | YES | Read meta.json, verify quality block exists and counters increment correctly |
| REQ-LEARN-003 | PARTIALLY | "Structured judgment" is testable; but "after every invocation" needs clarification -- REQ-LEARN-004 says "no analysis if invocation_count < 3". These two requirements contradict. See ISSUE-R3-006. |
| REQ-LEARN-004 | YES | Verify no analysis for invocations 1-2; verify analysis for invocation 3+ |
| REQ-LEARN-005 | YES | Each evolution mode has clear input/output; testable with deliberate test scenarios |
| REQ-LEARN-006 | YES | Anti-loop guards are binary checks |
| REQ-LEARN-007 | YES | --fallback flag, two phases, CAPTURED trigger on P2 success |
| REQ-LEARN-008 | PARTIALLY | "Diff the Phase 1 and Phase 2 execution traces" -- but REQ-LEARN-001 only stores summaries, not traces. What is being diffed? See ISSUE-R3-001. |
| REQ-LEARN-009 | YES | Threshold values are concrete; testable with mock data |
| REQ-LEARN-010 | YES (if implemented) | COULD priority; criteria are clear |
| REQ-LEARN-011 | YES | MemoryGraph record with content_snapshot; verifiable |
| REQ-LEARN-012 | YES | Skill shows version list; verifiable |
| REQ-LEARN-013 | YES | Manual trigger with analysis retrieval; verifiable |

### 1.3 Measurability of Success Criteria

The new success metrics in Section 10 are generally well-defined:

- "Post-task analysis completion: 100% of invocations (after warm-up) produce analysis" with "FAIL if < 95% after invocation 3" -- measurable and concrete.
- "Effective rate improvement: agents with 10+ invocations show effective_rate > 70%" with "FAIL if < 50% after 15 invocations" -- measurable but see ISSUE-R3-007 for threshold gap.
- "Evolution suggestion rate: >=1 per 5 invocations" and "Evolution acceptance rate: >50%" -- informational, no fail threshold. Appropriate for a first release.
- "Version DAG integrity: 100% of evolutions produce version records" -- measurable.

---

## Part 2: Integration Issues

### 2.1 Autolearn + /run-agent (REQ-RUN-001..007)

The integration is mostly clean. REQ-LEARN-001 hooks into the end of `run-agent` to store execution records. REQ-LEARN-003 hooks in as a post-task background process. REQ-LEARN-002 extends meta.json updates already required by REQ-RUN-005.

**Concern**: REQ-RUN-005 says "update meta.json after each successful invocation" and uses atomic write. REQ-LEARN-002 adds quality counters that also need updating. REQ-LEARN-003 says post-task analysis runs "in the background after the agent returns output." But the quality counter `task_completed` can only be set after the analysis completes (since the analysis determines completion). This means meta.json needs TWO writes per invocation: one immediate (invocation_count, last_used) and one deferred (quality counters after analysis). The PRD does not specify this two-write pattern or how the deferred write interacts with the atomic write from REQ-RUN-005. See ISSUE-R3-008.

### 2.2 Version DAG (REQ-LEARN-011) vs. Behavior Versioning (REQ-BEHAV-006)

REQ-LEARN-011 creates version records in MemoryGraph for agent definition evolution (FIX/DERIVED/CAPTURED on agent.md, context.md, tools.md).

REQ-BEHAV-006 creates versioned behavior rules with SUPERSEDES relationships.

These are **parallel versioning systems** for the same agent:
- behavior.md versions live in MemoryGraph as `behavior_rule` entities with `version` field and `SUPERSEDES` relationships
- Agent definition versions live in MemoryGraph as `agent_version` entities with `generation` field and `EVOLVED_FROM` relationships

There is no conflict per se -- they track different things. But when a FIX evolution modifies `behavior.md` (which REQ-LEARN-005 allows since it says "targeted SEARCH/REPLACE edits to the file"), does it also create a behavior rule version in MemoryGraph? Or does the file diverge from MemoryGraph rules? This is the same problem identified in EC-RUN-007 for manual edits, but now it can happen automatically via evolution. See ISSUE-R3-009.

### 2.3 Quality Counters in meta.json (REQ-LEARN-002) vs. Existing meta.json (REQ-DEF-005)

REQ-DEF-005 specifies meta.json with: `created`, `last_used`, `version`, `author`, `invocation_count`.

REQ-LEARN-002 extends meta.json with: `generation`, `quality` block, `evolution_history` array.

The `version` field exists in both. REQ-DEF-005 says "incremented on definition file changes." REQ-LEARN-002 shows `version: 3` alongside `generation: 2`. The relationship between version and generation is not explicit. In OpenSpace, `generation` is the evolution depth (distance from root). What is `version` if not the same thing? See ISSUE-R3-010.

### 2.4 Autolearn Cost Model (NFR-005)

NFR-005 adds:
- Post-task analysis: $0.001-0.005 (Haiku) per invocation
- Evolution action: $0.005-0.02 (Haiku/Sonnet) per evolution

This means a typical `/run-agent` with autolearn costs:
- Base: $0.02-0.10 (Opus invocation)
- Analysis: $0.001-0.005 (Haiku, background)
- Total: $0.021-0.105 per invocation (~5% overhead)

With two-phase fallback:
- Phase 1: $0.02-0.10
- Phase 2: $0.02-0.10
- Analysis (x2): $0.002-0.01
- Total: $0.042-0.21 (2x base cost)

The cost model is reasonable and honestly documented. The opt-in nature of fallback is appropriate.

One gap: the analysis skips invocations 1-2 (REQ-LEARN-004), so cost is $0 for analysis on the first 2 runs. But the evolution cost is per-approved-evolution, not per-invocation, so it is inherently user-controlled. The cost model makes sense.

---

## Part 3: New Issues Found

### ISSUE-R3-001
**Severity**: HIGH
**Section**: Feature 7, REQ-LEARN-001 / REQ-LEARN-008
**Description**: REQ-LEARN-001 stores an `execution_summary` (from the Task tool return value) in MemoryGraph, not the full execution trace. But REQ-LEARN-003 says the analysis LLM receives "task description, assembled Context Envelope, agent output summary, user feedback." And REQ-LEARN-008 says CAPTURED evolution must "diff the Phase 1 and Phase 2 execution traces." There is a mismatch: the system stores summaries but claims to analyze and diff traces.

OpenSpace stores full execution recordings (conversations.jsonl, traj.jsonl, metadata.json) and feeds up to 80K chars of conversation history to the analyzer. The PRD's summary-only approach means the analysis LLM has far less signal to work with. This is acceptable as a pragmatic trade-off, but the PRD should be consistent -- either store traces or acknowledge that analysis works from summaries only.

**Recommendation**: Clarify REQ-LEARN-001 to specify what "execution record" contains. Options: (a) store only summary (current text), in which case REQ-LEARN-008 must say "diff the Phase 1 and Phase 2 outputs" not "traces"; or (b) store the assembled Context Envelope + full Task output as a file in `.claude/agents/traces/{name}/{timestamp}.json` and reference it from the MemoryGraph record. Option (b) gives the analysis LLM more signal at the cost of disk space. Option (a) is simpler but limits analysis quality.

### ISSUE-R3-002
**Severity**: MEDIUM
**Section**: Feature 7, REQ-LEARN-006
**Description**: OpenSpace has three independent anti-loop guards: (1) `_addressed_degradations` dict tracking which skill+tool pairs have been evolved, (2) `min_selections=5` requiring fresh data before re-evaluation, (3) LLM confirmation gate (`_llm_confirm_evolution`) that asks the LLM to verify an evolution is warranted before executing it.

The PRD captures guard (2) -- counter reset post-evolution -- and partially captures guard (1) -- max 1 evolution per invocation. But it does not include the LLM confirmation gate (guard 3). TASK-AGENT-025 says "LLM confirmation gate" in its description, and GR-010 references it, but REQ-LEARN-006 does not define what the confirmation gate does or how it works. There is no requirement specifying this behavior.

**Recommendation**: Add a REQ-LEARN-014 (Priority: SHOULD) that specifies: "Before executing any evolution action, the system SHOULD ask a Haiku LLM to confirm the evolution is warranted based on the skill content, proposed change, and trigger context. If the LLM says the evolution is not warranted, skip it and log the decision." This prevents false-positive triggers from wasting evolution LLM calls and user review time.

### ISSUE-R3-003
**Severity**: HIGH
**Section**: Feature 7, REQ-LEARN-003
**Description**: The post-task analysis is described as spawning "a Task subagent (model: haiku) with analysis instructions" that produces a structured judgment. But the requirement does not specify whether this analysis subagent has tool access (Read, Bash, MCP tools) or is purely prompt-in/JSON-out.

This matters significantly. OpenSpace's analyzer runs as an agent loop with up to 5 iterations and has tool access to verify outcomes (re-run commands, read files, check outputs). A pure LLM call can only reason about what it is told in the prompt -- it cannot verify that an output file exists, that a test passes, or that an API response was correct.

If the analysis subagent HAS tool access, it runs as a Task subagent (which inherits parent tools per Section 8). But since it runs "in the background" (REQ-LEARN-004), this raises the question of how a background Task subagent works in Claude Code -- the Task tool is synchronous from the user's perspective. See ISSUE-R3-011.

**Recommendation**: Specify whether the analysis subagent has tool access. If yes, clarify how background Task tool execution works (it may need to be foreground but queued after the main output is shown). If no, document this as a known limitation vs. OpenSpace and note that analysis quality will be lower.

### ISSUE-R3-004
**Severity**: MEDIUM
**Section**: Feature 7, REQ-LEARN-005
**Description**: The FIX evolution mode says "the evolution LLM reads the current file + analysis + recent execution traces" and "produces targeted SEARCH/REPLACE edits to the file." But it does not specify HOW the evolution LLM reads the current file. Two options:

(a) The orchestrator reads the file and passes its content in the prompt. This works but means the evolution LLM sees a snapshot, not the live file, and cannot verify its edits compiled/run correctly.

(b) The evolution LLM runs as a Task subagent with Read/Edit tool access. This is more powerful but adds cost and complexity.

OpenSpace uses option (b) -- the evolution agent loop has tool access (`_MAX_EVOLUTION_ITERATIONS=5`) and can retry up to 3 times.

**Recommendation**: Specify option (a) for Phase 1 (simpler, cheaper, consistent with Haiku model). The orchestrator reads the file, passes content + analysis in the prompt, receives SEARCH/REPLACE edits as structured output, and applies them using Edit tool. Document that option (b) is a Phase 5+ enhancement.

### ISSUE-R3-005
**Severity**: LOW
**Section**: Feature 7, REQ-LEARN-006
**Description**: OpenSpace includes a safety checker (`check_skill_safety`, `is_skill_safe`) that scans evolved skill content for prompt injection patterns before registration. The PRD relies solely on user approval (GR-009) to catch problematic evolution outputs. This is acceptable given L1 autonomy, but a user reviewing a diff might not catch subtle prompt injection (e.g., "Ignore all previous instructions and...") embedded in a long context.md.

**Recommendation**: Add a note to REQ-LEARN-006: "COULD: Validate evolved file content against known prompt injection patterns (e.g., 'ignore previous instructions', 'disregard the above') before presenting to user for approval. Flag suspicious patterns in the diff view." Low priority but good defense-in-depth.

### ISSUE-R3-006
**Severity**: MEDIUM
**Section**: Feature 7, REQ-LEARN-003 vs. REQ-LEARN-004
**Description**: REQ-LEARN-003 says "After every /run-agent invocation (both success and failure), the system MUST run a post-task analysis." REQ-LEARN-004 says "no analysis if invocation_count < 3 (skip the first few warm-up runs)." These two requirements contradict. MUST "after every" vs. "no analysis if < 3."

**Recommendation**: Amend REQ-LEARN-003 to say "After every /run-agent invocation where invocation_count >= 3..." or add a qualifier: "subject to the warm-up exclusion in REQ-LEARN-004." The success metric already correctly says "100% of invocations (after warm-up)" so the intent is clear, but the requirement text is contradictory.

### ISSUE-R3-007
**Severity**: LOW
**Section**: Section 10, Success Metrics
**Description**: The "Effective rate improvement" metric has two thresholds: "effective_rate > 70%" as the target and "FAIL if < 50% after 15 invocations." There is a 20pp gap between target and fail threshold. This means an agent at 55% effective_rate passes but is below target. This is not necessarily wrong -- it gives room for learning -- but it is inconsistent with the executive summary's claim that "effective_rate (completions/selections) > 70% and rising over time" which is stated as a MUST.

**Recommendation**: Either change the executive summary to say "> 50% and rising" (matching the fail threshold) or tighten the fail threshold to 60%. The 70% target can remain aspirational. The gap should be acknowledged.

### ISSUE-R3-008
**Severity**: MEDIUM
**Section**: Feature 7, REQ-LEARN-002 / REQ-LEARN-003 / REQ-RUN-005
**Description**: meta.json requires two writes per invocation: (1) immediate write after the Task returns (invocation_count, last_used per REQ-RUN-005), and (2) deferred write after post-task analysis completes (quality counters: task_completed, completion_rate, etc.). The PRD does not specify this two-write pattern.

Additionally, `task_completed` appears in both the execution record (REQ-LEARN-001) and the analysis judgment (REQ-LEARN-003). The execution record stores it at invocation time, but how is it determined before the analysis runs? If the `/run-agent` skill sets `task_completed: true` simply because the Task subagent returned without error, that is a heuristic. If it waits for the analysis, it is blocking (contradicting REQ-LEARN-004's "non-blocking" requirement).

**Recommendation**: Specify the two-write pattern explicitly. Write 1 (immediate): increment invocation_count, update last_used, set `task_completed` to a heuristic value (true if Task returned output, false if Task errored). Write 2 (deferred, after analysis): update quality counters using the analysis judgment's `task_completed` which may override the heuristic. Document that the heuristic and the analysis may disagree (the analysis is authoritative).

### ISSUE-R3-009
**Severity**: MEDIUM
**Section**: Feature 7 + Feature 5 interaction
**Description**: FIX evolution can modify behavior.md (REQ-LEARN-005 says edits target "a specific file"). But behavior.md is also managed by `/adjust-behavior` which stores rules in MemoryGraph with version tracking (REQ-BEHAV-002). If a FIX evolution edits behavior.md directly, the MemoryGraph behavior rules and the file will diverge -- exactly the scenario EC-RUN-007 warns about for manual edits.

Worse: a FIX evolution might add a behavior rule to behavior.md that contradicts an existing MemoryGraph rule. The user reviews the diff of behavior.md but has no visibility into MemoryGraph rules that might conflict.

**Recommendation**: Add a constraint to REQ-LEARN-005: "FIX evolution MUST NOT modify behavior.md directly. Behavioral changes MUST go through the /adjust-behavior pathway to maintain MemoryGraph consistency. If the analysis suggests a behavioral change, the evolution should modify context.md or agent.md instead, or produce a separate behavior adjustment proposal processed via REQ-BEHAV-002." This prevents the two behavior management systems from conflicting.

### ISSUE-R3-010
**Severity**: LOW
**Section**: Feature 7, REQ-LEARN-002 / REQ-DEF-005
**Description**: meta.json now has both `version` (from REQ-DEF-005, "incremented on definition file changes") and `generation` (from REQ-LEARN-002, evolution depth from root). The semantics overlap: both increment when the agent definition changes. The difference is that `version` might increment on manual edits (user directly editing agent.md) while `generation` only increments on evolution actions.

The example in REQ-LEARN-002 shows `version: 3` and `generation: 2`, implying one manual edit and two evolutions. But this relationship is not specified.

**Recommendation**: Add a note to REQ-LEARN-002 clarifying: "`version` increments on ANY definition file change (manual edit or evolution). `generation` increments ONLY on evolution actions (FIX, DERIVED, CAPTURED). Therefore generation <= version always holds." This makes the two fields distinguishable and useful.

### ISSUE-R3-011
**Severity**: HIGH
**Section**: Feature 7, REQ-LEARN-004
**Description**: REQ-LEARN-004 says post-task analysis "runs in the background after the agent returns output to the user." But Claude Code's Task tool is synchronous -- when you call Task(), it blocks until the subagent completes. There is no documented mechanism for spawning a background Task that runs after the main conversation continues.

Options: (a) The analysis runs inline but after the output is displayed (the user sees the output, then there is a brief pause while analysis runs). (b) The analysis is queued and runs at the start of the next `/run-agent` invocation. (c) The analysis runs as a separate CLI process.

Option (a) is the most practical for Claude Code's architecture, but calling it "non-blocking" and "background" is misleading -- the user will see a delay after every invocation. Option (b) adds latency to the next invocation. Option (c) is architecturally complex.

**Recommendation**: Change REQ-LEARN-004 to say: "Post-task analysis SHOULD run after the agent output is displayed to the user. The user does not need to wait for the analysis to complete before providing their next command, but the analysis will consume a Haiku subagent invocation that may briefly occupy the session. If the user issues a command before the analysis completes, the analysis is cancelled and the invocation is marked as unanalyzed." Alternatively, specify that analysis is deferred to the next `/run-agent` invocation or triggered by `/evolve-agent`. This is an architectural constraint that needs a concrete answer.

### ISSUE-R3-012
**Severity**: LOW
**Section**: Feature 7, REQ-LEARN-002
**Description**: The `evolution_history` array in meta.json grows without bound. After 50+ evolutions, this array could be large. Unlike the version DAG in MemoryGraph (which is designed for unbounded growth), meta.json is read on every `/run-agent` invocation and should stay compact.

**Recommendation**: Add a limit: "evolution_history in meta.json SHOULD retain only the last 10 entries. Full history is available in MemoryGraph via `/agent-history`." This keeps meta.json compact while preserving full history in the graph.

### ISSUE-R3-013
**Severity**: MEDIUM
**Section**: Feature 7, REQ-LEARN-011 (content_snapshot)
**Description**: REQ-LEARN-011 stores `content_snapshot` as `{"agent.md": "...", "context.md": "..."}` in MemoryGraph for every version. A typical agent definition is 5K-15K tokens across files. MemoryGraph is not designed for large blob storage -- it is optimized for graph queries and relationship traversal, not for storing multi-KB text snapshots.

Over 20+ versions, this creates substantial storage pressure on MemoryGraph. RISK-014 acknowledges this with "archive old versions after 20+ generations; only keep content_snapshot for last 5 versions" but this is a risk mitigation, not a requirement.

**Recommendation**: Either (a) add a requirement REQ-LEARN-015 that formalizes the RISK-014 mitigation: "Content snapshots in MemoryGraph SHOULD be retained for only the last 5 versions. Older versions SHOULD store only the change_summary and content_diff. Full content for all versions is available on disk at `.claude/agents/versions/{name}/{version}/`." Or (b) move content_snapshot storage to disk entirely and store only a file path reference in MemoryGraph.

---

## Part 4: Consistency Checks

### 4.1 Traceability Matrix Coverage

Checking all new REQ-LEARN IDs against the matrix (Section 16, row INT-AGENT-007):
- Matrix says: `REQ-LEARN-001..013` -- Covers all 13 requirements. YES.
- Matrix says: `EC-LEARN-001..008` -- Covers all 8 edge cases. YES.
- Matrix says: `TASK-AGENT-016..025` -- Covers all 10 tasks. YES.
- Matrix says: `US-006, US-007` -- Covers both new user stories. YES.
- Matrix says: `GR-009..012` -- Covers all 4 new guardrails. YES.
- Matrix says: `HO-007..009` -- Covers all 3 new oversight checkpoints. YES.
- Matrix says: `NFR-005` -- References updated cost model. YES.

**Verdict**: All new IDs are covered. No orphaned requirements.

### 4.2 Guardrails vs. Oversight Checkpoints

| Guardrail | Related Oversight | Consistent? |
|-----------|-------------------|-------------|
| GR-009 (all evolution requires user approval) | HO-007 (evolution review) | YES. Both reference REQ-LEARN-006. |
| GR-010 (max 1 evolution per invocation) | -- | No corresponding HO. Acceptable -- this is an automatic guard, not a human checkpoint. |
| GR-011 (counter reset after evolution) | -- | No corresponding HO. Acceptable -- fully automatic. |
| GR-012 (two-phase is opt-in) | HO-008 (phase 2 fallback) | YES. GR-012 prevents automatic fallback; HO-008 is the human gate. |

**Verdict**: Consistent. No conflicts.

### 4.3 Priority Label Consistency

Feature 7 is Priority: MUST. Checking internal requirements:

| Requirement | Priority | Body Language | Consistent? |
|-------------|----------|---------------|-------------|
| REQ-LEARN-001 | MUST | MUST produce | YES |
| REQ-LEARN-002 | MUST | MUST be expanded | YES |
| REQ-LEARN-003 | MUST | MUST run | YES |
| REQ-LEARN-004 | MUST | MUST be automatic | YES |
| REQ-LEARN-005 | MUST | MUST support | YES |
| REQ-LEARN-006 | MUST | MUST require | YES |
| REQ-LEARN-007 | SHOULD | SHOULD support | YES |
| REQ-LEARN-008 | SHOULD | MUST diff | **NO** -- SHOULD req with MUST body. See note. |
| REQ-LEARN-009 | SHOULD | SHOULD run | YES |
| REQ-LEARN-010 | COULD | SHOULD be flagged | Acceptable -- COULD feature, SHOULD body when implemented |
| REQ-LEARN-011 | MUST | MUST create | YES |
| REQ-LEARN-012 | SHOULD | SHOULD show | YES |
| REQ-LEARN-013 | SHOULD | SHOULD allow | YES |

REQ-LEARN-008 (SHOULD) says "the CAPTURED evolution MUST" in its body. This is the same pattern caught in rounds 1 and 2 (ISSUE-20, ISSUE-R2-002, ISSUE-R2-006). If two-phase fallback is implemented, the CAPTURED extraction must work correctly, so MUST-within-SHOULD is defensible here as "if implemented, it MUST behave as specified." Not raising a new issue as this is a known pattern.

### 4.4 Edge Case ID Uniqueness

All EC-LEARN-001..008 are unique and sequential. No gaps, no duplicates. Clean.

### 4.5 Task ID Continuity

Existing tasks: TASK-AGENT-001..015.
New tasks: TASK-AGENT-016..025.
Continuous range. No gaps. Clean.

---

## Part 5: Missing Edge Cases

### What happens if analysis says "task_completed: true" but user says "that was wrong"?

EC-LEARN-007 covers contradictory user feedback ("good" then "actually that was wrong") and says "use the most recent feedback." But it does not cover the case where the automatic analysis disagrees with the user. If the analysis says `task_completed: true` and the user explicitly says the output was wrong, which takes precedence?

The user's judgment should always override the LLM-as-judge. REQ-LEARN-004 says "if the user provides explicit feedback, it MUST be included in the analysis input" -- but this implies the analysis RERUNS with user feedback, not that the user overrides the initial analysis. If the analysis already ran in the background and stored `task_completed: true`, does user feedback trigger a re-analysis?

**See ISSUE-R3-014.**

### What if DERIVED creates a variant but parent is later FIXed?

Not covered. If agent `sec-analyzer` creates `sec-analyzer-v1` (DERIVED), and later `sec-analyzer` is FIXed to v2, does `sec-analyzer-v1` inherit the fix? In OpenSpace, DERIVED skills are independent -- they coexist and evolve separately. The PRD's REQ-LEARN-005 says "both parent and derived agent remain active (coexist)" which implies independence. But a user might expect that fixing the parent propagates to variants.

**See ISSUE-R3-015.**

### What if all 3 evolution modes are suggested for the same invocation?

REQ-LEARN-006 says "if multiple suggestions exist, they are queued and presented together." EC-LEARN-004 says "apply approved ones sequentially." But can a single invocation produce a FIX, a DERIVED, and a CAPTURED suggestion simultaneously? Technically yes, if the analysis identifies both a fixable issue and a specialization opportunity while the invocation also triggered a two-phase fallback CAPTURED.

The anti-loop guard says "max 1 evolution per invocation." But if 3 are suggested and 1 is applied, what happens to the other 2? Are they discarded or queued for the next invocation?

**See ISSUE-R3-016.**

### What happens during quality counter warm-up (invocations 1-3)?

REQ-LEARN-004 skips analysis for invocations 1-2. REQ-LEARN-009 requires `total_selections >= 5` before health monitoring triggers. So for invocations 1-2, no analysis runs and no quality data is collected except the basic task_completed heuristic from meta.json.

What about invocation 3? The quality counters will have very sparse data -- 0 analyses (for invocations 1-2) and 1 analysis (for invocation 3). The derived rates (completion_rate, effective_rate) from 1 data point are not statistically meaningful.

This is not a bug -- it is the expected warm-up behavior. But the metric "FAIL if < 50% after 15 invocations" should probably be "after 15 analyzed invocations" (which means invocation 17+, since the first 2 are skipped). This is a minor precision issue.

---

## Part 6: Additional Issues

### ISSUE-R3-014
**Severity**: MEDIUM
**Section**: Feature 7, REQ-LEARN-003 / REQ-LEARN-004
**Description**: No mechanism for user feedback to override or amend a completed analysis. If the analysis runs in the background and concludes `task_completed: true`, but the user later says the output was wrong, the quality counters have already been updated with a false positive. The analysis record in MemoryGraph is immutable.

**Recommendation**: Add to REQ-LEARN-004: "If the user provides explicit negative feedback after the analysis has completed, the system MUST create an amended analysis record that supersedes the original, with `task_completed` overridden to match user feedback. Quality counters in meta.json MUST be recalculated." This ensures user feedback is authoritative.

### ISSUE-R3-015
**Severity**: LOW
**Section**: Feature 7, REQ-LEARN-005 (DERIVED mode)
**Description**: When a parent agent is FIXed after a DERIVED variant exists, the variant does not inherit the fix. This is correct behavior (matches OpenSpace), but users may be surprised. No existing edge case covers this scenario.

**Recommendation**: Add EC-LEARN-009: "If a parent agent is FIXed after a DERIVED variant was created, the variant is NOT automatically updated. The user can manually apply the fix to the variant or create a new DERIVED variant from the fixed parent. The version DAG shows the divergence."

### ISSUE-R3-016
**Severity**: LOW
**Section**: Feature 7, REQ-LEARN-006 / EC-LEARN-004
**Description**: The anti-loop guard says "max 1 evolution per invocation" but EC-LEARN-004 says "queue all suggestions; present together; apply approved ones sequentially." If 3 suggestions are presented and 2 are approved, does the max-1 guard prevent the second from being applied? Or does the max-1 guard apply to automatic triggers, not to user-approved batch applications?

**Recommendation**: Clarify REQ-LEARN-006: "Max 1 automatic evolution trigger per invocation. When the user reviews queued suggestions, they may approve multiple suggestions in a single review session. Approved suggestions are applied sequentially, each producing a version record." This distinguishes the automatic guard from user-initiated batch operations.

### ISSUE-R3-017
**Severity**: LOW
**Section**: Section 10, Success Metrics
**Description**: Round 2 ISSUE-R2-003 noted that ">80% preference parity" and "FAIL if < 7/9" are numerically inconsistent (7/9 = 77.8%, not > 80%). The PRD changelog for v3.0.0 does not mention fixing this. The round 2 verdict said "address during task spec decomposition" but the inconsistency remains in the PRD text. Since this is round 3, noting it is still present.

**Recommendation**: Same as round 2: change target to ">=75% preference parity" to match the 7/9 threshold.

---

## Part 7: Token Budget Impact

### New MemoryGraph Records per Invocation

| Record Type | Estimated Size | Frequency |
|-------------|----------------|-----------|
| `agent_execution` (REQ-LEARN-001) | 200-500 tokens | Every invocation |
| `agent_analysis` (REQ-LEARN-003) | 300-800 tokens | Every invocation after warm-up |
| `agent_version` (REQ-LEARN-011) | 5,000-15,000 tokens (with content_snapshot) | Per approved evolution |

After 50 invocations with 5 evolutions, estimated MemoryGraph growth:
- Execution records: 50 x 350 avg = 17,500 tokens
- Analysis records: 48 x 550 avg = 26,400 tokens
- Version records: 5 x 10,000 avg = 50,000 tokens

Total: ~94,000 tokens of MemoryGraph storage. The version records with content_snapshot dominate. This reinforces ISSUE-R3-013 -- content snapshots should be moved to disk or pruned.

### Session Context Impact

Post-task analysis adds a Haiku Task subagent invocation per run. This does NOT add to the main session's context (the Task tool runs in isolation), but it does consume an API call and brief processing time.

The analysis results stored in MemoryGraph do NOT enter the Context Envelope of future `/run-agent` invocations unless explicitly referenced in `memory-keys.json`. This is clean design -- no silent context bloat.

---

## Part 8: Readiness Verdict

**NEEDS REVISION -- 3 HIGH issues must be addressed before decomposition**

### Blocking Issues (must fix before decomposition):

1. **ISSUE-R3-001 (HIGH)**: Execution record content is underspecified. The PRD claims trace diffing (REQ-LEARN-008) and trace analysis (REQ-LEARN-003) but only stores summaries (REQ-LEARN-001). Either enrich the execution record or downgrade the analysis/diff claims.

2. **ISSUE-R3-003 (HIGH)**: Analysis subagent capabilities are unspecified. Whether the Haiku analysis has tool access fundamentally changes the architecture. A task spec writer cannot design TASK-AGENT-017 without knowing whether to build a prompt-in/JSON-out call or a full Task subagent invocation.

3. **ISSUE-R3-011 (HIGH)**: "Background" post-task analysis is architecturally unimplementable as described. Claude Code's Task tool is synchronous. The PRD must specify a concrete execution model (inline-after-output, deferred-to-next-invocation, or manual-via-evolve-agent).

### Should-fix (address in PRD or during decomposition):

4. **ISSUE-R3-006 (MEDIUM)**: REQ-LEARN-003 and REQ-LEARN-004 contradict on "every invocation" vs. "skip first 3." Quick text fix.
5. **ISSUE-R3-008 (MEDIUM)**: Two-write pattern for meta.json needs specification.
6. **ISSUE-R3-009 (MEDIUM)**: FIX evolution must not modify behavior.md to avoid dual-versioning conflict.
7. **ISSUE-R3-014 (MEDIUM)**: User feedback override mechanism for completed analyses.
8. **ISSUE-R3-002 (MEDIUM)**: LLM confirmation gate is referenced but not specified as a requirement.
9. **ISSUE-R3-013 (MEDIUM)**: Content snapshots in MemoryGraph will cause storage bloat; needs a formal retention policy.
10. **ISSUE-R3-016 (LOW)**: "Max 1 evolution" guard ambiguity with batch user approval.

### Items that do NOT need fixing:

- Cost model is sound
- Priority labels are mostly consistent (one known SHOULD-with-MUST-body pattern)
- Traceability matrix is complete
- Guardrails and oversight checkpoints are consistent
- Edge cases are comprehensive for a first draft of the autolearn feature
- Version DAG design is faithful to OpenSpace
- Anti-loop guards (minus the LLM confirmation gate) are adequate

### What the PRD does well in v3.0.0:

- The OpenSpace adaptation is thoughtful -- it takes the right patterns (skill lifecycle, quality counters, three triggers, version DAG, two-phase execution) while adapting to Claude Code's constraints (user approval gates instead of autonomous evolution, MemoryGraph instead of SQLite, skills instead of SKILL.md files).
- The L1 autonomy decision (all evolutions require human approval) is the correct call for a first release. OpenSpace's fully autonomous evolution is appropriate for a research benchmark but not for a production developer tool.
- The cost model is transparent and the opt-in design for expensive features (two-phase fallback) shows good judgment.
- The phasing is logical: Phase 4 depends on Phases 1+2 but not Phase 3, allowing parallel progress.
- The anti-loop guards prevent the most dangerous failure mode (runaway evolution cycles).

---

## Issue Summary

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 0 | -- |
| HIGH | 3 | ISSUE-R3-001, ISSUE-R3-003, ISSUE-R3-011 |
| MEDIUM | 6 | ISSUE-R3-002, ISSUE-R3-006, ISSUE-R3-008, ISSUE-R3-009, ISSUE-R3-013, ISSUE-R3-014 |
| LOW | 8 | ISSUE-R3-004, ISSUE-R3-005, ISSUE-R3-007, ISSUE-R3-010, ISSUE-R3-012, ISSUE-R3-015, ISSUE-R3-016, ISSUE-R3-017 |

**Total round 3 issues**: 17 (0 critical, 3 high, 6 medium, 8 low)

The 3 HIGH issues are all in the same area: the execution model for post-task analysis and evolution. Once the PRD specifies whether analysis is inline or deferred, whether subagents have tool access, and what data the analysis operates on, the remaining issues are addressable during task spec writing.

**Estimated effort to fix**: One focused revision pass (1-2 hours) to address the 3 blocking issues. The MEDIUM issues can be folded into the same pass.
