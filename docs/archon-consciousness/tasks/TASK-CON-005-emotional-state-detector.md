# TASK-CON-005: Emotional State Detector

**Status**: Ready
**Phase**: 2 — Core Subsystems
**Implements**: FR-CON-005 (signal extraction + preprocessing), FR-CON-006 (classification), FR-CON-007 (communication parameters)
**Depends On**: TASK-CON-002 (EmotionalStateLogger for transition writes)
**Complexity**: Medium

---

## Context

The emotional state detector classifies Steven's current state from text signals and maps it to concrete communication parameters. It operates entirely on rule-based heuristics (no ML) using 5 text signals and 3 sentiment lexicons. The key constraint: NEVER surface detection to the user (GUARD-CON-009).

---

## Prerequisites

- TASK-CON-002 complete (EmotionalStateLogger for writing transitions)
- No external API calls (NFR-CON-SEC-001, GUARD-CON-001)

---

## Scope

### In Scope
- **Preprocessing** (FR-CON-005):
  - Strip fenced code blocks (``` ... ```)
  - Strip inline code (backtick-wrapped `...`)
  - Strip blockquotes (> ...)
  - Strip URLs
  - Analyze remaining natural language only
- **5 signal extractors** (FR-CON-005):
  - `message_brevity`: true if word count < 10 AND rolling 5-message avg > 30
  - `length_delta`: deviation from rolling 5-message average (session-scoped, reset per session)
  - `punctuation_density`: (exclamation marks + ALL CAPS words) / total words
  - `question_frequency`: question marks per message
  - `explicit_sentiment_words`: keyword match count against 3 lexicons (20 words each)
- **3 starter lexicons** (FR-CON-005):
  - Frustration: broken, stuck, again, wtf, wrong, annoying, frustrated, ugh, sigh, keeps, failing, still, doesn't work, what the hell, come on, seriously, ridiculous, unacceptable, terrible, awful
  - Urgency: asap, urgent, critical, production down, hotfix, immediately, time-sensitive, deadline, blocking, ship it, priority, emergency, right now, before EOD, ASAP, hurry, rush, today, now, quick
  - Confusion: confused, unclear, don't understand, what do you mean, lost, huh, makes no sense, which one, not sure, explain, wait what, I thought, contradicts, ambiguous, conflicting, how does, why would, that doesn't, I expected, mismatch
- **State classifier** (FR-CON-006):
  - 6 states: frustrated, exploring, in_flow, confused, urgent, neutral
  - Rule-based mapping from signals to states
  - Confidence score per classification
  - Default to neutral when confidence < 0.6 (GUARD-CON-006)
  - First message of session: state = neutral (EC-CON-003)
- **Communication parameter map** (FR-CON-007):
  - frustrated → max 3 sentences, lead with acknowledgment, no unsolicited suggestions, no questions unless blocking
  - in_flow → max 1 sentence, no explanations unless asked, no questions, no preamble
  - confused → numbered lists, 1 clarifying question per response, define terms
  - exploring → up to 10 sentences, 2-3 alternatives, open questions
  - urgent → action first, defer explanation, no preamble
  - neutral → standard personality rules
  - Overrides personality verbosity rules; reverts on return to neutral
- **State transition logging** via TASK-CON-002's EmotionalStateLogger
- **User correction handling** (EC-CON-011): if user says "I'm not frustrated", reset to neutral immediately
- Unit tests: preprocessing, each signal extractor, classifier, parameter mapping, edge cases
- Target: < 100ms classification (NFR-CON-PERF-002)

### Out of Scope
- The actual response modification (personality override happens at conversation level, not in this module)
- Slow-path lexicon extension (Phase 2 feature)
- Integration test with live session (TASK-CON-010)

---

## Approach

1. Tests first for preprocessing: message with code blocks, inline code, URLs, blockquotes → verify only natural language remains
2. Tests for each signal extractor with known inputs and expected outputs
3. Tests for classifier: construct signal vectors that should map to each of the 6 states
4. Tests for confidence < 0.6 → neutral default
5. Implement `EmotionalStateDetector` class with:
   - `preprocess(message: str) -> str`
   - `extract_signals(message: str, history: list) -> SignalVector`
   - `classify(signals: SignalVector) -> (state, confidence)`
   - `get_communication_params(state) -> CommunicationParams`
6. Rolling average maintained as session-scoped state (list of last 5 message lengths)

---

## Validation Criteria

- [ ] Preprocessing strips fenced code, inline code, blockquotes, URLs
- [ ] `ERROR_HANDLER` in inline code does NOT trigger ALL CAPS detection
- [ ] message_brevity correctly compares against rolling 5-message average
- [ ] First message returns neutral (no baseline for deltas)
- [ ] Each lexicon matches its 20 words correctly (case-insensitive)
- [ ] Confidence < 0.6 → neutral (GUARD-CON-006)
- [ ] User correction "I'm not frustrated" → immediate reset to neutral
- [ ] Communication params match PRD spec for each state
- [ ] Classification completes in < 100ms (NFR-CON-PERF-002)
- [ ] No HTTP calls made during classification (GUARD-CON-001)
- [ ] All tests pass

---

## Test Commands

```bash
pytest tests/archon-consciousness/test_preprocessing.py -v
pytest tests/archon-consciousness/test_signal_extraction.py -v
pytest tests/archon-consciousness/test_state_classifier.py -v
pytest tests/archon-consciousness/test_communication_params.py -v
```
