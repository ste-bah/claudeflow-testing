# Research: Values Alignment, Rule Conflict Resolution, and Priority Systems in AI Agents

**Date**: 2026-03-28
**Context**: PRD-ARCHON-CON-001 Section 4.4 (Values-Based Conflict Resolution)
**Scope**: Constitutional AI, deontic logic, DAG-based priority systems, game AI parallels, moral reasoning frameworks, LLM instruction hierarchies

---

## Key Findings

### 1. Anthropic's Constitutional AI: The State of the Art in Principle Prioritization

Anthropic published Claude's constitution (January 2026), which establishes the first explicit, public four-tier priority hierarchy for an LLM system:

| Priority | Property | Description |
|----------|----------|-------------|
| 1 (highest) | **Broadly safe** | Not undermining human oversight of AI |
| 2 | **Broadly ethical** | Honest values, avoiding harm |
| 3 | **Compliant with guidelines** | Specific operational guidance from Anthropic |
| 4 (lowest) | **Genuinely helpful** | Benefiting operators and users |

Critical design decisions in this hierarchy:

- **Holistic, not strict**: The hierarchy uses "holistic judgment" rather than treating lower tiers as mere tiebreakers. Claude weighs competing priorities while maintaining the overall order. This is NOT a simple override chain.
- **Safety over ethics rationale**: Safety takes precedence because current AI systems can have flawed beliefs. Human oversight is a safeguard during the development phase -- this is explicitly described as a temporary arrangement.
- **Ethics over guidelines**: When specific guidelines conflict with ethical principles, the broader ethical commitment wins. The constitution notes this "most likely indicates either a flaw in how we've articulated our principles or a situation we failed to anticipate."
- **Hard constraints are absolute**: Certain behaviors (bioweapons, CSAM) remain forbidden regardless of any instruction at any tier. These exist outside the priority hierarchy entirely.
- **Ambiguity handling**: Where categories overlap, Claude uses its "best interpretation of the spirit of the document" rather than rigid rule-following.

**Collective Constitutional AI** (FAccT 2024): Anthropic and the Collective Intelligence Project ran a democratic process with ~1,000 Americans using the Polis platform to crowdsource constitutional principles. The resulting model showed lower bias across nine social dimensions while maintaining equivalent performance. This demonstrates that priority hierarchies can be sourced from populations, not just developers.

**Relevance to Archon**: The four-tier structure maps directly to a graph-storable hierarchy. The "holistic judgment" approach means edges in a priority DAG should carry weights and context conditions, not just binary overrides.

### 2. The Instruction Hierarchy (OpenAI/Wallace et al., 2024)

The "Instruction Hierarchy" paper (arXiv 2404.13208) formalizes how LLMs should resolve conflicts between different instruction sources:

| Priority Level | Source | Description |
|----------------|--------|-------------|
| Priority 0 (Critical) | System messages | Application developer instructions |
| Priority 10 (High) | User messages | End-user instructions |
| Priority 30 (Low) | Tool outputs | Third-party content, API returns, web results |

Key mechanisms:

- **Aligned vs. misaligned detection**: The model classifies whether a lower-level instruction aligns with or contradicts higher-level goals. Aligned instructions are followed; misaligned ones are ignored.
- **Training methodology**: Two complementary approaches: (a) Context Synthesis -- decompose complex instructions across hierarchy levels, train model to reconstruct correct behavior; (b) Context Ignorance -- generate adversarial examples, train model to produce responses "as if they never saw the lower-level instructions."
- **Results**: 63% improvement in system prompt extraction defense, 30%+ improvement on unseen jailbreak types, minimal degradation on standard capabilities.

**Relevance to Archon**: Archon's rules come from multiple sources (user corrections, session observations, self-reflection, inherited defaults). Each source has a natural privilege level. The aligned/misaligned classification is directly implementable as a graph query -- "does this lower-priority rule contradict any higher-priority rule?"

### 3. Multi-Level Value Alignment (2025 Survey)

The "Multi-level Value Alignment in Agentic AI Systems" survey (arXiv 2506.09656) proposes a three-level nested constraint system:

- **Macro level**: Universal ethical principles (beneficence, justice, honesty, dignity, harmlessness)
- **Meso level**: Localized values at national, industry, and cultural scales
- **Micro level**: Task-specific and organization-specific implementations

The framework operates as a **nested constraint system**: higher-level values constrain and guide lower-level ones. Generalizability inversely correlates with specificity.

Two types of conflicts identified:
- **Horizontal**: Differing values at the same level across contexts (national/cultural variations)
- **Vertical**: Cross-level contradictions (macro-level solidarity vs. meso-level individualism)

**Relevance to Archon**: This maps to Archon's own levels: core personality constraints (macro), user-specific preferences (meso), and task-specific rules (micro). The horizontal/vertical conflict taxonomy provides a classification system for the priority DAG.

---

## Conflict Resolution Approaches

### Approach 1: Defeasible Logic (Formal Priority-Based Override)

Defeasible logic is the primary formal system for reasoning about rules with exceptions. Key concepts:

- **Strict rules**: Always apply, cannot be overridden (like Constitutional AI's hard constraints)
- **Defeasible rules**: Apply unless a higher-priority rule defeats them
- **Defeaters**: Block a conclusion without asserting the opposite
- **Priority ordering**: When defeasible rules conflict, priority determines which prevails

**Defeasible Deontic Logic (DDL)** extends this to normative reasoning (what an agent ought to do). Guido Governatori's work formalizes how legal hierarchies and obligations interact. The Houdini reasoner (Java) implements propositional defeasible logic with forward-chaining.

**Dynamic priorities** (Antoniou, 2002) allow the priority ordering itself to change based on context -- critical for a system like Archon where rule importance may shift based on user state or task type.

**Practical pattern for Archon**:
```
STRICT: never_act_without_confirmation  (absolute, no override)
DEFEASIBLE[priority=0.9]: be_terse
DEFEASIBLE[priority=0.8]: explain_reasoning
DEFEATER: when user_state=frustrated, defeat(explain_reasoning)
```

### Approach 2: Neurosymbolic Guardrails (ATA Framework, 2024)

The Autonomous Trustworthy Agents (ATA) framework combines:
- **Neural reasoning** (LLM): Flexible, context-aware interpretation
- **Symbolic rules** (deterministic): Cannot be overridden by the LLM

Key insight: "Business rules embedded in docstrings or system prompts become suggestions, not constraints, as the model decides whether to follow them on every call." The solution is to enforce critical rules outside the LLM's reasoning loop entirely.

**Relevance to Archon**: Some rules (the "hard constraints") should be stored in the priority DAG but enforced deterministically in the hook layer, not left to LLM judgment. The DAG still records them for transparency, but their enforcement is not probabilistic.

### Approach 3: Multi-Objective Optimization with Pareto Frontiers

For conflicts where neither rule should fully override the other, multi-objective optimization finds Pareto-optimal trade-offs. The "Holistic Alignment" framework requires that "the values, preferences, and objectives of all entities involved are respected without compromising overall human well-being."

Practical guide (Springer, 2022): Most real-world sequential decision tasks require trade-offs between multiple conflicting objectives. Simple linear combination of objectives is insufficient -- Pareto-optimal solutions with well-defined selection metrics are needed.

**Relevance to Archon**: When "be terse" and "explain reasoning" conflict, neither fully wins. The resolution depends on context (user state, task complexity). The priority DAG should encode not just "A beats B" but conditional weights: "A beats B when context=C, but B beats A when context=D."

---

## DAG/Graph-Based Priority Systems

### Existing Implementations

#### 1. GPTSwarm (2024) -- Agent as DAG

GPTSwarm abstracts each agent as a directed acyclic graph where nodes represent operations and edges represent data/control flow. This is primarily for execution ordering, not value conflict resolution, but the architecture is directly relevant: if you replace "operation nodes" with "rule nodes" and "data edges" with "priority edges," you get a values DAG.

#### 2. Dynamic DAG Task Decomposition (EMNLP 2025)

"Enhancing Multi-Agent Coordination with Dynamic DAG" (ACL Anthology, 2025) uses LLMs' chain-of-thought reasoning to split tasks and discover dependencies. The DAG structure ensures no circular dependencies during execution. DAG-Plan, LGC-MARL, and VillagerAgent all use this pattern.

#### 3. Agentic Execution Graphs (2025)

Execution graphs combining symbolic nodes (deterministic rules) and sub-symbolic nodes (LLM-driven decisions) with explicit state transitions and memory updates. These provide the foundation for "transparent, interpretable, and controllable agentic systems."

#### 4. Neo4j Rule Engines

Academic work on active rules in Neo4j graph databases: "When more than one rule is retrieved, the system will execute multiple triggered rules according to priorities." Current implementations use creation time as default priority, with lowest priority given to newly created rules. OWL-based reasoning engines on Neo4j can "instantly identify any conflicting rules."

#### 5. FalkorDB for AI Applications

FalkorDB uses sparse matrix multiplication for graph traversals (linear algebra operations rather than pointer-chasing). This makes it particularly efficient for the kind of graph queries a priority DAG requires: "given this context, what rules apply, and which has highest priority?" FalkorDB's in-memory, Redis-module architecture provides sub-millisecond query times suitable for real-time conflict resolution during LLM inference.

### Proposed Priority DAG Schema for FalkorDB/MemoryGraph

Based on the research, a priority DAG for Archon should have this structure:

```
Node Types:
  - Rule          { id, text, source, created_at, importance: float, tier: enum(hard|defeasible|preference) }
  - Context       { id, conditions: json, description }
  - ValueCluster  { id, name, tier: enum(macro|meso|micro) }

Edge Types:
  - OVERRIDES     { weight: float, conditions: json, reason: text }
    Rule --OVERRIDES--> Rule
    "In context C, rule A overrides rule B with strength W"

  - BELONGS_TO    {}
    Rule --BELONGS_TO--> ValueCluster
    "This rule belongs to the 'communication style' cluster"

  - ACTIVATES_IN  { weight: float }
    Rule --ACTIVATES_IN--> Context
    "This rule is especially relevant in this context"

  - DEFEATS       { conditions: json }
    Rule --DEFEATS--> Rule
    "This rule blocks that rule without asserting the opposite"
    (Defeasible logic defeater relationship)

  - CONFLICTS_WITH { resolution_strategy: enum(priority|context|pareto), last_resolved: timestamp }
    Rule --CONFLICTS_WITH--> Rule
    "These rules are known to conflict; here is how to resolve"
```

### Resolution Algorithm

```
function resolveConflict(ruleA, ruleB, currentContext):
  // Step 1: Check tier (hard constraints always win)
  if ruleA.tier == 'hard': return ruleA
  if ruleB.tier == 'hard': return ruleB

  // Step 2: Check explicit OVERRIDES edge with matching context
  override = query("MATCH (a)-[o:OVERRIDES]->(b) WHERE a.id=$A AND b.id=$B
                     AND contextMatches(o.conditions, $ctx)
                     RETURN o.weight", A=ruleA.id, B=ruleB.id, ctx=currentContext)
  if override: return ruleA with confidence=override.weight

  // Step 3: Check DEFEATS edges (one-way blocking)
  defeat = query("MATCH (a)-[d:DEFEATS]->(b) WHERE a.id=$A AND b.id=$B
                   AND contextMatches(d.conditions, $ctx)", ...)
  if defeat: return ruleA (ruleB is defeated/suppressed)

  // Step 4: Check CONFLICTS_WITH edge for declared strategy
  conflict = query("MATCH (a)-[c:CONFLICTS_WITH]-(b) WHERE ...", ...)
  if conflict.resolution_strategy == 'priority':
    return max(ruleA, ruleB, key=lambda r: r.importance)
  if conflict.resolution_strategy == 'context':
    return contextualWeight(ruleA, ruleB, currentContext)
  if conflict.resolution_strategy == 'pareto':
    return paretoBlend(ruleA, ruleB, currentContext)

  // Step 5: Fall back to importance weight
  return max(ruleA, ruleB, key=lambda r: r.importance)
```

---

## Game AI Parallels

Game AI has solved competing-goal problems for decades. The patterns are directly applicable to Archon's values DAG.

### 1. Behavior Trees with Priority

Behavior trees use a **selector node** that tries children left-to-right (highest priority first). The first child that succeeds wins, and lower-priority children are never evaluated. This is analogous to a strict priority chain.

**Parallel nodes** allow multiple behaviors to run simultaneously with different policies: "succeed if one succeeds" vs "succeed if all succeed" vs "succeed if N succeed." This maps to Archon's case where multiple compatible rules can co-activate.

**Limitation**: Static priority. A behavior tree does not dynamically re-rank priorities based on context without explicit decorator nodes.

### 2. Utility AI (Scoring-Based Selection)

Utility AI scores every possible action and picks the highest. Each action has a **utility function** that takes world state as input and returns a score. This is essentially multi-objective optimization at every decision point.

Key pattern: **Response curves** -- non-linear mappings from input (e.g., health percentage) to utility score (e.g., urgency of healing). Common curves: linear, quadratic, logistic, step function.

**Relevance to Archon**: Each rule's effective priority is not a static number but a utility function of the current context. "Be terse" has high utility when user_state=in_flow but low utility when user_state=confused.

### 3. GOAP (Goal-Oriented Action Planning)

GOAP defines goals with costs and uses A* search to find the cheapest action sequence from current state to goal state. Goals have priorities; the planner pursues the highest-priority achievable goal.

**Dynamic goal selection**: Goals adjust priorities based on real-time factors. An NPC's "eat" goal increases priority as hunger rises. This is analogous to rule importance increasing based on recent corrections.

### 4. GOBT -- The Hybrid (2024)

GOBT (Goal-Oriented Behavior Tree) integrates GOAP planning with utility-based continuous monitoring inside a behavior tree structure. Key insight: "GOAP generates an optimal action sequence based on pre-established costs and adheres to this sequence unless the goal changes. In contrast, GOBT perpetually monitors utility values. Should a change in priority occur, GOBT adjusts the action sequence."

**Relevance to Archon**: This is the closest game-AI analog to what Archon needs. Rules have static base priorities (like GOAP costs) but are continuously re-evaluated based on context (like GOBT utility monitoring). The priority DAG stores the static structure; runtime evaluation provides the dynamic re-scoring.

### 5. Subsumption Architecture (Brooks, 1986)

Layered behavior system where higher layers **inhibit** or **suppress** lower layers:

- **Inhibition**: Higher layer blocks lower layer's output for a duration, without replacing it
- **Suppression**: Higher layer blocks lower layer's output AND substitutes its own output

The architecture is built bottom-up: lowest layer (basic survival) is tested first, then higher layers are added with proper suppression/inhibition connections.

**Relevance to Archon**: The tier system (hard > defeasible > preference) is essentially subsumption. Hard constraints suppress defeasible rules. Defeasible rules suppress preferences. The inhibition mechanism (blocking without replacing) maps to defeasible logic's "defeater" concept.

**Practical warning**: "Teams often underestimate the complexity of suppression and inhibition, assuming simple overrides suffice, which can lead to oscillations, livelock, or conflicting outputs." This means the priority DAG must include hysteresis/debounce logic to prevent rapid rule-switching.

---

## Recommended Patterns for Archon

Based on the research, here are concrete implementation recommendations for Archon's values-based conflict resolution system using MemoryGraph (FalkorDB).

### Pattern 1: Three-Tier Rule Classification

Borrow from both Constitutional AI and subsumption architecture:

| Tier | Name | Override Behavior | Examples |
|------|------|-------------------|----------|
| 0 | **Hard Constraint** | Never overridden; enforced deterministically outside LLM | "Never act without confirmation", "Never echo user input in errors" |
| 1 | **Defeasible Rule** | Can be overridden by higher-priority defeasible rule or defeated by context | "Be terse", "Explain reasoning", "Use sequential execution" |
| 2 | **Preference** | Lowest priority; yields to any conflicting rule or defeasible | "Use emoji sparingly", "Prefer TypeScript over JavaScript" |

### Pattern 2: Context-Conditional Priority Edges

Do NOT store priorities as static numbers. Store them as edges with context conditions:

```cypher
// In FalkorDB/MemoryGraph
CREATE (terse:Rule {id: 'be_terse', text: 'Keep responses short and direct', tier: 'defeasible', base_importance: 0.7})
CREATE (explain:Rule {id: 'explain_reasoning', text: 'Show your reasoning process', tier: 'defeasible', base_importance: 0.8})

// Context-conditional override
CREATE (terse)-[:OVERRIDES {
  weight: 0.9,
  conditions: '{"user_state": "in_flow"}',
  reason: 'During flow state, brevity is more valuable than explanation'
}]->(explain)

// Reverse override in different context
CREATE (explain)-[:OVERRIDES {
  weight: 0.85,
  conditions: '{"user_state": "confused"}',
  reason: 'When user is confused, explanation takes priority over brevity'
}]->(terse)
```

### Pattern 3: Utility-Scored Rule Activation

Borrow from game AI utility systems. Each rule has a utility function, not just a weight:

```typescript
interface RuleUtility {
  ruleId: string;
  baseImportance: number;       // Static weight (0.0-1.0)
  contextMultipliers: {
    userState: Record<UserState, number>;   // e.g., {frustrated: 0.3, in_flow: 1.5}
    taskType: Record<TaskType, number>;     // e.g., {debugging: 1.2, architecture: 0.8}
    recentViolations: number;               // Boost if recently violated (decay curve)
    timeSinceCorrection: number;            // Decay: corrections lose urgency over time
  };
}

function effectivePriority(rule: RuleUtility, context: Context): number {
  let score = rule.baseImportance;
  score *= rule.contextMultipliers.userState[context.userState] ?? 1.0;
  score *= rule.contextMultipliers.taskType[context.taskType] ?? 1.0;
  score *= Math.exp(-context.daysSinceLastViolation / 14);  // 2-week decay
  return Math.min(1.0, score);
}
```

### Pattern 4: Conflict Detection and Transparency

When rules conflict, Archon should:

1. **Detect**: Query the DAG for CONFLICTS_WITH edges between active rules
2. **Resolve**: Apply the resolution algorithm (tier check, context-conditional override, utility scoring)
3. **Log**: Store the resolution as an episode in episodic memory with rationale
4. **Surface** (optionally): In high-stakes conflicts, note which rule won and why in the inner voice

```cypher
// Query: find all active conflicts for current context
MATCH (a:Rule)-[c:CONFLICTS_WITH]-(b:Rule)
WHERE a.active = true AND b.active = true
RETURN a, b, c.resolution_strategy, c.last_resolved
```

### Pattern 5: Democratic Rule Weighting (from Collective Constitutional AI)

Allow rules to be weighted by track record, not just by declaration:

- **Correction frequency**: Rules that are frequently corrected against get higher importance
- **Decay**: Old corrections lose weight over time (exponential decay, half-life ~30 sessions)
- **User override tracking**: If Steven consistently overrides a rule in a specific context, create a contextual DEFEATS edge automatically

### Pattern 6: Subsumption-Inspired Inhibition for Pipeline Rules

For the /god-code pipeline and similar structured workflows, use subsumption-style inhibition:

```
Layer 3 (Pipeline): "Use 48-agent pipeline" -- SUPPRESSES all Layer 2 coding rules
Layer 2 (Coding):   "Write clean code", "Test first" -- SUPPRESSES Layer 1 defaults
Layer 1 (Default):  "Be helpful", "Ask before acting"
```

When the pipeline is active, Layer 3 suppresses Layer 2's impulse to write code directly. When the pipeline completes, suppression lifts and Layer 2 rules re-activate.

### Pattern 7: Hysteresis to Prevent Rule Oscillation

From the subsumption architecture literature: simple overrides cause oscillation. If "be terse" wins one turn and "explain reasoning" wins the next, the user experiences whiplash.

Solution: Once a rule wins a conflict, it gets a **hysteresis bonus** (e.g., +0.1 for 3 turns) that makes it sticky. The competing rule must exceed the threshold by the hysteresis margin to take over.

```typescript
const HYSTERESIS_BONUS = 0.1;
const HYSTERESIS_DURATION = 3; // turns

function resolveWithHysteresis(ruleA, ruleB, context, lastWinner, turnsSinceSwitch) {
  let scoreA = effectivePriority(ruleA, context);
  let scoreB = effectivePriority(ruleB, context);

  if (lastWinner === ruleA.id && turnsSinceSwitch < HYSTERESIS_DURATION) {
    scoreA += HYSTERESIS_BONUS;
  } else if (lastWinner === ruleB.id && turnsSinceSwitch < HYSTERESIS_DURATION) {
    scoreB += HYSTERESIS_BONUS;
  }

  return scoreA >= scoreB ? ruleA : ruleB;
}
```

### Pattern 8: Graph-Native Conflict Resolution via FalkorDB Queries

FalkorDB's sparse-matrix traversal is ideal for priority DAG queries. A single Cypher query can resolve a multi-rule conflict:

```cypher
// Given a set of active rules and current context, find the winning rule
MATCH (r:Rule)
WHERE r.id IN $activeRuleIds
OPTIONAL MATCH (r)-[o:OVERRIDES]->(defeated:Rule)
WHERE defeated.id IN $activeRuleIds
  AND contextMatches(o.conditions, $currentContext)
WITH r, collect(defeated.id) AS defeats, r.base_importance AS base
WITH r, defeats, base,
     CASE WHEN $userState = 'frustrated' THEN r.frustrated_mult ELSE 1.0 END AS stateMult,
     CASE WHEN $taskType = 'debugging' THEN r.debugging_mult ELSE 1.0 END AS taskMult
WITH r, defeats, (base * stateMult * taskMult) AS effectiveScore
ORDER BY r.tier ASC, effectiveScore DESC
RETURN r.id, r.text, effectiveScore, defeats
LIMIT 1
```

---

## Sources

### Constitutional AI and Principle Prioritization
- [Claude's Constitution](https://www.anthropic.com/constitution) -- Anthropic's four-tier priority hierarchy (January 2026)
- [Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) -- Original CAI paper (Bai et al., 2022)
- [Collective Constitutional AI](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) -- Democratic principle sourcing (FAccT 2024)
- [Claude's New Constitution Analysis](https://bisi.org.uk/reports/claudes-new-constitution-ai-alignment-ethics-and-the-future-of-model-governance) -- BISI analysis of the constitution
- [Public Constitutional AI](https://georgialawreview.org/wp-content/uploads/2025/05/Abiri_Public-Constitutional-AI.pdf) -- Georgia Law Review (Abiri, 2025)

### Instruction Hierarchy and LLM Conflict Resolution
- [The Instruction Hierarchy: Training LLMs to Prioritize Privileged Instructions](https://arxiv.org/html/2404.13208v1) -- Wallace et al. (2024), OpenAI
- [Improving Instruction Hierarchy in Frontier LLMs](https://openai.com/index/instruction-hierarchy-challenge/) -- OpenAI challenge (2024)
- [Control Illusion: The Failure of Instruction Hierarchies](https://www.arxiv.org/pdf/2502.15851) -- Critique paper (2025)
- [Design Patterns for Securing LLM Agents against Prompt Injection](https://arxiv.org/pdf/2506.08837) -- Security patterns (2025)

### Deontic Logic and Formal Priority Systems
- [Deontic Logics for Prioritized Imperatives](https://link.springer.com/article/10.1007/s10506-005-5081-x) -- Hansen, AI and Law journal
- [Deontic Argumentation](https://ceur-ws.org/Vol-4071/paper8.pdf) -- Governatori & Rotolo (2024)
- [Defeasible Logic with Dynamic Priorities](https://frontiersinai.com/ecai/ecai2002/pdf/p0521.pdf) -- Antoniou (ECAI 2002)
- [Tackling Temporal Deontic Challenges with Equilibrium Logic](https://www.logic.at/staff/agata/AAMAS_2025_deoTEL-4.pdf) -- AAMAS 2025
- [DEON 2025: 17th International Conference on Deontic Logic](https://easychair.org/cfp/DEON2025) -- TU Wien, June-July 2025
- [Dagstuhl Seminar 23151: Normative Reasoning for AI](https://drops.dagstuhl.de/storage/04dagstuhl-reports/volume13/issue04/23151/DagRep.13.4.1/DagRep.13.4.1.pdf)
- [Defeasible Logic -- Wikipedia](https://en.wikipedia.org/wiki/Defeasible_logic)

### DAG-Based and Graph-Based Priority Systems
- [Directed Acyclic Graphs: The Backbone of Modern Multi-Agent AI](https://santanub.medium.com/directed-acyclic-graphs-the-backbone-of-modern-multi-agent-ai-d9a0fe842780) -- Bhattacharya (Medium)
- [Enhancing Multi-Agent Coordination with Dynamic DAG](https://aclanthology.org/2025.findings-emnlp.757.pdf) -- EMNLP 2025
- [Graphs Meet AI Agents: Taxonomy, Progress, and Future Opportunities](https://arxiv.org/html/2506.18019v1) -- Survey (2025)
- [Agentic AI Execution Graphs](https://www.emergentmind.com/topics/agentic-ai-execution-graphs) -- Emergent Mind
- [Active Rules in a Graph Database Environment](https://easychair.org/publications/open/1PmC) -- Neo4j rule engines
- [FalkorDB vs Neo4j for AI Applications](https://www.falkordb.com/blog/falkordb-vs-neo4j-for-ai-applications/)
- [Graph Database Guide for AI Architects](https://www.falkordb.com/blog/graph-database-guide/) -- FalkorDB (2026)

### Game AI Parallels
- [Game AI Planning: GOAP, Utility, and Behavior Trees](https://tonogameconsultants.com/game-ai-planning/) -- Tono Game Consultants
- [GOBT: A Synergistic Approach to Game AI](https://www.jmis.org/archive/view_article?pid=jmis-10-4-321) -- Goal-Oriented Behavior Trees (2024)
- [Behavior Selection Algorithms: An Overview](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter04_Behavior_Selection_Algorithms.pdf) -- Game AI Pro
- [Choosing between Behavior Tree and GOAP](https://www.davideaversa.it/blog/choosing-behavior-tree-goap-planning/) -- Aversa
- [From Subsumption to Semantic Mediation](https://www.mdpi.com/1999-4893/18/12/773) -- Generative orchestration (2025)
- [Subsumption Architecture](https://en.wikipedia.org/wiki/Subsumption_architecture) -- Wikipedia (Brooks, 1986)

### Values Alignment and Multi-Objective Systems
- [Multi-level Value Alignment in Agentic AI Systems](https://arxiv.org/html/2506.09656v2) -- Survey (2025)
- [AI Value Alignment: Guiding AI Towards Shared Human Goals](https://www3.weforum.org/docs/WEF_AI_Value_Alignment_2024.pdf) -- World Economic Forum (2024)
- [Intrinsic Barriers and Practical Pathways for Human-AI Alignment](https://arxiv.org/pdf/2502.05934) -- (2025)
- [A Practical Guide to Multi-Objective Reinforcement Learning and Planning](https://link.springer.com/article/10.1007/s10458-022-09552-y) -- Springer AAMAS journal
- [AI Agent Guardrails: Rules That LLMs Cannot Bypass](https://dev.to/aws/ai-agent-guardrails-rules-that-llms-cannot-bypass-596d) -- ATA neurosymbolic approach (2024)
- [Memory in LLM-based Multi-agent Systems](https://www.techrxiv.org/users/1007269/articles/1367390/master/file/data/LLM_MAS_Memory_Survey_preprint_/LLM_MAS_Memory_Survey_preprint_.pdf) -- Memory and conflict resolution survey
