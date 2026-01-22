# God Agent PRD (Complete End-to-End Implementation)

**Source:** *God Agent: A Self-Correcting, Neuro-Symbolic Cognitive Architecture for Multi-Agent Orchestration* (13 Dec 2025)  
**Product:** God Agent v1.0  
**Document Type:** Product Requirements Document (PRD)  
**Owner:** TBD  
**Status:** Implementation-Ready Draft  
**Last Updated:** December 13, 2025

---

## 1. Executive Summary

God Agent is a neuro-symbolic cognitive architecture that enables multi-agent LLM systems to learn continuously, explain their reasoning through provenance tracking, and self-correct through adversarial validation—all without base model retraining.

### Core Capabilities
- **Persistent Learning**: 10-30% quality improvement on repeated tasks via trajectory-based LoRA weight adaptation
- **Provenance-First Design**: Every claim traceable through L-Score validated citation graphs
- **Adversarial Self-Correction**: Shadow Vector search (v × -1) for contradiction detection with 90% recall
- **Memory Coordination**: 88% multi-agent success rate (vs. 60% baseline) via Relay Race Protocol
- **Sub-millisecond Performance**: 150x faster vector search (0.3ms vs 45ms baseline)

---

## 2. Problem Statement

Multi-agent LLM systems suffer from three fundamental architectural limitations:

### 2.1 Knowledge Decay Across Agent Handoffs
When orchestrating complex tasks requiring sequential agent execution, information loss accumulates exponentially. By the fifth agent in a chain, over 40% of initial context is lost or corrupted through prompt-based handoffs alone.

### 2.2 Inability to Learn from Experience  
Standard RAG systems retrieve context but cannot modify retrieval strategies, update confidence scores, or optimize routing based on past success patterns. Every query executes identically regardless of prior experience.

### 2.3 Absence of Provenance Tracking
When systems synthesize information across sources, the derivation path evaporates immediately. There is no mechanism to answer: "How did you know this?"—creating undetectable hallucinations.

### 2.4 The Memory Coordination Problem
In LLM-based multi-agent orchestration, subagents are transient—only the orchestrator persists. This creates asymmetry where the orchestrator must serve as sole repository of system state across potentially dozens of specialized subagents.

---

## 3. Vision

Build an agentic platform that:

- **Remembers how it knows**: Every claim attached to a provenance chain, answering "How did you know?" via citation-graph traversal
- **Learns from how it learned**: Repeated tasks improve by closed-loop feedback without retraining the base model
- **Actively self-corrects**: Searches for contradictions as well as supporting evidence to reduce confirmation bias
- **Coordinates reliably**: Multi-agent workflows succeed through explicit memory key passing and sequential execution

---

## 4. Goals and Non-Goals

### 4.1 Goals (v1)

| ID | Goal | Success Metric |
|----|------|----------------|
| G1 | Implement five-layer architecture (Native → Reasoning → Memory → Learning → Orchestration) | All layers functional with integration tests passing |
| G2 | Deliver provenance-first outputs with L-Score enforcement | L-Score ≥ 0.3 threshold enforced; <10ms 5-hop traversal |
| G3 | Provide closed learning loop with trajectory-based weight updates | 10-30% quality improvement on repeated task types |
| G4 | Support Shadow Vector contradiction search | 90% recall on opposing viewpoints |
| G5 | Implement sequential multi-agent orchestration (Relay Race Protocol) | 88% success rate with explicit memory key handoffs |
| G6 | Achieve sub-millisecond vector search performance | <1ms median (k=10, 10k vectors) in native mode |
| G7 | Support 5-tier compression lifecycle | 90%+ memory reduction for cold/frozen vectors |

### 4.2 Non-Goals (v1)
- Training or fine-tuning the base LLM
- Building complete PhD pipeline content library (v1 focuses on execution framework)
- Distributed, multi-node deployment (single-host first)
- GPU acceleration (CPU-first with WASM fallback)
- Real-time applications requiring <10ms end-to-end latency (current ~150ms)

---

## 5. Architecture Overview

### 5.1 Five-Layer Neuro-Symbolic Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 5: ORCHESTRATION (Claude Flow)                                │
│ • 48-Agent Relay Race Protocol                                      │
│ • Neural Routing (Tiny Dancer)                                      │
│ • Circuit Breaker Fault Tolerance                                   │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 4: LEARNING (Sona Engine)                                     │
│ • Trajectory Tracking                                               │
│ • LoRA-Style Weight Updates (rank r=16)                             │
│ • EWC++ Catastrophic Forgetting Prevention                          │
│ • Persistent Weights (.agentdb/sona_weights.bin)                    │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 3: MEMORY (MemoryEngine)                                      │
│ • VectorDB (HNSW) + GraphDB (Hypergraph) + CausalMemory             │
│ • Synchronized Storage/Retrieval                                    │
│ • 5-Tier Compression Lifecycle                                      │
│ • LRU Cache (1000 entries, <50µs hit)                               │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 2: REASONING (ReasoningBank)                                  │
│ • PatternMatcher (Template-Based Retrieval)                         │
│ • CausalMemory (Hypergraph Causal Chains)                           │
│ • ProvenanceStore (L-Score + Citation Graphs)                       │
│ • GNN Enhancement (768→1024 dim)                                    │
│ • 39 Attention Mechanisms (Auto-Selection)                          │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 1: NATIVE CORE (RuVector/Rust)                                │
│ • VectorDB (HNSW, 768-dim, L2-normalized)                           │
│ • GraphDB (Hypergraph with Temporal Edges)                          │
│ • Tiny Dancer (FastGRNN Neural Router)                              │
│ • Compiled to WASM with Node.js Bindings                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Functional Requirements

### FR-1: Vector Invariants and Fail-Fast Validation (P0)

**Description:** Enforce strict vector contract at all ingestion boundaries.

**Specification:**
- All embeddings: 768-dimensional, L2-normalized, no NaN/Infinity
- Reject mismatched dimensions at API boundary (no silent projection)
- Provide projection utility for external embeddings (1536→768, 1024→768) with explicit operator responsibility

**Interface:**
```typescript
function assertDimensions(
  vector: Float32Array,
  expected: number,
  context: string
): void {
  if (vector.length !== expected) {
    throw new GraphDimensionMismatchError(
      `${context}: Expected ${expected}D, got ${vector.length}D`
    );
  }
  if (!isL2Normalized(vector)) {
    throw new Error(`${context}: Vector not L2-normalized`);
  }
  if (vector.some(x => !Number.isFinite(x))) {
    throw new Error(`${context}: Vector contains NaN or Infinity`);
  }
}

function normL2(vector: Float32Array): Float32Array {
  const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  return vector.map(x => x / norm);
}
```

**Acceptance Criteria:**
- [ ] `assertDimensions()` invoked for VectorDB inserts, Pattern storage, Hyperedge creation
- [ ] Dimension mismatch causes hard failure with descriptive error
- [ ] Unit tests verify validation at all insertion paths

---

### FR-2: VectorDB with HNSW Index (P0)

**Description:** Implement VectorDB with Hierarchical Navigable Small World (HNSW) index in Rust with WASM fallback.

**Specification:**
- Index structure: HNSW with M=32, efConstruction=200, efSearch=50
- Dimensions: 768 (fixed, validated at insertion)
- Metrics: Cosine similarity (default), Euclidean, Dot Product, Manhattan
- Performance: <1ms for k=10 retrieval (150x faster than Python baselines)

**Interface:**
```typescript
interface VectorDB {
  insert(vector: Float32Array): VectorID;
  search(query: Float32Array, k: number): SearchResult[];
  getVector(id: VectorID): Float32Array | null;
  delete(id: VectorID): boolean;
  backend: 'native' | 'wasm';
}

interface SearchResult {
  id: VectorID;
  similarity: number;
  vector?: Float32Array;
}
```

**Performance Targets:**

| Vectors | Search Time (k=10) | Index Size | Construction Time |
|---------|-------------------|------------|-------------------|
| 1k | 0.2ms | 3 MB | 0.8s |
| 10k | 0.3ms | 30 MB | 12s |
| 100k | 1.2ms | 300 MB | 3.2min |
| 1M (compressed) | 5.3ms | 297 MB | 42min |

**Acceptance Criteria:**
- [ ] k=10 search on 10k vectors achieves ~0.3ms median in native mode
- [ ] Regression tests for latency and scale in CI
- [ ] Graceful fallback to WASM if native binding unavailable

---

### FR-3: GraphDB with Hypergraph Support (P0)

**Description:** Implement hypergraph storage supporting binary edges (2 nodes) and hyperedges (3+ nodes) with temporal constraints.

**Specification:**
- Binary edge: 2 nodes (standard relationship)
- Hyperedge: 3+ nodes (collective relationship)
- Temporal hyperedges: `expiresAt` field for time-bound relationships
- Query language: Cypher-like syntax for graph traversal
- Persistence: JSON registry (.hyperedges.json) + native binary format

**Interface:**
```typescript
interface GraphDB {
  createNode(properties: Record<string, any>): NodeID;
  createEdge(source: NodeID, target: NodeID, metadata: Metadata): EdgeID;
  createHyperedge(nodes: NodeID[], metadata: HyperedgeMetadata): HyperedgeID;
  createTemporalHyperedge(input: ITemporalHyperedgeInput): HyperedgeID;
  query(cypher: string): QueryResult[];
  getNode(id: NodeID): INode | null;
  getEdges(nodeId: NodeID, direction: 'in' | 'out' | 'both'): IEdge[];
}

interface ITemporalHyperedgeInput {
  nodes: NodeID[];
  embedding?: Float32Array;
  granularity: 'Hourly' | 'Daily' | 'Monthly';
  expiresAt: Date;
  metadata?: Record<string, any>;
}

interface HyperedgeMetadata {
  embedding?: Float32Array; // 768-dim, validated
  relation?: string;
  confidence?: number;
  [key: string]: any;
}
```

**Acceptance Criteria:**
- [ ] Support creating hyperedges with 3+ nodes
- [ ] Temporal hyperedges excluded from results after expiration
- [ ] File locking prevents race conditions in wrapper.js fallback
- [ ] Embedding dimension validated (768-dim) at hyperedge creation

---

### FR-4: MemoryEngine (Hybrid Synchronized Storage) (P0)

**Description:** Unified API for store/retrieve/search with synchronized vector + graph + causal representations.

**Specification:**
- Automatic embedding: Converts text to 768-dim vectors via EmbeddingProvider
- Base64 encoding for CLI-safe storage of binary/complex data
- LRU cache: 1000 entries, <50µs cache hit
- No orphan nodes: Every stored item must link to existing node

**Interface:**
```typescript
interface MemoryEngine {
  store(key: string, value: string, options: IStoreOptions): Promise<void>;
  retrieve(key: string, options: IRetrieveOptions): Promise<string | null>;
  search(query: string, options: ISearchOptions): Promise<SearchResult[]>;
}

interface IStoreOptions {
  namespace: string;
  linkTo?: NodeID;      // Required for non-root nodes
  relation?: RelationType;
  embedding?: Float32Array;
  provenanceId?: ProvenanceID;
}

interface ISearchOptions {
  namespace: string;
  k: number;
  minLScore?: number;
  includeMetadata?: boolean;
}

type RelationType = 'extends' | 'contradicts' | 'supports' | 'cites' | 'derives_from';
```

**Storage Pipeline:**
```
Input: Key-value pair with namespace
  ↓
Step 1: Embed value (768-dim)
  ↓
Step 2: Store in VectorDB → vectorId
  ↓
Step 3: Create graph node with metadata
  ↓
Step 4: Link to parent node (prevent orphans)
  ↓
Step 5: Update LRU cache
```

**Acceptance Criteria:**
- [ ] Interface supports store, retrieve, search
- [ ] LRU cache achieves <50µs hit-path
- [ ] Storage pipeline embeds, inserts to VectorDB, creates GraphDB node
- [ ] Orphan prevention enforced at storage boundary

---

### FR-5: Namespace Protocol and Integrity Rules (P0)

**Description:** Enforce namespace naming standard and prevent orphan nodes.

**Specification:**
- Namespace regex: `^[a-z0-9]+(/[a-z0-9-]+)*$`
- Valid: `research/literature/papers`, `project/api-design`
- Invalid: `Research/Papers` (uppercase), `project//api` (double slash)
- Linkage required for non-root nodes

**Standard Namespaces:**
```
project/events       - Event-driven architecture patterns
project/api          - API design decisions
project/database     - Database schema and queries
project/frontend     - UI/UX patterns
project/bugs         - Bug reports and fixes
project/tests        - Test strategies and cases
research/[topic]     - Research literature by topic
patterns/[taskType]  - Reusable patterns by task type
```

**Acceptance Criteria:**
- [ ] Namespace regex enforced at store boundary
- [ ] Non-root nodes require `linkTo` parameter
- [ ] `validateGraphIntegrity()` detects orphan nodes

---

### FR-6: ReasoningBank API (P0)

**Description:** Unified reasoning interface supporting pattern-match, causal-inference, hybrid modes with optional GNN enhancement and learning toggles.

**Interface:**
```typescript
interface ReasoningBank {
  reason(request: IReasoningRequest): Promise<IReasoningResponse>;
  provideFeedback(feedback: ILearningFeedback): Promise<void>;
  close(): Promise<void>;
}

interface IReasoningRequest {
  query: Float32Array;              // 768-dim query embedding
  context?: Float32Array[];         // Optional context embeddings
  type: 'pattern-match' | 'causal-inference' | 'contextual' | 'hybrid';
  maxResults?: number;              // Default: 10
  confidenceThreshold?: number;     // Default: 0.7
  minLScore?: number;               // Default: 0.5
  enhanceWithGNN?: boolean;         // Apply GNN before reasoning
  applyLearning?: boolean;          // Use Sona weights
}

interface IReasoningResponse {
  query: Float32Array;
  type: ReasoningType;
  patterns: IPatternMatch[];
  causalInferences: IInferenceResult[];
  enhancedEmbedding?: Float32Array; // GNN-enhanced 1024-dim
  trajectoryId: string;             // For feedback loop
  attentionWeights?: Float32Array[];
  confidence: number;
  processingTimeMs: number;
  provenanceInfo: {
    lScores: number[];
    totalSources: number;
    combinedLScore: number;
  };
}

interface ILearningFeedback {
  trajectoryId: string;
  quality: number;                  // 0-1 scale
  route: string;                    // e.g., 'reasoning.causal', 'coding.debug'
  contextIds?: string[];
}
```

**Acceptance Criteria:**
- [ ] `reason()` returns patterns, causal inferences, trajectoryId, confidence, provenance info
- [ ] Supports options: `enhanceWithGNN`, `applyLearning`, routing by `type`
- [ ] `provideFeedback()` updates Sona weights and triggers learning

---

### FR-7: PatternMatcher (Template-Based Retrieval) (P0)

**Description:** Store and retrieve task-specific patterns with confidence scoring.

**Interface:**
```typescript
interface PatternMatcher {
  storePattern(pattern: IPattern): Promise<PatternID>;
  findSimilar(query: Float32Array, k: number): Promise<IPatternMatch[]>;
  matchPattern(query: Float32Array, threshold: number): Promise<IPatternMatch | null>;
  prunePatterns(threshold: number, minUsage: number): Promise<number>;
}

interface IPattern {
  id?: PatternID;
  embedding: Float32Array;          // 768-dim L2-normalized
  taskType: string;                 // 'reasoning.causal', 'coding.debug', etc.
  successRate: number;              // 0-1 quality score
  usageCount?: number;
  metadata: {
    triggers: string[];             // Conditions when pattern applies
    constraints: string[];          // Limitations of pattern
    examples: string[];             // Successful applications
  };
}

interface IPatternMatch {
  pattern: IPattern;
  similarity: number;
  confidence: number;
  lScore?: number;
}
```

**Retrieval Process:**
1. HNSW search for k=100 nearest neighbors (<5ms)
2. Optional GNN enhancement (768→1024 transformation)
3. Confidence scoring based on similarity + successRate
4. Filter by `confidenceThreshold` (default 0.7)
5. Apply Sona weights if `applyLearning` enabled
6. Return top-k after re-ranking

**Acceptance Criteria:**
- [ ] Pattern retrieval <10ms for 10k patterns
- [ ] Patterns with successRate < 0.4 and usageCount > 10 prunable
- [ ] Auto-pattern creation when trajectory quality > 0.8

---

### FR-8: CausalMemory (Hypergraph-Based Causal Reasoning) (P0)

**Description:** Model multi-node cause-effect relationships with bidirectional traversal.

**Interface:**
```typescript
interface CausalMemory {
  addCausalLink(input: ICausalLinkInput): Promise<void>;
  queryCausalChain(nodeId: string, direction: 'forward' | 'backward', hops: number): Promise<ICausalChain>;
  inferConsequences(conditions: string[], threshold: number): Promise<IInferenceResult[]>;
}

interface ICausalLinkInput {
  causes: string[];                 // Cause node IDs (1+ nodes)
  effects: string[];                // Effect node IDs (1+ nodes)
  confidence: number;               // Causal strength (0-1)
  metadata?: {
    mechanism?: string;             // How causality operates
    evidence?: string[];            // Supporting evidence
    context?: string;               // When causality applies
  };
}

interface ICausalChain {
  nodes: ICausalNode[];
  edges: ICausalEdge[];
  totalConfidence: number;
  depth: number;
}

interface IInferenceResult {
  effect: string;
  probability: number;
  confidence: number;
  supportingChains: ICausalChain[];
}
```

**Hyperedge Decision Rule:**
- 2 nodes: Standard edge (A → B)
- 3+ nodes: Hyperedge ({A, B, C} → {D})
- Example: "Rain + Cold + High Altitude → Snow" = 4-node hyperedge

**Acceptance Criteria:**
- [ ] Support 3+ node hyperedges for collective causation
- [ ] Bidirectional traversal (forward and backward)
- [ ] 5-hop traversal <15ms
- [ ] Cycle detection via DFS prevents infinite traversal

---

### FR-9: ProvenanceStore + L-Score Enforcement (P0)

**Description:** Track derivation paths from sources to insights; compute L-Score; reject knowledge below threshold.

**L-Score Formula:**
```
L-Score = GM(confidences) × AR(relevances) / DF(depth)

Where:
  GM = Geometric Mean: (∏cᵢ)^(1/n) - weakest link dominates
  AR = Arithmetic Mean: (Σrⱼ) / m - rewards multiple sources
  DF = Depth Factor: 1 + log₂(1 + depth) - penalizes long chains

Threshold: L-Score ≥ 0.3 required for acceptance
```

**Interface:**
```typescript
interface ProvenanceStore {
  storeSource(input: ISourceInput): Promise<SourceID>;
  createProvenance(input: IProvenanceInput): Promise<ProvenanceID>;
  calculateLScore(provenanceId: ProvenanceID): Promise<number>;
  traverseCitationGraph(provenanceId: ProvenanceID, options: ITraversalOptions): Promise<ICitationPath>;
}

interface ISourceInput {
  type: 'document' | 'conversation' | 'experiment' | 'simulation' | 'external-api';
  title: string;
  authors?: string[];
  url?: string;
  location?: {
    page?: number;
    section?: string;
    lineRange?: [number, number];
  };
  relevanceScore: number;           // 0-1
  embedding?: Float32Array;
}

interface IProvenanceInput {
  sources: ISourceInput[];
  derivationPath: IDerivationStep[];
  parentProvenanceId?: ProvenanceID;
}

interface IDerivationStep {
  description: string;
  sourceIds: SourceID[];
  operation: 'extraction' | 'synthesis' | 'inference' | 'transformation';
  confidence: number;               // 0-1
}

interface ICitationPath {
  insightId: ProvenanceID;
  sources: ISourceReference[];
  derivationPath: IDerivationStep[];
  lScore: number;
  depth: number;
  ancestors: ProvenanceID[];
}
```

**L-Score Calculation Example:**
```typescript
// Sources: [{ relevanceScore: 0.95 }, { relevanceScore: 0.85 }]
// Derivation: [{ confidence: 0.95 }, { confidence: 0.85 }, { confidence: 0.75 }]

geometric_mean = (0.95 × 0.85 × 0.75)^(1/3) = 0.846
average_relevance = (0.95 + 0.85) / 2 = 0.875
depth_penalty = 1 + log₂(1 + 3) = 2.0

L-Score = 0.846 × 0.875 / (1 + 2.0) = 0.247 // REJECTED: < 0.3
```

**Adaptive Thresholds by Domain:**

| Domain | Optimal Threshold | False Positive Rate | False Negative Rate |
|--------|------------------|---------------------|---------------------|
| Factual retrieval | 0.40 | 2.1% | 8.3% |
| Code generation | 0.30 | 5.4% | 4.7% |
| Research synthesis | 0.25 | 9.2% | 1.8% |
| Debugging | 0.35 | 3.8% | 6.1% |

**Acceptance Criteria:**
- [ ] L-Score calculated per formula
- [ ] Knowledge rejected when L-Score < threshold
- [ ] Citation graph traversal <10ms for 5-hop, <20ms for 10-hop
- [ ] `traverseCitationGraph()` answers "How did you know?"

---

### FR-10: Shadow Vector Contradiction Detection (P0)

**Description:** Adversarial search via semantic inversion to find contradictions and refutations.

**Formula:**
```
Shadow(v) = v × -1

Effect:
  cosine(v, x) = -cosine(Shadow(v), x)
  
If document D supports query Q:
  cosine(Q, D) ≈ 0.8 (high similarity)
  cosine(Shadow(Q), D) ≈ -0.8 (high dissimilarity → refutation)
```

**Interface:**
```typescript
interface ShadowVectorSearch {
  findContradictions(planVector: Float32Array, options: IShadowSearchOptions): Promise<IContradiction[]>;
  validateClaim(claim: string): Promise<IValidationReport>;
}

interface IShadowSearchOptions {
  type: 'contradiction' | 'counterargument' | 'falsification';
  threshold: number;                // Minimum refutation strength (default 0.7)
  k?: number;                       // Max results
  filters?: {
    sentiment?: 'negative';
    type?: 'Refutation';
  };
}

interface IContradiction {
  documentId: string;
  claim: string;
  refutationStrength: number;
  evidenceType: string;
  lScore: number;
}

interface IValidationReport {
  claim: string;
  support: IPatternMatch[];
  contradictions: IContradiction[];
  credibility: number;              // 0-1
  verdict: 'SUPPORTED' | 'REFUTED' | 'UNCERTAIN';
}
```

**Contradiction Classification:**

| Hypothesis Similarity | Shadow Similarity | Classification |
|----------------------|-------------------|----------------|
| > 0.7 | > 0.7 | AMBIGUOUS |
| < Shadow | > 0.7 | CONTESTED |
| 0.5-0.7 | 0.5-0.7 | DEBATED |
| < 0.3 | > 0.7 | FALSIFIED |

**Acceptance Criteria:**
- [ ] `findContradictions()` performs shadow inversion and HNSW search
- [ ] Filter by refutation strength threshold
- [ ] Contradiction classification implemented
- [ ] 90% recall on opposing viewpoints benchmark

---

### FR-11: Sona Engine (Trajectory-Based Learning) (P0)

**Description:** Closed-loop learning via trajectory tracking and LoRA-style weight updates without base model retraining.

**Specification:**
- LoRA rank: r=16 (12,288 parameters)
- Learning rate: α = 0.01 (default)
- Weight storage: `.agentdb/sona_weights.bin` (binary format)
- Auto-save: Every 100ms during active learning
- EWC++ regularization: λ = 0.1 (prevents catastrophic forgetting)

**Interface:**
```typescript
interface SonaEngine {
  createTrajectory(route: string, patterns: PatternID[], context: string[]): TrajectoryID;
  provideFeedback(trajectoryId: TrajectoryID, quality: number): Promise<void>;
  getWeight(patternId: PatternID, route: string): Promise<number>;
  getWeights(route: string): Promise<Float32Array>;
  saveWeights(path?: string): Promise<void>;
  loadWeights(path: string): Promise<void>;
  checkDrift(): Promise<IDriftMetrics>;
  rollbackToCheckpoint(): Promise<void>;
}

interface IDriftMetrics {
  currentWeights: Float32Array;
  baselineWeights: Float32Array;
  drift: number;                    // Cosine distance [0, 1]
  threshold: number;
  timestamp: number;
  checkpointId?: string;
}
```

**Weight Update Algorithm:**
```
For each pattern P in trajectory T with quality Q:
  reward = quality × L-Score × trajectory_success_rate
  gradient = (reward - 0.5) × P.similarity
  importance = FisherInformation[P.id]
  
  weight[P.id] += α × gradient / (1 + λ × importance)

Where:
  α = learning rate (0.01)
  λ = EWC regularization strength (0.1)
  importance = Fisher Information (protects critical weights)
```

**Drift Detection:**
```
drift_score = 1 - cosine_similarity(current_weights, baseline_centroid)

Thresholds:
  drift > 0.3 → ALERT (review required)
  drift > 0.5 → REJECT (rollback to checkpoint)
```

**Task Type Taxonomy:**

| Task Type | Learning Focus | Weight Update Strategy |
|-----------|----------------|----------------------|
| reasoning.causal | X→Y relationships | Strengthen causal paths with high reward |
| reasoning.analogy | Cross-domain transfer | Broaden pattern matching across namespaces |
| coding.generation | New code creation | Template weights for code structure |
| coding.refactor | Restructure existing | Transformation pattern weights |
| coding.debug | Error diagnosis | Diagnostic pattern weights |
| memory.synthesis | Information compression | Summarization template weights |
| planning.architect | System design | Architecture pattern weights |

**Acceptance Criteria:**
- [ ] `provideFeedback()` updates weights per formula
- [ ] Weights persist to `.agentdb/sona_weights.bin`
- [ ] 10-30% quality improvement on repeated task types
- [ ] Auto-pattern creation when quality > 0.8
- [ ] Drift detection triggers rollback when threshold exceeded
- [ ] EWC++ prevents catastrophic forgetting (≤2% degradation on old tasks)

---

### FR-12: Orchestration – Relay Race Protocol (P0)

**Description:** Sequential multi-agent orchestration with explicit memory key passing and wait gates.

**Protocol:**
```
THE LOOP:
1. DEFINE SCOPE → Identify next step in sequence
2. RETRIEVE → Get exact memory key from previous agent
3. SPAWN → Launch next agent with "Previous Key" in prompt
4. WAIT → DO NOT spawn next until current confirms storage
5. CAPTURE → Read agent's output for new "Output Key"
6. REPEAT
```

**Fatal Error Prevention:**
- NEVER spawn Agent B until Agent A stored its output → Prevents context loss (45% of baseline failures)
- NEVER assume Agent B knows Agent A's work → Explicitly pass: "Retrieve: research/agent_a_output"
- ALWAYS validate handoff → Agent A must report output key before Agent B spawns

**99.9% Sequential Rule:**
- Default: Sequential execution (agents spawn one at a time)
- Exception: Parallelism permitted for read-only operations only

**Parallel-Safe Operations:**
- Literature search across multiple databases
- Citation extraction from independent documents
- Multi-perspective analysis (different viewpoints)

**Parallel-Unsafe Operations:**
- Hypothesis generation (requires completed literature review)
- Methodology design (requires validated hypotheses)
- Results synthesis (requires all analysis complete)

**Agent Task Template:**
```typescript
interface IAgentTask {
  agentName: string;
  position: string;                 // e.g., "Agent #12/48"
  phase: string;                    // e.g., "Architecture"
  previousKey: string | null;       // Memory key to retrieve
  outputKey: string;                // Memory key to store
  task: string;                     // Specific objective
  qualityGate: string;              // Fail-fast condition
  parallel?: boolean;               // Safe to parallelize
  dependencies?: string[];          // Agent IDs this depends on
}
```

**Acceptance Criteria:**
- [ ] Orchestrator loop: define → retrieve → spawn → wait → capture → repeat
- [ ] 99.9% sequential rule enforced with read-only exceptions
- [ ] Explicit memory key passing in agent prompts
- [ ] 88% success rate (vs. 60% baseline) with structured memory

---

### FR-13: Tiny Dancer Neural Router (P1)

**Description:** FastGRNN-based neural routing for intelligent agent selection.

**Specification:**
- Model: FastGRNN (Fast Gated Recurrent Neural Network)
- Architecture: 768→256→N projection (N = number of agents)
- Input: Query embedding (768-dim)
- Output: { selectedAgent, confidence, uncertainty }
- Inference: <1ms on CPU

**Interface:**
```typescript
interface TinyDancer {
  route(query: Float32Array, candidates: IAgent[]): Promise<IRoutingDecision>;
  recordSuccess(agentId: AgentID): void;
  recordFailure(agentId: AgentID): void;
  getCircuitBreakerStatus(agentId: AgentID): CircuitBreakerState;
}

interface IRoutingDecision {
  selectedAgent: AgentID;
  confidence: number;               // 0-1
  uncertainty: number;              // 0-1 (epistemic uncertainty)
  alternativeAgents: { agent: AgentID; score: number }[];
}

type CircuitBreakerState = 'closed' | 'open' | 'half-open';
```

**Routing Decision Rules:**

| Condition | Action | Rationale |
|-----------|--------|-----------|
| confidence ≥ 0.85 AND uncertainty ≤ 0.15 | Route to top-scoring specialist | High confidence routing |
| confidence < 0.85 | Fallback to Generalist | Uncertainty too high |
| uncertainty > 0.15 | Fallback to Generalist | Model unsure |
| 5+ failures in 60s | Suspend agent (circuit breaker) | Prevent cascading failures |

**Circuit Breaker Protocol:**
```
CLOSED (normal)
    │
    ├─ 5+ failures in 60s ──→ OPEN (suspended, 5-min cooldown)
    │
OPEN ──cooldown expires──→ HALF-OPEN (trial)
                              │
                              ├─ success ──→ CLOSED
                              └─ failure ──→ OPEN (10-min cooldown)
```

**Acceptance Criteria:**
- [ ] Routing decision <1ms
- [ ] Circuit breaker suspends agent after 5+ failures in 60s
- [ ] Half-open state allows trial after cooldown
- [ ] Graceful fallback to generalist when uncertain

---

### FR-14: 5-Tier Compression Lifecycle (P1)

**Description:** Adaptive compression to reduce memory footprint for infrequently accessed embeddings.

**Compression Tiers:**

| Tier | Heat Score | Format | Compression | Bytes/Vector | Error | Access Pattern |
|------|-----------|--------|-------------|--------------|-------|----------------|
| Hot | >0.8 | Float32 | 1x | 3,072 | <0.01% | Immediate |
| Warm | >0.4 | Float16 | 2x | 1,536 | <0.01% | Frequent (24h) |
| Cool | >0.1 | PQ8 | 8x | 384 | <2% | Occasional (week) |
| Cold | >0.01 | PQ4 | 16x | 192 | <5% | Rare (month) |
| Frozen | <0.01 | Binary | 32x | 96 | <10% | Archive |

**Rules:**
- ONE-WAY transitions: hot → warm → cool → cold → frozen (no reversal)
- Trigger: Access frequency over sliding 24-hour window
- Decompression: Only top-k results (k=10) decompressed for search

**Interface:**
```typescript
interface CompressionManager {
  compress(embedding: Float32Array, tier: CompressionTier): CompressedEmbedding;
  decompress(compressed: CompressedEmbedding): Float32Array;
  updateAccessFrequency(vectorId: VectorID): void;
  transitionTier(vectorId: VectorID): CompressionTier;
  getMemoryUsage(): IMemoryUsageStats;
}

interface IMemoryUsageStats {
  totalVectors: number;
  byTier: Record<CompressionTier, number>;
  totalBytes: number;
  compressionRatio: number;
}
```

**Acceptance Criteria:**
- [ ] 90%+ memory reduction for 1M vectors (3 GB → 297 MB)
- [ ] Search latency <10ms with compressed vectors
- [ ] Tier transitions based on access frequency
- [ ] PQ8/PQ4/Binary codebooks trained and stored

---

### FR-15: Dynamic Attention Selection (P1)

**Description:** Auto-select optimal attention mechanism from 39+ options based on data topology.

**Core Attention Mechanisms:**

| Mechanism | Use Case | Complexity | Selection Condition |
|-----------|----------|------------|---------------------|
| MultiHead | General sequences <1k tokens | O(n²) | Default |
| Hyperbolic | Hierarchical (depth >3) | O(n²) | hierarchyDepth > 3 |
| Flash | Long contexts >10k tokens | O(n) memory | sequenceLength > 10000 |
| Linear | Real-time <1ms budget | O(n) | latencyBudget < 1 |
| GraphRoPe | Knowledge/causal graphs | O(n²) | hasGraphStructure |
| DualSpace | Hybrid Euclidean-hyperbolic | O(n²) | hierarchyDepth > 2 AND hasGraphStructure |
| LocalGlobal | Mixed granularity | O(n × window) | sequenceLength > 5000 AND hierarchyDepth > 2 |

**Interface:**
```typescript
interface AttentionFactory {
  autoSelect(profile: IDataProfile): AttentionType;
  create(type: AttentionType, config: IAttentionConfig): IAttentionLayer;
}

interface IDataProfile {
  hierarchyDepth: number;           // 0-10+ (0=flat, 10+=deep)
  sequenceLength: number;           // Number of tokens/nodes
  sparsity: number;                 // 0-1 (fraction of zeros)
  latencyBudget: number;            // Milliseconds allowed
  hasGraphStructure?: boolean;
  hasEdgeFeatures?: boolean;
}
```

**Acceptance Criteria:**
- [ ] Auto-selection based on data profile
- [ ] Graceful degradation if preferred mechanism unavailable
- [ ] GNN enhancement (768→1024) uses appropriate attention

---

### FR-16: 48-Agent PhD Pipeline (P2)

**Description:** Complete 7-phase research pipeline demonstrating sequential orchestration.

**Phase Structure:**

| Phase | Agents | Purpose |
|-------|--------|---------|
| 1. Foundation | 1-4 | Meta-cognitive principles, decomposition, planning |
| 2. Discovery | 5-9 | Literature search, tiered memory, quality classification |
| 3. Architecture | 10-15 | Theoretical analysis, gap detection, contradiction search |
| 4. Synthesis | 16-20 | Evidence synthesis, pattern analysis, theory building |
| 5. Design | 21-25 | Model architecture, methodology, sampling, instruments |
| 6. Writing | 26-32 | Introduction, lit review, methods, results, discussion |
| 7. QA | 33-37 | Red team, confidence quantification, reproducibility |

**Sample Agent Definitions:**

```typescript
const agents: IAgentDefinition[] = [
  {
    id: 'step-back-analyzer',
    position: 1,
    phase: 'Foundation',
    previousKey: null,
    outputKey: 'research/meta/principles',
    task: 'Extract high-level guiding principles before details',
    qualityGate: 'Must produce 5+ actionable principles'
  },
  {
    id: 'contradiction-analyzer',
    position: 14,
    phase: 'Architecture',
    previousKey: 'research/gaps/analysis',
    outputKey: 'research/gaps/contradictions',
    task: 'Detect contradictions via NEGATIVE VECTOR SEARCH',
    qualityGate: 'Must use shadow vectors; identify 5+ contradictions'
  },
  {
    id: 'adversarial-reviewer',
    position: 33,
    phase: 'QA',
    previousKey: 'research/writing/conclusion',
    outputKey: 'research/qa/redteam',
    task: 'Red team critique with 85%+ confidence threshold',
    qualityGate: 'Must identify 10+ weaknesses'
  }
];
```

**Acceptance Criteria:**
- [ ] All 37 core agents defined with keys and quality gates
- [ ] Phase transitions enforce dependencies
- [ ] Memory keys follow namespace convention
- [ ] 88% pipeline completion rate

---

## 7. Non-Functional Requirements

### NFR-1: Performance (P0)

| Operation | Target | Notes |
|-----------|--------|-------|
| VectorDB search (k=10, 10k vectors) | <1ms, ~0.3ms native | 150x faster than Python |
| Pattern matching (10k patterns) | <10ms | With Sona weights |
| Causal chain traversal (5-hop) | <15ms | Bidirectional |
| Provenance traversal (5-hop) | <10ms | Citation graph |
| Provenance traversal (10-hop) | <20ms | Deep chains |
| Agent routing (Tiny Dancer) | <1ms | FastGRNN inference |
| L-Score calculation | <10ms | Per provenance |
| GNN enhancement (50 nodes) | <100ms | 768→1024 |

### NFR-2: Reliability (P0)

- **Orchestration success rate**: ≥88% with structured memory (vs. 60% baseline)
- **Sequential execution**: 99.9% of operations sequential; parallelism only for read-only
- **Circuit breaker**: Suspend agent after 5+ failures in 60s
- **Drift detection**: Alert at cosine distance >0.3, rollback at >0.5

### NFR-3: Data Integrity (P0)

- **Vector invariants**: 768-dim, L2-normalized, no NaN/Infinity at all boundaries
- **No orphan nodes**: Every graph node linked to parent
- **Provenance required**: No derivation without sources
- **L-Score threshold**: Knowledge rejected when L-Score < 0.3
- **File locking**: Mutex on wrapper.js writes prevents race conditions
- **Backup/repair**: Graph JSON registry fallback for "metadata amnesia"

### NFR-4: Scalability (P1)

| Component | Optimal Range | Limit | Mitigation |
|-----------|--------------|-------|------------|
| VectorDB | 10k-100k vectors | 1M with compression | 5-tier lifecycle |
| GraphDB | 1k-10k nodes | 100k with ego graph | 2-hop subgraph extraction |
| Sona weights | 255 pattern clusters | Rank r=16 | EWC++ regularization |
| Agents | 1-48 sequential | Timeout 5min | Fallback to generalist |

### NFR-5: Portability (P1)

- **Platforms**: Linux x64/ARM64, macOS x64/ARM64, Windows x64
- **Bindings**: Native Rust with automatic WASM fallback
- **Persistence**: JSON + binary formats for cross-platform compatibility

### NFR-6: Observability (P1)

- **Metrics**: Latency histograms, success rates, memory usage
- **Logging**: Structured logs for all agent transitions and learning events
- **Tracing**: Trajectory IDs link queries to outcomes
- **Debugging**: Citation graph traversal for "How did you know?"

---

## 8. API Reference

### 8.1 Complete TypeScript Interfaces

```typescript
// ==================== LAYER 1: NATIVE CORE ====================

interface VectorDB {
  insert(vector: Float32Array): VectorID;
  search(query: Float32Array, k: number): SearchResult[];
  getVector(id: VectorID): Float32Array | null;
  delete(id: VectorID): boolean;
  count(): number;
  backend: 'native' | 'wasm';
}

interface GraphDB {
  createNode(properties: Record<string, any>): NodeID;
  createEdge(source: NodeID, target: NodeID, metadata: Metadata): EdgeID;
  createHyperedge(nodes: NodeID[], metadata: HyperedgeMetadata): HyperedgeID;
  createTemporalHyperedge(input: ITemporalHyperedgeInput): HyperedgeID;
  query(cypher: string): QueryResult[];
  getNode(id: NodeID): INode | null;
  getEdges(nodeId: NodeID, direction: 'in' | 'out' | 'both'): IEdge[];
  validateIntegrity(): IIntegrityReport;
}

interface TinyDancer {
  route(query: Float32Array, candidates: IAgent[]): Promise<IRoutingDecision>;
  recordSuccess(agentId: AgentID): void;
  recordFailure(agentId: AgentID): void;
  getCircuitBreakerStatus(agentId: AgentID): CircuitBreakerState;
}

// ==================== LAYER 2: REASONING ====================

interface ReasoningBank {
  reason(request: IReasoningRequest): Promise<IReasoningResponse>;
  provideFeedback(feedback: ILearningFeedback): Promise<void>;
  findContradictions(planVector: Float32Array, options: IShadowSearchOptions): Promise<IContradiction[]>;
  validateClaim(claim: string): Promise<IValidationReport>;
  close(): Promise<void>;
}

interface PatternMatcher {
  storePattern(pattern: IPattern): Promise<PatternID>;
  findSimilar(query: Float32Array, k: number): Promise<IPatternMatch[]>;
  matchPattern(query: Float32Array, threshold: number): Promise<IPatternMatch | null>;
  prunePatterns(threshold: number, minUsage: number): Promise<number>;
}

interface CausalMemory {
  addCausalLink(input: ICausalLinkInput): Promise<void>;
  queryCausalChain(nodeId: string, direction: 'forward' | 'backward', hops: number): Promise<ICausalChain>;
  inferConsequences(conditions: string[], threshold: number): Promise<IInferenceResult[]>;
}

interface ProvenanceStore {
  storeSource(input: ISourceInput): Promise<SourceID>;
  createProvenance(input: IProvenanceInput): Promise<ProvenanceID>;
  calculateLScore(provenanceId: ProvenanceID): Promise<number>;
  traverseCitationGraph(provenanceId: ProvenanceID, options: ITraversalOptions): Promise<ICitationPath>;
}

// ==================== LAYER 3: MEMORY ====================

interface MemoryEngine {
  store(key: string, value: string, options: IStoreOptions): Promise<void>;
  retrieve(key: string, options: IRetrieveOptions): Promise<string | null>;
  search(query: string, options: ISearchOptions): Promise<SearchResult[]>;
  getCompressionStats(): IMemoryUsageStats;
}

interface CompressionManager {
  compress(embedding: Float32Array, tier: CompressionTier): CompressedEmbedding;
  decompress(compressed: CompressedEmbedding): Float32Array;
  updateAccessFrequency(vectorId: VectorID): void;
  transitionTier(vectorId: VectorID): CompressionTier;
}

// ==================== LAYER 4: LEARNING ====================

interface SonaEngine {
  createTrajectory(route: string, patterns: PatternID[], context: string[]): TrajectoryID;
  provideFeedback(trajectoryId: TrajectoryID, quality: number): Promise<void>;
  getWeight(patternId: PatternID, route: string): Promise<number>;
  getWeights(route: string): Promise<Float32Array>;
  saveWeights(path?: string): Promise<void>;
  loadWeights(path: string): Promise<void>;
  checkDrift(): Promise<IDriftMetrics>;
  rollbackToCheckpoint(): Promise<void>;
  createCheckpoint(): Promise<string>;
}

// ==================== LAYER 5: ORCHESTRATION ====================

interface ClaudeFlowOrchestrator {
  runPipeline(agents: IAgentDefinition[]): Promise<IPipelineResult>;
  spawnAgent(agent: IAgentDefinition, previousOutput: string | null): Promise<IAgentResult>;
  waitForCompletion(agentId: AgentID, timeout: number): Promise<void>;
  getMemoryKey(key: string): Promise<string | null>;
  setMemoryKey(key: string, value: string): Promise<void>;
}

interface IAgentDefinition {
  id: AgentID;
  position: number;
  phase: string;
  previousKey: string | null;
  outputKey: string;
  task: string;
  qualityGate: string;
  parallel?: boolean;
  dependencies?: AgentID[];
  timeout?: number;
}

interface IPipelineResult {
  success: boolean;
  completedAgents: AgentID[];
  failedAgents: { agentId: AgentID; error: string }[];
  totalTime: number;
  memoryKeys: Record<string, string>;
}
```

---

## 9. Key Workflows

### 9.1 Reason → Execute → Feedback → Improve

```typescript
// Step 1: Agent calls ReasoningBank
const response = await bank.reason({
  query: taskEmbedding,
  type: 'hybrid',
  applyLearning: true,
  enhanceWithGNN: true,
  minLScore: 0.5
});

// Step 2: Agent executes task using patterns
const result = await executeTask(response.patterns, response.causalInferences);

// Step 3: Evaluate outcome
const quality = evaluateResult(result); // 0-1 scale

// Step 4: Provide feedback
await bank.provideFeedback({
  trajectoryId: response.trajectoryId,
  quality: quality,
  route: 'coding.debug',
  contextIds: ['error_log_001']
});

// Step 5: Sona updates weights (internal)
// Next query automatically benefits from learning
```

### 9.2 Shadow Vector Contradiction Search

```typescript
// Step 1: Generate hypothesis embedding
const hypothesis = await embed("Low-carb diets reduce cardiovascular risk");

// Step 2: Find contradictions
const contradictions = await bank.findContradictions(hypothesis, {
  type: 'counterargument',
  threshold: 0.7,
  filters: { type: 'PeerReviewedPaper' }
});

// Step 3: Classify evidence
for (const c of contradictions) {
  console.log(`${c.claim} (strength: ${c.refutationStrength})`);
}

// Step 4: Validate claim with both hemispheres
const report = await bank.validateClaim("Low-carb diets reduce cardiovascular risk");
console.log(`Verdict: ${report.verdict} (credibility: ${report.credibility})`);
```

### 9.3 Relay Race Orchestration

```typescript
// Orchestrator loop
async function runPipeline(agents: IAgentDefinition[]) {
  for (const agent of agents) {
    // 1. RETRIEVE: Get previous agent's output
    const previousOutput = agent.previousKey 
      ? await orchestrator.getMemoryKey(agent.previousKey)
      : null;
    
    // 2. SPAWN: Launch agent with context
    const result = await orchestrator.spawnAgent(agent, previousOutput);
    
    // 3. WAIT: Block until storage confirmed
    await orchestrator.waitForCompletion(agent.id, agent.timeout || 300000);
    
    // 4. VALIDATE: Check quality gate
    if (!result.meetsQualityGate) {
      throw new Error(`Agent ${agent.id} failed quality gate: ${agent.qualityGate}`);
    }
    
    // 5. CAPTURE: Store output key
    await orchestrator.setMemoryKey(agent.outputKey, result.output);
    
    // 6. FEEDBACK: Update learning
    await bank.provideFeedback({
      trajectoryId: result.trajectoryId,
      quality: result.quality,
      route: agent.phase.toLowerCase()
    });
  }
}
```

### 9.4 Provenance-Validated Storage

```typescript
// Step 1: Store sources
const src1 = await provenance.storeSource({
  type: 'document',
  title: 'Paper A',
  relevanceScore: 0.95
});

const src2 = await provenance.storeSource({
  type: 'document', 
  title: 'Paper B',
  relevanceScore: 0.85
});

// Step 2: Create provenance chain
const provenanceId = await provenance.createProvenance({
  sources: [src1, src2],
  derivationPath: [
    { description: "Extract fact from A", sourceIds: [src1], operation: 'extraction', confidence: 0.95 },
    { description: "Synthesize with B", sourceIds: [src1, src2], operation: 'synthesis', confidence: 0.85 }
  ]
});

// Step 3: Validate L-Score before storage
const lScore = await provenance.calculateLScore(provenanceId);
if (lScore < 0.3) {
  throw new Error(`Rejected: L-Score ${lScore} < 0.3`);
}

// Step 4: Store with provenance
await memory.store('research/conclusion', conclusion, {
  namespace: 'research',
  provenanceId: provenanceId,
  linkTo: parentNodeId,
  relation: 'derives_from'
});
```

---

## 10. Success Metrics

### 10.1 System Performance Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| VectorDB median latency | ≤1ms (k=10, 10k vectors) | Benchmark harness |
| Provenance traversal (5-hop) | <10ms | CI regression tests |
| Provenance traversal (10-hop) | <20ms | CI regression tests |
| Agent routing | <1ms | P95 latency monitoring |
| Memory compression ratio | >90% at 1M vectors | Storage audit |

### 10.2 Quality & Reliability Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Orchestration success rate | ≥88% | Pipeline completion tracking |
| Learning uplift | 10-30% improvement | A/B test on repeated tasks |
| Hallucination prevention | L-Score ≥ 0.3 enforced | Storage boundary validation |
| Contradiction recall | 90% on adversarial test set | Shadow vector benchmark |
| Catastrophic forgetting | ≤2% degradation | Cross-task evaluation |

### 10.3 Learning Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Pattern recognition accuracy | 91.8% after 1000 tasks | Task success tracking |
| Agent routing precision | 94.2% | Routing correctness audit |
| Weight drift | <0.3 cosine distance | Drift monitoring |
| New pattern creation | >80% quality → auto-store | Trajectory analysis |

---

## 11. Implementation Milestones

### Milestone A: Foundation (Weeks 1-4) - P0

**Deliverables:**
- [ ] VectorDB with HNSW implementation and benchmark harness
- [ ] Vector validation (assertDimensions) at all boundaries
- [ ] GraphDB with hyperedge support
- [ ] MemoryEngine store/retrieve/search with namespace enforcement
- [ ] LRU cache (1000 entries, <50µs hit)

**Exit Criteria:**
- VectorDB benchmark: <1ms median (k=10, 10k vectors)
- All vector insertions validated
- No orphan nodes in graph
- Unit test coverage >80%

### Milestone B: Provenance + Learning (Weeks 5-8) - P0

**Deliverables:**
- [ ] ProvenanceStore with L-Score calculation
- [ ] L-Score rejection rule enforced at storage boundary
- [ ] Sona Engine with trajectory tracking
- [ ] LoRA weight persistence (.agentdb/sona_weights.bin)
- [ ] EWC++ regularization implementation

**Exit Criteria:**
- L-Score calculation matches formula
- Knowledge rejected when L-Score < 0.3
- 10% improvement on repeated tasks demonstrated
- Drift detection functional

### Milestone C: Orchestration + Adversarial (Weeks 9-12) - P0

**Deliverables:**
- [ ] Relay Race Protocol orchestrator
- [ ] Explicit memory key passing
- [ ] Wait gates preventing premature agent spawn
- [ ] Shadow Vector contradiction search
- [ ] Tiny Dancer neural router

**Exit Criteria:**
- 88% pipeline success rate on test workflows
- Shadow vectors achieve 90% contradiction recall
- Circuit breaker suspends failing agents
- Routing decision <1ms

### Milestone D: Compression + Polish (Weeks 13-16) - P1

**Deliverables:**
- [ ] 5-tier compression lifecycle
- [ ] Attention factory with auto-selection
- [ ] Graph fallback hardening (locking, backups)
- [ ] 48-agent PhD pipeline configuration
- [ ] Observability (metrics, logging, tracing)

**Exit Criteria:**
- 90% memory reduction at 1M vectors
- Graceful degradation under load
- Full pipeline completes in <45 minutes
- Documentation complete

---

## 12. Risks and Mitigations

### Risk Matrix

| Risk | Severity | Probability | RPN | Mitigation |
|------|----------|-------------|-----|------------|
| wrapper.js race condition (concurrent writes) | 6 | 3 | 90 | Mutex on writes; 99.9% sequential rule |
| Embedding dimension mismatch | 10 | 1 | 10 | assertDimensions at all boundaries |
| L-Score false positives (single-source hallucinations) | 7 | 2 | 28 | Adaptive thresholds by domain |
| Native binding unavailable | 7 | 2 | 42 | WASM fallback; platform compatibility check |
| Sona weight drift | 6 | 2 | 24 | Drift detection; automatic rollback |
| Sequential bottleneck (slow agent blocks pipeline) | 5 | 4 | 40 | Timeout + fallback to generalist |
| Memory overflow (>500 nodes in wrapper.js) | 9 | 1 | 18 | 2-hop ego graph extraction |

### Detailed Mitigations

**Race Condition in wrapper.js:**
```typescript
class HypergraphStore {
  private writeMutex: Lock = new Lock();

  async createHyperedge(input: IHyperedgeInput): Promise<HyperedgeID> {
    const release = await this.writeMutex.acquire();
    try {
      const registry = await this.loadRegistry();
      const id = generateHyperedgeID();
      registry[id] = input;
      await this.saveRegistry(registry);
      return id;
    } finally {
      release();
    }
  }
}
```

**Slow Agent Timeout:**
```typescript
async function executeAgent(agent: IAgent, timeout: number = 300000) {
  const result = await Promise.race([
    agent.execute(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Agent timeout')), timeout)
    )
  ]);
  
  if (result instanceof Error) {
    console.warn(`Agent ${agent.id} timed out. Falling back to generalist.`);
    return await generalistAgent.execute();
  }
  return result;
}
```

---

## 13. Open Questions

1. **Embedding Provider**: Which embedding model for 768D? Options: Claude native, Xenova/ONNX, custom trained
2. **Initial Agent Set**: Which specialist agents beyond generalist for v1? Minimum viable set?
3. **Deployment Strategy**: Single machine, containerized, or edge deployment?
4. **UI Requirements**: CLI-only vs. API + dashboard for first release?
5. **L-Score Threshold**: Fixed 0.3 or adaptive per domain?
6. **Parallel Identification**: Manual annotation vs. automatic dependency graph analysis?
7. **Cross-Model Transfer**: Strategy for integrating non-768D embedding models?

---

## 14. Appendix

### A. Key Formulas

**L-Score:**
```
L = GM(c₁...cₙ) × AR(r₁...rₘ) / (1 + log₂(1 + depth))

Where:
  GM = (∏cᵢ)^(1/n)  - Geometric mean of confidences
  AR = (Σrⱼ)/m      - Arithmetic mean of relevances
  
Threshold: L ≥ 0.3
```

**Shadow Vector:**
```
Shadow(v) = v × -1

Contradiction detected when:
  cosine(Shadow(v), document) > threshold
```

**Sona Weight Update:**
```
weight[i] += α × (reward - 0.5) × similarity / (1 + λ × importance[i])

Where:
  α = 0.01 (learning rate)
  λ = 0.1 (EWC regularization)
  reward = quality × L-Score × historical_success
```

**Trajectory Cumulative Reward:**
```
Qᵢ = Σⱼ₌ᵢⁿ γʲ⁻ⁱ rⱼ

Where:
  γ = 0.95 (discount factor)
  rⱼ = reward at step j
```

### B. Standard Namespaces

```
project/events           - Event-driven architecture patterns
project/api              - API design decisions
project/database         - Database schema and queries
project/frontend         - UI/UX patterns
project/bugs             - Bug reports and fixes
project/tests            - Test strategies and cases
research/meta/           - Meta-cognitive outputs (principles, questions, plans)
research/literature/     - Literature review outputs
research/theory/         - Theoretical framework outputs
research/gaps/           - Gap analysis and contradictions
research/synthesis/      - Evidence synthesis outputs
research/design/         - Research design outputs
research/writing/        - Manuscript sections
research/qa/             - Quality assurance outputs
patterns/[taskType]      - Reusable patterns by task type
```

### C. Agent Phase Map

| Phase | # | Agents | Key Output |
|-------|---|--------|------------|
| Foundation | 1-4 | step-back-analyzer, ambiguity-clarifier, self-ask-decomposer, research-planner | research/meta/rewoo-plan |
| Discovery | 5-9 | context-tier-manager, literature-mapper, systematic-reviewer, citation-extractor, source-tier-classifier | research/literature/quality |
| Architecture | 10-15 | theoretical-framework-analyst, methodology-scanner, construct-definer, gap-hunter, contradiction-analyzer, risk-analyst | research/gaps/fmea |
| Synthesis | 16-20 | evidence-synthesizer, pattern-analyst, thematic-synthesizer, theory-builder, hypothesis-generator | research/synthesis/hypotheses |
| Design | 21-25 | model-architect, opportunity-identifier, method-designer, sampling-strategist, instrument-developer | research/design/instruments |
| Writing | 26-32 | validity-guardian, introduction-writer, literature-review-writer, methodology-writer, results-writer, discussion-writer, conclusion-writer | research/writing/conclusion |
| QA | 33-37 | adversarial-reviewer, confidence-quantifier, citation-validator, reproducibility-checker, file-length-manager | research/qa/final |

### D. Performance Benchmarks Summary

| Operation | Baseline | God Agent Native | Speedup |
|-----------|----------|-----------------|---------|
| Vector search (k=10, 10k) | 45ms (FAISS Python) | 0.3ms | 150x |
| Memory coordination success | 60% | 88% | +28pp |
| Learning improvement | 0% (stateless) | 10-30% | N/A |
| Contradiction recall | N/A (no adversarial) | 90% | N/A |

---

## 15. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-12-13 | TBD | Initial draft from white paper |
| 1.0 | 2025-12-13 | TBD | Complete end-to-end PRD |

---

*This PRD is derived from the God Agent White Paper (December 13, 2025) and represents the complete implementation specification for building the God Agent system end-to-end.*
