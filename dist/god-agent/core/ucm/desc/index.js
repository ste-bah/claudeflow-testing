/**
 * SPRINT 3 - DESC (Dual Embedding Symmetric Chunking)
 *
 * Exports all DESC components for UCM (Unbounded Context Memory).
 *
 * Components:
 * - SymmetricChunker: RULE-064 compliant chunking
 * - DualEmbeddingStore: Episode storage with dual embeddings
 * - EpisodeRetriever: RULE-069 all-to-all retrieval with RULE-066 threshold
 * - EmbeddingProxy: HTTP client for gte-Qwen2-1.5B-instruct
 * - InjectionFilter: Safety mechanisms for injection
 *
 * IDESC-001: Intelligent DESC v2 Components:
 * - OutcomeTracker: Outcome recording and success rate calculation
 * - ConfidenceCalculator: Multi-factor confidence level calculation
 * - OutcomeService: Daemon service for outcome IPC
 * - Errors: Error hierarchy for outcome tracking
 */
export { SymmetricChunker } from './symmetric-chunker.js';
export { DualEmbeddingStore } from './dual-embedding-store.js';
export { EpisodeRetriever } from './episode-retriever.js';
export { EmbeddingProxy } from './embedding-proxy.js';
export { InjectionFilter, EnhancedInjectionFilter, createEnhancedInjectionFilter, toLegacyDecision, isEnhancedDecision } from './injection-filter.js';
// IDESC-001: Intelligent DESC v2 exports
export { OutcomeTracker, createOutcomeTracker } from './outcome-tracker.js';
export { ConfidenceCalculator, createConfidenceCalculator, formatConfidence, getConfidenceDescription } from './confidence-calculator.js';
export { NegativeExampleProvider, createNegativeExampleProvider, DEFAULT_NEGATIVE_EXAMPLE_CONFIG } from './negative-example-provider.js';
export { createOutcomeServiceHandler, registerOutcomeService } from './outcome-service.js';
// IDESC-001 Sprint 5: ReasoningBank Integration
export { TrajectoryLinker, createTrajectoryLinker } from './trajectory-linker.js';
export { TraceSummarizer, createTraceSummarizer, DEFAULT_TRACE_CONFIG } from './trace-summarizer.js';
// IDESC-001 Sprint 6: Active Learning - Metrics Aggregation
export { MetricsAggregator, createMetricsAggregator } from './metrics-aggregator.js';
// IDESC-001 Sprint 6: Active Learning - Threshold Adjustment
export { ThresholdAdjuster, createThresholdAdjuster, initThresholdAdjustmentsTable } from './threshold-adjuster.js';
// IDESC-001 Sprint 6: Active Learning - Quality Monitor
export { QualityMonitor, createQualityMonitor } from './quality-monitor.js';
// IDESC-001: Error classes
export { OutcomeError, OutcomeRecordingError, EpisodeNotFoundError, InvalidOutcomeError, InsufficientOutcomeDataError, ConfidenceError, ConfidenceCalculationError, WarningError, WarningGenerationError, ReasoningLinkError, TrajectoryLinkError, TrajectoryNotFoundError, ThresholdError, ThresholdBoundsError, InvalidThresholdError, ActiveLearningError, InsufficientLearningDataError, LearningRateError, isOutcomeError, isConfidenceError, isWarningError, isReasoningLinkError, isThresholdError, isActiveLearningError } from './errors.js';
// IDESC-001: Additional type exports
export { ErrorType } from '../types.js';
//# sourceMappingURL=index.js.map