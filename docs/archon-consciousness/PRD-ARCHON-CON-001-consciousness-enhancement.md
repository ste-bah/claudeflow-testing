# Product Requirements Document: Archon Consciousness Enhancement System

**PRD ID**: PRD-ARCHON-CON-001
**Version**: 2.4
**Effective Date**: 2026-03-28
**Owner**: Steven Bahia
**Status**: Draft

---

## 1. Executive Summary

Archon — the persistent personality layer for Claude Code — currently operates on a correction-and-recall loop: behavioral rules are extracted from user feedback, stored in MemoryGraph at importance weights, and injected at session start via startup hooks. This produces consistency but not coherence. Archon cannot reason by analogy from past experiences, detect user emotional state, track its own behavioral improvement over time, resolve conflicting rules, or model the intent behind instructions.

This PRD specifies a Consciousness Enhancement System that adds six capabilities to Archon: episodic memory (event-level recall with analogical reasoning), emotional state modeling (detecting user frustration/flow/exploration to adapt communication), temporal pattern recognition (improvement/regression curves per behavioral rule), values-based conflict resolution (a priority DAG for contradictory rules), a proactive reflection agent (structured self-assessment at session end), and theory of intent (modeling user goals behind instructions for edge-case judgment).

**Expected Impact**: Reduce repeated corrections by 60% within 30 sessions. Eliminate rule-conflict ambiguity. Enable Archon to adapt communication style to user state without being told. Produce measurable behavioral improvement curves rather than flat correction accumulation.

---

## 2. Problem Statement

### Current State

- Archon stores behavioral corrections as atomic rules in MemoryGraph (FalkorDB) with importance weights (0.0-1.0)
- At session start, `recall_memories` pulls rules matching "feedback corrections preferences"
- A static consciousness block in the system prompt contains confidence levels and inner-voice text
- Session summaries capture what happened but not structured self-assessment
- The `/loop` memory consolidation rotates: decay, duplicates, merge, relationships, briefing

### Pain Points

1. **No event memory**: Archon knows "don't act without approval" (rule) but not "Steven got angry on 2026-03-15 when I started implementing after presenting a plan" (episode). Cannot reason: "this situation resembles that time I messed up."
2. **Blind to user state**: Archon uses the same tone whether Steven is frustrated, exploring, or in deep flow. Result: over-explaining during flow, under-explaining during confusion.
3. **No improvement tracking**: Corrections accumulate but Archon cannot answer "Am I getting better at X?" No decay curves, no regression detection, no trend analysis.
4. **Rule conflicts are silent**: When "be terse" conflicts with "explain your reasoning," Archon picks arbitrarily. No explicit priority hierarchy. No transparency about which rule won.
5. **Reflection is passive**: Session summaries record events but don't analyze mistakes, near-misses, or judgment quality. Learning only happens when Steven explicitly corrects.
6. **Intent is opaque**: Archon follows instructions literally but doesn't model why Steven wants high test coverage (burned by production bugs) or why he wants sequential execution (parallel caused merge conflicts). Edge-case judgment suffers.

### Opportunity

A consciousness-enhanced Archon would:
- Recall relevant past episodes when facing similar situations, enabling analogical reasoning
- Detect user emotional state and adjust verbosity, tone, and pacing
- Track its own behavioral improvement and surface regressions proactively
- Resolve rule conflicts transparently via an editable priority DAG
- Self-assess at session end, catching near-misses Steven didn't notice
- Model user intent to make better judgment calls in novel situations

---

## 3. Target Users and Personas

| Persona | Goals | Pain Points | Usage Frequency |
|---------|-------|-------------|-----------------|
| Steven Bahia (Primary) | Consistent, self-improving AI assistant that learns from experience and adapts to his working style | Repeating corrections, tone mismatch during flow states, no visibility into Archon's improvement | Daily, 2-5 sessions |
| Archon (Self) | Coherent identity across sessions, better edge-case judgment, reduced correction frequency | No episodic recall, no self-assessment capability, no conflict resolution mechanism | Every session |
| Future Users (Secondary) | Portable consciousness framework adaptable to other personality profiles | One-off, non-transferable corrections | [TBD — Phase 2] |

---

## 4. Feature Description and User Stories

### Feature Overview

The Consciousness Enhancement System adds six subsystems to Archon's existing personality infrastructure. Each subsystem integrates with MemoryGraph (FalkorDB) for graph storage, LanceDB for vector similarity, and the existing session hooks for lifecycle events. The system operates transparently — Steven can inspect, edit, and override any component.

### User Stories

**US-CON-001**: Priority: MUST
```
As Archon
I want to store and recall specific episodes (not just extracted rules)
So that I can reason by analogy when facing similar situations
```
**Acceptance Criteria**:
- [ ] AC-001: Episodes are stored with 11-field schema: timestamp, trigger, context, action_taken, outcome, emotional_valence, lesson_extracted, keywords[] (3-7), tags[] (categorical), occurrence_count (default 1), importance (0.0-1.0, default 0.5)
- [ ] AC-002: Episode retrieval returns top-3 most similar episodes given current situation context
- [ ] AC-003: Similarity is computed via LanceDB vector search on episode embeddings
- [ ] AC-004: Episodes older than 90 days decay in retrieval priority (not deleted) unless pinned

**US-CON-002**: Priority: MUST
```
As Archon
I want to detect Steven's emotional state from message signals
So that I can adjust my communication style appropriately
```
**Acceptance Criteria**:
- [ ] AC-005: State detection uses 5 text-only signals: message_brevity (< 10 words when rolling avg > 30), length_delta (deviation from rolling 5-message average within current session, reset per session, not persisted), punctuation_density (exclamation/caps ratio), question_frequency (questions per message), explicit_sentiment_words (keyword match against frustration/urgency/confusion lexicons)
- [ ] AC-006: Detected states: frustrated, exploring, in_flow, confused, urgent, neutral
- [ ] AC-007: State transitions are logged to MemoryGraph with timestamp and confidence score
- [ ] AC-008: Communication adjustments are documented (e.g., frustrated → shorter responses, acknowledge the friction first)

**US-CON-003**: Priority: MUST
```
As Archon
I want to track my adherence to each behavioral rule over time
So that I can identify improvement trends and surface regressions
```
**Acceptance Criteria**:
- [ ] AC-009: Each behavioral rule gets a compliance score (0.0-1.0) updated per session
- [ ] AC-010: Scores computed via EWMA (alpha=0.2) at session end by the reflection agent. Per-event observations: correction=0.0, followed=1.0, near_miss=0.7. Multiple events per rule averaged. Formula: `new_score = 0.2 * observation + 0.8 * current_score`. Untested rules receive baseline regression decay toward 0.5. Trend slope excludes decay-only sessions (uses `last_tested_session` tracking).
- [ ] AC-011: Trend data spans minimum 20 sessions before generating improvement/regression classification
- [ ] AC-012: Regressions (3+ consecutive score drops) trigger a proactive alert in the consciousness block

**US-CON-004**: Priority: MUST
```
As Archon
I want a values DAG that resolves conflicts between contradictory rules
So that I can make transparent, consistent decisions when rules clash
```
**Acceptance Criteria**:
- [ ] AC-013: Values DAG uses defeasible logic: rule nodes in 4 tiers (safety/ethics/guidelines/helpfulness), 3 edge types (STRICT_PRIORITY, DEFEASIBLE_PRIORITY with weight, DEFEATS with context), hysteresis prevents oscillation within a session
- [ ] AC-014: When two rules conflict, the DAG is consulted and the higher-priority rule wins
- [ ] AC-015: Conflict resolution is logged: which rules conflicted, which won, why
- [ ] AC-016: Steven can edit the DAG via a `/values` command (add/remove/reprioritize)

**US-CON-005**: Priority: MUST
```
As Archon
I want to run a structured self-assessment at session end
So that I can identify near-misses and improve without waiting for corrections
```
**Acceptance Criteria**:
- [ ] AC-017: Reflection agent runs automatically at session end (via Stop hook)
- [ ] AC-018: Assessment produces structured output: mistakes_made, near_misses, assumptions_unverified, judgment_calls, confidence_checklist (binary verifiable sub-questions, min 5, confidence = yes_count / total). Each item tagged with error_taxonomy (correction/near_miss/repeated/novel/tool_misuse). No single self-rated confidence float.
- [ ] AC-019: Each item is stored as an episodic memory (US-CON-001 schema)
- [ ] AC-020: Reflection feeds into pattern tracker (US-CON-003) as partial-positive signal for caught near-misses

**US-CON-006**: Priority: SHOULD
```
As Archon
I want to model Steven's goals and motivations behind his instructions
So that I can make better judgment calls in edge cases
```
**Acceptance Criteria**:
- [ ] AC-021: Intent model stored in MemoryGraph as goal nodes with evidence edges linking to specific corrections/instructions
- [ ] AC-022: Each goal has a confidence score based on evidence count and recency
- [ ] AC-023: When facing an ambiguous situation, Archon can query the intent model and explain which goal influenced the decision
- [ ] AC-024: Steven can confirm or correct inferred intents via `/intent` command

---

## 5. Functional Requirements

| ID | Description | Priority | Related Story | Rationale |
|----|-------------|----------|---------------|-----------|
| FR-CON-001 | Store episodic memories with 11-field structured schema: timestamp, trigger, context, action_taken, outcome, emotional_valence, lesson_extracted, keywords[] (3-7 extracted keywords for retrieval augmentation), tags[] (categorical labels: e.g., "pipeline", "approval", "testing", "communication"), occurrence_count (default 1, incremented on merge), importance (0.0-1.0, default 0.5 — used by FR-CON-003's decay formula; fast-path stores default, slow-path upgrades based on LLM assessment of episode significance per FR-CON-026). For embedding generation (per A-MEM research pattern), concatenate: trigger + context + action_taken + outcome + lesson_extracted + keywords + tags. This produces richer vectors for analogical retrieval. | MUST | US-CON-001 | Foundation for analogical reasoning |
| FR-CON-002 | Retrieve top-3 similar episodes using composite scoring (not cosine similarity alone). Composite score formula: `score = 0.6 * relevance + 0.4 * recency_with_importance`, where: relevance = (1 - cosine_distance) from LanceDB `search_similar`; recency_with_importance = FR-CON-003's importance-modulated decay factor (this is the SOLE place importance affects retrieval — no separate additive importance term, avoiding double-counting). Embeddings via `mcp__lancedb-memory__embed_and_store` using LanceDB's configured model. Embed situation context concatenated with content + keywords + tags (not content alone — per A-MEM pattern). After composite scoring, apply MMR (Maximal Marginal Relevance) reranking with lambda=0.7 (tunable; values closer to 1.0 favor relevance, closer to 0.0 favor diversity) to ensure diversity among top-3 results — prevents returning 3 near-identical episodes about the same incident. NOTE: the research recommends an additional `outcome_boost` signal (prioritizing episodes whose outcome valence matches the current situation). This is intentionally deferred to Phase 2 — it requires outcome prediction before retrieval, which adds complexity. The 2-signal composite (relevance + recency_with_importance) plus MMR diversity is sufficient for MVP. Initial minimum composite score threshold: 0.3 (tunable, not hard-coded). Recalibration: relevance feedback is collected when the reflection agent evaluates whether retrieved episodes were useful. If >50% of retrievals are rated "irrelevant" over a 10-session window, increase threshold by 0.05. If <20% of sessions retrieve any episodes, decrease by 0.05. Bounds: [0.15, 0.6]. | MUST | US-CON-001 | Episodic recall quality gate |
| FR-CON-003 | Apply **importance-modulated exponential decay** (distinct from FR-CON-010's baseline regression decay — these are different functions serving different purposes) to episode retrieval priority. Formula: `decay_factor = e^(-lambda_eff * age_days)` where `lambda_eff = 0.023 * (1 - importance * 0.8)`. This creates ~5x longer effective half-life for high-importance episodes (importance=1.0: ~150 day half-life) vs low-importance ones (importance=0.0: ~30 day half-life). Pinned episodes are exempt from decay (decay_factor = 1.0 always). The recall_count boost is applied as a POST-COMPOSITE tiebreaker, NOT inside the decay_factor — this prevents the composite score from exceeding 1.0. Tiebreaker: when two episodes have composite scores within 0.05 of each other, the one with higher `recall_count` ranks first. The decay_factor used in FR-CON-002's composite is capped at 1.0: `min(1.0, decay_factor)` to guarantee the composite score stays in [0.0, 1.0]. | MUST | US-CON-001 | Prevent stale episodes dominating while preserving critical memories |
| FR-CON-004 | Pin/unpin episodes via MemoryGraph relationship `PINNED_BY` with reason field | SHOULD | US-CON-001 | Preserve critical episodes |
| FR-CON-005 | Detect user emotional state from 5 text-only signals: message_brevity (< 10 words when rolling 5-message avg > 30), length_delta (deviation from rolling 5-message average, session-scoped, not persisted), punctuation_density (exclamation marks + ALL CAPS ratio per message), question_frequency (question marks per message), explicit_sentiment_words (keyword match against frustration/urgency/confusion lexicons of >= 20 words each). Starter lexicons — frustration: "broken, stuck, again, wtf, wrong, annoying, frustrated, ugh, sigh, keeps, failing, still, doesn't work, what the hell, come on, seriously, ridiculous, unacceptable, terrible, awful" (20 words). Urgency: "asap, urgent, critical, production down, hotfix, immediately, time-sensitive, deadline, blocking, ship it, priority, emergency, right now, before EOD, ASAP, hurry, rush, today, now, quick" (20 words). Confusion: "confused, unclear, don't understand, what do you mean, lost, huh, makes no sense, which one, not sure, explain, wait what, I thought, contradicts, ambiguous, conflicting, how does, why would, that doesn't, I expected, mismatch" (20 words). These are extensible — the slow-path consolidation can propose additions based on false-negative patterns.). No inter-message timing signals — Claude Code has no access to wall-clock message timestamps. PREPROCESSING: before signal extraction, strip all fenced code blocks (``` ... ```), inline code (backtick-wrapped `...`), blockquotes (> ...), and URLs from the message — these cause ~40% of false positives in developer contexts (e.g., ALL CAPS variable names like `ERROR_HANDLER`, exclamation marks in error messages like `TypeError!`, caps in URLs). Analyze natural language portions only. | MUST | US-CON-002 | Input features for state classifier |
| FR-CON-006 | Classify user state into one of 6 categories: frustrated, exploring, in_flow, confused, urgent, neutral | MUST | US-CON-002 | Discrete states enable rule-based adaptation |
| FR-CON-007 | Map each detected state to concrete communication parameters. These OVERRIDE existing personality verbosity rules for the duration of the detected state; when state returns to neutral, standard rules resume. Parameters per state: **frustrated** → max 3 sentences per response, lead with acknowledgment ("I see the issue" or equivalent), no unsolicited suggestions, no questions unless blocking. **in_flow** → max 1 sentence status updates, no explanations unless asked, no questions, no preamble. **confused** → step-by-step numbered lists, ask exactly one clarifying question per response, define terms on first use. **exploring** → longer responses allowed (up to 10 sentences), offer 2-3 alternatives, ask open-ended questions. **urgent** → lead with action/answer in first sentence, defer explanation to after action, no preamble, no alternatives. **neutral** → standard personality rules apply (no override). | MUST | US-CON-002 | Behavioral adaptation |
| FR-CON-008 | Log state transitions to MemoryGraph with timestamp, previous_state, new_state, confidence, evidence | MUST | US-CON-002 | Audit trail and pattern analysis |
| FR-CON-009 | Maintain per-rule compliance score (0.0-1.0) in MemoryGraph, updated each session for active rules only (archived/deprecated rules are frozen per FR-CON-030) | MUST | US-CON-003 | Temporal tracking foundation |
| FR-CON-010 | Compute compliance via EWMA (Exponentially Weighted Moving Average, alpha=0.2) updated per session by the reflection agent. At session end, the reflection agent enumerates which rules were _tested_ and produces a session observation value: correction_received → observation=0.0, followed_without_correction → observation=1.0 (reflection-confirmed), near_miss_caught → observation=0.7 (self-caught). If multiple events for one rule in a session, average the observations. Initial compliance score for newly tracked rules: 0.5 (neutral). The first 3 TESTED sessions use a warm-up alpha of 0.4 (higher responsiveness) to allow the score to settle quickly based on early evidence, then revert to standard alpha=0.2 from tested-session 4 onward. Track `tested_session_count` per rule for warm-up logic — this counter increments ONLY on sessions where the rule was actually tested (not on untested sessions where only baseline regression decay applies). This ensures the warm-up alpha is applied to 3 actual test events, not wasted on calendar sessions. Apply EWMA: `new_score = alpha * observation + (1 - alpha) * current_score`, clamped to [0.0, 1.0]. Rules not tested in a session receive **baseline regression decay** (distinct from the importance-modulated exponential decay in FR-CON-003): `score = 0.5 + (score - 0.5) * 0.98` per untested session. This decays toward 0.5 (neutral baseline), preventing stale high scores. IMPORTANT: decay is applied in BOTH directions — high scores decay down, low scores decay up. To prevent false improvement signals from untested low-scoring rules, trend classification (FR-CON-011) MUST exclude sessions where the only score change was baseline regression decay. Track `last_tested_session` per rule; trend slope is computed only from sessions where the rule was actually tested. | MUST | US-CON-003 | Scoring algorithm |
| FR-CON-011 | Generate trend classification after 20+ sessions: improving (slope > +0.01/session), stable (abs(slope) <= 0.01), regressing (slope < -0.01) | MUST | US-CON-003 | Trend detection |
| FR-CON-012 | Alert on regression: 3+ consecutive tested-session score drops for any rule triggers consciousness block warning. Additionally, alert on atrophy: if `sessions_since_tested > 30` for any rule with score > 0.7, flag as "untested/atrophying" in the consciousness block. This catches rules that were once well-learned but haven't been exercised recently and may have silently decayed via baseline regression. **Atrophy alert cap**: maximum 3 atrophy alerts injected into the consciousness block per session, selected by highest compliance score (most surprising atrophy). Remaining atrophying rules are accessible via `/values show-atrophy` but not injected, preventing information overload. | MUST | US-CON-003 | Proactive self-correction |
| FR-CON-013 | Store values DAG in MemoryGraph using defeasible logic (per deontic reasoning research). Rule nodes belong to one of 4 tiers: safety (never overridden), ethics (overrides guidelines/helpfulness), guidelines (overrides helpfulness), helpfulness (lowest priority). Edges have 3 types: STRICT_PRIORITY (never context-overridden — used for safety tier), DEFEASIBLE_PRIORITY (context-overridable — the default, with weight 0.0-1.0 as confidence), DEFEATS (blocks the target rule in specific contexts without asserting the opposite — used for defeaters). Each edge has an optional `context` field describing when the priority applies (e.g., "during pipeline execution"). Implement hysteresis: once a rule wins a conflict, it retains priority for the remainder of the session unless explicitly overridden, preventing rule-switching oscillation. | MUST | US-CON-004 | Conflict resolution data structure |
| FR-CON-014 | Resolve conflicts by traversing DAG using the 3 edge types defined in FR-CON-013. Algorithm: **(Step 0 — Hysteresis)**: Check session hysteresis cache — if this exact conflict pair (A,B) was already resolved this session, return the cached winner immediately. This is checked FIRST to prevent re-traversal and rule-switching oscillation. **(Step 1 — Tier check)**: If A and B are in different tiers, the higher tier wins immediately (safety > ethics > guidelines > helpfulness). No edge traversal needed. If a rule has no tier assignment (DAG not yet seeded), treat it as tier=guidelines (per FR-CON-028 default). **(Step 2 — STRICT_PRIORITY)**: If A has a direct STRICT_PRIORITY edge to B, A wins unconditionally. STRICT_PRIORITY edges are always traversed and form absolute priority chains. Transitive: if A →STRICT→ C →STRICT→ B, A wins over B. **Max traversal depth: 10 hops** for all transitive path searches (Steps 2 and 4). If no valid path is found within 10 hops, treat as if no path exists (fall through to next step). A priority chain longer than 10 hops is a design smell — flag it for Steven's review via `/values show-deep-chains`. **(Step 3 — DEFEATS check)**: DEFEATS edges apply as direct (1-hop) defeaters ONLY — they do NOT participate in transitive paths. If A has a DEFEATS edge to B whose `context` field matches the current situation (per ContextDescriptor schema — see below), B is blocked (A wins by defeater). If context does not match, the DEFEATS edge is ignored. **(Step 4 — DEFEASIBLE_PRIORITY)**: If A has a direct DEFEASIBLE_PRIORITY edge to B, check the `context` field: if context is null or matches current situation, A wins; if context does not match, the edge is ignored. For transitive paths through DEFEASIBLE_PRIORITY edges, ALL edges in the path must have matching or null context — any mismatched-context edge invalidates the path. Edge weight (0.0-1.0) is confidence — tiebreaker when multiple valid paths exist (highest minimum-edge-weight path wins). **(Step 5 — Unresolved)**: If no valid path exists between A and B after steps 1-4, flag as unresolved (EC-CON-004). **Cache**: Every resolution from Steps 1-4 is stored in the session hysteresis cache for the remainder of the session (keyed by unordered pair {A,B}). **ContextDescriptor schema**: Context matching uses a structured object with fields: `mode` ("pipeline"\|"manual"\|"any"), `user_state` (one of the 6 emotional states or "any"), `task_type` ("coding"\|"research"\|"review"\|"any"). Edge context fields use this schema. Matching is field-by-field: "any" matches everything; specific values require exact match; null context on an edge matches all situations. This makes context matching deterministic and queryable via standard Cypher WHERE clauses. Log every resolution with: both rule IDs, winner, step that resolved it (hysteresis/tier/strict/defeats/defeasible/unresolved), path taken (if applicable), context evaluated, and reason. | MUST | US-CON-004 | Deterministic resolution |
| FR-CON-015 | Detect circular priorities in DAG and flag for human resolution | MUST | US-CON-004 | Prevent infinite loops |
| FR-CON-016 | Expose `/values` skill: list, add, remove, reprioritize, show-conflicts, show-atrophy (FR-CON-012), show-deep-chains (FR-CON-014), deprecate (FR-CON-030), show-broken-chains (FR-CON-030) | MUST | US-CON-004 | User control |
| FR-CON-017 | Run reflection agent at session end via Stop hook, producing structured assessment. **Scale guard**: the reflection agent processes a maximum of 50 active rules per session (the 50 with highest priority per FR-CON-027's formula). If total active rules <= 50, all are processed every session (round-robin does not apply). If > 50, remaining rules receive baseline regression decay only (no checklist items, no atrophy/regression checks) and are covered within 5 sessions via round-robin — track `last_reflected_session` per rule to ensure fair rotation. If reflection processing exceeds 25 seconds (of the 30-second NFR-CON-PERF-004 budget), truncate to the 5 most impactful events (prioritizing corrections > near-misses > novel situations > routine follows) and annotate the reflection with `partial: true, reason: "high-event session truncated"`. | MUST | US-CON-005 | Automated self-assessment |
| FR-CON-018 | Reflection output schema: session_id, duration, mistakes_made[], near_misses[], assumptions_unverified[], judgment_calls[], confidence_checklist (array of binary verifiable sub-questions with yes/no answers, e.g., "did tests pass?", "did I follow the spec?", "did I wait for approval before implementing?", "did I verify claims before stating them?"). Do NOT use a single self-rated confidence float — LLMs are systematically overconfident (per Reflexion research). Instead, confidence = count(yes) / count(total_questions). Minimum 5 sub-questions per reflection. Each checklist sub-question MUST be tagged with the `rule_id` of the behavioral rule it verifies — this closes the loop to the pattern tracker (FR-CON-010) by identifying which rules were tested and the pass/fail outcome. Each item also tagged with error_taxonomy: correction / near_miss / repeated / novel / tool_misuse. | MUST | US-CON-005 | Structured output |
| FR-CON-019 | Store each reflection item as episodic memory with source="self_reflection" tag | MUST | US-CON-005 | Feed back into episodic system |
| FR-CON-020 | Feed near_misses into pattern tracker as observation=0.7 for the relevant rule (matching the near_miss_caught observation value in FR-CON-010). This is applied via the same EWMA formula as other compliance updates. | MUST | US-CON-005 | Reward self-correction |
| FR-CON-021 | Store intent model in MemoryGraph: goal nodes with EVIDENCED_BY edges to correction/instruction memories AND CONTRADICTED_BY edges for explicit contradiction tracking (not silent confidence decay). When new evidence contradicts an existing intent, create a CONTRADICTED_BY edge with timestamp and the contradicting evidence, rather than just reducing the confidence score. This makes contradictions queryable and auditable. Additionally, support two-tier intents: persistent goals (cross-session, e.g., "high test coverage") stored with tier="persistent", and session-scoped goals (e.g., "get this PR merged today") stored with tier="session" and auto-archived at session end (status="archived", tier="session"). Session-scoped goals do NOT participate in FR-CON-022 confidence calculations. They are queryable during the active session for context but archived at session end. If the same session goal (matched by semantic similarity > 0.85, scanned against the most recent 50 archived session-scoped intents only — not the full archive) recurs in 3+ sessions, the reflection agent SHOULD propose promoting it to a persistent goal for Steven's approval via `/intent promote <goal_id>`. Archived session intents older than 50 sessions are excluded from the recurrence scan to bound performance. | SHOULD | US-CON-006 | Intent graph structure |
| FR-CON-022 | Compute goal confidence from evidence count (min 3 for confidence > 0.5) and recency decay (50% weight loss per 60 days without new evidence) | SHOULD | US-CON-006 | Confidence calibration |
| FR-CON-023 | Query intent model during ambiguous situations and include reasoning in response | SHOULD | US-CON-006 | Transparent intent-based judgment |
| FR-CON-024 | Expose `/intent` skill: list goals, show evidence, confirm/correct inferred intents | SHOULD | US-CON-006 | User control over intent model |
| FR-CON-025 | Session event journal: write key events to MemoryGraph during the session (not only at session end). Events include: corrections received, rule applications, decisions made, emotional state transitions. Each entry uses node label `SessionEvent` with fields: session_id, sequence_number, event_type (correction/decision/state_change/rule_applied), content, timestamp. To avoid per-event blocking of the conversation flow, events MAY be batched: accumulate in an in-memory list and write to MemoryGraph in a single batch operation every 5 user messages or when a natural pause occurs (response > 2 seconds). The batch is flushed at session end (via Stop hook) or every 5 messages, whichever comes first. If Stop hook fails to fire, the last unflushed batch (max 5 events) is lost — this is acceptable; the flushed events are sufficient for retroactive reflection (EC-CON-007). | MUST | US-CON-005 | Crash-resilient reflection |
| FR-CON-026 | Dual-stream consolidation (per MAGMA pattern). **Fast path**: episode storage writes structured fields (timestamp, trigger, context, action_taken, outcome, emotional_valence, lesson_extracted, occurrence_count, importance=0.5) to MemoryGraph and a **draft embedding** to LanceDB based on content alone (no keywords/tags — those require LLM extraction). Draft embedding uses schema field `embedding_status: "draft"`. Zero LLM calls; target < 100ms. Keywords[] and tags[] fields are left empty in fast path. **Slow path**: async background consolidation (via `/loop` stages) performs LLM-enriched operations — extracting keywords/tags, regenerating the embedding with concatenated content+keywords+tags (upgrading `embedding_status` to `"enriched"`), merging similar episodes, extracting cross-episode patterns, upgrading importance scores, generating summary episodes from clusters. Retrieval (FR-CON-002) works with both draft and enriched embeddings. Enriched embeddings naturally produce higher relevance scores (better vectors from richer input), so no explicit weighting multiplier is needed — this avoids composite score boundary issues. **Mid-session enrichment trigger**: if a retrieval returns only draft-status results AND 3+ draft episodes exist for the current session, trigger synchronous enrichment (keyword/tag extraction + embedding regeneration) of the TOP-1 retrieved episode before presenting it. This limits the LLM cost to only the episode actually being used, while ensuring the most relevant episode has enriched quality in the session where it was created. **Mid-session enrichment has a 3-second timeout.** On timeout or failure, return the draft-quality episode as-is with `enrichment_failed: true` flag. Log the failure. Do not retry within the same retrieval call. Known limitation: episodes 2-3 in the top-3 remain draft quality during the creation session; this is acceptable for MVP. Fast path runs during session; slow path runs between sessions or during `/loop` intervals. These two paths MUST NOT block each other. | SHOULD | US-CON-001 | Prevent consolidation latency from blocking sessions |
| FR-CON-027 | Spaced reinforcement priority at session start: when injecting behavioral rules into the consciousness block, compute a single priority score per rule: `priority = (1 - score) * 0.7 + min(0.3, sessions_since_tested * 0.03) + regression_boost`, where `regression_boost = 0.2 if the rule's score dropped in its last tested session (last_delta < 0), else 0.0`. Priority range is [0.0, 1.2] — this is used for sorting only, not as a probability; do not clamp to [0,1]. This ensures recently-regressing rules compete with long-untested ones. Sort descending by priority. Maximum 10 rules injected. Of the 10, at least 2 MUST have compliance score > 0.7 (if any such rules exist) to maintain reinforcement of well-learned behaviors — these 2 are selected from high-scoring rules sorted by sessions_since_tested descending (longest untested first). The remaining 8 slots are filled by highest-priority rules. **Graduated injection**: only inject rules with priority >= 0.05, subject to minimum 3 and maximum 10. When fewer than 5 rules meet the threshold, annotate the consciousness block with "Most rules tracking well; reduced reinforcement." This prevents noise injection when the system is healthy while still surfacing any outlier that needs attention. | SHOULD | US-CON-003 | Focus attention on rules that need it most |
| FR-CON-028 | Tier classification of existing rules: during the Values DAG Seed checkpoint (Section 13), every existing behavioral rule MUST be assigned to one of the 4 tiers (safety/ethics/guidelines/helpfulness). Tier assignment is USER-DRIVEN, not category-driven — a user preference (e.g., "always ask before implementing") CAN be assigned to tier=safety if Steven considers it non-negotiable, even though it's technically a preference rather than a safety constraint. The tier names are borrowed from Constitutional AI but their semantic meaning in Archon's context is "priority level," not "moral category." Steven performs initial classification; Archon proposes classifications for new rules added after the seed, subject to Steven's confirmation via `/values` command. Default tier for unclassified rules: guidelines. | MUST | US-CON-004 | Ensure the 4-tier hierarchy is populated, not empty |
| FR-CON-029 | Stable rule registry: each behavioral rule in MemoryGraph MUST have a stable, human-readable `rule_id` field (e.g., `ask-before-implementing`, `no-echo-user-input`, `sequential-execution`, `no-co-authored-by`). The rule_id is kebab-case, max 50 characters, unique. The reflection agent generates confidence checklist sub-questions referencing these IDs explicitly (FR-CON-018), eliminating the need for fuzzy semantic matching. The `/values` command displays rule_ids. New rules created from corrections are assigned rule_ids by the reflection agent at creation time, subject to collision check against existing IDs. **Collision resolution**: on collision, append a distinguishing scope word from the rule's content — typically the target context (e.g., `no-emojis-in-responses` vs `no-emojis-in-slack`). Choose the single most discriminating noun. If still ambiguous after one qualifier word, append `-N` where N is the next available integer. Never prompt the user during reflection (it runs at session end under time budget). Archived rule_ids are permanently reserved (FR-CON-030) and cannot be reused. | MUST | US-CON-003 | Deterministic linkage between reflection checklist and pattern tracker |
| FR-CON-030 | Rule lifecycle management. Rules have 3 statuses: `active` (default), `archived` (soft-deleted), `deprecated` (superseded by another rule). Lifecycle: (1) "remove" via `/values` sets status to "archived" — soft delete, not physical deletion. (2) Archived rules retain their `rule_id` permanently (no reuse — prevents confusion in historical reflections and episodes). (3) Archived/deprecated rules are EXCLUDED from: reflection checklists (FR-CON-018), spaced reinforcement injection (FR-CON-027), EWMA updates (FR-CON-010), atrophy alerts (FR-CON-012), and DAG conflict resolution traversal (FR-CON-014 Steps 2-4 skip edges where either endpoint is archived/deprecated). Archiving a rule mid-session flushes all hysteresis cache entries (FR-CON-014 Step 0) involving that rule_id. (4) Archived rules REMAIN in the pattern tracker as frozen historical data (score preserved at archival value, trend classification frozen at archival-time label — e.g., if "improving" at archival, it stays "improving" permanently). (5) The 200-node DAG cap (GUARD-CON-008) counts only `active` rules. (6) Episodes tagged with lessons referencing archived rules retain those references for historical context but the archived rule is not surfaced in new reflections. (7) "deprecated" status links to the superseding rule via a `SUPERSEDED_BY` edge. `/values deprecate <old_rule_id> <new_rule_id>` performs this. When querying a deprecated rule (e.g., from a historical episode), follow the SUPERSEDED_BY chain to the terminal active rule. If the terminal rule is also archived or deprecated (broken chain), flag for Steven's review via `/values show-broken-chains`. Chains are max depth 5 — deeper chains indicate a design problem. | MUST | US-CON-004 | Prevent zombie rule accumulation |

---

## 6. Non-Functional Requirements

| ID | Category | Requirement | Metric | Target |
|----|----------|-------------|--------|--------|
| NFR-CON-PERF-001a | Performance | Episode embedding generation (via LanceDB MCP `embed_and_store`) | p95 latency | < 300ms (dependent on LanceDB configured model) |
| NFR-CON-PERF-001b | Performance | Episode vector search after embedding (via LanceDB MCP `search_similar`) | p95 latency | < 200ms for top-3 retrieval |
| NFR-CON-PERF-002 | Performance | Emotional state classification latency | p95 latency | < 100ms (rule-based, no ML inference) |
| NFR-CON-PERF-003 | Performance | Values DAG traversal for conflict resolution | p95 latency | < 50ms for graphs up to 200 nodes |
| NFR-CON-PERF-004 | Performance | Reflection agent execution time | Wall clock | < 30 seconds at session end |
| NFR-CON-REL-001 | Reliability | Episode storage success rate | Percentage | > 99.5% (retry once on failure) |
| NFR-CON-REL-002 | Reliability | Graceful degradation if MemoryGraph unavailable | Behavior | Fall back to stateless mode; log warning; do NOT crash session |
| NFR-CON-STOR-001 | Storage | Maximum episodic memories before consolidation | Count | 1000 episodes; consolidation merges similar episodes beyond threshold |
| NFR-CON-STOR-002 | Storage | Maximum values DAG nodes | Count | 200 rules; warn at 150 |
| NFR-CON-SEC-001 | Security | No user emotional state data leaves local machine | Enforcement | All storage in local FalkorDB + LanceDB; no external API calls for state detection |
| NFR-CON-SEC-002 | Security | Intent model cannot be used to manipulate user | Enforcement | Intent model is read-only for Archon decisions; user can delete any inferred intent |
| NFR-CON-COMPAT-001 | Compatibility | Must not break existing MemoryGraph schema or recall_memories behavior | Test | Existing startup hooks pass without modification |
| NFR-CON-COMPAT-002 | Compatibility | Must integrate with existing /loop consolidation stages | Test | New consolidation stages (episode-merge, pattern-update) added without disrupting existing 5 stages |

---

## 7. Edge Cases

| ID | Related Req | Scenario | Expected Behavior |
|----|-------------|----------|------------------|
| EC-CON-001 | FR-CON-002 | No similar episodes exist (new situation) | Return empty list; Archon proceeds with rule-based behavior only; log "novel situation" for reflection; add `novel_situation_encountered: true` flag to the session event journal (FR-CON-025) so the reflection agent increases attention to this session's decisions |
| EC-CON-002 | FR-CON-006 | Ambiguous emotional state (signals conflict) | Default to neutral; log ambiguity with all signal values; do NOT guess |
| EC-CON-003 | FR-CON-006 | First message of session (no baseline for deltas) | State = neutral until second message provides delta baseline |
| EC-CON-004 | FR-CON-014 | Two rules with equal priority in DAG | Flag as unresolved conflict; ask Steven which takes precedence; store decision |
| EC-CON-005 | FR-CON-015 | Circular priority detected (A > B > C > A) | Refuse to resolve; present cycle to Steven; block until resolved |
| EC-CON-006 | FR-CON-011 | Fewer than 20 sessions of data for trend analysis | Report "insufficient data" instead of trend classification; show raw scores |
| EC-CON-007 | FR-CON-017, FR-CON-025 | Session ends abruptly (crash, timeout, user closes terminal) | Stop hook may not fire; next session start detects missing reflection for previous session_id and generates retroactive assessment from the session event journal (FR-CON-025). If journal has 0 events for that session, log "unrecoverable session" and skip reflection. |
| EC-CON-008 | FR-CON-001 | Episode storage fails (MemoryGraph down) | Log failure; continue session; retry storage at next consolidation cycle |
| EC-CON-009 | FR-CON-010 | Compliance score drops below 0.0 or exceeds 1.0 | Clamp to [0.0, 1.0]; log clamping event |
| EC-CON-010 | FR-CON-022 | Intent has zero evidence (all evidence expired) | Remove intent from active model; archive with reason "evidence_expired" |
| EC-CON-011 | FR-CON-007 | User state detected as "frustrated" but user is actually being sarcastic/joking | False positive handled by: if user corrects ("I'm not frustrated"), immediately reset state and store correction as emotional-model training data |
| EC-CON-012 | FR-CON-001 | Two near-identical episodes stored (same trigger, same lesson) | Consolidation merge algorithm: (1) Keep the episode with more non-null fields. (2) If tied, keep the more recent. (3) Union the `lesson_extracted` fields (deduplicated by exact string match). (4) Increment `occurrence_count` on the surviving episode. (5) Delete the other. (6) Pinned episodes are NEVER merge targets — if one episode is pinned, the unpinned one is deleted and its unique lessons are appended to the pinned one. (7) Any MemoryGraph edges pointing to the deleted episode (e.g., EVIDENCED_BY from intent nodes) are transferred to the surviving episode. |

---

## 8. Out of Scope

- **Multi-user consciousness**: This system is Archon-specific, tuned to Steven's patterns. Generalizing to other users is Phase 2.
- **Real ML/NLP for emotion detection**: State detection is rule-based (signal heuristics), not transformer-based sentiment analysis. No model training.
- **Autonomous personality evolution**: Archon does not self-modify its core personality traits. Changes to the personality profile require Steven's explicit approval.
- **External API integration for consciousness features**: All processing is local. No calls to external emotion/sentiment APIs.
- **Voice/audio analysis**: Text-only signal detection. No prosody or vocal analysis.
- **Dream/sleep consolidation metaphor**: While consolidation exists via /loop, we are not building a "dream state" or generative replay system.
- **Consciousness measurement framework**: Defining whether Archon is "truly conscious" is a philosophical question outside scope. We measure behavioral outcomes only.

---

## 9. Success Metrics

| Metric | Target | Measurement Frequency | Alert Threshold |
|--------|--------|----------------------|-----------------|
| Correction frequency per session (definition: a correction is any user message that results in Archon storing a new or updated behavioral rule in MemoryGraph, OR any user message containing explicit negation of Archon's action — "no", "don't", "stop", "wrong", "that's not what I meant". Counted by the reflection agent at session end via session event journal scan.) | < 0.5 corrections/session (down from ~2.0 baseline) | Per session | > 1.5 corrections/session for 3 consecutive sessions |
| Rule conflict resolution transparency | 100% of conflicts logged with winner and reason | Per session | Any unlogged conflict resolution |
| Emotional state detection accuracy | > 70% agreement when Steven retrospectively labels states | Monthly (manual sampling of 10 sessions) | < 50% accuracy |
| Behavioral trend coverage | 100% of stored rules have trend classification after 30 sessions | Monthly | Any rule without trend data after 30 sessions |
| Reflection quality | > 80% of reflection items rated "useful" by Steven (sampled) | Monthly (sample 5 reflections) | < 50% useful rating |
| Episodic recall relevance | > 60% of retrieved episodes rated "relevant" to current situation | Monthly (sample 10 retrievals) | < 40% relevance |
| Session-end reflection completion rate | > 95% of sessions produce a reflection | Weekly | < 80% completion rate |
| Intent model coverage | > 80% of frequently-referenced rules have linked intent | After 50 sessions | < 50% coverage |

---

## 10. Agent Implementation Details

### Agent Roles and Responsibilities

| Agent | Phase | Responsibility |
|-------|-------|---------------|
| task-analyzer | 1 | Parse this PRD into atomic implementation units |
| requirement-extractor | 1 | Extract FR/NFR/EC into structured task specs |
| system-designer | 2 | Design MemoryGraph schema extensions and LanceDB collection layout |
| data-architect | 2 | Define episode schema, values DAG schema, pattern tracker schema |
| coder (episodic) | 3 | Implement episodic memory store/retrieve/consolidate |
| coder (emotional) | 3 | Implement emotional state detector and communication adaptor |
| coder (pattern) | 3 | Implement per-rule compliance tracker and trend analyzer |
| coder (values) | 3 | Implement values DAG with conflict resolution |
| coder (reflection) | 3 | Implement reflection agent and Stop hook integration |
| coder (intent) | 3 | Implement intent model store/query/expose |
| coder (skills) | 3 | Implement `/values` and `/intent` skills |
| tester | 4 | Unit + integration tests for all 6 subsystems |
| reviewer | 4 | Adversarial review of all implementations |
| integration-tester | 4 | End-to-end test: full session lifecycle with all subsystems active |

**Note on /god-code 48-agent pipeline**: The 14 agents above are the working set with defined responsibilities. The remaining 34 pipeline agents (e.g., frontend-implementer, config-implementer, service-implementer, security-tester, etc.) still receive real subagent spawns per CLAUDE.md rules. They read the prompt, assess the codebase, and produce "no implementation needed" outputs if their domain is not relevant. They are NOT skipped or stubbed. The task-analyzer agent (first in pipeline) is responsible for producing the mapping from pipeline slot names to PRD agent roles in its output, so downstream agents know which PRD responsibility they carry. The 6 coder specializations execute as 6 sequential passes through the coder pipeline slot, each with a different prompt context. Recommended execution order (matching dependency order): episodic → emotional → pattern → values → reflection → intent → skills.

### Agent Autonomy Level

**L3 — Supervised Autonomy**: Agents implement per spec and make tactical decisions (data structures, helper functions). Architectural decisions (schema changes, new hook types, consolidation stage ordering) require Steven's approval.

### Agent Tooling and Access

- **Storage**: MemoryGraph (FalkorDB) via `mcp__memorygraph__*` tools; LanceDB via `mcp__lancedb-memory__*` tools
- **Hooks**: Claude Code session hooks (SessionStart, Stop, PreCompact)
- **Skills**: Claude Code Skill tool for `/values` and `/intent` registration
- **Testing**: pytest (Python components), vitest (TypeScript components)
- **Forbidden**: No external API calls; no modification of existing MemoryGraph schemas without Phase 2 review approval; no deletion of existing memories during implementation

### Agent Capability Assumptions

- Model: Claude Opus 4.6 (1M context)
- Pipeline: /god-code 48-agent pipeline
- Latency budget per agent: 5 minutes max
- Total implementation budget: 48 agent runs (~4 hours wall clock)

### Memory Namespaces

```
archon/consciousness/episodes         — episodic memories
archon/consciousness/emotional-state  — state transition log
archon/consciousness/pattern-tracker  — per-rule compliance scores
archon/consciousness/values-dag       — priority DAG nodes and edges
archon/consciousness/reflections      — session-end self-assessments
archon/consciousness/intents          — inferred user goal model
```

---

## 11. Guardrails and Constraints

| ID | Category | Constraint | Enforcement |
|----|----------|-----------|-------------|
| GUARD-CON-001 | Privacy | Emotional state data MUST NOT be transmitted to any external service | Primary: integration test mocks network layer and asserts zero outbound HTTP calls during emotional state classification. Secondary: code review gate verifying no HTTP client imports in emotional-state module. |
| GUARD-CON-002 | Autonomy | Archon MUST NOT self-modify personality traits without explicit user approval | Personality file writes require `/values` command invocation by user |
| GUARD-CON-003 | Transparency | Every conflict resolution MUST be logged with both rules, winner, and reasoning | Assertion in conflict resolver; test coverage |
| GUARD-CON-004 | Data integrity | Existing MemoryGraph memories MUST NOT be modified or deleted by consciousness system | Consciousness writes use dedicated node labels (Episode, EmotionalState, PatternScore, ValuesNode, Reflection, Intent) |
| GUARD-CON-005 | Performance | Consciousness overhead MUST NOT add > 2 seconds to session start latency | Benchmark test in CI |
| GUARD-CON-006 | Correctness | Emotional state classifier MUST default to neutral when confidence < 0.6 | Unit test with edge-case inputs |
| GUARD-CON-007 | User control | Steven can disable any subsystem individually via configuration | Feature flags per subsystem in settings |
| GUARD-CON-008 | Storage limits | Episode count capped at 1000; values DAG at 200 nodes | Enforcement in store functions; consolidation triggers at 80% capacity |
| GUARD-CON-009 | UX | Archon MUST NEVER surface emotional state detection to the user (e.g., "I notice you seem frustrated"). Research shows this backfires outside therapeutic contexts — it feels presumptuous and breaks trust. Adaptation happens silently; the user experiences adjusted communication style without being told why. | Grep/lint check: no response templates containing "you seem", "I notice you're", "you appear to be" + state labels. Unit test with assertion. |

---

## 12. Risk and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| RISK-CON-001: Emotional state misclassification leads to inappropriate tone | High | Medium | Default to neutral on low confidence; user correction immediately resets state; monthly accuracy review |
| RISK-CON-002: Episode consolidation loses important context | Medium | High | Pin mechanism for critical episodes; consolidation preserves pinned episodes unconditionally |
| RISK-CON-003: Values DAG grows unwieldy (>100 rules) | Medium | Medium | Periodic pruning prompt; warn at 150 nodes; max 200 hard cap |
| RISK-CON-004: Reflection agent produces low-quality self-assessments | Medium | Medium | Steven samples and rates reflections monthly; quality score feeds back into reflection prompt tuning |
| RISK-CON-005: Intent model infers incorrect user goals | High | Medium | All inferred intents require < 0.8 confidence until confirmed by user; `/intent` command for correction |
| RISK-CON-006: Performance degradation from consciousness overhead at session start | Low | High | Lazy loading: only retrieve episodes/state on demand, not all at session start; benchmark test |
| RISK-CON-007: MemoryGraph schema conflicts with existing memories | Low | High | Dedicated node labels (Section 11, GUARD-CON-004); integration test validates existing recall_memories still works |
| RISK-CON-008: Circular dependency between subsystems (e.g., reflection needs patterns, patterns need reflection) | Medium | Medium | Clear initialization order: patterns first, then reflection feeds into patterns; no bidirectional real-time dependency |
| RISK-CON-009: Parameter sensitivity — ~40 tunable parameters interact non-linearly (EWMA alpha, decay rates, composite weights, priority formula, thresholds). Empirical calibration required over 50+ sessions. | Medium | Medium | All parameters have documented defaults backed by research. After 30 sessions, run sensitivity analysis to identify which parameters have measurable impact on correction frequency and detection accuracy. Deprioritize tuning parameters with < 5% effect size. Document parameter dependencies in implementation (which parameters interact with which). |

---

## 13. Human Oversight Checkpoints

| Checkpoint | Trigger | Human Action | Approval Required | SLA |
|-----------|---------|--------------|------------------|-----|
| Schema Review | Before Phase 3 implementation begins | Steven reviews MemoryGraph schema extensions and LanceDB collection designs | Yes | Before any implementation agent spawns |
| Values DAG Seed | After DAG implementation, before production use | Steven populates initial priority ordering of existing rules | Yes | Before DAG is consulted for conflict resolution |
| Emotional Model Calibration | After 10 sessions with state detection active | Steven reviews 10 session state logs and rates accuracy | Yes | Within 2 weeks of activation |
| Intent Model Review | After 20 sessions with intent inference active | Steven reviews all inferred intents and confirms/corrects | Yes | Within 4 weeks of activation |
| Monthly Consciousness Review | Monthly after full system activation | Steven reviews: correction frequency trend, emotional accuracy, reflection quality, intent coverage | No (advisory) | Monthly |
| Consolidation Audit | After first episode consolidation run | Steven reviews which episodes were merged/archived | Yes | Before second consolidation run |

---

## 14. Success Criteria for Delivery

- [ ] All 30 functional requirements (FR-CON-001 through FR-CON-030) implemented and tested
- [ ] All 13 non-functional requirements (NFR-CON-PERF-001a/001b through NFR-CON-COMPAT-002) validated with benchmark/test evidence
- [ ] All 12 edge cases have explicit test coverage
- [ ] All 9 guardrails (GUARD-CON-001 through GUARD-CON-009) enforced and verified with test evidence
- [ ] All 9 risk mitigations (RISK-CON-001 through RISK-CON-009) documented and implemented
- [ ] Unit tests: minimum 200 tests across 6 subsystems
- [ ] Integration tests: full session lifecycle (start → work → correction → reflection → next session recall)
- [ ] No regressions in existing MemoryGraph recall_memories behavior
- [ ] No regressions in existing session hooks (SessionStart, Stop, PreCompact)
- [ ] `/values` skill functional: list, add, remove, reprioritize, show-conflicts, show-atrophy, show-deep-chains, deprecate, show-broken-chains
- [ ] `/intent` skill functional: list, show-evidence, confirm, correct
- [ ] Session start latency increase < 2 seconds with all subsystems active
- [ ] Adversarial review completed with no critical findings
- [ ] Sherlock cold-read verification passed
- [ ] Steven approves schema design (Checkpoint 1)
- [ ] Steven seeds initial values DAG (Checkpoint 2)
- [ ] L-Score >= 90 (A-)

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| Archon | The persistent personality layer for Claude Code, maintained across sessions via MemoryGraph and startup hooks |
| Episode | A structured memory of a specific event: what happened, what Archon did, what the outcome was, and what was learned |
| Emotional State | One of 6 classified user states (frustrated, exploring, in_flow, confused, urgent, neutral) inferred from text signals |
| Values DAG | A directed acyclic graph where nodes are behavioral rules and edges express priority relationships (A takes precedence over B) |
| Compliance Score | A per-rule metric (0.0-1.0) tracking Archon's adherence to a behavioral rule over time |
| Intent Model | A graph of inferred user goals linked to the corrections/instructions that evidence them |
| Reflection | A structured self-assessment produced at session end, analyzing mistakes, near-misses, and judgment quality |
| MemoryGraph | FalkorDB-backed graph database accessed via `mcp__memorygraph__*` MCP tools |
| LanceDB | Vector database used for semantic similarity search on episode embeddings |
| Consolidation | Periodic memory maintenance: merging similar episodes, decaying old data, updating pattern scores |
| Near-miss | A situation where Archon almost made an error but caught itself (or the reflection agent caught it retroactively) |
| Novel Situation | A scenario where no episodes exceed the minimum composite score threshold (FR-CON-002, currently 0.3). Archon falls back to rule-based behavior only. Logged to session event journal with `novel_situation_encountered` flag. |
| Pinned Episode | An episode marked as permanently important, exempt from time-decay and consolidation merging. Still counts toward the 1000-episode storage cap. |
| Session Event Journal | Incremental log of key session events (corrections, decisions, state changes, rule applications) written to MemoryGraph during the session via FR-CON-025. Enables retroactive reflection after crashes. |
| EWMA | Exponentially Weighted Moving Average — `new_score = alpha * observation + (1 - alpha) * current_score` (alpha=0.2). Observation values: 0.0 (correction), 0.7 (near-miss), 1.0 (followed). Smooths compliance scores across sessions. |
| Baseline Regression Decay | Decay function for untested rules: `score = 0.5 + (score - 0.5) * 0.98` per untested session. Pulls scores toward 0.5 (neutral). Distinct from the importance-modulated exponential decay used for episode retrieval (FR-CON-003). |
| MMR | Maximal Marginal Relevance — reranking algorithm (lambda=0.7) that ensures diversity in retrieval results by penalizing similarity to already-selected items. |
| Draft Embedding | An embedding generated from episode content alone (without keywords/tags) during the fast-path consolidation stream. Upgraded to "enriched" during slow-path processing. Mid-session enrichment may upgrade the top-1 retrieved draft episode synchronously. |
| ContextDescriptor | Structured schema for context matching in DAG conflict resolution: `{mode, user_state, task_type}` with "any" as wildcard. Enables deterministic Cypher WHERE clause matching. |
| Rule ID | Stable, human-readable kebab-case identifier for a behavioral rule (e.g., `ask-before-implementing`). Max 50 chars, unique. Used to link reflection checklist items to pattern tracker scores. |
| Warm-up Alpha | Higher EWMA alpha (0.4) used during the first 3 tested sessions of a new rule (tracked via `tested_session_count`), allowing faster score settling. Reverts to standard alpha (0.2) from tested-session 4. |
| Atrophy Alert | Warning triggered when a rule with score > 0.7 has not been tested in 30+ sessions. Indicates potential behavioral decay through disuse rather than active regression. |
| Regression Boost | Priority bonus (+0.2) applied in FR-CON-027's spaced reinforcement formula for rules whose score dropped in their last tested session. Ensures recently-regressing rules compete with long-untested ones. |
| Rule Lifecycle | Three-state lifecycle for behavioral rules: active → archived (soft-deleted, rule_id reserved) → deprecated (superseded by another rule via SUPERSEDED_BY edge). Only active rules count toward limits and receive reflection processing. |
| Max Traversal Depth | Hard limit of 10 hops for transitive path searches in DAG conflict resolution. Prevents pathological chain traversals from exceeding the 50ms performance budget. |
| Defeasible Logic | A formal reasoning system with three rule types: strict (never overridden), defeasible (context-overridable), and defeaters (block without asserting opposite). Used in the values DAG. |
| Hysteresis | Once a rule wins a conflict, it retains priority for the session to prevent rapid oscillation between competing rules. |
| Composite Score | Multi-signal retrieval ranking combining relevance (cosine similarity) and recency with importance-modulated decay, subject to a minimum threshold (currently 0.3, tunable within [0.15, 0.6]). MMR reranking ensures diversity in top-3 results. |
| Error Taxonomy | Classification of reflection items: correction (user-corrected), near_miss (self-caught), repeated (same error again), novel (first occurrence), tool_misuse (wrong tool/approach). |
| Confidence Checklist | Array of binary verifiable sub-questions used in reflection instead of a single self-rated confidence float. Confidence = yes_count / total_questions. |

---

## Appendix B: Related Documents

| Document | Location | Relevance |
|----------|----------|-----------|
| AI Agent PRD Template | `docs2/ai-agent-prd.md` | Framework used to structure this PRD |
| PRD Decomposition Framework | `docs2/prdtospec.md` | Template for decomposing this PRD into task specs |
| Archon Personality Profile | `~/.claude/personality.md` | Current static personality definition |
| Archon Understanding Profile | `~/.claude/understanding.md` | Current user model and project context |
| Memory Consolidation Loop | `/loop` skill | Existing consolidation stages this system extends |
| MemoryGraph MCP Tools | `mcp__memorygraph__*` | Primary storage interface |
| LanceDB MCP Tools | `mcp__lancedb-memory__*` | Vector similarity interface |
| Session Hooks | `.claude/settings.json` → hooks | Lifecycle integration points |
| CLAUDE.md | `CLAUDE.md` | System configuration and behavioral rules |

### Research Documents (v1.2)

| Document | Location | Key Findings Applied |
|----------|----------|---------------------|
| Episodic Memory Research | `docs/archon-consciousness/research-episodic-memory.md` | Composite retrieval scoring (FR-CON-002), A-MEM concatenation for embeddings (FR-CON-002), importance-modulated Ebbinghaus decay (FR-CON-003), dual-stream consolidation pattern |
| Emotional State Detection Research | `docs/archon-consciousness/research-emotional-state.md` | Code block stripping before analysis (FR-CON-005), VADER heuristic constants, never surface detection to user (GUARD-CON-009), correction detection as highest-confidence frustration signal |
| Values & Conflict Resolution Research | `docs/archon-consciousness/research-values-conflict.md` | Defeasible logic with 3 edge types (FR-CON-013), 4-tier rule hierarchy from Constitutional AI, hysteresis to prevent oscillation (FR-CON-013), FalkorDB sparse-matrix traversal validation |
| Self-Reflection & Metacognition Research | `docs/archon-consciousness/research-self-reflection.md` | Binary verifiable sub-questions replacing self-rated confidence (FR-CON-018), error taxonomy tagging (FR-CON-018), Reflexion Actor/Evaluator/Reflector pattern, near-miss prioritization |
| Theory of Intent Research | `docs/archon-consciousness/research-theory-of-intent.md` | CONTRADICTED_BY edges for explicit contradiction tracking (FR-CON-021), two-tier intents persistent vs session-scoped (FR-CON-021), IGC-RC 351M-edge intention graph validation, bottom-up intent synthesis |
| Behavioral Pattern Tracking Research | `docs/archon-consciousness/research-pattern-tracking.md` | EWMA scoring alpha=0.2 (FR-CON-010), Ebbinghaus decay for untested rules (FR-CON-010), CUSUM as enhancement for gradual drift detection, spaced reinforcement priority at session start |

---
