# Research: Self-Reflection, Metacognition, and Self-Assessment in AI Agent Systems

**Date**: 2026-03-28
**Scope**: 2023-2026 literature on agent self-reflection, confidence calibration, and structured assessment
**Purpose**: Inform design of a session-end reflection agent for Archon in Claude Code

---

## Key Findings

1. **Self-reflection dramatically improves agent performance** — Reflexion achieves 91% pass@1 on HumanEval (vs 80% for GPT-4 baseline) purely through verbal self-reflection stored in episodic memory. LATS reaches 92.7% on the same benchmark by combining tree search with reflection.

2. **Self-correction without external feedback is hard but possible** — A critical survey (Kamoi et al., TACL 2024) found intrinsic self-correction (no external signal) is "largely ineffective" in vanilla prompting. However, SCoRe (Google DeepMind, 2024) showed RL-trained self-correction improves MATH by 15.6% using only self-generated data. The key insight: models need to be *trained* for self-correction, not just *prompted*.

3. **LLMs are systematically overconfident** — The Dunning-Kruger effect manifests in LLMs: the worst-performing models show the most severe overconfidence. Claude models show the best calibration among frontier models (ECE=0.120) but all exhibit substantial calibration errors. Unlike humans, LLMs fail to improve calibration from retrospective performance feedback.

4. **Structured reflection outperforms unstructured** — Multi-level reflection (Self-Learning Agents, EMNLP 2025) using hierarchical memory (short-term subgoal reflections, long-term exemplars, episodic tuples) significantly outperforms flat reflection. Reflective Memory Management (ACL 2025) shows 10%+ accuracy improvement through prospective+retrospective reflection.

5. **The Accuracy-Correction Paradox** — Weaker models achieve 1.6x higher intrinsic correction rates than stronger models because stronger models make fewer but *deeper* errors that resist self-correction (arxiv 2601.00828). This implies reflection agents should focus on error *detection* and *categorization* rather than assuming they can always self-fix.

6. **Confidence can be made reliable with the right approach** — "Know When You're Wrong" (2026) introduces normalized confidence scores from anchor token probabilities, improving AUROC from 0.806 to 0.879. Post-RL SFT with self-distillation restores calibration in RL-trained models (calibration error 0.163 -> 0.034).

---

## Notable Architectures

### Reflexion (Shinn et al., NeurIPS 2023)

**Paper**: [arxiv.org/abs/2303.11366](https://arxiv.org/abs/2303.11366)
**Code**: [github.com/noahshinn/reflexion](https://github.com/noahshinn/reflexion)

**Architecture**: Three components working in a loop:
- **Actor** — LLM that generates actions/decisions
- **Evaluator** — Produces a score from the trajectory (task-specific: test pass/fail, reward signal, heuristic)
- **Self-Reflection Model** — Analyzes the (trajectory, reward) pair and produces a verbal summary of what went wrong and how to improve

**Memory**: Episodic memory buffer stores the last 3 self-reflections as natural language. Truncated to prevent context overflow. Reflections are prepended to the actor's prompt on subsequent trials.

**Key design choice**: Reflections act as "semantic gradients" — they provide concrete, directional improvement signals in natural language rather than scalar rewards. The reflection is *not* a summary of what happened; it diagnoses *why* it failed and prescribes *what to change*.

**Reflection prompt structure** (reconstructed from paper):
```
You are an advanced reasoning agent that can improve based on self-reflection.
You will be given a previous reasoning trial in which you were given access to
[tools] and a question to answer. You were unsuccessful in answering the question
either because you guessed the wrong answer with Finish[<answer>], or you used up
your set number of reasoning steps.

In a few sentences, diagnose a possible reason for failure and devise a new,
concise, high level plan that aims to mitigate the same failure.
Use complete sentences.
```

**Applicability to Archon**: High. The three-component split (actor/evaluator/reflector) maps directly to a session-end flow: the session transcript is the trajectory, automated checks are the evaluator, and a reflection agent produces the verbal summary stored to memory.

---

### Self-Refine (Madaan et al., NeurIPS 2023)

**Paper**: [arxiv.org/abs/2303.17651](https://arxiv.org/abs/2303.17651)
**Code**: [github.com/madaan/self-refine](https://github.com/madaan/self-refine)

**Architecture**: Single-LLM loop with three roles:
1. **Generate** — Produce initial output
2. **Feedback** — Same LLM critiques its own output (localized, specific feedback)
3. **Refine** — Same LLM revises output using the feedback

Loop continues until feedback says "no further improvements needed" or max iterations reached.

**Key insight**: The feedback step must be *specific and localized* — "paragraph 2 is too verbose" not "could be better." The paper shows ~20% improvement across 7 tasks over single-pass generation.

**No cross-session memory** — Self-Refine operates within a single generation episode. It does not persist reflections for future sessions, making it complementary to (not a replacement for) Reflexion-style episodic memory.

**Applicability to Archon**: Medium. The feedback-then-refine loop is useful for *within-task* quality improvement (e.g., refining a code review before submitting it). But session-end reflection needs cross-session persistence, which Self-Refine does not provide.

---

### ReAct (Yao et al., ICLR 2023)

**Paper**: [arxiv.org/abs/2210.03629](https://arxiv.org/abs/2210.03629)

**Architecture**: Interleaved Thought-Action-Observation traces:
- **Thought** — Internal reasoning (decompose task, track progress, handle exceptions)
- **Action** — External tool use (search, code execution, API calls)
- **Observation** — Environment feedback from the action

**Self-assessment mechanism**: The Thought step serves as inline self-assessment. The agent articulates *why* it is taking an action before taking it, creating an auditable reasoning trace. When observations contradict expectations, the Thought step handles exception/error recognition.

**Applicability to Archon**: The Thought-Action-Observation pattern is already implicit in Claude Code's tool-use loop. The key takeaway is that *explicit verbalization of reasoning before action* improves both performance and interpretability. A session-end reflector could analyze these traces for patterns of reasoning failures.

---

### Tree of Thoughts (Yao et al., NeurIPS 2023)

**Paper**: [arxiv.org/abs/2305.10601](https://arxiv.org/abs/2305.10601)

**Architecture**: Generalizes chain-of-thought into a tree structure:
- Multiple reasoning paths explored via BFS or DFS
- LLM self-evaluates each intermediate "thought" node
- Backtracking when evaluation scores are low

**Self-evaluation**: The LLM rates its own partial solutions (e.g., "sure/maybe/impossible" for Game of 24). This is the most direct form of inline metacognition — the model must assess its own intermediate states.

**Results**: GPT-4 with ToT solves 74% of Game of 24 vs 4% with chain-of-thought, demonstrating the value of structured self-evaluation at intermediate steps.

**Applicability to Archon**: The self-evaluation heuristic (rating intermediate states) could be adapted for session-end reflection: rate each major decision point in the session as "good/questionable/bad" and explain why.

---

### LATS — Language Agent Tree Search (Zhou et al., ICML 2024)

**Paper**: [arxiv.org/abs/2310.04406](https://arxiv.org/abs/2310.04406)
**Code**: [github.com/lapisrocks/LanguageAgentTreeSearch](https://github.com/lapisrocks/LanguageAgentTreeSearch)

**Architecture**: Monte Carlo Tree Search (MCTS) with LLM components:
- **Selection** — UCB1-based node selection
- **Expansion** — LLM generates candidate actions
- **Evaluation** — LLM-powered value function estimates future reward
- **Simulation** — Rollout to terminal state
- **Backpropagation** — Update node values
- **Reflection** — On failed trajectories, generate self-critique stored as context for future iterations

**Key innovation**: Unifies reasoning (ToT), acting (ReAct), and planning (search algorithms) into a single framework. The reflection component specifically generates verbal critiques of *failed* trajectories that are injected into future search iterations.

**Applicability to Archon**: The reflection-on-failure pattern is directly applicable. A session-end agent should specifically identify and reflect on *failures and near-misses*, not just summarize what happened.

---

### SCoRe — Self-Correction via Reinforcement Learning (Kumar et al., Google DeepMind, 2024)

**Paper**: [arxiv.org/abs/2409.12917](https://arxiv.org/abs/2409.12917)

**Architecture**: Multi-turn RL training for self-correction:
1. Model generates initial response (potentially incorrect)
2. Given a correction prompt, model generates a second attempt
3. RL reward signal based on correctness of the second attempt
4. Training uses entirely self-generated data — no teacher model

**Key finding**: Prompt-based self-correction does not work well. Models must be *trained* to self-correct via RL. SCoRe improves self-correction by 15.6% on MATH and 9.1% on HumanEval.

**Applicability to Archon**: Implies that session-end reflection should not expect the agent to reliably self-correct in-context. Instead, reflections should be *stored* and used to influence future sessions (Reflexion pattern), not used for immediate self-repair.

---

### Multi-Level Reflection (EMNLP 2025)

**Paper**: "Self-Learning Agents Enhanced by Multi-level Reflection" (ACL Anthology 2025.emnlp-main.839)

**Architecture**: Hierarchical reflection with three memory tiers:
- **Short-term memory** — Subgoal-level reflections within current episode
- **Long-term memory** — Persistent exemplars accumulated across all episodes
- **Episodic memory** — Instance-level (state, action, reward, reflection) tuples

Reflections flow upward: individual action reflections consolidate into subgoal reflections, which consolidate into episode-level lessons learned.

**Applicability to Archon**: High. The three-tier memory maps to: (1) within-task notes, (2) persistent skill/pattern knowledge in MemoryGraph, (3) session-level retrospectives with specific examples.

---

## Confidence Calibration Research

### The State of LLM Metacognition (2024-2026)

| Finding | Source | Year |
|---------|--------|------|
| LLMs exhibit Dunning-Kruger effect — worst models are most overconfident | [arxiv.org/html/2603.09985v1](https://arxiv.org/html/2603.09985v1) | 2026 |
| LLMs and humans show similar metacognitive *sensitivity* but LLMs fail to learn from performance | [journals.sagepub.com](https://journals.sagepub.com/doi/10.1177/09637214251391158) | 2025 |
| Signal Detection Theory framework for measuring LLM metacognition | [arxiv.org/html/2603.25112](https://arxiv.org/html/2603.25112) | 2026 |
| Normalized anchor-token confidence scores: AUROC 0.879 for error detection | [arxiv.org/abs/2603.06604](https://arxiv.org/abs/2603.06604) | 2026 |
| Post-RL SFT restores calibration (ECE 0.163 -> 0.034) | [arxiv.org/abs/2603.06604](https://arxiv.org/abs/2603.06604) | 2026 |
| Calibration is trainable but does not generalize without joint multitask training | [arxiv.org/pdf/2510.05126v1](https://arxiv.org/pdf/2510.05126v1) | 2025 |
| Epistemic calibration via prediction markets shows promise | [arxiv.org/html/2512.16030v1](https://arxiv.org/html/2512.16030v1) | 2025 |
| Claude Opus 4.5 best frontier calibration (ECE=0.120); all models still overconfident | [arxiv.org/html/2603.06604](https://arxiv.org/html/2603.06604) | 2026 |

### Practical Implications for Agent Self-Assessment

1. **Do not trust raw verbalized confidence** — LLMs that say "I'm 90% confident" are poorly calibrated. Instead, use structured evaluation criteria with binary yes/no checks.

2. **Self-consistency as a proxy for confidence** — Generate multiple responses and measure agreement. High disagreement = low confidence. This is more reliable than asking the model to rate itself.

3. **Decompose assessment into verifiable sub-questions** — Instead of "how well did I do?", ask "did the tests pass?", "did I handle edge cases?", "did I follow the spec?" Binary verifiable questions produce more reliable self-assessment than holistic ratings.

4. **Stronger models make fewer but deeper errors** — The Accuracy-Correction Paradox means that when a strong model *does* make an error, it is unlikely to catch it via simple re-prompting. External validation (tests, type checks, linting) is essential.

5. **Retrospective calibration is worse than prospective** — Unlike humans, LLMs get *less* calibrated when asked to reassess after seeing results. Design reflection prompts to analyze specific evidence rather than asking for holistic reassessment.

---

## Structured Assessment Formats

### Format 1: Reflexion-Style Verbal Reflection (Episode Memory)

```
## Session Reflection

**Outcome**: [success | partial_success | failure]
**Task**: [one-line description]

**What went well**:
- [specific action that succeeded and why]

**What went wrong**:
- [specific failure, root cause diagnosis]

**Near-misses** (things that almost failed):
- [action that succeeded but was fragile/risky]

**Lesson for next session**:
- [concrete, actionable directive — not vague advice]

**Confidence in this reflection**: [high | medium | low]
```

### Format 2: Structured Scoring Rubric (Adaptive Rubric Pattern)

```json
{
  "session_id": "uuid",
  "timestamp": "ISO-8601",
  "task_description": "one-line summary",
  "duration_minutes": 45,
  "scores": {
    "task_completion": {
      "value": 0.85,
      "evidence": "8 of 10 acceptance criteria met",
      "failures": ["criterion 7: edge case X not handled"]
    },
    "code_quality": {
      "value": 0.90,
      "evidence": "all tests pass, no lint errors",
      "concerns": ["function Y is 73 lines, approaching limit"]
    },
    "methodology_adherence": {
      "value": 0.70,
      "evidence": "skipped memory retrieval in agent 3",
      "violations": ["parallel execution where sequential required"]
    },
    "efficiency": {
      "value": 0.60,
      "evidence": "3 unnecessary file re-reads, 2 failed tool calls",
      "waste_sources": ["redundant grep after glob found file"]
    }
  },
  "overall_score": 0.76,
  "error_log": [
    {
      "type": "near_miss",
      "description": "almost committed .env file",
      "severity": "high",
      "prevention": "add pre-commit hook check"
    }
  ],
  "actionable_items": [
    {
      "type": "memory_store",
      "key": "pattern/avoid-parallel-when-dependent",
      "value": "agents 2-4 had data dependencies, should have been sequential"
    },
    {
      "type": "skill_gap",
      "area": "WebSocket testing",
      "recommendation": "review async lock patterns before next WS task"
    }
  ],
  "corrections_received": 2,
  "corrections_detail": [
    "User corrected: use field_validator not validator",
    "User corrected: cache TTL should be 5min not 15min"
  ]
}
```

### Format 3: Comparative Session Assessment

```yaml
session_assessment:
  # What the user asked for vs what was delivered
  intent_alignment:
    user_asked: "Add pagination to the list endpoint"
    delivered: "Added pagination with offset/limit params"
    gap: "Did not add total_count in response headers as implied by 'pagination'"
    gap_severity: medium

  # Decision quality audit
  decisions:
    - decision: "Used offset/limit instead of cursor pagination"
      rationale: "Simpler for SQL backend"
      quality: good
      alternative_considered: false  # Should have discussed with user

    - decision: "Added 1000 max limit"
      rationale: "Prevent abuse"
      quality: good
      alternative_considered: true

  # Tool usage efficiency
  tool_efficiency:
    total_tool_calls: 34
    unnecessary_calls: 5
    failed_calls: 2
    retry_after_failure: 1
    could_have_batched: 3

  # Pattern compliance
  patterns_followed: ["test-first", "cache-layer", "error-no-echo"]
  patterns_violated: ["memory-retrieval-before-action"]
  new_patterns_discovered: ["cursor-pagination-for-large-datasets"]
```

---

## Recommended Patterns for Archon

### Pattern 1: Session-End Reflection Agent

**Trigger**: Automatically at session end (or after major task completion).

**Architecture** (adapted from Reflexion):
```
1. COLLECT — Gather session transcript, tool calls, user corrections, test results
2. EVALUATE — Run automated checks (tests pass? lint clean? files organized?)
3. REFLECT — LLM analyzes (transcript + evaluation) to produce structured reflection
4. STORE — Write reflection to MemoryGraph with relationships to task, patterns, errors
5. VERIFY — Retrieve stored reflection to confirm persistence
```

**Critical design rules**:
- Reflection must be *specific and evidence-based*, not generic ("could improve" is banned)
- Always capture user corrections verbatim — these are the highest-signal learning data
- Near-misses are more valuable than successes — prioritize capturing what almost went wrong
- Use binary verifiable sub-questions, not holistic ratings
- Store both the reflection AND the raw evidence (tool calls, error messages) separately

### Pattern 2: Confidence-Aware Decision Logging

During a session, log each major decision with:
```json
{
  "decision": "what was decided",
  "alternatives": ["what else was considered"],
  "confidence": "high|medium|low",
  "verification": "how this can be checked",
  "reversible": true
}
```

At session end, the reflection agent reviews these logs and identifies:
- Decisions made with low confidence that turned out correct (lucky — should build skill)
- Decisions made with high confidence that turned out wrong (overconfident — dangerous pattern)
- Decisions where no alternatives were considered (tunnel vision — flag for future sessions)

### Pattern 3: Error Taxonomy and Escalation

Classify errors detected during reflection:

| Category | Example | Storage | Action |
|----------|---------|---------|--------|
| **Correction** | User said "use X not Y" | MemoryGraph: `correction/{topic}` | Permanent rule |
| **Near-miss** | Almost deleted wrong file | MemoryGraph: `near-miss/{category}` | Add guardrail |
| **Repeated error** | Same mistake as 2 sessions ago | MemoryGraph: `recurring/{pattern}` | Escalate priority |
| **Novel error** | New failure mode never seen | MemoryGraph: `novel-error/{description}` | Analyze root cause |
| **Tool misuse** | Wrong tool for the job | MemoryGraph: `tool-pattern/{tool}` | Update routing |

### Pattern 4: Prospective + Retrospective Reflection (from RMM, ACL 2025)

**Prospective** (before next session):
- What should I remember about this user's preferences?
- What patterns from this codebase should I preload?
- What mistakes should I actively watch for?

**Retrospective** (analyzing this session):
- What worked and why?
- What failed and why?
- What was the user's emotional trajectory (frustrated -> satisfied)?

Both produce structured artifacts stored in MemoryGraph with different relationship types:
- Retrospective: `session -> learned_from -> lesson`
- Prospective: `session -> prepares_for -> future_context`

### Pattern 5: Adaptive Rubric Self-Evaluation

Instead of a fixed scoring rubric, generate task-specific evaluation criteria at session start, then evaluate against them at session end:

```
SESSION START:
  Task: "Add WebSocket heartbeat"
  Generated criteria:
    1. Heartbeat interval configurable
    2. Dead connection cleanup
    3. No self-heartbeat (server shouldn't update own timestamp)
    4. Thread-safe shared state access
    5. Tests cover timeout scenarios

SESSION END:
  Criterion 1: PASS — interval param added with default
  Criterion 2: PASS — cleanup coroutine implemented
  Criterion 3: FAIL — initially self-updated, caught in review
  Criterion 4: PASS — asyncio.Lock on all shared state methods
  Criterion 5: PARTIAL — timeout test exists but edge case missing
  Score: 3.5/5 = 70%
  Key lesson: "Always check heartbeat direction — server-side heartbeat is a common anti-pattern"
```

### Pattern 6: Minimal Viable Reflection (for every session, no exceptions)

Even when a session is short or trivial, store:

```json
{
  "session_id": "uuid",
  "duration_minutes": 5,
  "task": "quick fix: typo in error message",
  "outcome": "success",
  "corrections_received": 0,
  "notable": false,
  "one_liner": "Fixed typo, no issues"
}
```

This ensures the reflection habit is never skipped and provides data for trend analysis (e.g., "85% of sessions have no corrections" vs "corrections increasing over last 10 sessions").

---

## Sources

### Core Papers
- [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366) — Shinn et al., NeurIPS 2023
- [Self-Refine: Iterative Refinement with Self-Feedback](https://arxiv.org/abs/2303.17651) — Madaan et al., NeurIPS 2023
- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) — Yao et al., ICLR 2023
- [Tree of Thoughts: Deliberate Problem Solving with Large Language Models](https://arxiv.org/abs/2305.10601) — Yao et al., NeurIPS 2023
- [Language Agent Tree Search Unifies Reasoning, Acting, and Planning](https://arxiv.org/abs/2310.04406) — Zhou et al., ICML 2024
- [Training Language Models to Self-Correct via Reinforcement Learning (SCoRe)](https://arxiv.org/abs/2409.12917) — Kumar et al., Google DeepMind, 2024

### Confidence Calibration
- [The Dunning-Kruger Effect in Large Language Models](https://arxiv.org/html/2603.09985v1) — 2026
- [Metacognition and Uncertainty Communication in Humans and LLMs](https://journals.sagepub.com/doi/10.1177/09637214251391158) — Steyvers & Peters, 2025
- [Do LLMs Know What They Know? Measuring Metacognitive Efficiency with SDT](https://arxiv.org/html/2603.25112) — 2026
- [Know When You're Wrong: Aligning Confidence with Correctness](https://arxiv.org/abs/2603.06604) — 2026
- [Improving Metacognition and Uncertainty Communication in Language Models](https://arxiv.org/pdf/2510.05126v1) — 2025
- [Quantifying uncert-AI-nty: Testing the Accuracy of LLMs' Confidence Judgments](https://link.springer.com/article/10.3758/s13421-025-01755-4) — Memory & Cognition, 2025

### Self-Correction Surveys
- [When Can LLMs Actually Correct Their Own Mistakes? A Critical Survey](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00713/125177/) — Kamoi et al., TACL 2024
- [Decomposing LLM Self-Correction: The Accuracy-Correction Paradox](https://arxiv.org/abs/2601.00828) — 2026
- [Self-Correction LLM Papers Collection](https://github.com/ryokamoi/llm-self-correction-papers) — GitHub

### Memory and Reflection
- [In Prospect and Retrospect: Reflective Memory Management](https://arxiv.org/abs/2503.08026) — Tan et al., ACL 2025
- [Self-Learning Agents Enhanced by Multi-level Reflection](https://aclanthology.org/2025.emnlp-main.839.pdf) — EMNLP 2025
- [Hindsight is 20/20: Building Agent Memory that Retains, Recalls, and Reflects](https://arxiv.org/html/2512.12818v1) — 2025
- [Agent Memory Paper List](https://github.com/Shichun-Liu/Agent-Memory-Paper-List) — GitHub survey
- [Rubric-Based Evaluation for Agentic Systems](https://medium.com/@aiforhuman/rubric-based-evaluation-for-agentic-systems-db6cb14d8526) — 2024

### Implementations
- [Reflexion implementation](https://github.com/noahshinn/reflexion) — GitHub
- [Self-Refine implementation](https://github.com/madaan/self-refine) — GitHub
- [LATS implementation](https://github.com/lapisrocks/LanguageAgentTreeSearch) — GitHub
- [Tree of Thoughts implementation](https://github.com/princeton-nlp/tree-of-thought-llm) — GitHub
- [Building a Reflexion Agent with LangChain and LangGraph](https://medium.com/@vi.ha.engr/building-a-self-correcting-ai-a-deep-dive-into-the-reflexion-agent-with-langchain-and-langgraph-ae2b1ddb8c3b) — Medium
