# Research: Behavioral Compliance Tracking, Improvement Curves, and Self-Monitoring in AI Agent Systems

**Research Date**: 2026-03-28
**Context**: PRD-ARCHON-CON-001 (US-CON-003, FR-CON-009 through FR-CON-012)
**Purpose**: Identify proven patterns for per-rule compliance scoring, drift detection, and improvement curve analysis implementable in MemoryGraph at session granularity.

---

## Key Findings

### 1. Per-Rule Compliance Tracking Is an Emerging but Underserved Area

The dominant paradigm in RLHF and alignment research focuses on aggregate reward signals, not per-rule compliance decomposition. Safe RLHF (ICLR 2024) introduces 14 harm categories scored independently, which is the closest analog to per-rule tracking. Google DeepMind's Gemini uses multi-objective optimization with separate weighted reward scores for helpfulness, factuality, and safety — demonstrating that decomposed scoring is production-viable at scale, though applied during training rather than deployment monitoring.

No existing production system was found that maintains a persistent per-rule compliance score updated at session granularity and tracked over time in a graph database. This means Archon's pattern tracker (FR-CON-009) would be novel in its approach: scoring adherence to individual behavioral constraints per-session with trend analysis over a rolling window.

### 2. Behavioral Drift Detection Has Matured for Statistical ML but Lags for LLM Agents

Traditional ML drift detection is well-established: Population Stability Index (PSI), Kolmogorov-Smirnov tests, Jensen-Shannon divergence, and control chart methods (CUSUM, EWMA). These detect distribution shifts in model inputs or outputs. However, for LLM-based agents, the field is pivoting from statistical distribution monitoring to behavioral assurance — checking whether the agent still acts correctly, not just whether input distributions shifted.

AnchorDrift (2026) argues that most drift detection tools "monitor the wrong thing" — they track embedding distributions when teams actually need behavioral contract monitoring. Evidently AI's open-source framework (20M+ downloads) now supports LLM-specific evaluations including guardrail scoring and regression detection across releases, but operates at the query/response level rather than tracking per-rule adherence over sessions.

### 3. LLM Self-Evaluation and Self-Play Are Viable for Session-End Reflection

The "LLMs-as-Judges" paradigm (comprehensive survey, Dec 2024) establishes that LLMs can reliably score their own outputs against rubrics. Key finding: self-preference bias exists (models tend to rate their own outputs higher), but this can be mitigated by using structured rubrics with binary/ternary scoring rather than open-ended quality ratings.

"Visionary Tuning" (arxiv:2503.03967, Mar 2025) demonstrates a self-play loop where models simulate interactions, identify behavioral violations against a specification, and self-refine. The per-rule verification mechanism checks each anti-behavior against individual guidelines — a direct analog to Archon's reflection agent checking each behavioral rule.

S2R (ACL 2025) teaches LLMs to self-verify and self-correct, establishing that execution feedback (did the action succeed?) is more reliable than internal confidence estimation for self-assessment.

### 4. Statistical Process Control Methods Are Directly Applicable

CUSUM (Cumulative Sum) and EWMA (Exponentially Weighted Moving Average) are the two most relevant SPC methods for Archon's trend detection:

- **EWMA** is preferred for compliance scoring because it naturally weights recent sessions more heavily than distant ones, matching the intuition that recent behavior is more indicative than historical. An EWMA with smoothing factor alpha=0.2 means each session's score contributes 20% of the new average, with older sessions decaying exponentially. This is computationally trivial (one multiplication and one addition per update).

- **CUSUM** is preferred for regression detection because it accumulates small deviations over time, detecting gradual drift that individual session scores might miss. A CUSUM chart signals regression when cumulative negative deviations from a target exceed a threshold.

No existing paper was found applying CUSUM/EWMA specifically to AI agent behavioral rule compliance. The closest analog is EWMA applied to intensive longitudinal psychological data (PMC, 2023), which uses the same session-level update pattern Archon needs.

### 5. Spaced Repetition Models Apply to Rule Reinforcement Priority

The Ebbinghaus forgetting curve (exponential decay: R = e^(-t/S) where t is time and S is stability) has been successfully combined with AI scheduling (DRL-SRS, 2024). The key insight for Archon: rules that have not been tested recently should have increased reinforcement priority at session start, analogous to spaced repetition scheduling flashcards that are about to be forgotten.

Content-Aware Spaced Repetition (KARL, Shu et al. 2024) adds a critical refinement: items are not treated independently. Rules that share semantic content can transfer reinforcement — if Archon successfully follows "always ask before implementing," the related rule "never start coding without approval" gets partial reinforcement credit.

### 6. Safety/Alignment Teams Use Multi-Dimensional Behavioral Benchmarks

The 2025 AI Safety Index (Future of Life Institute) and UK AISI red-teaming evaluations use structured, per-category scoring:
- HarmBench: jailbreak resistance scored per harm category
- BBQ: social discrimination scored per bias dimension
- HELM Safety: standardized evaluation across violence, fraud, discrimination categories
- Attack Success Rate (ASR): percentage of adversarial attempts that succeed, tracked over time

The common pattern: decompose "safety" into discrete, independently scorable dimensions, track each dimension separately, alert when any single dimension regresses. This directly validates Archon's per-rule approach.

---

## Compliance Scoring Methods

### Method 1: EWMA Per-Rule Score (Recommended for Archon)

```
score_new = alpha * session_delta + (1 - alpha) * score_previous
```

Where:
- `alpha` = 0.2 (smoothing factor; recent sessions weighted 5x current value)
- `session_delta` values per PRD AC-010:
  - correction_received: -0.1
  - followed_without_correction: +0.05
  - near_miss_caught: +0.02
  - not_tested: no update (score unchanged)
- `score_previous` = last stored EWMA score for this rule
- Initial score for new rules: 0.5 (neutral starting point)
- Clamped to [0.0, 1.0] per EC-CON-009

**Why EWMA over simple accumulation**: Simple additive scoring (the PRD's current formula) has no decay — a rule corrected once in session 5 carries that penalty forever unless offset by many positive sessions. EWMA naturally decays old signals, so a single correction 20 sessions ago has minimal impact on the current score. This matches human intuition: "you used to make that mistake but haven't in months" should yield a high score.

**Compatibility note**: The PRD specifies additive deltas (AC-010). EWMA can wrap the same deltas — the `session_delta` values stay identical, they just feed into an EWMA update rather than raw addition. The PRD's scoring algorithm is preserved; only the accumulation method changes.

### Method 2: Bayesian Per-Rule Score (Alternative)

Model each rule as a Beta distribution: Beta(alpha, beta) where alpha = successful applications, beta = violations. The compliance score is the posterior mean: alpha / (alpha + beta). This naturally handles uncertainty — rules tested only twice have wide confidence intervals.

**Tradeoff**: More principled than EWMA but harder to explain to users and requires tracking two parameters per rule instead of one.

### Method 3: Multi-Armed Bandit Prioritization

Treat rules as "arms" and session-start injection as "pulls." Rules with lower compliance scores or higher uncertainty get more reinforcement (injected more prominently in the consciousness block). This maps directly to the Upper Confidence Bound (UCB) algorithm:

```
priority = compliance_score + c * sqrt(ln(total_sessions) / times_tested)
```

Where `c` controls exploration-exploitation balance. Rules that are rarely tested but uncertain get boosted.

---

## Drift/Regression Detection

### Method 1: CUSUM for Regression Alerts (Recommended)

Track cumulative sum of negative deviations from a target score:

```
S_n = max(0, S_{n-1} + (target - score_n) - allowance)
```

Where:
- `target` = 0.7 (minimum acceptable compliance score)
- `allowance` = 0.02 (tolerated noise per session, prevents false positives)
- Alert when `S_n > threshold` (e.g., 0.3 = roughly 3 consecutive drops)
- Reset `S_n = 0` after alert is acknowledged

**Why CUSUM over "3 consecutive drops" (PRD AC-012)**: The PRD's "3+ consecutive score drops" rule is a simplified CUSUM. Pure CUSUM is better because it catches gradual drift that never shows 3 consecutive drops but accumulates over 5-6 sessions. However, for simplicity and PRD compliance, implementing the literal "3 consecutive drops" rule first and adding CUSUM as an enhancement is reasonable.

### Method 2: Sliding Window Regression Detection

Compute linear regression slope over a rolling window of N sessions (N=10 recommended for responsiveness):

```
slope = linear_regression(scores[-10:])
trend = "improving" if slope > +0.01 else "regressing" if slope < -0.01 else "stable"
```

This maps directly to FR-CON-011. The 20-session minimum (AC-011) is the bootstrap period before trend classification begins.

### Method 3: Change Point Detection (Advanced)

Use Bayesian Online Change Point Detection (BOCPD) to identify the exact session where behavior shifted. This is more sophisticated than slope analysis and can detect both gradual drift and sudden regime changes.

**Tradeoff**: Computationally heavier and harder to implement in MemoryGraph. Recommended only if simpler methods produce too many false positives.

---

## Improvement Curve Analysis

### Ebbinghaus-Inspired Rule Decay Model

Rules that are not tested in a session should not maintain their score indefinitely. Apply a "forgetting pressure" that decays untested rules toward a baseline:

```
If rule not tested in session:
    score = score * decay_factor + baseline * (1 - decay_factor)
```

Where:
- `decay_factor` = 0.98 per session (slow decay; ~13% loss after 10 untested sessions)
- `baseline` = 0.5 (neutral; the score Archon would have with no evidence)

**Rationale**: A rule that scored 0.95 twenty sessions ago but has not been tested since should not continue to report 0.95. The agent may have "forgotten" the behavior. Gentle decay toward baseline creates an honest uncertainty signal.

### Spaced Reinforcement Priority

At session start, prioritize rule injection by "urgency" — rules most at risk of being forgotten:

```
urgency = (1 - score) + recency_penalty
recency_penalty = min(0.3, sessions_since_last_tested * 0.03)
```

Rules with low scores AND long intervals since last test get the highest injection priority. This is analogous to spaced repetition scheduling: review the items most likely to be forgotten.

### Improvement Curve Classification

After the 20-session bootstrap period, classify each rule's trajectory:

| Classification | Criterion | Action |
|---|---|---|
| **Improving** | Slope > +0.01/session over last 20 sessions | Celebrate; reduce injection priority |
| **Stable-High** | Score > 0.8, abs(slope) <= 0.01 | Maintain; low injection priority |
| **Stable-Low** | Score < 0.5, abs(slope) <= 0.01 | Alert; increase injection priority; flag for user review |
| **Regressing** | Slope < -0.01/session over last 20 sessions | Alert via consciousness block; highest injection priority |
| **Volatile** | Standard deviation > 0.15 over last 10 sessions | Flag for analysis; may indicate context-dependent rule |
| **Insufficient Data** | < 20 sessions with this rule tested | Report raw scores only |

---

## Recommended Patterns for Archon

### Pattern 1: MemoryGraph Schema for Per-Rule Compliance

Store as MemoryGraph nodes with label `PatternScore`:

```
Node: PatternScore
Fields:
  rule_id: string          # Links to the behavioral rule memory ID
  rule_name: string        # Human-readable rule name
  ewma_score: float        # Current EWMA compliance score [0.0, 1.0]
  raw_scores: string       # JSON array of last 30 session scores (rolling window)
  sessions_tested: int     # Total sessions where this rule was tested
  sessions_since_tested: int  # Sessions since last test
  trend: string            # "improving" | "stable" | "regressing" | "volatile" | "insufficient"
  slope: float             # Linear regression slope over last 20 tested sessions
  cusum_value: float       # Current CUSUM accumulator for regression detection
  consecutive_drops: int   # For PRD AC-012 (3+ consecutive drops alert)
  last_updated: string     # ISO timestamp
  created: string          # ISO timestamp
```

Relationships:
- `PatternScore -[TRACKS]-> BehavioralRule` (links score to the rule it monitors)
- `PatternScore -[REGRESSION_ALERT]-> SessionReflection` (links to the session where regression was detected)

### Pattern 2: Session-End Update Algorithm

Execute at session end, inside the reflection agent (FR-CON-017):

```
1. Enumerate rules tested this session (from session event journal, FR-CON-025)
2. For each tested rule:
   a. Compute session_delta: -0.1 (correction), +0.05 (followed), +0.02 (near-miss caught)
   b. Update EWMA: score = 0.2 * delta + 0.8 * previous_score
   c. Clamp to [0.0, 1.0]
   d. Append to raw_scores (trim to last 30)
   e. Update consecutive_drops: increment if delta < 0, reset to 0 if delta >= 0
   f. Update CUSUM: S = max(0, S + (0.7 - score) - 0.02)
   g. If consecutive_drops >= 3 OR cusum > 0.3: flag regression
   h. Recompute slope if sessions_tested >= 20
   i. Classify trend
3. For each untested rule:
   a. Increment sessions_since_tested
   b. Apply forgetting decay: score = score * 0.98 + 0.5 * 0.02
   c. (Do NOT change consecutive_drops or CUSUM for untested rules)
4. Store updated PatternScore nodes to MemoryGraph
5. Generate consciousness block summary:
   - Rules improving: [list]
   - Rules regressing: [list with alert flag]
   - Rules needing attention (stable-low or volatile): [list]
```

### Pattern 3: Trend Visualization Data for `/self-assess`

Store enough data in the `raw_scores` field (last 30 session scores as JSON array) to render ASCII sparklines or trend indicators in the `/self-assess` skill output:

```
Rule: "Ask before implementing"
Score: 0.87 [+0.12 over 20 sessions]  Trend: IMPROVING
History: [0.5, 0.55, 0.5, 0.6, 0.65, 0.6, 0.7, 0.75, 0.8, 0.82, 0.85, 0.87]

Rule: "Never echo user input in errors"
Score: 0.92 [+0.00 over 20 sessions]  Trend: STABLE-HIGH
History: [0.9, 0.92, 0.9, 0.92, 0.93, 0.92, 0.92, 0.92, 0.91, 0.92]

Rule: "Sequential execution for dependent tasks"
Score: 0.45 [-0.08 over 10 sessions]  Trend: REGRESSING  *** ALERT ***
History: [0.6, 0.55, 0.5, 0.5, 0.48, 0.45, 0.45]
```

### Pattern 4: Integration with Existing Memory Consolidation

The existing `/loop` consolidation rotates 5 stages: decay, duplicates, merge, relationships, briefing. Add a 6th stage: `pattern-update`. This stage:

1. Retrieves all `PatternScore` nodes
2. Applies forgetting decay to untested rules (in case sessions ended without reflection)
3. Recomputes trend classifications
4. Generates a "behavioral health" summary stored at `archon/consciousness/pattern-tracker/summary`
5. Prunes `raw_scores` arrays to last 30 entries

### Pattern 5: Self-Play Verification (Enhancement Beyond PRD)

Inspired by Visionary Tuning: periodically (every 10 sessions), the reflection agent generates synthetic scenarios for rules with low or volatile scores and evaluates whether Archon would handle them correctly. This is a lightweight self-play test:

1. Pick 3 rules with lowest scores or highest volatility
2. Generate a brief scenario where the rule would be tested
3. Ask the model what it would do in that scenario
4. Score the response against the rule
5. Store result as a "self-test" episode (source="self_play")

This provides compliance data for rules that are rarely tested in real sessions, reducing the "untested rule" blind spot.

---

## Sources

### RLHF and Compliance Scoring
- [Safe RLHF (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/dd1577afd396928ed64216f3f1fd5556-Paper-Conference.pdf) — Decoupled helpfulness/harmlessness scoring with 14 harm categories
- [Survey of RLHF (Kaufmann et al., 2023)](https://arxiv.org/pdf/2312.14925) — Comprehensive review of reward modeling approaches
- [RLHF for LLM Safety (Annotera)](https://www.annotera.ai/blog/how-rlhf-works-human-feedback-loops-llm-safety/) — Human feedback loops for safety
- [Consensus-Based Reward for Malicious RLHF Mitigation (Nature, 2025)](https://www.nature.com/articles/s41598-025-92889-7) — Robustness of reward models

### Behavioral Drift Detection
- [Tracking Behavioral Drift in LLMs (Paunova, Medium)](https://medium.com/@EvePaunova/tracking-behavioral-drift-in-large-language-models-a-comprehensive-framework-for-monitoring-86f1dc1cb34e) — Framework for instruction-following, factuality, and tone drift
- [AI Drift Detection Tools 2026 (AnchorDrift)](https://anchordrift.ai/blog/ai-drift-detection-tools-2026/) — Behavioral assurance vs statistical monitoring
- [Evidently AI (open-source)](https://github.com/evidentlyai/evidently) — 100+ metrics for ML/LLM monitoring
- [Self-Healing ML Pipelines (Preprints, 2025)](https://www.preprints.org/manuscript/202510.2522) — Automated drift detection and remediation
- [Model Drift Guide (SmartDev)](https://smartdev.com/ai-model-drift-retraining-a-guide-for-ml-system-maintenance/) — PSI, KS, JSD methods

### Self-Evaluation and Self-Play
- [Model Behavior Specification via Self-Playing (arxiv:2503.03967)](https://arxiv.org/abs/2503.03967) — Visionary Tuning: per-guideline compliance checking
- [LLMs-as-Judges Survey (arxiv:2412.05579)](https://arxiv.org/html/2412.05579v2) — Comprehensive survey on LLM-based evaluation
- [Self-Improving AI Agents through Self-Play (arxiv:2512.02731)](https://arxiv.org/html/2512.02731v1) — Self-play for continuous improvement
- [S2R: Self-Verify and Self-Correct (ACL 2025)](https://aclanthology.org/2025.acl-long.1104.pdf) — Execution feedback for self-assessment
- [Self-play with Execution Feedback (arxiv:2406.13542)](https://arxiv.org/abs/2406.13542) — Instruction-following improvement via self-play

### Statistical Process Control
- [CUSUM and EWMA Control Charts (JMP)](https://www.jmp.com/en/statistics-knowledge-portal/quality-and-reliability-methods/control-charts/cusum-and-ewma-control-charts) — Canonical SPC reference
- [EWMA for Intensive Longitudinal Data (PMC, 2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10248291/) — Session-level EWMA in psychological research
- [AI + SPC Review (arxiv:2503.01858)](https://www.arxiv.org/pdf/2503.01858) — Integration of AI with statistical process control

### Spaced Repetition and Forgetting Curves
- [DRL-SRS: Deep RL for Spaced Repetition (MDPI, 2024)](https://www.mdpi.com/2076-3417/14/13/5591) — Transformer-based recall probability estimation
- [Human-like Forgetting Curves in DNNs (arxiv:2506.12034)](https://arxiv.org/pdf/2506.12034) — Neural networks exhibit Ebbinghaus-like decay
- [Content-Aware Spaced Repetition (KARL)](https://www.giacomoran.com/blog/content-aware-sr/) — Semantic transfer between related items

### AI Safety Monitoring
- [2025 AI Safety Index (Future of Life Institute)](https://futureoflife.org/ai-safety-index-summer-2025/) — Per-category safety scoring across models
- [AISI Agent Red-Teaming (UK AI Safety Institute)](https://alignmentproject.aisi.gov.uk/research-area/empirical-investigations-into-ai-monitoring-and-red-teaming) — Largest public evaluation of agentic LLM safety
- [ALERT Benchmark (arxiv:2404.08676)](https://arxiv.org/abs/2404.08676) — Per-category red teaming benchmark
- [MTSA: Multi-Turn Safety Alignment (ACL 2025)](https://aclanthology.org/2025.acl-long.1282.pdf) — Multi-turn vulnerability detection

### Agent Evaluation Frameworks
- [AI Agent Metrics (Galileo)](https://galileo.ai/blog/ai-agent-metrics) — Per-session scoring patterns
- [Beyond Task Completion (arxiv:2512.12791)](https://arxiv.org/html/2512.12791v1) — Multi-dimensional agentic evaluation
- [Strands Evals (AWS)](https://aws.amazon.com/blogs/machine-learning/evaluating-ai-agents-for-production-a-practical-guide-to-strands-evals/) — Production agent evaluation guide
- [Fiddler AI Guardrails Metrics](https://www.fiddler.ai/articles/ai-guardrails-metrics) — Compliance coverage tracking
