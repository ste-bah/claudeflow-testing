# Adversarial Review: PRD-AGENT-001 Task Specifications (Round 2 - FINAL)

```
Reviewer:   Claude Opus 4.6 (adversarial cold-read)
Date:       2026-03-29
PRD:        PRD-AGENT-001 v3.0.0
Scope:      Verification of 4 blockers + 8 important fixes from Round 1
```

---

## 1. Blocker Verification

| # | Blocker | File | Fixed? | Evidence |
|---|---------|------|--------|----------|
| B1 | TASK-AGT-005 meta.json fallback missing `quality`, `generation` | TASK-AGT-005.md | YES | Step 11 fallback (line 247-265) now includes full `quality` block with all 7 sub-fields at 0.0, `generation: 0`, and `evolution_history_last_10: []`. Matches TASK-AGT-001 schema. |
| B2 | TASK-AGT-008 skill YAML missing `triggers` key | TASK-AGT-008.md | YES | YAML frontmatter (line 53-56) now includes `triggers: ["/adjust-behavior", "adjust behavior", "change behavior", "add behavior rule"]`. |
| B3 | TASK-AGT-008 global scope behavior.md write path | TASK-AGT-008.md | YES | Step 8 (line 381-383) now has explicit guard: `IF agent_scope != "global":` before behavior.md regeneration, with comment explaining `.claude/agents/custom/global/` MUST NOT be created. |
| B4 | TASK-AGT-014 impossible cancellation scenario | TASK-AGT-014.md | YES | Cancellation section (line 208-226) rewritten. Now states "Cancellation is not architecturally possible" explicitly, explains Claude Code Task tool is synchronous, and handles timeout-only case with `analysis_timeout` reason. Also adds `last_analysis_invocation` field for detecting unanalyzed invocations. |

**Result: 4/4 blockers resolved.**

---

## 2. Important Fix Verification

| # | Issue | File | Fixed? | Evidence |
|---|-------|------|--------|----------|
| I1 | Leading-digit agent names silently fail sanitization | TASK-AGT-001.md | YES | `sanitizeAgentName` (line 205) now has `.replace(/^[0-9-]+/, '')` that strips leading digits and hyphens. Test case on line 744 confirms `"123-agent"` returns `"agent"`. Clear error path for names that become too short after stripping. |
| I2 | Levenshtein distance unreliable in prompt | TASK-AGT-004.md | YES | Step 3 (line 111) now states "Levenshtein distance was considered but dropped -- unreliable when computed by the orchestrator in a prompt. Substring match is sufficient for Phase 1." Step 4 (line 131-145) documents Master Prompt Framework with all 12 Principles. |
| I3 | Dangerously heuristic user feedback detection | TASK-AGT-014.md | YES | User feedback section (line 230-256) completely reworked. Now uses structured prompt: `"Agent output above. Quick feedback? (good / bad / skip)"` with explicit keyword mapping. Also addresses EC-LEARN-007 contradictory feedback (line 258-260). |
| I4 | `applied_rate: 1.0` with zero data after counter reset | TASK-AGT-015.md | YES | Line 108-110 now sets all rates to `0.0` with explicit NOTE: "All rates set to 0.0 (not 1.0) because 0/0 is undefined. Rates will be computed after the first post-evolution invocation." |
| I5 | EC-LEARN-006 (MemoryGraph unavailable during version storage) | TASK-AGT-015.md | NO | Not addressed. The version record storage in Step 6 (line 117-119) still assumes MemoryGraph is available. No fallback to local-only storage with deferred sync. |
| I6 | Few-shot example in Haiku evolution prompt | TASK-AGT-015.md | NO | The evolution prompt template (line 130-176) still has no few-shot example in the prompt itself. The SEARCH/REPLACE example (line 180-187) exists in the schema section but is not part of the user message template. |
| I7 | Pre-implementation Haiku JSON conformance testing gate | All Phase 4 specs | NO | Neither TASK-AGT-014 nor TASK-AGT-015 mention a pre-implementation step to test Haiku prompt templates for JSON conformance rate. |
| I8 | `.claude/agents/traces/` in `.gitignore` | TASK-AGT-003.md | YES | `.gitignore` entry section (line 113-124) now includes both `.claude/agents/traces/` and `.claude/agents/versions/` with explanatory comments. |

**Result: 5/8 important fixes applied. 3 deferred (I5, I6, I7).**

---

## 3. Regression Check (fixes introducing new issues)

| File | New Issues? | Notes |
|------|-------------|-------|
| TASK-AGT-001.md | None | Leading-digit strip regex is correct. Test case updated consistently. |
| TASK-AGT-003.md | None | Gitignore entries are additive. No conflict with TASK-AGT-002. |
| TASK-AGT-004.md | None | Levenshtein removal is clean. Master Prompt Framework reference is well-integrated. Smoke Test 3 (line 414) still references "Levenshtein distance 1" in its description, but the actual test behavior (substring match warning) is what matters. Minor wording artifact only. |
| TASK-AGT-005.md | None | Fallback meta.json is now schema-complete. `evolution_history_last_10: []` is a Phase 4 extension but compatible with `additionalProperties: true` in TASK-AGT-001 schema. |
| TASK-AGT-006.md | None | Reference agents are consistent with Master Prompt Framework. All 3 agents have OUTPUT FORMAT as a section header, aligning with TASK-AGT-004's generation template. |
| TASK-AGT-008.md | None | Global guard is clean. Triggers are standard format. STOPWORDS position (line 290) is still after use (line 244) but this was noted in Round 1 as minor and is a constant definition — acceptable for a spec document. |
| TASK-AGT-014.md | None | Structured feedback is a clean improvement. The `"good / bad / skip"` prompt is simple and unambiguous. Contradictory feedback handling addresses EC-LEARN-007 from the PRD. |
| TASK-AGT-015.md | None | Rate reset to 0.0 is mathematically correct. |

**Result: No regressions detected.**

---

## 4. Deferred Items (acknowledged, not blocking)

The following 3 important items from Round 1 were not addressed in this round. They are real gaps but can be implemented as TODOs without blocking Phase 1-4 implementation:

1. **I5 (EC-LEARN-006 MemoryGraph fallback for version storage)**: Risk is low -- MemoryGraph unavailability during evolution is an edge case within an edge case (evolution itself is infrequent). The version backup files on disk provide a safety net. Recommend adding a TODO comment in TASK-AGT-015 Step 6.

2. **I6 (Few-shot example in evolution prompt)**: The SEARCH/REPLACE schema section serves as a de facto example. Haiku's instruction-following for this format is likely adequate given the explicit schema. Can be added if evolution edit quality is observed to be low during implementation.

3. **I7 (Haiku JSON conformance pre-test)**: This is a process improvement, not a spec defect. The implementer should validate prompt templates against Haiku as part of the implementation itself. Recommend adding to the Sherlock gates: "Run 5 test prompts through Haiku, verify JSON parse success rate >= 80%."

---

## 5. Verdict

**APPROVED** -- ready for implementation.

All 4 blockers are resolved. 5 of 8 important fixes are applied. The 3 deferred items are low-risk and can be addressed during implementation or as fast-follows. No regressions introduced by the fixes.
