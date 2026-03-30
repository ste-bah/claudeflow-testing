# PRD-AGENT-001 Review: Round 1 (Adversarial)

**Reviewer**: Code Review Agent (Opus 4.6)
**Date**: 2026-03-29
**PRD Version Reviewed**: 1.0.0
**Verdict**: NOT READY FOR IMPLEMENTATION -- 28 issues found (5 critical, 8 high, 10 medium, 5 low)

---

## Summary

The PRD is a solid first draft with clear intent and good research backing. However, it has significant structural deviations from the ai-agent-prd.md template, multiple internal contradictions in token budgets, vague acceptance criteria, missing features that the synthesis explicitly recommended, and security gaps in the tool factory design. It reads like a synthesis repackaged as a PRD rather than a PRD derived from a synthesis -- many sections copy the research findings verbatim instead of converting them into testable requirements.

---

## CATEGORY 1: TEMPLATE COMPLIANCE

ISSUE-01: CRITICAL
Section: Overall structure
Description: The PRD is missing 4 of the 14 required sections from the ai-agent-prd.md template. The template mandates: (1) Executive Summary, (2) Problem Statement, (3) Target Users/Personas, (4) Feature Description and User Stories, (5) Functional Requirements, (6) Non-Functional Requirements, (7) Edge Cases, (8) Out of Scope, (9) Success Metrics, (10) Agent Implementation Details, (11) Guardrails and Constraints, (12) Risk and Mitigation, (13) Human Oversight Checkpoints, (14) Success Criteria for Delivery. The PRD is completely missing: Section 4 (User Stories -- no user stories exist anywhere), Section 11 (Guardrails and Constraints -- no guardrails table), Section 13 (Human Oversight Checkpoints -- escalation rules are informal prose, not the required checkpoint/trigger/action/SLA table), and Section 14 (Success Criteria for Delivery -- no delivery checklist). Section 7 (Agent Roles and Autonomy) is not a template section; it partially covers Section 10 (Agent Implementation Details) but omits Agent Tooling/Access, Agent Capability Assumptions, and cost budgets per task.
Recommendation: Add all 4 missing sections. Convert escalation rules ESC-001 through ESC-004 into the Human Oversight Checkpoints table with SLAs. Add a Guardrails table. Add a delivery checklist. Write user stories for at least the 3 primary workflows (create, run, adjust).

ISSUE-02: MEDIUM
Section: Overall structure
Description: The PRD embeds edge cases inside each feature section instead of consolidating them in a dedicated Section 7 (Edge Cases). The template specifies a single edge cases section with a unified table. The current approach scatters 19 edge cases across 5 subsections, making it impossible to verify completeness at a glance.
Recommendation: Either consolidate all edge cases into a single section (template-compliant) or add a cross-reference index in Section 7 that lists all EC-* IDs with pointers. The current structure is workable but deviates from template.

ISSUE-03: LOW
Section: Header metadata
Description: The PRD header uses `Owner: Steven Bahia` and `Agent: Archon (Claude Opus 4.6)` but the template specifies `Owner: [PM Name]` and `Status: Approved`. The PRD says `Status: DRAFT` which is fine, but there is no `PRD ID` field matching the template pattern `PRD-[YEAR]-[SEQUENCE]`. The document uses `PRD-AGENT-001` which is a different namespace.
Recommendation: Either adopt the template's ID format or document why the deviation is intentional. Minor but contributes to template non-compliance.

---

## CATEGORY 2: COMPLETENESS

ISSUE-04: CRITICAL
Section: Feature 3 (/run-agent), REQ-RUN-002 step 6
Description: The synthesis explicitly calls out LEANN integration as a recommended component of the Context Envelope (Section 6, `memory-keys.json` includes `leann_queries`). The PRD mentions "optionally query LEANN for code context" in REQ-RUN-002 step 6 but there is NO requirement for LEANN integration. No REQ-* ID covers it. No edge case addresses what happens when LEANN is not running. No NFR specifies LEANN query latency. The word "optionally" makes this a ghost feature -- it is mentioned but not specified, not testable, and not traceable. An implementer will either skip it entirely or implement it ad-hoc with no quality gate.
Recommendation: Either promote LEANN integration to a SHOULD requirement with its own REQ-* ID, edge cases (LEANN not running, LEANN returns no results, LEANN query exceeds latency budget), and an NFR for query time, OR explicitly move it to Out of Scope with a rationale.

ISSUE-05: HIGH
Section: Missing feature
Description: There is no `/edit-agent` command. EC-DEF-002 references it ("Use a different name or run /edit-agent {name}") but no feature, requirement, or task defines it. This is a dangling reference. Users who follow the error message will find a command that does not exist.
Recommendation: Either add `/edit-agent` as a SHOULD feature (even if it just opens the agent directory files for manual editing) or remove the reference from EC-DEF-002 and replace with guidance to manually edit files.

ISSUE-06: HIGH
Section: Missing feature
Description: There is no agent versioning mechanism. `meta.json` has a `version` field that increments on definition file changes (REQ-DEF-005), but there is no way to: (a) view previous versions of an agent definition, (b) roll back to a previous agent version (only behavior rollback exists), (c) diff two agent versions, or (d) pin a specific agent version in a workflow. The synthesis mentions that Agent Zero has no versioning either, but this PRD claims to improve on Agent Zero.
Recommendation: Add at minimum a COULD requirement for agent definition snapshots (zip the directory on version increment, store in `.claude/agents/versions/{name}/{version}/`).

ISSUE-07: HIGH
Section: Missing feature
Description: There is no agent composition mechanism. The synthesis identifies that Agent Zero shares `AgentContext` across agents. The PRD has no way to reference one agent's `context.md` from another agent, inherit tool instructions across agents, or build agent hierarchies. REQ-DEF-004 mentions "override-based merging" with a "base template" but never defines what the base template is, where it lives, how merging works, or what "override" means concretely.
Recommendation: Either flesh out REQ-DEF-004 with concrete merge semantics (which files override which, deep merge vs. replace, conflict resolution) or demote it to COULD with an explicit "deferred" note.

ISSUE-08: HIGH
Section: Section 6 (Scope), Out of Scope
Description: "Automated agent testing framework" is listed as out of scope, but there is no alternative quality assurance mechanism. TASK-AGENT-006 says "Test with 3 real agents" but there is no definition of what "test" means, no pass/fail criteria for those tests, and no way to regression-test agent definitions after behavior adjustments. If an `/adjust-behavior` call subtly degrades agent output quality, how would the user know?
Recommendation: Add at minimum a SHOULD requirement for a smoke-test mechanism: `/test-agent {name} --task "task" --expected-output-contains "string"` or similar. Alternatively, add success criteria to TASK-AGENT-006 that define what "test with 3 real agents" means concretely.

ISSUE-09: MEDIUM
Section: Feature 6 (/list-agents, /archive-agent)
Description: The traceability matrix row for INT-AGENT-006 shows no edge cases ("--") and no NFRs ("--"). This means: (a) there are no edge cases for `/list-agents` (what if there are 0 agents? 100 agents? agent directory is corrupted?), (b) there are no edge cases for `/archive-agent` (what if the agent is currently running? what if archive directory already has that name?), and (c) there are no performance requirements (how fast should listing be for 50+ agents?).
Recommendation: Add at least 3 edge cases for lifecycle features and link them to the traceability matrix.

ISSUE-10: MEDIUM
Section: Feature 4 (Tool Factory)
Description: The synthesis recommends a namespace prefix for dynamic tools ("Dynamic tools prefixed with requesting agent ID, e.g., `agent_research_parse_table`"). The PRD does not mention tool namespacing anywhere. Without it, two agents could create a tool named `parse_table` and collide silently.
Recommendation: Add a REQ-TOOL-* requirement for tool name namespacing or at minimum an edge case for name collisions with existing tools (both other dynamic tools AND built-in/MCP tools).

ISSUE-11: MEDIUM
Section: Feature 5 (Behavior Adjustment)
Description: REQ-BEHAV-003 defines a behavior rule schema with `category`, `priority`, `source`, `version`, `active`, and `agent_scope`. But there is no requirement specifying the valid values for `priority` (is it 1-10? 1-100? higher=more important?). There is no requirement specifying how priorities are compared when injecting rules into the Context Envelope (REQ-BEHAV-004 says "highest priority first" but does not define the sort order). There is no requirement for what happens when two rules have the same priority.
Recommendation: Define priority as an explicit integer range (e.g., 1-100, higher wins) and specify tiebreaker behavior (e.g., most recently modified wins).

---

## CATEGORY 3: PRECISION

ISSUE-12: CRITICAL
Section: Section 1 (Executive Summary)
Description: "output quality comparable to a manually crafted Task tool invocation" is the core success criterion and it is completely unmeasurable. What is "comparable"? How do you test it? What metric quantifies output quality? This is the foundational promise of the entire system and it has no concrete definition.
Recommendation: Replace with a measurable criterion: "When tested against the 3 reference agents (SEC analyzer, code reviewer, doc writer), the agent's output must pass the same acceptance criteria as a manually crafted prompt, as judged by the user in a blind comparison (>80% preference parity)."

ISSUE-13: HIGH
Section: Section 8 (Success Metrics)
Description: "Agent reuse rate > 3 invocations per agent on average" is a vanity metric that tells you nothing about quality. A user who runs a broken agent 10 times trying to fix it would inflate this metric. There is no metric for agent output quality, agent definition quality, behavior rule effectiveness, or user satisfaction.
Recommendation: Add at least one quality metric: e.g., "% of agent invocations that require zero user corrections to the output" or "% of behavior adjustments that survive >5 invocations without rollback."

ISSUE-14: MEDIUM
Section: NFR-001
Description: "/create-agent MUST complete in < 30 seconds" -- this includes LLM generation. But the PRD also requires user review and approval (REQ-CREATE-003). Does the 30-second clock include the time the user spends reviewing? If yes, this is unreasonable. If no, this should say "time from invocation to preview shown to user." Ambiguous measurement boundary.
Recommendation: Clarify: "Time from `/create-agent` invocation to generated definition presented to user for review: < 30 seconds. User review time excluded."

ISSUE-15: MEDIUM
Section: NFR-002
Description: "Creating an agent MUST require no knowledge of the internal file format" -- this is a usability aspiration, not a testable requirement. How do you test "no knowledge"? What if the generated description mentions `agent.md` in an error message?
Recommendation: Rephrase: "The `/create-agent` skill MUST accept a natural language description as its only required input. No references to file names, directory structures, or token limits MUST appear in the primary creation flow (errors and verbose output excluded)."

ISSUE-16: MEDIUM
Section: REQ-TOOL-003
Description: "New tools MUST be callable within 200ms of registration" -- callable by whom? By the same session that called `add_tool`? By any concurrent subagent? The MCP `list_changed` notification is async; the 200ms budget is for the factory's internal processing, not for Claude Code's tool list refresh. The synthesis says "~50-100ms" for the refresh, but the PRD lumps both into 200ms. The measurement point is unclear.
Recommendation: Split into two metrics: (a) factory internal registration < 100ms, (b) tool appearing in Claude Code's callable list < 200ms after `list_changed` sent.

ISSUE-17: LOW
Section: TC-005
Description: "Maximum recommended prompt for Task tool: 15,000 tokens (sweet spot identified in research)" -- the synthesis says "5K-15K token sweet spot" which is a range, not a max. The PRD converts this to a ceiling. The actual hard limit is "model context minus ~4,100 tokens overhead" (also stated in TC-005) which for Opus 1M is ~996K tokens. Calling 15K a "maximum recommended" when the hard limit is 996K is misleading; it is an efficiency recommendation, not a constraint.
Recommendation: Rephrase: "Recommended prompt range: 5,000-15,000 tokens for optimal quality/cost balance. Hard limit: model context window minus ~4,100 tokens overhead."

---

## CATEGORY 4: CONSISTENCY

ISSUE-18: CRITICAL
Section: REQ-DEF-003 vs. TC-003 vs. TC-005 vs. Context Envelope spec
Description: The token budgets are internally contradictory. REQ-DEF-003 says individual file hard limits sum to: agent.md (5,000) + context.md (8,000) + tools.md (3,000) + behavior.md (2,000) = 18,000 tokens for definition files alone. REQ-DEF-003 also says "Total assembled prompt... hard limit 20,000 tokens." That leaves only 2,000 tokens for memory recall + workflow state + task description after all definition files are at their limits. But TC-003 says CLAUDE.md is auto-injected at ~2,100 tokens. If CLAUDE.md is counted in the 20,000 budget, there are NEGATIVE tokens remaining for the actual task. If CLAUDE.md is NOT counted, the true assembled prompt is 20,000 + 2,100 = 22,100 tokens, which conflicts with TC-005's recommendation of max 15,000. The synthesis (Section 6) specifies a total hard limit of 18,000 for definition files and "under 20,000 tokens" for the full prompt -- but this was BEFORE accounting for CLAUDE.md. Nobody reconciled these numbers.
Recommendation: Perform a concrete token budget worksheet. Proposed fix: (a) CLAUDE.md overhead (2,100) is OUTSIDE the 20,000 budget (it is auto-injected, not controllable), (b) definition file maximums should sum to no more than 14,000 (leave room for memory, task, and headroom), (c) reduce context.md hard limit from 8,000 to 6,000. Document this explicitly with a budget table.

ISSUE-19: CRITICAL
Section: REQ-RUN-004 vs. CLAUDE.md confirmation protocol
Description: REQ-RUN-004 says `/run-agent` spawns a Task tool subagent. The CLAUDE.md Prime Directive says all implementation requires explicit user confirmation. But REQ-RUN-004 has autonomy level L3 (Consultant) and the Agent Autonomy table says the agent "assembles and runs; human reviews output." This means `/run-agent` would execute the subagent WITHOUT asking for confirmation, which directly violates CLAUDE.md's confirmation protocol. The CLAUDE.md does carve out exceptions for `/god-code` and `/god-research` but NOT for `/run-agent`. Either the confirmation protocol needs a `/run-agent` exception, or `/run-agent` needs a confirmation step (which would make it L1, not L3).
Recommendation: Add `/run-agent` to the CLAUDE.md pipeline auto-execute override list, OR change the autonomy level to L1 with a mandatory "About to spawn agent '{name}' with {token_count} tokens. Proceed?" confirmation step. The latter is safer and consistent.

ISSUE-20: HIGH
Section: Feature 5 priority labels
Description: Feature 5 (Self-Directed Behavior Adjustment) has `Priority: SHOULD` at the feature level, but REQ-BEHAV-001 through REQ-BEHAV-005 are all `Priority: MUST`. A SHOULD feature cannot contain MUST requirements -- if the feature is optional, its requirements cannot be mandatory. This is a logical contradiction. Either the feature is MUST (and all its MUST requirements are valid) or it is SHOULD (and its requirements should be SHOULD/COULD).
Recommendation: Either promote Feature 5 to MUST (it is in Phase 2, which is planned, so this is reasonable) or demote REQ-BEHAV-001 through REQ-BEHAV-005 to SHOULD.

ISSUE-21: MEDIUM
Section: REQ-TOOL-007 priority label
Description: REQ-TOOL-007 says "Priority: SHOULD" in the header but the body says "Tool names MUST be unique" and "MUST return an error." The priority label contradicts the requirement text. This is a copy-paste error that creates ambiguity about whether uniqueness is mandatory.
Recommendation: Change priority to MUST (uniqueness enforcement is a correctness requirement, not optional).

---

## CATEGORY 5: ARCHITECTURAL SOUNDNESS

ISSUE-22: HIGH
Section: Feature 4 (Tool Factory), NFR-TOOL-002
Description: NFR-TOOL-002 says "Dynamic tool code MUST NOT have access to environment variables containing secrets." The enforcement mechanism is unspecified. Subprocess execution on macOS does NOT automatically strip environment variables -- child processes inherit the parent's environment by default. The PRD says sandboxing is "via subprocess isolation" (EC-TOOL-002) but subprocess isolation on macOS with Python's `subprocess` module does NOT prevent reading environment variables, does NOT prevent reading files outside the project directory (no chroot), and does NOT prevent spawning persistent processes (no cgroup/seccomp). The stated security NFRs are aspirational, not achievable with the stated implementation approach.
Recommendation: Specify concrete enforcement: (a) `subprocess.Popen(env={...})` with an explicit allowlist of safe environment variables (strip all secrets), (b) `cwd` set to a temp directory with only the tool's input files, (c) for file access restriction, either accept the risk (dev environment) or use a sandbox library like `firejail`/`nsjail`. Document which NFRs are "best effort in dev" vs. "hard enforcement."

ISSUE-23: HIGH
Section: Feature 5 (Behavior Adjustment), REQ-BEHAV-002
Description: The LLM-mediated merge pipeline uses Haiku (step 3) to merge behavior rules. Haiku is a small, fast model optimized for cost, not for nuanced rule conflict detection. The PRD expects this model to: (a) eliminate redundancies, (b) resolve conflicts by preferring newer adjustments, (c) produce a clean merged ruleset. But what if Haiku hallucinates a rule that was never in the input? What if Haiku silently drops a rule during merge? What if Haiku changes the semantics of a rule while "cleaning up" the wording? There is no validation step between the Haiku merge output and storage. REQ-BEHAV-005 says the user must approve, but a user looking at 20+ rules cannot reliably spot a subtle semantic drift introduced by the merge model.
Recommendation: Add a validation step: after Haiku merge, diff the merged output against the input rules. Flag any rule that was removed, any rule that appears new (not in inputs), and any rule whose wording changed by more than a fuzzy similarity threshold. Present the diff to the user, not just the merged result.

ISSUE-24: MEDIUM
Section: TC-001 (depth=1 constraint)
Description: The PRD acknowledges depth=1 but does not address what happens when a custom agent's `tools.md` instructs the agent to spawn subagents. A user could create an agent whose role description says "orchestrate a multi-step workflow by delegating to sub-agents." The agent would fail at runtime with no useful error. There is no validation at creation time to catch this.
Recommendation: Add a validation rule in `/create-agent`: scan generated `agent.md` and `tools.md` for patterns that imply subagent spawning ("Task(", "spawn agent", "delegate to") and warn: "Custom agents cannot spawn subagents (depth=1 constraint). Rephrase the agent's role to perform tasks directly."

ISSUE-25: MEDIUM
Section: Feature 4, REQ-TOOL-005
Description: Tool definitions persist to `.tool-factory/tools/{name}.json`. The PRD says nothing about what happens to these files across git branches. If a user creates a tool on branch A, switches to branch B, the tool files are still on disk (untracked). If the tool factory auto-loads on restart, tools from branch A leak into branch B. If `.tool-factory/` is gitignored, tools are local-only and cannot be shared. If it is tracked, tool code (potentially untrusted) enters the repo.
Recommendation: Add a requirement specifying: (a) whether `.tool-factory/` should be gitignored (recommended: yes), (b) whether tools are branch-scoped or global, (c) whether tool definitions should be exportable/importable for sharing.

---

## CATEGORY 6: EDGE CASES THE PRD MISSED

ISSUE-26: HIGH
Section: Feature 4 (Tool Factory)
Description: What happens if `add_tool` is called with a name that collides with a built-in Claude Code tool (e.g., `Read`, `Write`, `Bash`, `Grep`) or an existing MCP tool (e.g., `mcp__memorygraph__store_memory`)? The tool would be registered as `mcp__tool-factory__Read` which is technically unique, but the description could confuse the LLM into calling the wrong tool. REQ-TOOL-007 only prevents collisions within the factory's own namespace.
Recommendation: Add an edge case: "If tool name matches a built-in or MCP tool name (case-insensitive), warn user and suggest a more specific name. Allow override with `--force` flag."

ISSUE-27: MEDIUM
Section: Feature 3 (/run-agent), REQ-RUN-005
Description: What happens if two concurrent `/run-agent` calls for the same agent both try to update `meta.json` simultaneously? Both read `invocation_count: 5`, both write `invocation_count: 6`, and one invocation is lost. The PRD has no concurrency control for `meta.json`.
Recommendation: Add an edge case: "Concurrent invocations of the same agent MUST use atomic file operations (write to temp file + rename) to prevent data loss in meta.json. Invocation count may be approximate under concurrency."

ISSUE-28: LOW
Section: Feature 5 (Behavior Adjustment)
Description: What if a user manually edits `behavior.md` directly (via a text editor, not `/adjust-behavior`)? The MemoryGraph rules and the file contents would diverge. On the next `/run-agent`, which takes precedence -- the file or MemoryGraph? REQ-BEHAV-004 says MemoryGraph rules are injected. REQ-RUN-002 step 4 says `behavior.md` is read. Both would be injected, potentially with duplicate or conflicting rules.
Recommendation: Add reconciliation logic: on `/run-agent`, compare `behavior.md` mtime against last known edit timestamp in MemoryGraph. If the file was modified externally, warn user: "behavior.md was modified outside /adjust-behavior. Rules may be inconsistent. Run /adjust-behavior to reconcile."

---

## CATEGORY 7: MISSING FROM SYNTHESIS

ISSUE-29 (BONUS): LOW
Section: Synthesis Section 2 (Feature 1)
Description: The synthesis recommends "MemoryGraph registration: Store tool metadata in MemoryGraph for cross-session discoverability" for dynamic tools. The PRD's REQ-TOOL-008 only logs to a file. There is no requirement for tool metadata in MemoryGraph. This means tools created in session A are only discoverable in session B by reloading from disk -- there is no semantic search for "what tools have I created before?"
Recommendation: Add a SHOULD requirement: "Tool metadata (name, description, creation date, usage count) SHOULD be stored in MemoryGraph with tag `dynamic-tool` for cross-session discoverability."

ISSUE-30 (BONUS): LOW
Section: Synthesis Section 2
Description: The synthesis recommends "Bash wrapping is the fallback for one-offs only" but the PRD never mentions Bash wrapping as an alternative to the tool factory for ephemeral computations. This is a useful escape hatch that the PRD should acknowledge in the scope section.
Recommendation: Add a note in Section 6 (Scope): "For ephemeral one-off computations, agents may use the Bash tool directly. The tool factory is for reusable, schema-validated tools that persist across invocations."

---

## ISSUE SUMMARY

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 5 | ISSUE-01, ISSUE-04, ISSUE-12, ISSUE-18, ISSUE-19 |
| HIGH | 8 | ISSUE-05, ISSUE-06, ISSUE-07, ISSUE-08, ISSUE-20, ISSUE-22, ISSUE-23, ISSUE-26 |
| MEDIUM | 10 | ISSUE-02, ISSUE-09, ISSUE-10, ISSUE-11, ISSUE-14, ISSUE-15, ISSUE-16, ISSUE-24, ISSUE-25, ISSUE-27 |
| LOW | 5 | ISSUE-03, ISSUE-17, ISSUE-21, ISSUE-28, ISSUE-29, ISSUE-30 |

**Top 5 actions before this PRD is implementable:**

1. **Fix the token budget contradiction** (ISSUE-18). This is a math error that will cause runtime failures. Do the arithmetic, publish a budget table.
2. **Add the 4 missing template sections** (ISSUE-01). User stories, guardrails, oversight checkpoints, and delivery criteria are not optional in the template.
3. **Resolve the CLAUDE.md confirmation protocol conflict** (ISSUE-19). Either `/run-agent` gets an exemption or it gets a confirmation step. Cannot be both L3 and compliant.
4. **Define "output quality comparable"** (ISSUE-12). The core success criterion must be measurable or the entire system has no acceptance test.
5. **Decide on LEANN: in or out** (ISSUE-04). Ghost features are worse than missing features because they create false expectations.
