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
export { type TaskDomain, type TaskComplexity, type ColdStartPhase, type FailureType, type ITaskAnalysis, type IAgentCapability, type ICapabilityMatch, type IRoutingFactor, type IRoutingResult, type IRoutingAlternative, type IRoutingFeedback, type IFailureClassification, type IGeneratedStage, type IGeneratedPipeline, type IColdStartConfig, type IRoutingConfig, type ICapabilityIndex, type IRoutingEngine, type IPipelineGenerator, type IRoutingLearner, type IFailureClassifier, type ITaskAnalyzer, type IConfirmationRequest, type IConfirmationOption, type IConfirmationResponse, type IConfirmationHandler, DEFAULT_COLD_START_CONFIG, DEFAULT_ROUTING_CONFIG, } from './routing-types.js';
export { cosineSimilarity, normalizeL2, softmax, relu, sigmoid, tanh, matVecMul, addBias, reluVector, calculateConfidence, calculateUncertainty, calculateScore, rankByScore, topK, isWithinWindow, timeUntilExpiry, xavierInit, zeroInit, initFromEmbeddings, } from './routing-utils.js';
export { RoutingError, TaskAnalysisError, CapabilityIndexError, IndexSyncError, PipelineGenerationError, ConfirmationTimeoutError, } from './routing-errors.js';
export { getColdStartPhase, getColdStartWeights, formatColdStartIndicator, defaultColdStartConfig, } from './cold-start-config.js';
export { TaskAnalyzer, type ITaskAnalyzerConfig } from './task-analyzer.js';
export { CapabilityIndex, type ICapabilityIndexConfig } from './capability-index.js';
export { FailureClassifier } from './failure-classifier.js';
export { RoutingEngine, type IRoutingEngineConfig } from './routing-engine.js';
export { PipelineGenerator, type IPipelineGeneratorConfig } from './pipeline-generator.js';
export { RoutingLearner, type IRoutingLearnerConfig } from './routing-learner.js';
export { ConfirmationHandler, type IConfirmationHandlerConfig } from './confirmation-handler.js';
//# sourceMappingURL=index.d.ts.map