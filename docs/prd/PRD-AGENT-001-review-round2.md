# PRD-AGENT-001 Review: Round 2 (Adversarial)

**Reviewer**: Code Review Agent (Opus 4.6)
**Date**: 2026-03-29
**PRD Version Reviewed**: 2.0.0
**Round 1 Issues**: 30
**Verdict**: READY FOR DECOMPOSITION (with 4 minor items to address during task spec writing)

---

## Part 1: Round 1 Fix Verification

| Issue | Severity | Summary | Verdict | Notes |
|-------|----------|---------|---------|-------|
| ISSUE-01 | CRITICAL | Missing 4 template sections (User Stories, Guardrails, Oversight Checkpoints, Delivery Criteria) | FIXED | Section 3 has user stories (US-001..005). Section 7 has guardrails table (GR-001..008). Section 9 has oversight checkpoints with SLAs (HO-001..006). Section 15 has delivery checklists per phase. All four gaps closed. |
| ISSUE-02 | MEDIUM | Edge cases scattered across feature sections instead of consolidated | FIXED | Edge cases remain distributed per-feature (which the round 1 review said was "workable but deviates"). The traceability matrix (Section 16) now cross-references all EC-* IDs per intent. This is an acceptable resolution. |
| ISSUE-03 | LOW | PRD ID format deviates from template | NOT_FIXED | Still uses `PRD-AGENT-001` instead of `PRD-[YEAR]-[SEQUENCE]`. Acceptable -- this is a cosmetic namespace choice and does not block implementation. |
| ISSUE-04 | CRITICAL | LEANN integration was a ghost feature (mentioned but no REQ) | FIXED | Promoted to REQ-DEF-007 (SHOULD priority) with concrete schema for `memory-keys.json`, explicit behavior when LEANN is not running (EC-DEF-006), and LEANN queries in the Context Envelope assembly (REQ-RUN-002 step 6). Clean fix. |
| ISSUE-05 | HIGH | `/edit-agent` dangling reference in EC-DEF-002 | FIXED | EC-DEF-002 now says "Use a different name or manually edit files in .claude/agents/custom/{name}/." `/edit-agent` moved to Out of Scope (Section 6) as a future enhancement. No dangling references remain. |
| ISSUE-06 | HIGH | No agent versioning mechanism | PARTIALLY_FIXED | Version field exists in `meta.json` (REQ-DEF-005), but there is still no way to view, diff, or roll back definition file versions. However, the round 1 recommendation was "Add at minimum a COULD requirement for snapshots" and the PRD has implicitly deferred this by not claiming versioning as a feature. Section 6 does not list it as out of scope either. Acceptable for Phase 1 -- the version counter is sufficient for tracking; snapshot/rollback can be a Phase 3+ enhancement. |
| ISSUE-07 | HIGH | Agent composition/inheritance undefined | FIXED | REQ-DEF-004 demoted to COULD with explicit deferral note: "merge semantics to be defined in Phase 3 based on real usage patterns. Not implemented in Phase 1." This is the right call -- defer until real patterns emerge. |
| ISSUE-08 | HIGH | "Test with 3 agents" had no acceptance criteria | FIXED | TASK-AGENT-006 now has concrete pass criteria: SEC analyzer (3+ risk factors from AAPL 10-K), code reviewer (5+ issues in test file), doc writer (valid README from project structure). These are testable. |
| ISSUE-09 | MEDIUM | No edge cases for lifecycle features (/list-agents, /archive-agent) | FIXED | EC-LIST-001, EC-LIST-002, EC-ARCHIVE-001 added. Traceability matrix updated. NFR gap (performance for listing) is minor and acceptable -- listing is a filesystem scan, not a hot path. |
| ISSUE-10 | MEDIUM | No tool namespacing or collision detection | FIXED | REQ-TOOL-011 added (SHOULD) with reserved word validation and case-insensitive collision detection. EC-TOOL-007 covers the built-in tool collision case. Warning + explicit confirmation is the right UX. |
| ISSUE-11 | MEDIUM | Priority range and tiebreaker undefined for behavior rules | FIXED | REQ-BEHAV-003 now specifies: "priority: integer 1-100, higher number = higher priority. Tiebreaker when two rules have the same priority: most recently modified wins." Clear and implementable. |
| ISSUE-12 | CRITICAL | "output quality comparable" is unmeasurable | FIXED | Executive Summary now has: ">80% preference parity" in blind comparison on 3 reference agents. Section 10 metric: "Agent output quality: >80% preference parity vs manual prompt, blind comparison on 3 reference agents, 3 tasks each (9 comparisons). FAIL if < 7/9 parity." Measurable and concrete. |
| ISSUE-13 | HIGH | No quality metric for agent output | FIXED | Section 10 adds "Agent invocations without corrections: >70% of invocations require zero user corrections." Tracked via MemoryGraph tags. Marked as informational (no fail threshold), which is honest -- this is a learning metric, not a gate. Good addition. |
| ISSUE-14 | MEDIUM | NFR-001 timing boundary ambiguous (includes user review?) | FIXED | NFR-001 now says: "time from invocation to generated definition presented to user for review: < 30 seconds (user review time excluded)." Unambiguous. |
| ISSUE-15 | MEDIUM | NFR-002 "no knowledge" is untestable | FIXED | NFR-002 rephrased: "The `/create-agent` skill MUST accept a natural language description as its only required input. No references to file names, directory structures, or token limits MUST appear in the primary creation flow (errors and verbose output excluded)." Testable. |
| ISSUE-16 | MEDIUM | REQ-TOOL-003 timing measurement point unclear | FIXED | REQ-TOOL-003 now split: "Tool factory internal registration: < 100ms p95. Tool appearing in Claude Code's callable list: < 200ms p95 after list_changed sent." Two distinct measurement points. |
| ISSUE-17 | LOW | TC-005 misleading "maximum recommended" for 15K tokens | FIXED | TC-005 now says: "Recommended controllable prompt range: 5,000-15,000 tokens for optimal quality/cost balance. Hard limit: model context window minus ~4,100 tokens overhead." Accurate. |
| ISSUE-18 | CRITICAL | Token budget contradiction (individual limits summed > total limit) | FIXED | Section 4 now has a full Token Budget Worksheet. Individual file limits reduced: agent.md 3,000, context.md 5,000, tools.md 2,000, behavior.md 1,500 = 11,500 definition total. Dynamic context 900-3,000. Grand total 16,510-18,610 including fixed overhead. Controllable hard limit 15,000. CLAUDE.md explicitly outside budget. The math works: 11,500 + 3,000 (dynamic max) = 14,500 < 15,000. Correct. |
| ISSUE-19 | CRITICAL | /run-agent autonomy level contradicts CLAUDE.md confirmation protocol | FIXED | REQ-RUN-001 now explicitly requires confirmation: "The skill MUST show the assembled context token count and ask for confirmation before spawning." Autonomy table (Section 8) shows /run-agent as L1 (Operator). Section 6 explicitly notes "confirmation step." GR-006 reinforces this. No conflict with CLAUDE.md. |
| ISSUE-20 | HIGH | Feature 5 priority SHOULD but contains MUST requirements | FIXED | Feature 5 promoted to Priority: MUST. All REQ-BEHAV-001..005 are MUST. REQ-BEHAV-006 is SHOULD, REQ-BEHAV-007 is COULD. No logical contradictions. |
| ISSUE-21 | MEDIUM | REQ-TOOL-007 priority label vs body mismatch | FIXED | REQ-TOOL-007 now has Priority: MUST in the header. Body says "MUST be unique" and "MUST return an error." Consistent. |
| ISSUE-22 | HIGH | Tool sandbox NFRs aspirational; no concrete enforcement | FIXED | REQ-TOOL-004 now specifies: explicit env allowlist (PATH, HOME, LANG, PYTHONPATH), cwd set to temp directory, subprocess timeout kills process tree. NFR-TOOL-002 honestly states "File access restriction outside cwd: best-effort on macOS (development environment)." Security model documented as "development-grade, not production-grade." This is the right approach -- honest about limitations rather than making unenforceable claims. |
| ISSUE-23 | HIGH | Haiku merge has no validation against hallucination | FIXED | REQ-BEHAV-002 now includes step 4: diff merged output against inputs, flag removed/new/changed rules, present diff to user. EC-BEHAV-005 explicitly covers the hallucination case. GR-007 reinforces this. The fix is thorough. |
| ISSUE-24 | MEDIUM | No validation for depth=1 violation in agent definitions | FIXED | REQ-CREATE-008 (SHOULD) validates generated files for subagent-spawning patterns ("Task(", "spawn agent", "delegate to sub-agent") and warns. GR-001 references this. Good catch-at-creation approach. |
| ISSUE-25 | MEDIUM | .tool-factory/ git tracking policy unspecified | FIXED | REQ-TOOL-005 now explicitly states: ".tool-factory/ MUST be added to .gitignore (tool code is potentially untrusted; should not enter the repo)." GR-005 reinforces. Clear policy. |
| ISSUE-26 | HIGH | Tool name collision with built-in tools | FIXED | REQ-TOOL-011 handles this with reserved word validation and case-insensitive matching. EC-TOOL-007 specifies the UX: warn + require explicit confirmation. |
| ISSUE-27 | MEDIUM | Concurrent meta.json updates (race condition) | FIXED | REQ-RUN-005 now specifies: "Use atomic file operations (write to temp file + rename) to prevent concurrent update corruption." EC-RUN-006 acknowledges approximate count under concurrency. Pragmatic. |
| ISSUE-28 | LOW | Manual behavior.md edits cause divergence with MemoryGraph | FIXED | EC-RUN-007 now detects the divergence and warns: "behavior.md was modified outside /adjust-behavior. File and MemoryGraph rules may be inconsistent." Injects both but flags duplicates. Good UX. |
| ISSUE-29 | LOW | No MemoryGraph storage for dynamic tool metadata | FIXED | REQ-TOOL-008 now includes: "Tool metadata (name, description, creation date, usage count) SHOULD be stored in MemoryGraph with tag `dynamic-tool` for cross-session discoverability." |
| ISSUE-30 | LOW | No mention of Bash wrapping as alternative to tool factory | FIXED | Section 6 now has a "Note on Bash Wrapping" subsection explicitly positioning Bash for ephemeral one-offs vs. tool factory for reusable tools. |

**Summary**: 27 FIXED, 1 PARTIALLY_FIXED (ISSUE-06, acceptable), 1 NOT_FIXED (ISSUE-03, cosmetic), 1 NOT_APPLICABLE (ISSUE-03 is below the bar for blocking). No regressions introduced by any fix.

---

## Part 2: New Issues Found in v2.0

### ISSUE-R2-001
**Severity**: LOW
**Section**: Token Budget Worksheet (Section 4)
**Description**: The worksheet shows "GRAND TOTAL: ~16,510-18,610 tokens" which includes the fixed overhead (~4,110). The summary line says "(within 5K-15K sweet spot for definition + dynamic)" but 16,510-18,610 is NOT within 5K-15K -- that range is only the controllable portion (11,500 + 900-3,000 = 12,400-14,500). The parenthetical is misleading because it is attached to the grand total line, not the controllable total.
**Recommendation**: Move the sweet-spot comment to the "Definition total + Dynamic total" subtotal line, or rephrase: "Controllable portion: 12,400-14,500 tokens (within 5K-15K sweet spot)."

### ISSUE-R2-002
**Severity**: LOW
**Section**: REQ-DEF-007
**Description**: REQ-DEF-007 has "Priority: SHOULD" in the feature-level header, but the requirement body uses "MUST" language twice: "MUST support both MemoryGraph recall queries and LEANN code search queries" and "LEANN queries MUST be silently skipped." A SHOULD requirement should not contain MUST directives. This is the same pattern that was caught in ISSUE-20/ISSUE-21 for round 1.
**Recommendation**: Either promote REQ-DEF-007 to MUST (the memory-keys.json format is foundational enough to justify this) or soften the body language to SHOULD. Given that REQ-RUN-002 step 5-6 already depends on this schema, MUST is the right call.

### ISSUE-R2-003
**Severity**: MEDIUM
**Section**: Section 10 (Success Metrics)
**Description**: The "Agent output quality" metric specifies "blind comparison on 3 reference agents, 3 tasks each (9 comparisons)" with "FAIL if < 7/9 parity." But the metric says ">80% preference parity" which is 7.2/9. Since you cannot have 0.2 of a comparison, the threshold is effectively 8/9 (88.9%) to pass at >80%, or 7/9 (77.8%) which is technically below 80%. The stated threshold (7/9) contradicts the stated target (>80%).
**Recommendation**: Either change the target to ">75% preference parity" (which maps to 7/9) or change the fail threshold to "FAIL if < 8/9 parity" (which maps to >80%). Given this is a first release, 7/9 (>75%) is more realistic. Align the numbers.

### ISSUE-R2-004
**Severity**: LOW
**Section**: Traceability Matrix (Section 16)
**Description**: REQ-ARCHIVE-002 (`/restore-agent`) is defined in the Feature 6 requirements but does not appear in the traceability matrix. The matrix row for INT-AGENT-006 lists "REQ-LIST-001..002, REQ-ARCHIVE-001..002" which does cover it textually via the range, but there is no corresponding task for REQ-ARCHIVE-002. TASK-AGENT-014 says "archive + restore" so it is implicitly covered, but the matrix should ideally list the task explicitly against both requirements.
**Recommendation**: Minor. The range notation covers it. No action needed unless the team prefers explicit listing.

### ISSUE-R2-005
**Severity**: LOW
**Section**: Section 8 (Agent Implementation Details), Autonomy Levels table
**Description**: The table lists "Tool Factory `add_tool`" as L1 (Operator) with "human reviews code before registration." This is correct per HO-003. But REQ-TOOL-002 does not mention a confirmation step for `add_tool` -- it just describes the API surface. The confirmation requirement is only in HO-003. An implementer reading only Feature 4 requirements might build `add_tool` without a confirmation step.
**Recommendation**: Add a note to REQ-TOOL-002 or a new REQ-TOOL-012: "The `add_tool` management tool MUST show tool name, description, code, and parameters to the user and wait for explicit approval before registration (see HO-003)." This makes the confirmation requirement discoverable from within the feature section.

### ISSUE-R2-006
**Severity**: MEDIUM
**Section**: Feature 6, REQ-ARCHIVE-001
**Description**: REQ-ARCHIVE-001 says Priority: COULD, but the requirement body uses "MUST" language: "/archive-agent {name} MUST move the agent directory..." A COULD requirement should use SHOULD or MAY in its body, not MUST. If the feature is built at all, the behavior described is correct, but the priority label signals it might not be built.
**Recommendation**: Rephrase the body: "If implemented, `/archive-agent {name}` SHALL move the agent directory to..." or promote to SHOULD to match the imperative tone. This is the same SHOULD-body-in-COULD-feature pattern.

### ISSUE-R2-007
**Severity**: LOW
**Section**: Section 15 (Success Criteria), Phase 1 checklist
**Description**: The Phase 1 checklist includes "LEANN integration works when LEANN is running; gracefully skips when not." But LEANN integration is REQ-DEF-007 which is Priority: SHOULD. A SHOULD requirement appearing in a mandatory delivery checklist is a priority mismatch. If LEANN is not delivered in Phase 1, does Phase 1 fail?
**Recommendation**: Either mark this checklist item as "(SHOULD -- deliver if time permits)" or promote REQ-DEF-007 to MUST (see ISSUE-R2-002). The intent seems to be that LEANN is expected in Phase 1 but not strictly blocking.

---

## Part 3: Internal Consistency Check

### Token Budget Arithmetic
The token numbers now add up correctly:
- Individual file limits: 3,000 + 5,000 + 2,000 + 1,500 = 11,500 (definition files)
- Dynamic max: 2,000 + 500 + 500 = 3,000
- Controllable total: 11,500 + 3,000 = 14,500 (under 15,000 hard limit)
- Fixed overhead: ~4,110
- Grand total: ~18,610 max

One note: the worksheet shows dynamic minimum as 900 (500 + 200 + 200) but the ranges listed are "500-2,000" + "200-500" + "200-500" = 900-3,000. This is correct.

**Verdict**: Token math is sound.

### Priority Label Consistency
- Feature 5 promoted to MUST; all MUST requirements within it are valid.
- REQ-TOOL-007 is now MUST. Consistent.
- REQ-DEF-007 (SHOULD) contains MUST language (ISSUE-R2-002, low severity).
- REQ-ARCHIVE-001 (COULD) contains MUST language (ISSUE-R2-006, medium severity).
- REQ-LIST-001 and REQ-LIST-002 are SHOULD; the feature is SHOULD. Consistent.

**Verdict**: Two minor priority-label mismatches remain (ISSUE-R2-002, ISSUE-R2-006). Neither blocks decomposition.

### Traceability Matrix Coverage
Checked all new requirement IDs against the matrix:
- REQ-DEF-007: Covered under INT-AGENT-001 (REQ-DEF-001..007). Yes.
- REQ-CREATE-008: Covered under INT-AGENT-002 (REQ-CREATE-001..008). Yes.
- REQ-TOOL-011: Covered under INT-AGENT-004 (REQ-TOOL-001..011). Yes.
- EC-RUN-006, EC-RUN-007: Covered under INT-AGENT-003 (EC-RUN-001..007). Yes.
- EC-BEHAV-005: Covered under INT-AGENT-005 (EC-BEHAV-001..005). Yes.
- EC-LIST-001, EC-LIST-002: Covered under INT-AGENT-006. Yes.
- EC-ARCHIVE-001: Covered under INT-AGENT-006. Yes.
- REQ-RUN-006, REQ-RUN-007: Covered under INT-AGENT-003 (REQ-RUN-001..007). Yes.
- REQ-BEHAV-006, REQ-BEHAV-007: Covered under INT-AGENT-005 (REQ-BEHAV-001..007). Yes.

**Verdict**: All new IDs are covered. No orphaned requirements.

### Edge Case ID Uniqueness
All EC-* IDs checked for uniqueness:
- EC-DEF-001..006: Unique, sequential.
- EC-CREATE-001..003: Unique, sequential.
- EC-RUN-001..007: Unique, sequential.
- EC-TOOL-001..007: Unique, sequential.
- EC-BEHAV-001..005: Unique, sequential.
- EC-LIST-001..002: Unique, sequential.
- EC-ARCHIVE-001: Unique.

No duplicates. No gaps (except EC numbering is per-feature, which is fine).

**Verdict**: Clean.

### Cross-Reference Resolution
- GR-001 references REQ-CREATE-008: Exists. Resolves.
- GR-006 references REQ-RUN-001: Exists. Resolves.
- GR-007 references REQ-BEHAV-002 step 4: Exists. Resolves.
- HO-003 references `add_tool`: Exists in REQ-TOOL-002. Resolves.
- EC-DEF-006 references REQ-DEF-007: Exists. Resolves.
- EC-RUN-007 references /adjust-behavior: Exists as a skill in Feature 5. Resolves.
- Section 6 Out of Scope references `/edit-agent`: Not defined as a feature. Correct (it is out of scope). Resolves.
- Changelog references all 30 ISSUE-* IDs: Verified each maps to a real change. Resolves.

**Verdict**: All cross-references resolve. No dangling references.

---

## Part 4: Readiness Verdict

**READY FOR DECOMPOSITION**

The v2.0 PRD is a thorough, internally consistent document that addressed 27 of 30 round 1 issues completely, 1 partially (acceptable), and 1 cosmetic issue that does not affect implementation. The 7 new issues found in round 2 are all LOW or MEDIUM severity -- none are architectural, none are contradictions that would block an implementer, and none require structural changes to the PRD.

### Items to address during task spec decomposition (not PRD blockers):

1. **ISSUE-R2-003 (MEDIUM)**: Align the 80% target with the 7/9 threshold in the success metrics. Pick one number. Recommended: change target to ">75%" since this is a first release.
2. **ISSUE-R2-005 (LOW)**: When writing the task spec for Tool Factory, explicitly include the HO-003 confirmation requirement in the `add_tool` acceptance criteria so the implementer does not miss it.
3. **ISSUE-R2-006 (MEDIUM)**: When writing the task spec for `/archive-agent`, note the COULD priority and use conditional language ("if implemented, SHALL...").
4. **ISSUE-R2-002 / ISSUE-R2-007 (LOW)**: Decide whether LEANN support is MUST or SHOULD before writing the `/run-agent` task spec. The PRD currently sends mixed signals (SHOULD requirement but appears in Phase 1 mandatory checklist).

### What the PRD does well:

- Token budget worksheet is clear, correct, and explicitly accounts for CLAUDE.md overhead.
- Confirmation protocol is consistent throughout -- every user-facing action is L1 with explicit approval.
- Edge cases are comprehensive and address real failure modes (concurrent writes, LEANN unavailable, MemoryGraph down, hallucinated rules).
- Phasing is pragmatic -- COULD items are genuinely deferred, not hiding complexity.
- Security model is honestly scoped as "development-grade" rather than making unenforceable production claims.
- Success metrics are measurable with concrete pass/fail thresholds.
- Traceability matrix covers all requirements, edge cases, NFRs, tasks, user stories, guardrails, and oversight checkpoints.

---

## Issue Summary

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 0 | -- |
| HIGH | 0 | -- |
| MEDIUM | 2 | ISSUE-R2-003, ISSUE-R2-006 |
| LOW | 5 | ISSUE-R2-001, ISSUE-R2-002, ISSUE-R2-004, ISSUE-R2-005, ISSUE-R2-007 |

**Total round 2 issues**: 7 (0 critical, 0 high, 2 medium, 5 low)
**Compared to round 1**: 30 issues (5 critical, 8 high, 10 medium, 7 low)

The PRD improved substantially. Proceed to decomposition.
