/**
 * DAI-003: Intelligent Task Routing Module
 *
 * Provides:
 * - Task analysis and domain detection
 * - Agent capability indexing and matching
 * - Explainable routing decisions
 * - Multi-step pipeline generation
 * - Cold start handling
 * - EWC++ learning from feedback
 * - Failure classification
 * - Low-confidence confirmation flow
 *
 * Constitution: RULE-DAI-003-001 through RULE-DAI-003-007
 *
 * @module src/god-agent/core/routing
 */
// ===== TYPE DEFINITIONS (TASK-001) =====
export { 
// Default configurations
DEFAULT_COLD_START_CONFIG, DEFAULT_ROUTING_CONFIG, } from './routing-types.js';
// ===== UTILITIES (to be kept from routing-utils.js) =====
export { cosineSimilarity, normalizeL2, softmax, relu, sigmoid, tanh, matVecMul, addBias, reluVector, calculateConfidence, calculateUncertainty, calculateScore, rankByScore, topK, isWithinWindow, timeUntilExpiry, xavierInit, zeroInit, initFromEmbeddings, } from './routing-utils.js';
// ===== COMPONENTS =====
// TASK-002: Routing Errors ✓
export { RoutingError, TaskAnalysisError, CapabilityIndexError, IndexSyncError, PipelineGenerationError, ConfirmationTimeoutError, } from './routing-errors.js';
// TASK-003: Cold Start Configuration ✓
export { getColdStartPhase, getColdStartWeights, formatColdStartIndicator, defaultColdStartConfig, } from './cold-start-config.js';
// TASK-004: Task Analyzer ✓
export { TaskAnalyzer } from './task-analyzer.js';
// TASK-005: Capability Index ✓
export { CapabilityIndex } from './capability-index.js';
// TASK-006: Failure Classifier ✓
export { FailureClassifier } from './failure-classifier.js';
// TASK-007: Routing Engine ✓
export { RoutingEngine } from './routing-engine.js';
// TASK-008: Pipeline Generator ✓
export { PipelineGenerator } from './pipeline-generator.js';
// TASK-009: Routing Learner ✓
export { RoutingLearner } from './routing-learner.js';
// TASK-010: Confirmation Handler ✓
export { ConfirmationHandler } from './confirmation-handler.js';
//# sourceMappingURL=index.js.map