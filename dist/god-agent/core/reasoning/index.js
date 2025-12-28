/**
 * God Agent Reasoning Module
 *
 * Implements:
 * - TASK-PAT-001 (Pattern Matching System)
 * - TASK-CAUSAL-001 (CausalMemory System)
 * - TASK-RSN-001 (ReasoningBank Unified API)
 *
 * Provides:
 * - Template-based retrieval of successful reasoning patterns
 * - Hypergraph-based causal reasoning with multi-cause support
 * - Unified reasoning interface with 4 modes (pattern-match, causal-inference, contextual, hybrid)
 * - GNN-enhanced embeddings (768D → 1024D)
 * - Trajectory tracking for Sona feedback
 *
 * Performance targets:
 * - Pattern retrieval: <5ms for k=100
 * - Confidence scoring: <1ms per pattern
 * - Cycle detection: <5ms per check
 * - 5-hop traversal: <15ms
 * - Link addition: <2ms
 * - Pattern-match mode: <10ms
 * - Causal-inference mode: <20ms
 * - Contextual mode: <30ms
 * - GNN enhancement: <100ms for 50 nodes
 */
// ===== PATTERN MATCHING SYSTEM =====
// Main PatternMatcher class
export { PatternMatcher } from './pattern-matcher.js';
// Pattern storage
export { PatternStore } from './pattern-store.js';
// Confidence scoring utilities
export { calculateConfidence, calibrateConfidence, rankPatterns, filterPatterns, batchCalculateConfidence, createPatternResult } from './confidence-scorer.js';
// Pattern enum (value export)
export { TaskType } from './pattern-types.js';
// ===== CAUSAL MEMORY SYSTEM =====
// Main CausalMemory class
export { CausalMemory } from './causal-memory.js';
// Core components
export { CausalHypergraph } from './causal-hypergraph.js';
export { CausalTraversal } from './causal-traversal.js';
export { CycleDetector } from './cycle-detector.js';
// ===== REASONING BANK UNIFIED API (TASK-RSN-001) =====
// Main ReasoningBank class
export { ReasoningBank } from './reasoning-bank.js';
// GNN Enhancement
export { GNNEnhancer } from './gnn-enhancer.js';
// Trajectory Tracking
export { TrajectoryTracker } from './trajectory-tracker.js';
// Mode Selection
export { ModeSelector } from './mode-selector.js';
// ReasoningBank type definitions
export { ReasoningMode } from './reasoning-types.js';
// ===== PROVENANCE STORE (TASK-PRV-001) =====
// Main ProvenanceStore class
export { ProvenanceStore } from './provenance-store.js';
// Provenance utilities
export { generateSourceID, generateProvenanceID, isValidSourceID, isValidProvenanceID, validateSourceInput, validateProvenanceInput, validateDerivationStep, geometricMean, arithmeticMean, depthFactor, calculateLScore, getThresholdForDomain, validateLScore, validateEmbedding, DEFAULT_LSCORE_THRESHOLD, DOMAIN_THRESHOLDS } from './provenance-utils.js';
// Provenance type definitions
export { LScoreRejectionError, ProvenanceValidationError } from './provenance-types.js';
// ===== SHADOW VECTOR SEARCH (TASK-SHA-001) =====
// Main ShadowVectorSearch class
export { ShadowVectorSearch, MockVectorStore } from './shadow-vector-search.js';
// Shadow vector utilities
export { createShadowVector, cosineSimilarity, isL2Normalized, normalizeL2, classifyDocument, determineEvidenceType, calculateCredibility, determineVerdict, calculateVerdictConfidence, calculateRefutationStrength, sortByRefutationStrength, filterByThreshold, } from './shadow-utils.js';
// Shadow vector type definitions
export { ShadowVectorError, DEFAULT_CLASSIFICATION_THRESHOLDS, DEFAULT_SHADOW_CONFIG, } from './shadow-types.js';
//# sourceMappingURL=index.js.map