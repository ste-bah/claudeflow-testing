# TASK-CON-007: Reflection Agent

**Status**: Ready
**Phase**: 2 — Core Subsystems
**Implements**: FR-CON-017 (Stop hook + scale guard + truncation), FR-CON-018 (structured output + confidence checklist + rule_id tagging), FR-CON-019 (episodic storage), FR-CON-020 (near-miss feedback to pattern tracker)
**Depends On**: TASK-CON-001 (Reflection node label), TASK-CON-003 (episodic memory store), TASK-CON-004 (pattern tracker update_rule_score + apply_baseline_decay)
**Complexity**: Large

---

## Context

The reflection agent runs at session end via the Stop hook, producing a structured self-assessment. It is the integration point between episodic memory and pattern tracking — it determines which rules were tested, scores them, stores reflection items as episodes, and feeds near-misses back into the pattern tracker. It has a hard 30-second budget.

---

## Prerequisites

- TASK-CON-001 complete (Reflection node label, SessionEvent readable)
- TASK-CON-003 complete (EpisodicMemory.store_fast for reflection items)
- TASK-CON-004 complete (PatternTracker.update_rule_score, apply_baseline_decay, check_alerts)

---

## Scope

### In Scope
- **Session event journal scan**: read SessionEvent nodes for current session_id, extract corrections, rule applications, decisions, state changes
- **Rule enumeration**: identify which active rules were tested (situations where the rule was relevant) based on journal events
- **Scale guard** (FR-CON-017):
  - Process max 50 active rules per session
  - If total active rules <= 50: process all; round-robin doesn't apply
  - If > 50: select top 50 by FR-CON-027 priority, track `last_reflected_session` for round-robin
- **Confidence checklist** (FR-CON-018):
  - Generate 5+ binary sub-questions (yes/no)
  - Each tagged with `rule_id` of the behavioral rule it verifies
  - Confidence = yes_count / total_questions
  - Each item tagged with error_taxonomy: correction / near_miss / repeated / novel / tool_misuse
- **EWMA feeding**: for each tested rule, call PatternTracker.update_rule_score with the observation value (0.0, 0.7, or 1.0)
- **Baseline decay**: call PatternTracker.apply_baseline_decay for untested rules
- **Episodic storage** (FR-CON-019): store each reflection item as Episode with `source: "self_reflection"` tag
- **Near-miss feedback** (FR-CON-020): for near-miss items, call PatternTracker.update_rule_score with observation=0.7
- **Alert checking**: call PatternTracker.check_alerts after all updates
- **Truncation** (FR-CON-017): if processing exceeds 25 seconds, truncate to 5 most impactful events (corrections > near-misses > novel situations > routine follows), annotate `partial: true`
- **Retroactive reflection** (EC-CON-007): if previous session has no Reflection node but has SessionEvent entries, generate retroactive assessment
- Unit tests for journal scanning, rule enumeration, checklist generation, truncation logic

### Out of Scope
- The Stop hook shell script that calls the reflection agent (TASK-CON-010)
- Emotional state detection (TASK-CON-005) — reflection reads states from journal, doesn't detect them
- Intent model updates (TASK-CON-008)

---

## Approach

1. Tests first:
   - Journal with 3 corrections, 2 follows, 1 near-miss → verify rule enumeration
   - Scale guard: 60 rules → only 50 processed, round-robin tracking works
   - Truncation: simulate > 25s → verify 5 most impactful selected by priority order
   - Retroactive: previous session has journal but no reflection → generates assessment
2. Implement `ReflectionAgent` class with:
   - `run(session_id) -> Reflection` — main entry point
   - `_scan_journal(session_id) -> list[SessionEvent]`
   - `_enumerate_tested_rules(events) -> dict[rule_id, list[observation]]`
   - `_generate_checklist(tested_rules) -> list[ChecklistItem]`
   - `_update_scores(tested_rules, untested_rules)` — calls PatternTracker
   - `_store_reflection_episodes(checklist_items)` — calls EpisodicMemory
   - `_check_time_budget()` — truncation guard
3. Reflection output stored as Reflection node in MemoryGraph + individual items as Episode nodes

---

## Validation Criteria

- [ ] Journal scan correctly extracts events for current session
- [ ] Rule enumeration correctly maps events to rule_ids
- [ ] Checklist generates 5+ sub-questions, each tagged with rule_id and error_taxonomy
- [ ] Confidence = yes_count / total
- [ ] EWMA updates called for all tested rules with correct observation values
- [ ] Baseline decay applied to untested rules only
- [ ] Near-miss items feed observation=0.7 to pattern tracker
- [ ] Scale guard: 60 active rules → 50 processed, 10 deferred
- [ ] Scale guard: 30 active rules → all 30 processed, no round-robin
- [ ] Truncation at 25s: top 5 by priority, `partial: true`
- [ ] Retroactive reflection works for previous session with journal but no reflection
- [ ] Reflection items stored as episodes with `source: "self_reflection"`
- [ ] Alerts checked after score updates
- [ ] Total execution < 30 seconds (NFR-CON-PERF-004)
- [ ] All tests pass

---

## Test Commands

```bash
pytest tests/archon-consciousness/test_reflection_agent.py -v
pytest tests/archon-consciousness/test_journal_scanning.py -v
pytest tests/archon-consciousness/test_checklist_generation.py -v
pytest tests/archon-consciousness/test_reflection_truncation.py -v
```
