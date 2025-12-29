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
 * - GNN-enhanced embeddings (1536D → 1024D)
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
export { PatternMatcher } from './pattern-matcher.js';
export { PatternStore } from './pattern-store.js';
export { calculateConfidence, calibrateConfidence, rankPatterns, filterPatterns, batchCalculateConfidence, createPatternResult } from './confidence-scorer.js';
export { TaskType } from './pattern-types.js';
export type { Pattern, PatternQuery, PatternResult, PatternStats, CreatePatternParams, UpdateSuccessParams, PruneParams, PruneResult } from './pattern-types.js';
export { CausalMemory } from './causal-memory.js';
export type { CausalMemoryConfig } from './causal-memory.js';
export { CausalHypergraph } from './causal-hypergraph.js';
export { CausalTraversal } from './causal-traversal.js';
export { CycleDetector } from './cycle-detector.js';
export type { NodeID, NodeType, TraversalDirection, CausalNode, CausalLink, CausalChain, TraversalOptions, InferenceResult, CauseFindingResult, AddCausalLinkParams, CausalGraphStats, SerializedCausalGraph, CycleCheckResult, } from './causal-types.js';
export { ReasoningBank } from './reasoning-bank.js';
export { GNNEnhancer } from './gnn-enhancer.js';
export type { TrajectoryGraph, TrajectoryNode, TrajectoryEdge, LayerActivationCache, ForwardResult, } from './gnn-enhancer.js';
export { WeightManager } from './weight-manager.js';
export type { IWeightConfig, IWeightMetadata, ICheckpointConfig, IWeightValidationResult, } from './weight-manager.js';
export { softmax, attentionScore, weightedAggregate, computeNeighborAttention, } from './gnn-math.js';
export { project_backward, softmax_backward, attention_backward, aggregate_backward, relu_backward, leaky_relu_backward, tanh_backward, sigmoid_backward, activation_backward, layer_backward, clipGradient, isGradientValid, accumulateGradient, accumulateWeightGradients, createWeightGradientAccumulator, } from './gnn-backprop.js';
export type { GradientResult, AttentionGradients, GradientConfig, } from './gnn-backprop.js';
export { AdamOptimizer, createAdamOptimizer, flattenWeights, unflattenWeights, applyAdamTo2DWeights, } from './adam-optimizer.js';
export type { AdamConfig, AdamState, StepResult, } from './adam-optimizer.js';
export { TrajectoryTracker } from './trajectory-tracker.js';
export type { TrajectoryTrackerConfig, TrajectoryStats } from './trajectory-tracker.js';
export { ModeSelector } from './mode-selector.js';
export type { ModeSelectorConfig } from './mode-selector.js';
export { ReasoningMode } from './reasoning-types.js';
export type { IReasoningRequest, IReasoningResponse, IPatternMatch, IInferenceResult, IProvenanceInfo, ILearningFeedback, TrajectoryRecord, TrajectoryID, GNNConfig, ReasoningBankConfig, ModeScores, ModeSelectionResult, ReasoningMetrics, ValidationResult, IContextualMatch, IGNNEnhancementResult } from './reasoning-types.js';
export { ProvenanceStore } from './provenance-store.js';
export type { ProvenanceStoreConfig } from './provenance-store.js';
export { generateSourceID, generateProvenanceID, isValidSourceID, isValidProvenanceID, validateSourceInput, validateProvenanceInput, validateDerivationStep, geometricMean, arithmeticMean, depthFactor, calculateLScore, getThresholdForDomain, validateLScore, validateEmbedding, DEFAULT_LSCORE_THRESHOLD, DOMAIN_THRESHOLDS } from './provenance-utils.js';
export { LScoreRejectionError, ProvenanceValidationError } from './provenance-types.js';
export type { SourceID, ProvenanceID, OperationType, SourceType, ISourceLocation, ISourceInput, ISource, IDerivationStep, IProvenanceInput, IProvenance, ISourceReference, ICitationPath, ITraversalOptions, ILScoreThreshold, ILScoreResult, ISerializedSource, ISerializedProvenance } from './provenance-types.js';
export { ShadowVectorSearch, MockVectorStore } from './shadow-vector-search.js';
export type { IVectorStore, IVectorSearchResult } from './shadow-vector-search.js';
export { createShadowVector, cosineSimilarity, isL2Normalized, normalizeL2, classifyDocument, determineEvidenceType, calculateCredibility, determineVerdict, calculateVerdictConfidence, calculateRefutationStrength, sortByRefutationStrength, filterByThreshold, } from './shadow-utils.js';
export { ShadowVectorError, DEFAULT_CLASSIFICATION_THRESHOLDS, DEFAULT_SHADOW_CONFIG, } from './shadow-types.js';
export type { DocumentID, ShadowSearchType, ValidationVerdict, EvidenceType, IShadowSearchOptions, IShadowFilters, IContradiction, ISupportingEvidence, IValidationReport, IShadowVectorConfig, IShadowSearchResult, IClassificationThresholds, } from './shadow-types.js';
export { ContrastiveLoss, mineHardNegatives, mineHardPositives, createSemiHardTriplets, POSITIVE_QUALITY_THRESHOLD, NEGATIVE_QUALITY_THRESHOLD, DEFAULT_MARGIN, } from './contrastive-loss.js';
export type { ContrastiveLossConfig, TrajectoryPair, TripletGradient, GradientBatch, ITrajectoryWithFeedback, } from './contrastive-loss.js';
export { TrainingHistoryManager } from './training-history.js';
export type { TrainingRecord, ITrainingStats } from './training-history.js';
export { GNNTrainer, createGNNTrainer } from './gnn-trainer.js';
export type { TrainingConfig, TrainingResult, EpochResult, ValidationResult as GNNValidationResult, TrainingDataset, TrainerCheckpoint, } from './gnn-trainer.js';
export { TrainingTriggerController, createTrainingTriggerController } from './training-trigger.js';
export type { TriggerConfig, TriggerStats, TriggerResult, } from './training-trigger.js';
export { EWCRegularizer, createEWCRegularizer } from './ewc-utils.js';
export { computeImportanceScores, getTopImportantParams, computeFisherOverlap, } from './ewc-utils.js';
export type { EWCConfig, EWCPenaltyResult, EWCGradientResult, FisherUpdateResult, } from './ewc-utils.js';
export { BackgroundTrainer, createBackgroundTrainer } from './background-trainer.js';
export type { BackgroundTrainerConfig, TrainingProgress, TrainingPhase, BackgroundTrainingResult, BackgroundTrainerEvents, WorkerMessage, } from './background-trainer.js';
export { TrainingWorker } from './training-worker.js';
//# sourceMappingURL=index.d.ts.map