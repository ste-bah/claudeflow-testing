# Adversarial Review: PRD-AGENT-001 Task Specifications (Round 1)

```
Reviewer:   Claude Opus 4.6 (adversarial cold-read)
Date:       2026-03-29
PRD:        PRD-AGENT-001 v3.0.0
Specs:      18 tasks (TASK-AGT-001 through TASK-AGT-018)
Scope:      Production-readiness, cross-task consistency, framework integration, autolearn coherence, gap analysis
```

---

## 1. Overall Assessment

The task specifications are **unusually thorough** for a skill-based system. Most specs contain exact file content, JSON schemas with field constraints, step-by-step algorithms, and specific test criteria. The decomposition from PRD to tasks is well-traced via REQ IDs.

**Biggest gap**: The specs rely heavily on Claude Code skill YAML files (`.claude/skills/*.md`) as the implementation mechanism, but skills are inherently prompt-based instructions that the orchestrator follows. There is no compile-time enforcement that the orchestrator will follow the 8-12 step algorithms specified. If the orchestrator deviates from any step (e.g., skips diff validation, forgets truncation order, miscounts tokens), there is no programmatic safety net. The TypeScript utilities in `src/agent-system/` cover only validation and token counting --- the critical execution paths (Context Envelope assembly, Haiku merge pipeline, evolution execution) exist solely as natural-language skill instructions.

**Second biggest gap**: Tasks 002/003 (Tool Factory MCP server) were not requested for review, but they are Phase 1 dependencies. Their absence from this review means a significant portion of the system is unexamined.

---

## 2. Production-Readiness Issues

### TASK-AGT-001 (Agent Definition Format)

- **AGENT_NAME_PATTERN rejects single-char names but also rejects 2-char names that start with a digit**: The pattern `^[a-z][a-z0-9-]*[a-z0-9]$` requires minimum 2 chars AND must start with lowercase letter. The sanitizer strips leading digits, so `"123-agent"` becomes `"agent"` (5 chars, valid). But the test case on line 743 says "starts with digit, verify behavior" with uncertain outcome. The sanitizer does NOT strip leading digits --- it only strips `[^a-z0-9-]`. Digits are `[a-z0-9-]` and pass through. Result: `"123-agent"` sanitizes to `"123-agent"`, which fails the pattern (starts with digit). The sanitizer has no explicit digit-stripping logic, so this is a **silent failure path** where the user gets a confusing "invalid after sanitization" error. The spec should either add digit-stripping logic or document the behavior explicitly.

- **`computeTokenBreakdown` only sums `.md` files for total**: The function on line 162 skips JSON files for the total count. But `memory-keys.json` and `meta.json` are injected into the Context Envelope indirectly (via MemoryGraph recall results). The total token computation does not account for dynamic context (MemoryGraph, LEANN, behavior rules, task description). This means `totalWithin` can report `true` while the assembled prompt exceeds 15,000 tokens. The total check is misleadingly incomplete. It would be better named `definitionTokensWithin` or documented as a partial check.

- **Import placement**: Line 174 has `import { TOTAL_CONTROLLABLE_TOKEN_LIMIT } from './constants.js'` AFTER the function that uses it. TypeScript hoists imports, but the spec's code layout suggests it was an afterthought. Minor, but if someone implements from the spec literally, they might place it wrong.

### TASK-AGT-004 (/create-agent skill)

- **Levenshtein distance computation is unspecified**: Step 3 says "Levenshtein distance <= 3" for overlap detection but provides no algorithm or library reference. Since this runs as a skill prompt (not code), the orchestrator (Claude) would need to compute Levenshtein mentally. For 10+ existing agents, this is unreliable. The spec should either drop Levenshtein (substring match is sufficient) or provide an explicit Bash command for the check.

- **No unit tests**: The spec explicitly states "Skills are tested via manual invocation, not unit tests." This is a production-readiness concern. The 8-step pipeline has multiple failure modes (name collision, overlap detection, depth-1 scan, token budget) that would benefit from automated validation. At minimum, the TypeScript utilities should have integration tests that simulate the full pipeline.

- **`/create-agent` argument parsing is ambiguous**: REQ-CREATE-001 says syntax is `/create-agent "description"` or `/create-agent --name "name" --description "description"`. But the skill YAML on line 56 uses positional `description` argument. The `--name` flag parsing is not defined in the skill YAML frontmatter --- it is only mentioned in Step 2. Claude Code skill argument parsing does not support `--flag` syntax natively; the orchestrator must parse it from the raw text. This should be documented as a known limitation or the parsing logic should be explicit.

### TASK-AGT-005 (/run-agent skill)

- **Step 6 (behavior.md reconciliation) is a no-op in Phase 1**: The spec acknowledges this but includes the full reconciliation logic anyway. This adds complexity to the skill prompt with no Phase 1 value. If an implementer includes it, the MemoryGraph check for behavior rules will always return empty (behavior rules don't exist until Phase 2), generating unnecessary debug-level logs. Consider removing the logic entirely from Phase 1 and adding it in TASK-AGT-009.

- **Model override parsing**: Step 1 shows syntax `/run-agent {name} --model haiku "task description"` but the YAML frontmatter lists `model` as an optional argument. Claude Code skill argument parsing for `--model` between positional args is not well-defined. The spec should clarify the parsing order or suggest quoting conventions.

- **Meta.json created from scratch if missing (Step 11)**: The fallback meta.json creation on line 247 omits the `quality` block and `generation` field that TASK-AGT-001's schema requires. This would produce a meta.json that fails TASK-AGT-001's validator. The fallback should include all fields.

### TASK-AGT-006 (Reference Agent Validation)

- **SEC Filing Analyzer tools.md has outdated EDGAR URLs**: The EDGAR full-text search URL on line 161 (`efts.sec.gov/LATEST/search-index`) may not be the current endpoint format. EDGAR's full-text search API has changed multiple times. The spec should note that URLs must be verified at implementation time.

- **Blind comparison methodology is not reproducible**: The scoring is qualitative (1-5 by Steven), with no inter-rater reliability. With only 9 comparisons, a single bad run can flip the result. The 7/9 threshold is reasonable but the methodology should acknowledge that LLM outputs are non-deterministic --- running the same task twice can produce different quality levels.

- **All 3 reference agents follow the Master Prompt Framework**: Good. However, the code-reviewer agent's tools.md on line 339 contains literal `grep -r` commands, which should use the Grep tool instead (per the tool instructions in the system). Minor inconsistency with the behavioral guidance.

### TASK-AGT-008 (/adjust-behavior skill)

- **STOPWORDS defined after use**: The STOPWORDS set on line 285 appears AFTER the algorithm that references it (line 239). An implementer reading top-to-bottom would encounter the reference before the definition. The spec should move STOPWORDS to the top of the diff validation section or note that it is a constant.

- **Global rules have no agent directory**: The smoke test on line 450 notes "behavior.md does not exist (global rules have no agent directory)." But Step 8's behavior.md regeneration (line 376) writes to `.claude/agents/custom/{agent_scope}/behavior.md`. When `agent_scope = "global"`, this path resolves to `.claude/agents/custom/global/` which does not exist and should not be created. The spec should add an explicit guard: "Skip behavior.md regeneration when agent_scope is 'global'."

- **Edit flow complexity**: The edit flow (line 395) allows users to modify individual rules by index, change priorities, and reject specific changes. After edits, diff validation runs again. This creates a potential loop (edit -> validate -> more edits). The spec should define a max iteration count or simplify the flow.

- **Haiku structured JSON output is not guaranteed**: The spec assumes Haiku returns strict JSON (line 143: "Output ONLY valid JSON. No markdown, no explanation, no preamble."). Haiku models frequently wrap JSON in markdown code fences. Step 5's fallback regex extraction handles this, but the spec should acknowledge that the regex approach is the expected path, not the exception.

### TASK-AGT-014 (Post-Task Analysis)

- **User feedback detection is dangerously heuristic**: The spec on line 231 says the orchestrator determines if the user's next message is feedback based on "conversational context." This is the orchestrator (Claude Opus) making a judgment call about whether a user message is feedback or a new command. Misclassification has real consequences: if a new command is treated as feedback, it gets appended to the trace instead of executed. If feedback is treated as a command, the analysis runs without it. The spec provides keyword lists but explicitly says "there is no rigid keyword parser." This is a production-readiness risk with no mitigation.

- **Cancellation handling is aspirational**: The spec says "if the user issues a new command before the analysis Task call returns" the analysis is cancelled. But Claude Code's Task tool is synchronous and blocking --- the user cannot issue a new command while the orchestrator is waiting for the Task to return. The cancellation scenario described is not actually possible in the current Claude Code architecture. The spec should either remove this section or clarify the actual cancellation mechanism.

- **Write 2 race condition**: Write 2 reads meta.json, modifies counters, and writes back. If two concurrent `/run-agent` invocations finish analysis at similar times, Write 2 from one can overwrite Write 2 from the other. The atomic write (temp + rename) prevents file corruption but not logical races. The spec should note this as a known limitation under concurrency.

- **12K/8K char truncation limits are arbitrary**: The spec truncates context_envelope to 12K chars and agent_output to 8K chars for the analysis prompt. Combined with system prompt, response schema, and quality history, this is ~6K tokens for context + ~2.5K for output = ~8.5K input tokens for Haiku. Haiku supports 200K context, so these limits are very conservative. If the agent's output is critical for analysis quality (e.g., a 10K-char SEC filing analysis), truncating to 8K loses relevant information. The spec should justify these limits or make them configurable.

### TASK-AGT-015 (FIX Evolution)

- **Haiku evolution prompt includes `## JSON Array of Edits:` as a heading with no content**: The user message template (line 173) ends with `## JSON Array of Edits:` which is intended to prompt the model to fill in the JSON. This is a prompt engineering technique, but it creates ambiguity --- the model might interpret this as an empty section header rather than a fill-in-the-blank prompt. Consider using "Respond with the JSON array:" instead.

- **Edit failure rollback is incomplete**: The spec says on line 101 "If any edit fails (search text not found): abort remaining edits, restore from backup, report error." But if edit 1 of 3 succeeds and edit 2 fails, the file has been partially modified. The restore-from-backup approach copies all files from the version directory back, which works, but the spec should clarify that the ENTIRE agent directory is restored (not just the target file).

- **`applied_rate: 1.0` after counter reset is misleading**: After evolution, the quality block resets with `applied_rate: 1.0` (line 108). But `total_selections` is 0 and `total_completions` is 0. An applied_rate of 1.0 with zero data is mathematically undefined (0/0). The spec should set `applied_rate: 0.0` (or null) and only compute it after the first post-evolution invocation.

- **`evolution_history_last_10` is new to TASK-AGT-015 but not in TASK-AGT-001's meta.json schema**: TASK-AGT-001 defines the meta.json JSON Schema (line 448) which allows `additionalProperties: true`, so this is technically valid. But the `evolution_history_last_10` field appears in the PRD's REQ-LEARN-002 example. TASK-AGT-001 should either include it in the schema with `"type": "array"` or document it as a Phase 4 extension.

---

## 3. Cross-Task Consistency Issues

1. **meta.json schema drift between TASK-AGT-001 and Phase 4 tasks**: TASK-AGT-001 defines `quality` as optional with no required sub-fields. TASK-AGT-013 (execution recording) and TASK-AGT-014 (analysis) both assume `quality` exists and has all 7 sub-fields. If `/create-agent` creates a meta.json without the `quality` block (e.g., smart file omission), Phase 4 tasks will crash. The spec should make `quality` required with all sub-fields initialized to 0 in TASK-AGT-001.

2. **meta.json fallback in TASK-AGT-005 vs schema in TASK-AGT-001**: TASK-AGT-005's Step 11 fallback creates meta.json with only 6 fields (missing `quality`, `generation`, `evolution_type`). This conflicts with TASK-AGT-001's template meta.json which has all fields. Any downstream task that reads `quality.total_selections` will throw a TypeError.

3. **Trace file directory**: TASK-AGT-001 defines `TRACES_DIR = '.claude/agents/traces'`. TASK-AGT-013 (not reviewed but referenced) and TASK-AGT-014 both use `.claude/agents/traces/{agent-name}/{timestamp}.json`. This is consistent. However, TASK-AGT-001's file organization tree shows `traces/` under `.claude/agents/`, not under `.claude/agents/custom/`. This is correct but could confuse implementers who assume traces live alongside agent definitions.

4. **Behavior rule schema location**: TASK-AGT-008 references "create_behavior_rule (from TASK-AGT-007)" and "update_behavior_rule (from TASK-AGT-007)" as callable functions. But TASK-AGT-007 was not reviewed, and it is unclear whether these are TypeScript utilities, MCP tool calls, or inline MemoryGraph operations. The cross-task interface is specified by name but not by calling convention.

5. **TASK-AGT-008's `triggers` field is missing from YAML frontmatter**: The YAML on line 49 has no `triggers` key. All other skill specs (004, 005) include `triggers`. Without it, the skill cannot be invoked via `/adjust-behavior`. This appears to be an omission.

6. **Version directory gitignore**: TASK-AGT-015 says to add `.claude/agents/versions/` to `.gitignore`. TASK-AGT-001 does not mention `.gitignore`. The traces directory (`.claude/agents/traces/`) is also not gitignored by any spec, but trace files contain full agent output (potentially sensitive). This should be addressed.

---

## 4. Framework Integration Assessment

### Master Prompt Framework in TASK-AGT-001's Template

The template agent.md in TASK-AGT-001 correctly implements all 6 framework sections: INTENT, SCOPE (In/Out), CONSTRAINTS, FORBIDDEN OUTCOMES, EDGE CASES, OUTPUT FORMAT, WHEN IN DOUBT. This matches the structure described in `docs2/ai_agent_prompt_guide.md`.

### Framework in TASK-AGT-004's Generation Instructions

TASK-AGT-004 embeds the 12 Principles as generation instructions (lines 131-144). The mapping from principles to agent.md sections is clear and correct. The spec explicitly states that the 12 Principles are applied during generation, not embedded in the template itself --- this is the right design decision.

**Issue**: The 12 Principles are listed in TASK-AGT-004 but NOT cross-referenced to the `docs2/ai_agent_prompt_guide.md` file content. If the guide is updated, the task spec becomes stale. The spec should include a note: "Verify against docs2/ai_agent_prompt_guide.md at implementation time."

### Framework in TASK-AGT-006's Reference Agents

All 3 reference agents follow the framework structure consistently:
- INTENT, SCOPE (In/Out), CONSTRAINTS, FORBIDDEN OUTCOMES, EDGE CASES, OUTPUT FORMAT, WHEN IN DOUBT
- All include the depth=1 constraint
- All include the XSS prevention rule (no echoing user input)
- All include the "no fabrication" forbidden outcome

**Issue**: The reference agents include OUTPUT FORMAT but the template in TASK-AGT-001 does not list it as a separate section header. The template has it embedded in the example but not as a `##` header. TASK-AGT-004's generation template (line 184) DOES include `## OUTPUT FORMAT`. The template and the generation instructions should align.

---

## 5. Autolearn Pipeline Assessment

### Data Flow: AGT-013 -> AGT-014 -> AGT-015

The data flow is coherent:
1. AGT-013 records execution (trace file + MemoryGraph record + Write 1 to meta.json)
2. AGT-014 reads trace, runs Haiku analysis, stores analysis record, creates relationship, runs Write 2
3. AGT-015 reads analysis suggestions, generates edits, presents diff, applies on approval

**Issue 1: Two-write pattern atomicity gap**. Write 1 (AGT-013) and Write 2 (AGT-014) are separate atomic writes. Between Write 1 and Write 2, meta.json has heuristic-based counters that may be wrong. If the session crashes between Write 1 and Write 2, meta.json retains incorrect counters permanently. There is no reconciliation mechanism to detect and fix this. The spec should add a `last_analysis_invocation` field to detect unanalyzed invocations.

**Issue 2: Haiku prompt templates are complete but untested**. The analysis prompt (AGT-014) and evolution prompt (AGT-015) are fully specified with system prompts, user messages, and response schemas. However, there is no mention of testing these prompts against Haiku to verify it produces conformant JSON output. Haiku's instruction-following for strict JSON is less reliable than Opus. The specs should include a pre-implementation step: "Run 10 test prompts through Haiku and verify JSON conformance rate > 90%."

**Issue 3: AGT-015/016 evolution prompts lack few-shot examples**. The Haiku evolution prompt (AGT-015 line 130) includes rules and output format but no few-shot examples. For SEARCH/REPLACE edit generation, few-shot examples significantly improve output quality. The spec includes one example in the schema section but it is not in the prompt template itself.

### Anti-Loop Guards (AGT-017 references to AGT-015/016)

AGT-017 references three guards:
- Max 1 evolution per invocation (defined in AGT-015)
- Counter reset post-evolution (defined in AGT-015)
- LLM confirmation gate for Triggers 2/3 (defined in AGT-017)

These are consistent. The `_evolution_applied_this_invocation` flag (AGT-015 line 249) is in-memory only, which is correct since it is per-invocation state.

**Issue**: The LLM confirmation gate in AGT-017 is specified as a Haiku prompt-in/JSON-out call with `{"confirmed": true/false, "reason": "..."}`. But AGT-017 was only partially read in this review. The full prompt template for the confirmation gate should be verified for completeness.

---

## 6. Missing Coverage

### PRD Requirements Not Covered by Any Task

1. **REQ-BEHAV-004 (behavior rule injection in /run-agent)**: Covered by TASK-AGT-009. However, TASK-AGT-009 was not in the review sample. Verify it specifies the priority sort order (agent-specific > global at same priority) and the injection location in the Context Envelope.

2. **REQ-LEARN-010 (tool quality tracking)**: TASK-AGT-017 marks this as "COULD priority --- schema only, stub implementation." The PRD also marks it COULD. Acceptable deferral, but the schema should still be defined in AGT-017 so Phase 5 can implement it.

3. **EC-LEARN-006 (MemoryGraph unavailable during version record storage)**: The PRD specifies fallback behavior (store locally in versions dir, sync later). TASK-AGT-015 does not mention this edge case. The version record storage assumes MemoryGraph is available. This is a gap.

4. **EC-LEARN-007 (contradictory user feedback)**: The PRD specifies "use most recent feedback; log the contradiction." TASK-AGT-014 does not address this --- it has a simple "most recent message" heuristic but does not handle the case where the user says "good" and then "actually that was wrong" in sequence.

5. **EC-LEARN-008 (agent has 5 invocations, all failures)**: The PRD specifies a specific user notification with 3 options (evolve, delete, recreate). TASK-AGT-017's health check logic flags the agent but does not differentiate "never succeeded" from "declining performance." This nuance is missing.

6. **EC-BEHAV-002 (50+ behavior rules, context bloat)**: The PRD specifies a warning when an agent has many rules. Neither TASK-AGT-008 nor TASK-AGT-009 addresses this. The Context Envelope assembly (TASK-AGT-005) does not check behavior rule count or their token contribution.

7. **NFR-006 fallback for /create-agent**: The PRD says "if MemoryGraph is unavailable during /create-agent, create locally but warn." TASK-AGT-004 does not mention MemoryGraph unavailability at all --- Step 8 assumes MemoryGraph is available for registration.

### Missing Guardrails

1. **No trace file size limit**: Trace files store `context_envelope` (up to 15K tokens ~ 60K chars) + `agent_output` (unbounded). A single trace file could be 100KB+. Over many invocations, traces accumulate. No spec defines cleanup, rotation, or size limits for `.claude/agents/traces/`.

2. **No concurrent invocation guard for the same agent**: Two simultaneous `/run-agent sec-filing-analyzer` calls would both read/write meta.json and both create trace files. The atomic write prevents corruption but counter values would be wrong (both read invocation_count=5, both write invocation_count=6 instead of 7).

3. **No validation of memory-keys.json recall_queries at creation time**: TASK-AGT-004 suggests memory keys but does not validate that the suggested MemoryGraph keys actually exist or are well-formed. A bad key (e.g., with special characters) could cause runtime errors in TASK-AGT-005.

---

## 7. Verdict

**NEEDS_REVISION** --- with 4 specific blockers and 8 important fixes.

### Blockers (must fix before implementation)

1. **TASK-AGT-005 meta.json fallback is schema-incomplete**: The fallback meta.json on Step 11 is missing `quality`, `generation`, and would break all Phase 4 consumers. Add all required fields.

2. **TASK-AGT-008 skill YAML is missing `triggers` key**: Without triggers, the skill cannot be invoked. Add `triggers: ["/adjust-behavior", "adjust behavior"]`.

3. **TASK-AGT-008 global scope behavior.md write path**: The behavior.md regeneration path would attempt to write to `.claude/agents/custom/global/` which should not exist. Add explicit guard for global scope.

4. **TASK-AGT-014 cancellation scenario is architecturally impossible**: Claude Code Task tool is synchronous. The user cannot issue commands while a Task is running. Either remove the cancellation section or redesign as a timeout-based mechanism.

### Important Fixes (should fix, but can unblock with a TODO)

1. TASK-AGT-001: Leading-digit agent names silently fail sanitization. Add digit-stripping or a clear error message.
2. TASK-AGT-004: Drop Levenshtein distance requirement (unreliable in prompt-based execution). Substring match is sufficient.
3. TASK-AGT-014: User feedback detection is dangerously heuristic. Add a structured feedback command (e.g., `/feedback "that was wrong"`) instead of relying on conversational heuristics.
4. TASK-AGT-015: `applied_rate: 1.0` with zero data is mathematically misleading. Set to 0.0 after counter reset.
5. TASK-AGT-015: Add EC-LEARN-006 coverage (MemoryGraph unavailable during version storage).
6. TASK-AGT-015: Add few-shot example to the Haiku evolution prompt template.
7. All Phase 4 specs: Add a pre-implementation gate to test Haiku JSON conformance with the actual prompt templates.
8. Add `.claude/agents/traces/` to `.gitignore` (contains potentially sensitive agent output).
