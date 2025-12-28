/**
 * DAI-003: Intelligent Task Routing Type Definitions
 *
 * TASK-001: Routing Type Definitions
 * Constitution: RULE-DAI-003-001 through RULE-DAI-003-007
 *
 * Provides types for:
 * - Task analysis and domain detection
 * - Agent capability matching
 * - Routing decisions with explanations
 * - Pipeline generation for multi-step tasks
 * - Cold start configuration
 * - Failure classification
 * - Learning feedback
 *
 * @module src/god-agent/core/routing/routing-types
 */
// ==================== Default Configurations ====================
/**
 * Default cold start configuration
 */
export const DEFAULT_COLD_START_CONFIG = {
    keywordOnlyThreshold: 25,
    learnedThreshold: 100,
    maxColdStartConfidence: 0.6,
    keywordOnlyWeight: 1.0,
    blendedKeywordWeight: 0.7,
    learnedKeywordWeight: 0.2,
};
/**
 * Default routing configuration
 */
export const DEFAULT_ROUTING_CONFIG = {
    coldStart: DEFAULT_COLD_START_CONFIG,
    autoExecuteThreshold: 0.9,
    showDecisionThreshold: 0.7,
    confirmationThreshold: 0.5,
    maxAlternatives: 3,
    maxPipelineStages: 10,
    estimatedTimePerStageMs: 30000,
    routingLatencyTargetMs: 300,
    analysisLatencyTargetMs: 150,
    pipelineLatencyTargetMs: 600,
    ewcLambda: 0.1,
    maxWeightChange: 0.05,
    accuracyWindowSize: 100,
    accuracyDegradationThreshold: 0.02,
    verbose: false,
};
//# sourceMappingURL=routing-types.js.map