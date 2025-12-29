/**
 * God Agent Core Module
 *
 * The unified export for all God Agent subsystems organized by layer:
 *
 * - Layer 1: Native Core (VectorDB, GraphDB)
 * - Layer 2: Reasoning (ReasoningBank, PatternMatcher, CausalMemory, ProvenanceStore, ShadowVectors)
 * - Layer 3: Memory (MemoryEngine, CompressionManager, LRU Cache)
 * - Layer 4: Learning (SonaEngine)
 * - Layer 5: Orchestration (RelayRace, AttentionFactory, PhD Pipeline)
 * - Layer 6: Intelligent Routing (DAI-003 - integrated via UniversalAgent)
 * - Observability (Metrics, Logger, Tracer)
 * - Benchmarks & Validation (Benchmarks, Scale Tests, Portability)
 *
 * @module god-agent/core
 */
export { GodAgent, godAgent, type GodAgentConfig, type GodAgentInitResult, type GodAgentStatus, type QueryOptions, type QueryResult, type StoreOptions, type StoreResult, } from './god-agent.js';
export { assertDimensions, assertDimensionsOnly, isL2Normalized, validateFiniteValues, normL2, createValidatedVector, calculateNorm, cosineSimilarity, euclideanDistance, } from './validation/index.js';
export { VECTOR_DIM, L2_NORM_TOLERANCE, HNSW_PARAMS, LORA_PARAMS, L_SCORE_THRESHOLD, } from './validation/index.js';
export { GraphDimensionMismatchError, ZeroVectorError, InvalidVectorValueError, NotNormalizedError, InvalidNamespaceError, } from './validation/index.js';
export { VectorDB, type VectorID, type VectorDBOptions, type SearchResult, type BackendType, DistanceMetric, } from './vector-db/index.js';
export * from './graph-db/index.js';
export { PatternMatcher, PatternStore, calibrateConfidence, rankPatterns, filterPatterns, batchCalculateConfidence, createPatternResult, TaskType, Pattern, PatternQuery, PatternResult, PatternStats, CreatePatternParams, UpdateSuccessParams, PruneParams, PruneResult, CausalMemory, CausalHypergraph, CausalTraversal, CycleDetector, ReasoningBank, GNNEnhancer, TrajectoryTracker, ModeSelector, ReasoningMode, ProvenanceStore, generateSourceID, generateProvenanceID, isValidSourceID, isValidProvenanceID, validateSourceInput, validateProvenanceInput, validateDerivationStep, geometricMean, depthFactor, calculateLScore, getThresholdForDomain, validateLScore, validateEmbedding, DEFAULT_LSCORE_THRESHOLD, DOMAIN_THRESHOLDS, LScoreRejectionError, ProvenanceValidationError, ShadowVectorSearch, MockVectorStore, createShadowVector, classifyDocument, determineEvidenceType, calculateCredibility, determineVerdict, calculateVerdictConfidence, calculateRefutationStrength, sortByRefutationStrength, filterByThreshold, ShadowVectorError, DEFAULT_CLASSIFICATION_THRESHOLDS, DEFAULT_SHADOW_CONFIG, } from './reasoning/index.js';
export type { CausalMemoryConfig, NodeType, TraversalDirection, CausalNode, CausalLink, CausalChain, TraversalOptions, InferenceResult, CauseFindingResult, AddCausalLinkParams, CausalGraphStats, SerializedCausalGraph, CycleCheckResult, TrajectoryGraph, TrajectoryNode, TrajectoryEdge, TrajectoryTrackerConfig, TrajectoryStats, ModeSelectorConfig, IReasoningRequest, IReasoningResponse, IPatternMatch, IInferenceResult, IProvenanceInfo, ILearningFeedback, TrajectoryRecord, GNNConfig, ReasoningBankConfig, ModeScores, ModeSelectionResult, ReasoningMetrics, ValidationResult, IContextualMatch, IGNNEnhancementResult, ProvenanceStoreConfig, SourceID, ProvenanceID, OperationType, SourceType, ISourceLocation, ISourceInput, ISource, IDerivationStep, IProvenanceInput, IProvenance, ISourceReference, ICitationPath, ITraversalOptions, ILScoreThreshold, ILScoreResult, ISerializedSource, ISerializedProvenance, IVectorStore, IVectorSearchResult, DocumentID, ShadowSearchType, ValidationVerdict, EvidenceType, IShadowSearchOptions, IShadowFilters, IContradiction, ISupportingEvidence, IValidationReport, IShadowVectorConfig, IShadowSearchResult, IClassificationThresholds, } from './reasoning/index.js';
export * from './memory/index.js';
export { SonaEngine, TrajectoryValidationError, WeightUpdateError, DriftExceededError, FeedbackValidationError, WeightPersistenceError, RollbackLoopError, CheckpointError, generateTrajectoryID, isValidTrajectoryID, generateCheckpointID, isValidCheckpointID, validateRoute, validateTrajectoryInput, validateQuality, validateLearningRate, validateRegularization, validateAndApplyConfig, validateFeedbackQuality, clampWeight, isValidWeight, calculateDrift, standardDeviation, calculateReward, calculateGradient, calculateWeightUpdate, updateFisherInformation, calculateSuccessRate, crc32, DEFAULT_LEARNING_RATE, DEFAULT_REGULARIZATION, DEFAULT_DRIFT_ALERT_THRESHOLD, DEFAULT_DRIFT_REJECT_THRESHOLD, DEFAULT_AUTO_SAVE_INTERVAL, DEFAULT_MAX_CHECKPOINTS, DEFAULT_INITIAL_WEIGHT, WEIGHT_MIN, WEIGHT_MAX, DEFAULT_FISHER_INFORMATION, FISHER_DECAY_RATE, AUTO_SAVE_THROTTLE_MS, AUTO_PATTERN_QUALITY_THRESHOLD, WEIGHT_FILE_VERSION, } from './learning/index.js';
export type { TrajectoryID, PatternID, Route, Weight, RouteWeights, WeightStorage, ITrajectory, ITrajectoryInput, IWeightUpdateParams, ILearningMetrics, DriftStatus, IDriftMetrics, ICheckpoint, ISonaConfig, ISerializedTrajectory, ISerializedRouteWeights, ISerializedSonaState, FisherInformationStorage, IFeedbackInput, IWeightUpdateResult, IWeightFileMetadata, ISerializedFisherEntry, CheckpointReason, ICheckpointFull, ISerializedCheckpoint, } from './learning/index.js';
export { RelayRaceOrchestrator, MockAgentExecutor, PipelineValidationError, AgentExecutionError, MemoryKeyError, QualityGateError, generatePipelineID, isValidPipelineID, validatePipelineDefinition, validateAgentDefinition, validateMemoryKeyChain, buildAgentPrompt, formatAgentPosition, parseAgentPosition, validateQualityGate, serializeMap, deserializeMap, DEFAULT_NAMESPACE, MAX_PIPELINE_AGENTS, } from './orchestration/index.js';
export type { IAgentDefinition, IPipelineDefinition, IPipelineExecution, IAgentResult, PipelineStatus, IAgentExecutor, PipelineEventType, IPipelineEvent, PipelineEventListener, IOrchestratorOptions, ISerializedPipelineExecution, } from './orchestration/index.js';
export { softmax, relu, sigmoid, tanh, matVecMul, addBias, reluVector, calculateUncertainty, calculateScore, rankByScore, topK, isWithinWindow, timeUntilExpiry, xavierInit, zeroInit, initFromEmbeddings, DEFAULT_COLD_START_CONFIG, DEFAULT_ROUTING_CONFIG, } from './routing/index.js';
export type { TaskDomain, TaskComplexity, ColdStartPhase, FailureType, ITaskAnalysis, IAgentCapability, ICapabilityMatch, IRoutingFactor, IRoutingResult, IRoutingAlternative, IRoutingFeedback, IFailureClassification, IGeneratedStage, IGeneratedPipeline, IColdStartConfig, IRoutingConfig, ICapabilityIndex, IRoutingEngine, IPipelineGenerator, IRoutingLearner, IFailureClassifier, ITaskAnalyzer, IConfirmationRequest, IConfirmationOption, IConfirmationResponse, IConfirmationHandler, } from './routing/index.js';
export { CompressionManager, float32ToFloat16, float16ToFloat32, encodeFloat16, decodeFloat16, trainPQCodebook, encodePQ8, decodePQ8, encodePQ4, decodePQ4, trainBinaryThresholds, encodeBinary, decodeBinary, calculateReconstructionError, cosineSimilarityCompression, uint8ToUint16, uint16ToUint8, CompressionTier, TIER_HIERARCHY, TIER_CONFIGS, DEFAULT_COMPRESSION_CONFIG, CompressionError, TierTransitionError, getTierForHeatScore, isValidTransition, getNextTier, calculateBytesForTier, } from './compression/index.js';
export type { ITierConfig, ICompressedEmbedding, IAccessRecord, IMemoryUsageStats, ICompressionConfig, IPQCodebook, IBinaryThresholds, } from './compression/index.js';
export * from './attention/index.js';
export * from './pipeline/index.js';
export type { IAgentExecutionOptions, IAgentExecutionResult, IAgentChainStep, IAgentChainResult, IAgentFilter, IAgentInfo, IAgentExecutionServiceConfig, } from './types/index.js';
export { DEFAULT_AGENT_TIMEOUT, } from './types/index.js';
export { AgentExecutionService, createAgentExecutionService, } from './services/index.js';
export { UnifiedSearch, VectorSourceAdapter, GraphSourceAdapter, MemorySourceAdapter, PatternSourceAdapter, FusionScorer, } from './search/index.js';
export type { QuadFusionOptions, QuadFusionResult, FusedSearchResult, SourceWeights, SearchSource, } from './search/index.js';
export * from './observability/index.js';
export * from './benchmarks/index.js';
export { VectorScaleTest, DEFAULT_VECTOR_SCALE_CONFIG, generateNormalizedVectors, vectorScaleTest, PipelineScaleTest, DEFAULT_PIPELINE_SCALE_CONFIG, generatePipelineAgents, pipelineScaleTest, MemoryPressureTest, DEFAULT_MEMORY_PRESSURE_CONFIG, memoryPressureTest, DegradationTest, CapacityManager, CapacityExceededError, DEFAULT_DEGRADATION_CONFIG, degradationTest, MultiInstanceTest, SimulatedInstance, DEFAULT_MULTI_INSTANCE_CONFIG, multiInstanceTest, ScaleTestRunner, scaleTestRunner, MemoryMonitor, DEFAULT_MEMORY_THRESHOLDS, memoryMonitor, ConcurrencyTracker, AsyncSemaphore, RateLimiter, concurrencyTracker, } from './scale-tests/index.js';
export type { MemorySnapshot, MemoryThreshold, MemoryThresholdConfig, MemoryTrend, ContentionEvent, ConcurrencyStats, OperationHandle, VectorScaleConfig, TierDistribution, ScalePointResult, NFR41ValidationResult, VectorScaleReport, PipelineScaleConfig, AgentResult, PipelineScaleReport, ContentionReport, PipelineAgent, MemoryPressureConfig, OperationResult, MemoryPressureReport, PressureTestSuiteReport, DegradationConfig, RejectionResult, RecoveryResult, CapacityResult, DegradationReport, MultiInstanceConfig, Instance, SyncResult, LoadResult, PartitionResult, MultiInstanceReport, ScaleTestRunnerConfig, NFR4Check, NFR4Summary, NFR4Report, } from './scale-tests/index.js';
export * from './portability/index.js';
export { MemoryServer, getMemoryServer, startMemoryServer, stopMemoryServer, MemoryClient, getMemoryClient, createMemoryClient, MemoryHealthMonitor, getHealthMonitor, isMemoryServerHealthy, discoverMemoryServer, MemoryError, InvalidRequestError, UnknownMethodError, ValidationError, StorageError, ServerShuttingDownError, TimeoutError, MaxConnectionsError, ServerNotRunningError, ServerDisconnectedError, errorFromInfo, isMemoryError, wrapError, createRequest, createSuccessResponse, createErrorResponse, serializeMessage, parseMessage, isRequest, isResponse, isValidMethod, validateParams, MessageBuffer, DEFAULT_SOCKET_PATH, DEFAULT_HTTP_PORT, DEFAULT_MAX_CONNECTIONS, DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_RECONNECT_DELAY_MS, DEFAULT_MAX_RECONNECT_ATTEMPTS, DEFAULT_HEALTH_CHECK_INTERVAL_MS, DEFAULT_HEALTH_CHECK_TIMEOUT_MS, DEFAULT_FAILURE_THRESHOLD, MEMORY_SERVER_VERSION, } from './memory-server/index.js';
export type { MemoryMethod, IMemoryRequest, IMemoryResponse, IMemoryErrorInfo, MemoryErrorCode, IKnowledgeEntry, IStoreKnowledgeParams, IGetKnowledgeByDomainParams, IGetKnowledgeByTagsParams, IDeleteKnowledgeParams, IProvideFeedbackParams, IProvideFeedbackResult, IQueryPatternsParams, IQueryPatternsResult, IPatternMatch as IMemoryPatternMatch, IServerStatus, IStorageStats, IPingResult, ServerState, IMemoryServerConfig, IPidFileContent, IMemoryClientConfig, ClientState, IClientConnection, IHealthCheckResult, IHealthMonitorConfig, } from './memory-server/index.js';
export { GracefulShutdown, ShutdownPriority, ShutdownTimeoutError, ShutdownInProgressError, DEFAULT_HANDLER_TIMEOUT_MS, MAX_SHUTDOWN_TIME_MS, SHUTDOWN_DEBOUNCE_MS, getGracefulShutdown, registerShutdownHandler, initiateShutdown, resetGracefulShutdown, registerComponentShutdown, registerDatabaseShutdown, registerSonaEngineShutdown, registerGraphDBShutdown, registerEmbeddingStoreShutdown, registerServerShutdown, } from './shutdown/index.js';
export type { ShutdownHandlerFn, IShutdownHandler, IShutdownHandlerResult, ShutdownReason, IShutdownEvent, IGracefulShutdownConfig, IShutdownable, } from './shutdown/index.js';
/**
 * God Agent version
 */
export declare const VERSION = "1.0.0";
/**
 * God Agent build info
 */
export declare const BUILD_INFO: {
    version: string;
    milestone: string;
    tasks: number;
    tests: number;
    modules: string[];
    nfr: {
        'NFR-1': string;
        'NFR-4': string;
        'NFR-5': string;
    };
};
//# sourceMappingURL=index.d.ts.map