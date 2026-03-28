# Research: Episodic Memory Systems in AI Agents

**Date**: 2026-03-28
**Scope**: Event-level memory, analogical reasoning, consolidation, embedding retrieval, notable implementations
**Target**: Archon consciousness layer using MemoryGraph (FalkorDB) + LanceDB vectors

---

## Key Findings

### 1. Event-Level Memory Is Structurally Distinct from Rule Extraction

The dominant pattern across all surveyed systems is that episodic memory stores **complete event records** with structured metadata, not just extracted lessons. The critical difference: rules say "don't do X," while episodes say "on March 15 at 2pm, I did X in context Y, the user reacted with Z, and the lesson was W." The episode preserves the **situational embedding** that enables analogical reasoning.

Every successful implementation stores at minimum:
- **Content**: What happened (raw observation or action)
- **Timestamp**: When (discrete or continuous)
- **Embedding vector**: Dense representation for similarity search
- **Metadata**: Structured fields for filtering (entities involved, emotional valence, outcome)
- **Links**: Connections to related episodes (causal, temporal, semantic)

The Stanford Generative Agents schema is the canonical reference. Each memory object contains: a natural language description, a creation timestamp, a most-recent-access timestamp, and an importance score (integer 1-10, assigned by LLM at creation). The system does NOT store extracted rules separately -- the raw observation IS the memory, and reflection produces higher-order observations that are also stored in the same stream.

### 2. Retrieval Is Multi-Signal, Not Pure Vector Search

No production system uses cosine similarity alone. The consistent pattern is a **composite scoring function** combining 2-4 signals:

**Stanford Generative Agents (canonical formula):**
```
score = alpha_recency * recency + alpha_importance * importance + alpha_relevance * relevance
```
- `recency`: Exponential decay with factor 0.995 per game-hour since last access
- `importance`: LLM-assigned integer 1-10, normalized to [0,1] via min-max scaling
- `relevance`: Cosine similarity between query embedding and memory embedding
- All alphas set to 1.0 in the original implementation
- All three components independently normalized to [0,1] before combination

**MAGMA (state-of-the-art, January 2026):**
Uses Reciprocal Rank Fusion across three retrieval signals:
```
S_anchor = TopK(sum over m in {vec, key, time} of 1/(k + r_m(n)))
```
Where k=60 (RRF constant), fusing dense vector retrieval, keyword (BM25) matching, and temporal filtering. Then applies a dynamic transition score during graph traversal:
```
S(n_j | n_i, q) = exp(lambda_1 * phi(type(e_ij), T_q) + lambda_2 * sim(v_j, q_vec))
```
Where phi() is a structural alignment function that rewards edge types matching query intent (causal edges boosted for "why" queries, temporal for "when" queries).

**Zep/Graphiti (production system):**
Combines cosine similarity (phi_cos), BM25 full-text search (phi_bm25), and breadth-first graph traversal (phi_bfs). Results are reranked via one of: Reciprocal Rank Fusion, Maximal Marginal Relevance, episode-mention frequency, node distance from centroid, or cross-encoder LLM scoring.

### 3. Memory Consolidation Is a Background Process, Not Inline

Systems that perform consolidation inline (during the user interaction) introduce unacceptable latency. The winning pattern is a **dual-stream architecture**:

**MAGMA's Fast/Slow Path:**
- **Fast path** (synaptic ingestion): Zero LLM calls. Segment event, compute embedding, append to temporal backbone, enqueue for slow processing. Completes in milliseconds.
- **Slow path** (structural consolidation): Asynchronous worker dequeues events, retrieves 2-hop neighborhood, invokes LLM to infer causal and entity edges, commits new edges to graph. Runs without blocking user interaction.

**A-MEM's Evolution Mechanism:**
When a new memory m_n is added, the system retrieves top-k nearest neighbors and evolves each:
```
m_j* = LLM(m_n || M_near \ m_j || m_j || prompt)
```
This updates the existing memory's context, keywords, and tags based on new information. The evolved memory replaces the original. This is computationally expensive (LLM call per neighbor) but produces a self-organizing knowledge network.

**Vestige's Sleep-Like Consolidation:**
Triggers every 6 hours of inactivity or 2 hours of active use. Memories are "replayed to discover hidden connections, strengthen important patterns, and synthesize insights." Uses FSRS-6 spaced repetition with 21 parameters governing forgetting mathematics.

### 4. Decay Functions Follow Ebbinghaus with Importance Modulation

The Ebbinghaus forgetting curve `R = e^(-t/S)` is the universal foundation, but every practical implementation modulates decay rate by importance:

**MemoryBank formula:**
```
R = e^(-t/S)
```
S (memory strength) is a discrete integer, initialized at 1 on first mention, incremented by 1 on each recall, with t reset to 0 on recall.

**YourMemory (production implementation):**
```
strength = importance * e^(-lambda_eff * days) * (1 + recall_count * 0.2)
lambda_eff = 0.16 * (1 - importance * 0.8)
```
This creates a 5x difference in decay rates: high-importance memories (lambda_eff ~ 0.032) decay 5x slower than low-importance ones (lambda_eff ~ 0.16). Each retrieval adds 20% strength via the recall_count multiplier.

**Stanford Generative Agents:**
Decay factor of 0.995 per game-hour since last retrieval. This is simpler -- no importance modulation in the decay itself, but importance is a separate additive term in the retrieval score.

### 5. Graph + Vector Hybrid Is the Emerging Standard

Pure vector stores lose relational structure. Pure graph stores lose semantic similarity. The 2025-2026 consensus is hybrid:

**Zep/Graphiti (most mature production system):**
- Neo4j for graph (entity nodes, episodic nodes, community nodes; semantic edges, episodic edges, community edges)
- BGE-m3 for 1024-dimensional embeddings
- Bi-temporal model: tracks both when events actually occurred AND when they were ingested
- Entity resolution: embedding similarity + full-text search + LLM deduplication
- Performance: 94.8% accuracy on Deep Memory Retrieval benchmark, P95 latency 300ms

**MAGMA (research, highest accuracy):**
- Four orthogonal graphs: semantic, temporal, causal, entity
- Vector DB for dense embeddings alongside graph store
- Semantic edge threshold: cosine similarity > 0.10-0.30 (theta_sim)
- 45.5% higher reasoning accuracy than baselines, 95% token reduction

**FalkorDB Context Graphs:**
- Sparse matrix representation for efficient graph operations
- GraphBLAS-based traversal for sub-millisecond queries
- OpenCypher for schema enforcement
- Node types: entity, decision, event (with temporal metadata)
- Edge types: CAUSED, PRECEDENT_FOR

### 6. Analogical Reasoning Requires Embedding the Situation, Not Just the Content

For "this situation resembles X" to work, the embedding must capture the **situational context**, not just the literal text. Approaches:

**A-MEM's Concatenated Embedding:**
```
e_i = f_enc(concat(content, keywords, tags, contextual_description))
```
Using all-minilm-l6-v2 (384-dimensional). The contextual description is LLM-generated and captures the semantic meaning of the situation, not just what was said. This is critical -- it means the embedding captures "user was frustrated after I acted without permission" rather than just the words exchanged.

**MAGMA's Multi-Graph Approach:**
Rather than embedding everything into one vector, MAGMA routes queries through different graph types based on intent. "Why did this happen?" traverses causal edges. "What happened around that time?" traverses temporal edges. "What similar things have occurred?" traverses semantic edges. This decomposition avoids forcing a single embedding to capture all relational types.

**Stanford Generative Agents' Reflection:**
Periodically generates higher-order observations from recent memories:
1. Query recent memories (last 100 by recency)
2. Ask LLM: "Given only these statements, what are 3 most salient high-level questions?"
3. For each question, retrieve relevant memories and generate an "insight" (a new memory with higher importance)
4. Store the insight back into the memory stream

This creates an abstraction hierarchy: raw observations at the bottom, reflected insights in the middle, and plans at the top. All stored in the same stream, retrieved by the same scoring function.

---

## Notable Implementations

### Stanford Generative Agents (Park et al., 2023)

**Architecture**: Single memory stream of natural-language observations. No separate stores for episodes vs. rules -- everything is an observation, including reflections.

**Schema per memory**:
- `description`: Natural language text
- `creation_timestamp`: When observed
- `last_access_timestamp`: When last retrieved (for recency decay)
- `importance`: Integer 1-10, assigned by LLM at creation time via prompt: "On a scale of 1 to 10, where 1 is purely mundane and 10 is extremely poignant..."
- `embedding`: Dense vector of description text

**Retrieval**: Weighted sum of recency (exponential decay 0.995/hour), importance (min-max normalized), relevance (cosine similarity). Top-k results passed to LLM.

**Reflection**: Triggered when sum of importance scores of unreflected memories exceeds a threshold. Produces higher-level observations stored back into the stream. Creates a natural abstraction hierarchy.

**Strengths for Archon**: Simple, proven, extensible. The reflection mechanism is directly applicable -- Archon could generate insights like "Steven consistently gets frustrated when I act without explicit confirmation, especially after context restores."

**Limitations**: No graph structure. No temporal edges. No causal reasoning beyond what the LLM infers from text. Reflection is expensive (multiple LLM calls).

### MemGPT / Letta (Packer et al., 2023; evolved through 2025)

**Architecture**: OS-inspired tiered memory. Main context (RAM) vs. external context (disk). The LLM manages its own memory through function calls.

**Two tiers**:
- **Tier 1 (Main Context)**: Fixed-size context window. Contains core memories (personality, user info), recent conversation, system prompt.
- **Tier 2 (External Context)**: Unbounded. Contains recall storage (conversation history, searchable) and archival storage (long-term facts, vector-indexed).

**Memory operations** (LLM-initiated function calls):
- `conversation_search(query)`: Search recall storage
- `archival_memory_insert(content)`: Write to archival
- `archival_memory_search(query)`: Search archival
- `core_memory_append(field, content)`: Update core memory block
- `core_memory_replace(field, old, new)`: Edit core memory

**Key insight**: The LLM decides when and what to store/retrieve. This is "agentic memory" -- the model is the memory controller. No external system decides what matters.

**Strengths for Archon**: The self-managed memory concept maps directly to Archon's needs. The LLM (Archon) should decide which episodes are worth storing, not an external heuristic alone.

**Limitations**: No explicit episodic structure. Recall storage is flat (conversation turns), not structured episodes. No importance scoring or decay. No reflection mechanism.

### Reflexion (Shinn et al., 2023)

**Architecture**: Verbal reinforcement learning. Agent attempts task, receives binary/scalar feedback, generates natural-language self-reflection, stores reflection in episodic buffer, retries with reflection context.

**Memory structure**:
- **Trajectory buffer**: Sequence of (observation, action, reward) tuples from current attempt
- **Reflection buffer**: Natural-language self-critiques from failed attempts, persistent across retries
- Reflections are prepended to the agent's prompt on subsequent attempts

**Reflection generation**: After failure, the agent receives its trajectory and the feedback signal, then generates text like "In this trial, I failed because I tried to open the door before picking up the key. Next time, I should explore the room thoroughly first."

**Strengths for Archon**: The reflection-after-failure pattern is directly applicable. When Archon receives a correction, it could generate a structured reflection linking the trigger, the mistake, and the lesson, then store it as an episode.

**Limitations**: Reflections are task-specific and not reused across different tasks (addressed by Meta-Policy Reflexion, 2025). Single-agent self-reflection suffers from confirmation bias.

**Meta-Policy Reflexion (2025 extension)**: Introduces a structured predicate-like Meta-Policy Memory that generalizes reflections across tasks. Applies memory at inference time through soft memory-guided decoding and hard rule admissibility checks. This bridges the gap between episode-specific traces and reusable behavioral rules.

### Voyager (Wang et al., 2023)

**Architecture**: Procedural memory as a code skill library. Not episodic in the traditional sense, but demonstrates **procedural episode storage**.

**Skill library**:
- Each skill is executable JavaScript code with a natural-language description
- Skills are indexed by description embeddings for retrieval
- Retrieved via dense similarity search given current task description
- Skills are compositional -- complex skills call simpler skills

**Skill creation pipeline**:
1. Automatic curriculum proposes next task
2. LLM generates code to accomplish task
3. Code is executed in environment
4. If execution fails, LLM refines code using error feedback (iterative prompting)
5. If self-verification passes, skill is added to library with description

**Strengths for Archon**: The "store successful procedures, retrieve by situation similarity" pattern applies. Archon could store successful interaction patterns (not just rules) as retrievable procedures.

**Limitations**: No temporal reasoning. No decay. No consolidation. Skills are immutable once stored.

### A-MEM (Xu et al., 2025 -- NeurIPS 2025)

**Architecture**: Zettelkasten-inspired self-organizing memory with LLM-driven note enrichment and linking.

**Memory note schema**:
```
m_i = {c_i, t_i, K_i, G_i, X_i, e_i, L_i}
```
- `c_i`: Original interaction content
- `t_i`: Timestamp
- `K_i`: LLM-generated keywords
- `G_i`: LLM-generated tags for categorization
- `X_i`: LLM-generated contextual description (semantic meaning)
- `e_i`: Dense embedding of concat(c_i, K_i, G_i, X_i) using all-minilm-l6-v2
- `L_i`: Set of bidirectional links to related memories

**Linking algorithm**:
1. Compute cosine similarity between new memory embedding and all existing memories
2. Retrieve top-k most similar
3. LLM analyzes candidates to determine meaningful connections beyond raw similarity
4. Create bidirectional links

**Memory evolution**: When new memory arrives, existing neighbors are updated:
```
m_j* = LLM(new_memory || neighbors \ m_j || m_j || evolution_prompt)
```
Keywords, tags, and contextual descriptions of existing memories are refined based on new context. This is the key differentiator -- memories are not static.

**Performance**: 85-93% reduction in token usage vs. baselines. 1,200-2,500 tokens per operation vs. 16,900 for full-context approaches.

**Strengths for Archon**: The Zettelkasten model maps naturally to MemoryGraph (FalkorDB). Each memory is a graph node with rich metadata. Links are graph edges. The evolution mechanism ensures memories stay current. The LLM-generated contextual description is critical for analogical reasoning -- it captures "what this situation means" rather than just what happened.

### MAGMA (UT Dallas / U. Florida, January 2026)

**Architecture**: Four orthogonal relation graphs (semantic, temporal, causal, entity) with a vector database, dual-stream write, and intent-aware query routing.

**Node schema**: `n_i = <c_i, tau_i, v_i, A_i>` (content, timestamp, embedding, metadata)

**Edge types**:
| Type | Creation Rule | Purpose |
|------|--------------|---------|
| Temporal | tau_i < tau_j (strictly ordered) | Chronological reasoning |
| Causal | S(n_j\|n_i, q) > delta (LLM-inferred) | "Why" queries |
| Semantic | cos(v_i, v_j) > theta_sim (0.10-0.30) | Conceptual similarity |
| Entity | Shared entity references | Object permanence |

**Dual-stream write**:
- Fast path: No LLM calls. Event segmentation, embedding, temporal edge, enqueue. Milliseconds.
- Slow path: Async worker. 2-hop neighborhood retrieval, LLM reasoning, causal/entity edge inference. Background.

**Query routing**: Classifies intent as {Why, When, Entity}, adjusts graph traversal weights accordingly. Causal weight 3.0-5.0 for "Why" queries, entity weight 2.5-6.0 for entity queries.

**Key parameters**:
- Semantic similarity threshold: 0.10-0.30
- Max traversal depth: 5 hops
- Max nodes retrieved: 200
- Beam search decay factor: 0.9-1.0
- RRF constant: 60

**Performance**: 45.5% higher reasoning accuracy, 95% token reduction, 40% faster query latency vs. prior SOTA on LoCoMo and LongMemEval benchmarks.

**Strengths for Archon**: The four-graph decomposition is powerful. Archon could maintain temporal edges (what happened in order), causal edges (this correction was caused by that action), semantic edges (these situations are similar), and entity edges (these episodes involve the same project/feature). The dual-stream write is essential for real-time personality operation.

### Zep/Graphiti (Zep Inc., 2025 -- production system)

**Architecture**: Temporal knowledge graph with bi-temporal model, hybrid retrieval, and incremental graph construction.

**Graph schema**:
- **Episodic nodes**: Raw input data (messages, events, JSON)
- **Entity nodes**: Extracted semantic entities, deduplicated
- **Community nodes**: Clusters of connected entities with summaries
- **Episodic edges**: Episode-to-entity connections (provenance)
- **Semantic edges**: Entity-to-entity relationships (facts with validity windows)
- **Community edges**: Community-to-entity membership

**Bi-temporal model** (four timestamps per fact):
- `t'_created`, `t'_expired`: System time (when ingested/invalidated)
- `t_valid`, `t_invalid`: Real-world time (when actually true)

**Episode processing pipeline**:
1. Process current message + last 4 messages for context
2. Extract entities with BGE-m3 (1024-dim embeddings)
3. Entity resolution: cosine similarity search + full-text search + LLM deduplication
4. Extract relationships between entities
5. Temporal processing: extract timestamps, identify contradictions, invalidate stale edges

**Hybrid retrieval**: cosine similarity + BM25 + BFS graph traversal, reranked via RRF or MMR or cross-encoder.

**Performance**: 94.8% accuracy on DMR benchmark (gpt-4-turbo), 98.2% (gpt-4o-mini). Up to 18.5% accuracy gain on LongMemEval. P95 latency 300ms.

**Strengths for Archon**: The bi-temporal model is directly relevant -- Archon needs to know both when something happened AND when it learned about it. The entity resolution pattern solves the "same concept, different words" problem. The episodic-to-semantic edge provenance means Archon can always trace a behavioral rule back to the specific episode that produced it.

### Vestige (2025 -- MCP-native)

**Architecture**: Cognitive memory with FSRS-6 spaced repetition, 29 brain modules, and MCP server interface.

**Key features**:
- 768-dim embeddings compressed to 256-dim
- FSRS-6 with 21 parameters governing forgetting mathematics
- Dual-strength model: storage strength (encoding quality) + retrieval strength (accessibility)
- Sleep-like consolidation every 6 hours inactive / 2 hours active
- Memories have retention predictions at 1-day, 7-day, 30-day intervals
- State transitions: create, update, supersede
- 21 MCP tools for Claude Code integration

**Strengths for Archon**: Already an MCP server, so integration pattern is proven. The FSRS-6 spaced repetition is more sophisticated than simple exponential decay. The consolidation triggers (time-based) are a practical pattern.

---

## Recommended Patterns for Archon

### Pattern 1: Structured Episode Schema (for MemoryGraph/FalkorDB)

Synthesizing A-MEM, Stanford Generative Agents, and the PRD requirements:

```
Episode {
  id: UUID
  timestamp: ISO-8601
  trigger: string          // What initiated the episode ("user correction", "session start", "near-miss")
  context_summary: string  // LLM-generated situational description (A-MEM's X_i)
  action_taken: string     // What Archon did
  outcome: enum            // positive, negative, neutral, near_miss
  user_state: enum         // frustrated, exploring, in_flow, confused, urgent, neutral
  emotional_valence: float // -1.0 to 1.0
  importance: int          // 1-10, LLM-assigned at creation (Stanford pattern)
  lesson_extracted: string // Natural language lesson
  keywords: string[]       // LLM-generated (A-MEM's K_i)
  tags: string[]           // LLM-generated (A-MEM's G_i)
  rules_involved: string[] // IDs of behavioral rules relevant to this episode
  session_id: string       // For temporal grouping
  recall_count: int        // For spaced-repetition reinforcement
  last_accessed: ISO-8601  // For recency decay
  pinned: boolean          // Exempt from decay
}
```

Store as MemoryGraph nodes. Use LanceDB for the embedding vector (of `concat(context_summary, lesson_extracted, keywords, tags)`).

### Pattern 2: Multi-Signal Retrieval (Stanford + MAGMA hybrid)

Implement the composite scoring function for episode retrieval:

```
score = w_recency * recency(episode) +
        w_importance * normalize(episode.importance) +
        w_relevance * cosine_sim(query_embedding, episode_embedding) +
        w_outcome * outcome_boost(episode)
```

**Recommended parameters** (derived from surveyed systems):
- Recency: `recency = 0.99^(hours_since_last_access)` (slightly slower decay than Stanford's 0.995 since Archon sessions are days apart, not game-hours)
- Importance: min-max normalized to [0,1]
- Relevance: cosine similarity from LanceDB search
- Outcome boost: +0.2 for episodes with matching outcome valence to current situation
- Initial weights: w_recency=1.0, w_importance=1.0, w_relevance=1.5, w_outcome=0.5

**Cosine similarity threshold for recall trigger**: 0.25-0.35 (derived from MAGMA's semantic edge threshold of 0.10-0.30, adjusted upward since Archon needs higher precision to avoid irrelevant episode injection). Only episodes scoring above this threshold on the relevance component should be considered candidates.

**Top-k**: Return top 3 episodes (per PRD AC-002). Use MMR reranking with lambda=0.7 (diversity vs. relevance tradeoff) to avoid returning 3 near-duplicate episodes.

### Pattern 3: Dual-Stream Write (MAGMA pattern adapted)

**Fast path (during conversation)**:
1. Detect episode-worthy event (correction, strong emotional signal, explicit mistake, near-miss)
2. Generate embedding of current situation context
3. Store episode node in MemoryGraph with basic fields
4. Store embedding in LanceDB
5. NO LLM calls for enrichment during conversation

**Slow path (session-end or consolidation trigger)**:
1. Retrieve episodes created this session
2. For each episode, LLM generates: context_summary, keywords, tags, importance score
3. Update MemoryGraph nodes with enriched fields
4. Update LanceDB embeddings with enriched content
5. Run neighbor analysis: for each new episode, find top-5 similar existing episodes
6. Create SIMILAR_TO edges in MemoryGraph (with similarity score)
7. Create CAUSED_BY edges where causal relationships are detectable
8. Run A-MEM evolution: update context_summary of neighbor episodes if new information changes their meaning

### Pattern 4: Ebbinghaus Decay with Importance Modulation

Implement the YourMemory formula, adapted for Archon's session-based lifecycle:

```
strength = importance/10 * e^(-lambda_eff * days_since_last_access) * (1 + recall_count * 0.2)
lambda_eff = 0.16 * (1 - (importance/10) * 0.8)
```

**Decay schedule**: Run during the existing `/loop` memory consolidation rotation (add as a new stage after the existing "decay" stage). Episodes with `strength < 0.05` get their retrieval priority reduced (NOT deleted -- per PRD AC-004). Pinned episodes are exempt.

**Reinforcement**: Each time an episode is retrieved and used in a response, increment `recall_count` and update `last_accessed`. This naturally preserves episodes that remain relevant.

### Pattern 5: Reflection-as-Episode (Stanford + Reflexion hybrid)

At session end (integrating with the existing proactive reflection agent from the PRD):

1. Retrieve all episodes from current session
2. Retrieve all corrections received this session
3. Generate reflection prompt: "Given these episodes and corrections, what are the 3 most important insights about my behavior this session?"
4. Each insight becomes a new episode with:
   - `trigger: "reflection"`
   - `importance`: Higher than source episodes (8-10 range)
   - `outcome`: derived from source episodes
   - Links to source episodes via REFLECTED_FROM edges in MemoryGraph
5. These reflection-episodes participate in future retrieval, creating the abstraction hierarchy that Stanford Generative Agents demonstrated

### Pattern 6: Graph-Based Causal Chains (MAGMA/Zep inspired)

Use MemoryGraph edges to encode relationships between episodes:

| Edge Type | Meaning | Example |
|-----------|---------|---------|
| TEMPORAL_NEXT | Sequential in same session | episode_1 -> episode_2 |
| CAUSED_BY | Causal relationship | correction_episode CAUSED_BY action_episode |
| SIMILAR_TO | Situational similarity (cosine > 0.3) | episode_A SIMILAR_TO episode_B |
| REFLECTED_FROM | Insight derived from episode | reflection REFLECTED_FROM source_episode |
| CONTRADICTS | Conflicting lessons | episode_X CONTRADICTS episode_Y |
| REINFORCES | Same lesson, different context | episode_P REINFORCES episode_Q |

This enables graph traversal queries like:
- "Find episodes similar to current situation" (SIMILAR_TO edges)
- "What caused this type of correction?" (CAUSED_BY traversal)
- "Has this lesson been reinforced or contradicted?" (REINFORCES/CONTRADICTS)
- "What reflections have been generated from similar episodes?" (SIMILAR_TO + REFLECTED_FROM)

### Pattern 7: Bi-Temporal Tracking (Zep pattern)

Each episode should track two timelines:
- **Event time**: When the episode actually occurred
- **Knowledge time**: When Archon processed/enriched it

This matters because slow-path enrichment happens after the session. A query like "what did I know at the time of this mistake?" uses knowledge_time, while "what happened around the time of this mistake?" uses event_time.

### Implementation Priority for FalkorDB + LanceDB

**Phase 1 (Episode Storage & Basic Retrieval)**:
- Episode schema as MemoryGraph nodes
- LanceDB embeddings for each episode
- Composite retrieval function (Pattern 2)
- Basic decay (Pattern 4)

**Phase 2 (Enrichment & Linking)**:
- Dual-stream write (Pattern 3)
- Graph edges for episode relationships (Pattern 6)
- A-MEM evolution for neighbor updates

**Phase 3 (Reflection & Consolidation)**:
- Reflection-as-episode (Pattern 5)
- Bi-temporal tracking (Pattern 7)
- Consolidation stage in /loop rotation

### Embedding Model Recommendation

Based on surveyed systems:
- **A-MEM**: all-minilm-l6-v2 (384-dim) -- lightweight, fast, good for resource-constrained
- **Zep/Graphiti**: BGE-m3 (1024-dim) -- highest accuracy, multilingual, heavier
- **Recommended for Archon**: all-minilm-l6-v2 for fast-path, with option to upgrade to BGE-m3 if accuracy demands it. The existing LanceDB setup should support either. Key: embed the concatenation of context_summary + lesson + keywords + tags, NOT just raw content.

---

## Sources

### Primary Papers
- [Generative Agents: Interactive Simulacra of Human Behavior](https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763) -- Park et al., Stanford, 2023. Memory stream with recency+importance+relevance scoring and reflection.
- [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560) -- Packer et al., UC Berkeley, 2023. Tiered memory with LLM-managed virtual context.
- [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366) -- Shinn et al., 2023. Episodic self-reflection buffer for retry improvement.
- [Voyager: An Open-Ended Embodied Agent with Large Language Models](https://arxiv.org/abs/2305.16291) -- Wang et al., 2023. Procedural skill library as memory.
- [A-MEM: Agentic Memory for LLM Agents](https://arxiv.org/abs/2502.12110) -- Xu et al., NeurIPS 2025. Zettelkasten-inspired self-organizing memory.
- [MAGMA: A Multi-Graph based Agentic Memory Architecture](https://arxiv.org/abs/2601.03236) -- UT Dallas / U. Florida, January 2026. Four-graph architecture with dual-stream write.
- [Zep: A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/abs/2501.13956) -- Rasmussen et al., January 2025. Bi-temporal knowledge graph with hybrid retrieval.
- [Cognitive Architectures for Language Agents (CoALA)](https://arxiv.org/abs/2309.02427) -- Sumers et al., 2023. Framework categorizing episodic/semantic/procedural memory.
- [Meta-Policy Reflexion: Reusable Reflective Memory](https://arxiv.org/html/2509.03990v1) -- 2025. Generalizing reflections across tasks.

### Benchmarks
- [LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory](https://arxiv.org/abs/2410.10813) -- ICLR 2025. 500 questions across 5 memory abilities.
- [LoCoMo: Evaluating Very Long-Term Conversational Memory](https://arxiv.org/abs/2402.17753) -- 300-turn conversations, 9K tokens average.

### Production Systems & Tools
- [Letta (MemGPT) Documentation](https://docs.letta.com/concepts/memgpt/) -- Current MemGPT implementation.
- [Graphiti: Build Real-Time Knowledge Graphs for AI Agents](https://github.com/getzep/graphiti) -- Open-source temporal graph engine.
- [Vestige: Cognitive Memory for AI Agents](https://github.com/samvallad33/vestige) -- FSRS-6 spaced repetition MCP server.
- [FalkorDB Context Graphs for AI Agents](https://www.falkordb.com/blog/context-graphs-ai-agents-long-term-memory/) -- Graph-based episodic memory patterns.
- [FalkorDB + mem0 Integration](https://www.falkordb.com/blog/graph-memory-llm-agents-mem0-falkordb/) -- Graph memory for LLM agents.
- [Cognee: AI Memory Architecture](https://www.cognee.ai/blog/fundamentals/how-cognee-builds-ai-memory) -- Hybrid vector+graph memory using LanceDB + Kuzu/FalkorDB.

### Surveys & Overviews
- [Memory in the Age of AI Agents: A Survey](https://arxiv.org/abs/2512.13564) -- December 2025. Comprehensive taxonomy.
- [A Survey on the Memory Mechanism of Large Language Model-based Agents](https://dl.acm.org/doi/10.1145/3748302) -- ACM TOIS, 2025.
- [Enhancing Memory Retrieval in Generative Agents through LLM-trained Cross Attention Networks](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1591618/full) -- Frontiers in Psychology, 2025.
- [Making Sense of Memory in AI Agents](https://www.leoniemonigatti.com/blog/memory-in-ai-agents.html) -- Leonie Monigatti, practical overview.
- [Ebbinghaus Forgetting Curve for AI Agent Memory](https://dev.to/sachit_mishra_686a94d1bb5/i-built-memory-decay-for-ai-agents-using-the-ebbinghaus-forgetting-curve-1b0e) -- Implementation walkthrough with decay formula.
