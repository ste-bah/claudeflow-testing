# Research: Theory of Intent for Archon Consciousness Enhancement

**Related PRD**: PRD-ARCHON-CON-001 (FR-CON-021 through FR-CON-024)
**Date**: 2026-03-28
**Purpose**: Literature review and design guidance for implementing a graph-based intent model in MemoryGraph, linking inferred user goals to correction/instruction evidence nodes.

---

## Key Findings

1. **LLMs demonstrate partial Theory of Mind but it is brittle.** GPT-4 matches 6-year-old children on false-belief tasks (75% accuracy) but fails on trivial adversarial perturbations, indicating pattern-matching rather than genuine mental-state reasoning. This means Archon cannot rely on implicit LLM ToM for intent modeling — it must be an explicit, structured system.

2. **Explicit intent graphs outperform implicit modeling.** Recent work on Intention Knowledge Graphs (IGC-RC framework, 2024) demonstrates that LLM-generated intention graphs with typed edges (temporal, causal, synchronous) capture user goals far more accurately than latent embeddings alone. The framework built a 351-million-edge intention graph from Amazon session data, proving the approach scales.

3. **Evidence-based confidence is essential.** Bayesian and evidence-count approaches to goal confidence converge on the same insight: an inferred intent with a single evidence node is a hypothesis; one with 5+ evidence nodes across multiple sessions is a belief. The PRD's threshold of 3 evidence nodes for confidence > 0.5 aligns with this literature.

4. **Recommender system patterns are directly transferable.** KGIN (Knowledge Graph-based Intent Network) represents user intents as attentive combinations of knowledge graph relations, with graph neural network aggregation over relational paths. This architecture maps cleanly to MemoryGraph: goal nodes, EVIDENCED_BY edges to correction memories, and path-based confidence computation.

5. **The critical gap is not detection but maintenance.** All reviewed systems struggle with intent drift — user goals change over time. The PRD's recency decay (50% weight loss per 60 days) addresses this, but the literature suggests also tracking intent contradictions (user corrections that negate a previously inferred intent) as first-class events.

6. **Practical voice assistants (Alexa, Siri) use shallow intent models.** Their NLU pipelines classify utterances into predefined intent schemas with slot-filling — this is fundamentally different from what Archon needs. Archon must infer latent, unstated goals from behavioral patterns across sessions, closer to the recommender system paradigm than the voice assistant paradigm.

---

## ToM Capabilities in Current LLMs

### Kosinski (2023) — "Theory of Mind May Have Spontaneously Emerged in Large Language Models"

Published in PNAS (November 2024, originally preprint February 2023). Tested 11 LLMs on 640 false-belief prompts across 40 tasks.

**Results by model generation:**
- GPT-3-davinci-002 (Jan 2022): 5% of tasks solved
- GPT-3-davinci-003 (Nov 2022): 20% solved
- ChatGPT-3.5-turbo (Mar 2023): 20% solved
- GPT-4 (Jun 2023): 75% solved — matching 6-year-old children

**Interpretation:** ToM capabilities appeared to emerge as a byproduct of improving language skills, without explicit training on mental-state reasoning tasks. The jump from GPT-3.5 (20%) to GPT-4 (75%) suggested a phase transition in capability.

**Source:** [Kosinski 2023, PNAS](https://www.pnas.org/doi/10.1073/pnas.2405460121)

### Sap et al. (2022) — "Neural Theory-of-Mind? On the Limits of Social Intelligence in Large LMs"

Published at EMNLP 2022. Evaluated GPT-3 on SocialIQa (understanding intents and reactions) and ToMi (inferring mental states of situation participants).

**Results:** GPT-3 achieved 55% on SocialIQa and 60% on ToMi — well below human performance. The authors argued that scaling alone would not produce genuine ToM and proposed person-centric NLP approaches as a more promising path.

**Key insight for Archon:** The paper's recommendation of "person-centric" approaches — building explicit models of specific individuals rather than relying on general social reasoning — directly supports Archon's approach of maintaining a per-user intent model in MemoryGraph.

**Source:** [Sap et al. 2022, EMNLP](https://aclanthology.org/2022.emnlp-main.248/)

### Bubeck et al. (2023) — "Sparks of Artificial General Intelligence: Early Experiments with GPT-4"

Microsoft Research evaluation of early GPT-4. Demonstrated GPT-4 reasoning about intentions in complex social situations, including helping someone navigate a difficult family situation. Characterized GPT-4 as "an early (yet still incomplete) version of AGI."

**Limitation identified:** The authors specifically noted GPT-4's "lack of ability to plan ahead" — it reasons about existing situations but cannot project how intents will evolve. This is precisely the gap Archon's temporal intent tracking (with recency decay and trend detection) addresses.

**Source:** [Bubeck et al. 2023, arXiv](https://arxiv.org/abs/2303.12712)

### The Brittleness Problem: Ullman (2023) and Shapira et al. (2024)

**Ullman's critique:** Small, logically irrelevant modifications to false-belief vignettes cause models to suddenly fail questions they previously answered correctly. Conclusion: LLMs "haven't learned yet anything like Theory-of-Mind" — success is narrow and contingent on surface patterns.

**Shapira et al. "Clever Hans" critique:** LLMs fail on adversarial ToM examples, suggesting apparent ToM abilities are explained by shallow heuristics — the "Clever Hans" effect where apparent intelligence masks reliance on spurious cues.

**Dissection study (2024):** "Dissecting the Ullman Variations with a SCALPEL" (arXiv 2406.14737) analyzed why LLMs fail at trivial false-belief alterations, finding that failures correlate with surface-level pattern disruption rather than reasoning breakdown.

**Counter-evidence (2025):** "LLMs achieve adult human performance on higher-order theory of mind tasks" (PMC 2025) found that internal representations of self and others' belief states exist in current LLMs and significantly affect ToM capabilities — suggesting some genuine structure beyond pure heuristics, even if brittle.

**Implication for Archon:** LLM ToM is unreliable for real-time intent inference. Archon must not depend on the LLM "understanding" user intent through conversation alone. Instead, intent must be explicitly modeled, evidence-linked, and user-correctable — which is exactly what FR-CON-021 through FR-CON-024 specify.

**Sources:**
- [Ullman Variations SCALPEL analysis](https://arxiv.org/html/2406.14737v1)
- [Re-evaluating ToM evaluation in LLMs](https://www.researchgate.net/publication/389510789)
- [Higher-order ToM in LLMs](https://pmc.ncbi.nlm.nih.gov/articles/PMC12808479/)
- [Survey of ToM in LLMs](https://arxiv.org/html/2502.06470v1)

---

## User Goal Modeling Approaches

### Bayesian User Models

Classical Bayesian user modeling maintains a probability distribution over possible user goals, updated with each observed action via Bayes' rule:

```
P(goal | actions) = P(actions | goal) * P(goal) / P(actions)
```

In robotics (Jain et al., "Recursive Bayesian Human Intent Recognition in Shared-Control Robotics"), this approach tracks a belief state over possible user intentions and updates it with each new observation. The belief converges as evidence accumulates.

**Adaptation for Archon:** Each inferred goal node in MemoryGraph has a confidence score (0.0-1.0). Each new EVIDENCED_BY edge (a correction or instruction that supports the goal) acts as a Bayesian update. The PRD's formula — min 3 evidence nodes for confidence > 0.5, with 50% recency decay per 60 days — is a pragmatic discrete approximation of continuous Bayesian updating.

**Recommended enhancement:** Track disconfirming evidence explicitly. When a user correction contradicts an inferred goal, create a CONTRADICTED_BY edge (not just absence of evidence). This allows the model to distinguish "no data" from "actively disproven."

### Probabilistic Modeling of Intentions in LLM Agents (2025)

Recent work (arXiv 2510.18476, "Probabilistic Modeling of Intentions in Socially Intelligent LLM Agents") treats social intelligence as building predictive models of another agent's behavior by inferring hidden strategies and latent capabilities. Agents infer and adapt to others' hidden intentions through theory-of-mind approaches.

**Key design pattern:** Intentions are modeled as latent variables in a probabilistic graphical model. Observable actions are conditioned on these latent intentions. Inference runs in both directions: actions inform intent estimates, and intent estimates predict future actions.

**Relevance to Archon:** This bidirectional inference is what makes intent models useful for edge-case judgment. When Archon faces an ambiguous situation, it queries the intent model to predict what the user would want — and the prediction quality depends on the evidence graph's depth.

### Multi-Turn Dialogue User Modeling

Survey evidence (ACM Computing Surveys 2025, "LLM-Based Multi-turn Dialogue Systems") shows that modern dialogue systems track three layers of user state:

1. **Objective attributes** — stable facts (user's technical level, domain expertise)
2. **Subjective interests** — semi-stable preferences (coding style, tool preferences)
3. **Immediate intentions** — session-scoped goals (what they're trying to build right now)

Archon's intent model should distinguish these layers. The existing MemoryGraph behavioral rules capture layer 2 (preferences). The proposed intent model (FR-CON-021) should focus on layer 1 (stable attributes that explain WHY preferences exist) and layer 3 (session goals that contextualize corrections).

### Beyond Slot-Filling: Deep Goal Modeling

Traditional NLU intent classification (Alexa, Siri) maps utterances to predefined schemas:

```
"Set a timer for 5 minutes" -> Intent: SetTimer, Slots: {duration: 5min}
```

This is fundamentally inadequate for Archon's needs. Archon must infer unstated goals like:

```
Observation: User corrects Archon 3 times for acting without approval
Observation: User explicitly says "I got burned by autonomous AI breaking things"
Observation: User requires sequential (not parallel) execution
Inferred Goal: "Safety/control over speed" — user prioritizes predictability
Evidence strength: 3 corrections + 1 explicit statement + 1 architectural preference = high confidence
```

The IGC-RC framework (described below) provides the closest architectural parallel for this kind of inference.

---

## Evidence-Based Intent Graphs

### Intention Knowledge Graph Construction (IGC-RC Framework, 2024)

The most directly relevant paper for Archon's implementation is "Intention Knowledge Graph Construction for User Intention Relation Modeling" (arXiv 2412.11500, December 2024).

**Architecture:**
1. **Intention Generation** — LLM generates natural-language intentions from user session behaviors
2. **Conceptualization** — Generated intentions are abstracted into concept-level categories
3. **Relation Classification** — Edges between intentions are classified into 6 types:
   - **Temporal-before**: Intent A typically precedes Intent B
   - **Temporal-after**: Intent A typically follows Intent B
   - **Synchronous**: Intent A and Intent B co-occur
   - **Causal-because**: Intent A causes Intent B
   - **Causal-result**: Intent A results from Intent B
   - **Item-session-intent-concept**: Hierarchical containment edges

**Scale:** 351 million edges from Amazon m2 dataset. Demonstrated effective prediction of new session intentions and improved product recommendations.

**Adaptation for Archon's MemoryGraph:**

```
Node Types:
  - InferredGoal: {name, description, confidence, created_at, last_evidenced_at}
  - CorrectionMemory: {content, session_id, timestamp} (existing)
  - InstructionMemory: {content, session_id, timestamp} (existing)
  - BehavioralRule: {rule_text, importance_weight} (existing)

Edge Types:
  - EVIDENCED_BY: InferredGoal -> CorrectionMemory | InstructionMemory
    Properties: {evidence_type: "correction"|"instruction"|"behavioral_pattern",
                 inferred_at, confidence_contribution}
  - CONTRADICTED_BY: InferredGoal -> CorrectionMemory
    Properties: {contradiction_type: "direct_negation"|"preference_shift", timestamp}
  - EXPLAINS: InferredGoal -> BehavioralRule
    Properties: {explanation_text, inferred_at}
  - SUPERSEDES: InferredGoal -> InferredGoal
    Properties: {reason, timestamp}
  - CO_OCCURS_WITH: InferredGoal -> InferredGoal
    Properties: {session_count, strength}
```

### Capturing and Anticipating User Intents in Data Analytics (2024)

"Capturing and Anticipating User Intents in Data Analytics via Knowledge Graphs" (arXiv 2411.01023) addresses a parallel problem: inferring what a data analyst is trying to accomplish from their query patterns.

**Key pattern:** The system builds an intent graph incrementally — each user action adds an edge, and intent nodes emerge from clustering. This bottom-up construction (observe actions first, infer goals later) matches Archon's operational reality: corrections and instructions arrive first, and goals are synthesized from accumulated evidence.

### KGIN: Knowledge Graph-Based Intent Network

KGIN (Wang et al., 2021, arXiv 2102.07057, cited extensively in 2024 follow-up work) represents each user intent as an attentive combination of knowledge graph relations. A GNN recursively integrates relation sequences along paths to distill intent information.

**Transferable pattern for Archon:**
- **Relational path aggregation**: Confidence in an inferred goal should consider not just direct evidence count but also the relational paths connecting evidence nodes. A goal supported by corrections across 5 different sessions is stronger than one supported by 5 corrections in a single session.
- **Intent disentanglement**: KGIN enforces independence between different intent representations. Archon should similarly ensure inferred goals are orthogonal — if "safety/control" and "code quality" are both inferred, they should not be collapsed into a single blurry goal.

### Entity-Driven Knowledge Intent Network (EKIN)

EKIN (Applied Intelligence, 2022) infers intents using both entities and relations in knowledge graphs. The dual-signal approach (what nodes are connected AND how they're connected) improves intent inference accuracy.

**Adaptation:** For Archon, this means the intent model should consider both the content of evidence nodes (what corrections say) and the relationship structure (are corrections clustered in time? Do they reference the same rule? Do they follow the same trigger pattern?).

---

## Recommended Patterns for Archon

### Pattern 1: Bottom-Up Intent Synthesis

Do not pre-define intent categories. Let goals emerge from evidence clustering.

**Implementation:**
1. Each correction and instruction is stored as a memory node (existing behavior)
2. At consolidation time (during `/loop` memory-garden), an intent-synthesis pass runs:
   - Group correction memories by topic similarity (LanceDB vector search)
   - For clusters of 3+ corrections with cosine similarity > 0.7, generate a candidate InferredGoal
   - Use the LLM to produce a natural-language goal description from the cluster
   - Create EVIDENCED_BY edges from the goal to each member correction
3. Human review via `/intent` skill before goals influence behavior

**Why bottom-up:** Pre-defined categories impose the developer's model of user goals. Bottom-up synthesis captures the actual user's priorities, which may be surprising.

### Pattern 2: Confidence as Evidence-Path Strength

Replace simple evidence counting with path-aware confidence.

**Formula:**
```
confidence(goal) = base_confidence(evidence_count) * recency_factor * diversity_bonus

where:
  base_confidence = min(1.0, evidence_count / 6)  # saturates at 6 evidence nodes
  recency_factor = max(0.1, exp(-days_since_last_evidence / 60))  # 60-day half-life
  diversity_bonus = 1.0 + 0.1 * (unique_sessions - 1)  # bonus for cross-session evidence
```

This rewards goals supported by evidence across multiple sessions (more likely to be stable preferences) and penalizes goals whose evidence clusters in a single session (may be situational).

### Pattern 3: Bidirectional Intent Querying

The intent model should be queryable in two directions:

1. **Forward (goal -> behavior):** "Given goal G, what should I do in situation S?" Used during ambiguous decisions. Traverses EXPLAINS edges to find relevant behavioral rules.

2. **Backward (behavior -> goal):** "Why does rule R exist?" Used during conflict resolution. Traverses EXPLAINS edges in reverse to find the motivating goal. When two rules conflict, the one whose goal has higher confidence wins.

**Integration with Values DAG (FR-CON-013):** PRIORITY_OVER edges in the values DAG can be informed by intent model confidence. If goal A (confidence 0.9) EXPLAINS rule X, and goal B (confidence 0.4) EXPLAINS rule Y, then X should have priority over Y unless the DAG explicitly says otherwise.

### Pattern 4: Contradiction Tracking

When a user correction directly negates a previously inferred goal, create a CONTRADICTED_BY edge rather than silently reducing confidence.

**Why this matters:** Silent confidence reduction loses information. An explicit contradiction edge enables:
- Detecting preference shifts ("user used to prioritize speed, now prioritizes safety")
- Preventing zombie goals (old goals that slowly regain confidence through tangentially related evidence)
- Providing transparency in `/intent` skill output ("Goal X was contradicted on 2026-03-15")

### Pattern 5: Session-Scoped Intent Inference

Maintain two tiers of intent:
1. **Persistent goals** — cross-session, stored in MemoryGraph, subject to evidence/decay rules (FR-CON-021-024)
2. **Session goals** — inferred from the first few messages of a session, stored in session event journal (FR-CON-025), discarded at session end unless promoted

Session goals capture immediate context ("I'm debugging a production issue" vs "I'm exploring a new architecture"). They should modulate how persistent goals are applied — e.g., in an urgent debugging session, the persistent goal "thorough testing" yields to the session goal "fix it fast."

### Pattern 6: MemoryGraph Schema Design

```cypher
// Create an inferred goal
CREATE (g:InferredGoal {
  name: "safety_over_speed",
  description: "User prioritizes predictable, controlled behavior over fast execution",
  confidence: 0.72,
  evidence_count: 5,
  unique_sessions: 4,
  created_at: "2026-02-15T10:30:00Z",
  last_evidenced_at: "2026-03-25T14:22:00Z",
  status: "active"  // active | archived | contradicted
})

// Link goal to evidence
MATCH (g:InferredGoal {name: "safety_over_speed"})
MATCH (c:Memory {content: "User corrected: don't start implementing without approval"})
CREATE (g)-[:EVIDENCED_BY {
  evidence_type: "correction",
  confidence_contribution: 0.15,
  inferred_at: "2026-02-15T10:30:00Z"
}]->(c)

// Link goal to behavioral rule it explains
MATCH (g:InferredGoal {name: "safety_over_speed"})
MATCH (r:Memory {content: "Always wait for explicit user confirmation before executing"})
CREATE (g)-[:EXPLAINS {
  explanation_text: "User requires approval gates because autonomous action caused problems",
  inferred_at: "2026-02-20T09:00:00Z"
}]->(r)

// Track contradiction
MATCH (g:InferredGoal {name: "always_explain_reasoning"})
MATCH (c:Memory {content: "User said: stop explaining, just do it"})
CREATE (g)-[:CONTRADICTED_BY {
  contradiction_type: "preference_shift",
  context: "User was in flow state, wanted brevity",
  timestamp: "2026-03-20T16:45:00Z"
}]->(c)

// Query: what goals are relevant to current situation?
MATCH (g:InferredGoal)-[:EXPLAINS]->(r:Memory)
WHERE g.status = "active" AND g.confidence > 0.5
RETURN g.name, g.description, g.confidence, collect(r.content) as rules
ORDER BY g.confidence DESC
```

---

## Sources

### Primary Papers

- Kosinski, M. (2023/2024). "Evaluating Large Language Models in Theory of Mind Tasks." *PNAS*. [Link](https://www.pnas.org/doi/10.1073/pnas.2405460121)
- Sap, M., Le Bras, R., Fried, D., & Choi, Y. (2022). "Neural Theory-of-Mind? On the Limits of Social Intelligence in Large LMs." *EMNLP 2022*. [Link](https://aclanthology.org/2022.emnlp-main.248/)
- Bubeck, S. et al. (2023). "Sparks of Artificial General Intelligence: Early Experiments with GPT-4." *arXiv 2303.12712*. [Link](https://arxiv.org/abs/2303.12712)

### ToM Critiques and Follow-ups

- Ullman, T. (2023). "Large Language Models Fail on Trivial Alterations to Theory-of-Mind Tasks." *arXiv*.
- Shapira, N. et al. (2024). Adversarial ToM evaluation ("Clever Hans" critique). [ResearchGate](https://www.researchgate.net/publication/389510789)
- "Dissecting the Ullman Variations with a SCALPEL" (2024). *arXiv 2406.14737*. [Link](https://arxiv.org/html/2406.14737v1)
- "LLMs achieve adult human performance on higher-order theory of mind tasks" (2025). [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12808479/)
- "A Survey of Theory of Mind in Large Language Models" (2025). *arXiv 2502.06470*. [Link](https://arxiv.org/html/2502.06470v1)
- "Rethinking Theory of Mind Benchmarks for LLMs" (2025). *arXiv 2504.10839*. [Link](https://arxiv.org/html/2504.10839v1)

### Intent Modeling and Knowledge Graphs

- "Intention Knowledge Graph Construction for User Intention Relation Modeling" (2024). *arXiv 2412.11500*. [Link](https://arxiv.org/abs/2412.11500)
- "Capturing and Anticipating User Intents in Data Analytics via Knowledge Graphs" (2024). *arXiv 2411.01023*. [Link](https://arxiv.org/abs/2411.01023)
- Wang, X. et al. (2021). "Learning Intents behind Interactions with Knowledge Graph for Recommendation" (KGIN). *arXiv 2102.07057*. [Link](https://arxiv.org/abs/2102.07057)
- "Knowledge Enhanced Multi-intent Transformer Network for Recommendation" (2024). *ACM Web Conference*. [Link](https://dl.acm.org/doi/10.1145/3589335.3648296)
- "Entity-driven User Intent Inference for Knowledge Graph-based Recommendation" (EKIN). *Applied Intelligence*. [Link](https://link.springer.com/article/10.1007/s10489-022-04048-4)
- "Explain What You Mean: Intent Augmented Knowledge Graph Recommender Built With LLM" (2025). *arXiv 2505.10900*. [Link](https://arxiv.org/html/2505.10900v1)
- "RecKG: Knowledge Graph for Recommender Systems" (2025). *arXiv 2501.03598*. [Link](https://arxiv.org/html/2501.03598v1)

### User Modeling and Dialogue Systems

- "Probabilistic Modeling of Intentions in Socially Intelligent LLM Agents" (2025). *arXiv 2510.18476*. [Link](https://arxiv.org/html/2510.18476)
- "A Survey on Recent Advances in LLM-Based Multi-turn Dialogue Systems" (2025). *ACM Computing Surveys*. [Link](https://dl.acm.org/doi/full/10.1145/3771090)
- "Using Large Language Models for Goal-Oriented Dialogue Systems" (2025). *Applied Sciences*. [Link](https://www.mdpi.com/2076-3417/15/9/4687)
- "Reimagining Intent Prediction: Insights from Graph-Based Dialogue Modeling" (2024). *LREC-COLING 2024*. [Link](https://aclanthology.org/2024.lrec-main.1208/)

### Practical Systems

- Alexa Skills Kit — Intent Model Documentation. [Developer Docs](https://developer.amazon.com/en-US/docs/alexa/custom-skills/create-the-interaction-model-for-your-skill.html)
- Jain et al. "Recursive Bayesian Human Intent Recognition in Shared-Control Robotics." *IROS 2018*. [Link](https://users.eecs.northwestern.edu/~sjq751/research_files/jain_iros18.pdf)

### Neuro-Symbolic and Hybrid Approaches

- "Recommender Systems Based on Neuro-Symbolic Knowledge Graph Embeddings" (2024). *User Modeling and User-Adapted Interaction*. [Link](https://link.springer.com/article/10.1007/s11257-024-09417-x)
- "Enhancing Intention Prediction and Interpretability in Service Robots with LLM and KG" (2024). *Scientific Reports*. [Link](https://www.nature.com/articles/s41598-024-77916-3)
