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
// ==================== Main Orchestrator ====================
export { GodAgent, godAgent, } from './god-agent.js';
// ==================== Layer 1: Native Core ====================
// Vector Validation (use actual exports from validation module)
export { assertDimensions, assertDimensionsOnly, isL2Normalized, validateFiniteValues, normL2, createValidatedVector, calculateNorm, cosineSimilarity, euclideanDistance, } from './validation/index.js';
export { VECTOR_DIM, L2_NORM_TOLERANCE, HNSW_PARAMS, LORA_PARAMS, L_SCORE_THRESHOLD, } from './validation/index.js';
export { GraphDimensionMismatchError, ZeroVectorError, InvalidVectorValueError, NotNormalizedError, InvalidNamespaceError, } from './validation/index.js';
// VectorDB (provides: VectorDB, VectorID, etc.)
export { VectorDB, DistanceMetric, } from './vector-db/index.js';
// GraphDB (provides: GraphDB, NodeID, etc.)
export * from './graph-db/index.js';
// ==================== Layer 2: Reasoning ====================
// Reasoning module exports: PatternMatcher, CausalMemory, ReasoningBank, ProvenanceStore, ShadowVectorSearch
// Note: Does NOT re-export cosineSimilarity, arithmeticMean, normalizeL2, calculateConfidence (use from vector-db/learning/routing instead)
export { 
// Pattern Matching
PatternMatcher, PatternStore, calibrateConfidence, rankPatterns, filterPatterns, batchCalculateConfidence, createPatternResult, TaskType, 
// Causal Memory
CausalMemory, CausalHypergraph, CausalTraversal, CycleDetector, 
// Reasoning Bank
ReasoningBank, GNNEnhancer, TrajectoryTracker, ModeSelector, ReasoningMode, 
// Provenance Store
ProvenanceStore, generateSourceID, generateProvenanceID, isValidSourceID, isValidProvenanceID, validateSourceInput, validateProvenanceInput, validateDerivationStep, geometricMean, depthFactor, calculateLScore, getThresholdForDomain, validateLScore, validateEmbedding, DEFAULT_LSCORE_THRESHOLD, DOMAIN_THRESHOLDS, LScoreRejectionError, ProvenanceValidationError, 
// Shadow Vector Search (note: isL2Normalized excluded to avoid duplicate)
ShadowVectorSearch, MockVectorStore, createShadowVector, classifyDocument, determineEvidenceType, calculateCredibility, determineVerdict, calculateVerdictConfidence, calculateRefutationStrength, sortByRefutationStrength, filterByThreshold, ShadowVectorError, DEFAULT_CLASSIFICATION_THRESHOLDS, DEFAULT_SHADOW_CONFIG, } from './reasoning/index.js';
// ==================== Layer 3: Memory ====================
export * from './memory/index.js';
// ==================== Layer 4: Learning ====================
// Learning module exports SonaEngine and trajectory/weight utilities
// Note: Does NOT re-export cosineSimilarity, arithmeticMean (avoid collision with reasoning)
export { SonaEngine, TrajectoryValidationError, WeightUpdateError, DriftExceededError, FeedbackValidationError, WeightPersistenceError, RollbackLoopError, CheckpointError, generateTrajectoryID, isValidTrajectoryID, generateCheckpointID, isValidCheckpointID, validateRoute, validateTrajectoryInput, validateQuality, validateLearningRate, validateRegularization, validateAndApplyConfig, validateFeedbackQuality, clampWeight, isValidWeight, calculateDrift, standardDeviation, calculateReward, calculateGradient, calculateWeightUpdate, updateFisherInformation, calculateSuccessRate, crc32, DEFAULT_LEARNING_RATE, DEFAULT_REGULARIZATION, DEFAULT_DRIFT_ALERT_THRESHOLD, DEFAULT_DRIFT_REJECT_THRESHOLD, DEFAULT_AUTO_SAVE_INTERVAL, DEFAULT_MAX_CHECKPOINTS, DEFAULT_INITIAL_WEIGHT, WEIGHT_MIN, WEIGHT_MAX, DEFAULT_FISHER_INFORMATION, FISHER_DECAY_RATE, AUTO_SAVE_THROTTLE_MS, AUTO_PATTERN_QUALITY_THRESHOLD, WEIGHT_FILE_VERSION, } from './learning/index.js';
// ==================== Layer 5: Orchestration ====================
// Orchestration - Relay Race Protocol
// Note: Does NOT re-export IAgentExecutor, DEFAULT_AGENT_TIMEOUT (avoid collision)
export { RelayRaceOrchestrator, MockAgentExecutor, PipelineValidationError, AgentExecutionError, MemoryKeyError, QualityGateError, generatePipelineID, isValidPipelineID, validatePipelineDefinition, validateAgentDefinition, validateMemoryKeyChain, buildAgentPrompt, formatAgentPosition, parseAgentPosition, validateQualityGate, serializeMap, deserializeMap, DEFAULT_NAMESPACE, MAX_PIPELINE_AGENTS, } from './orchestration/index.js';
// Routing (DAI-003 Intelligent Task Routing)
// Note: TinyDancer removed - new routing integrated via UniversalAgent
export { 
// Utilities retained
softmax, relu, sigmoid, tanh, matVecMul, addBias, reluVector, calculateUncertainty, calculateScore, rankByScore, topK, isWithinWindow, timeUntilExpiry, xavierInit, zeroInit, initFromEmbeddings, 
// DAI-003 configurations
DEFAULT_COLD_START_CONFIG, DEFAULT_ROUTING_CONFIG, } from './routing/index.js';
// Compression
// Note: Does NOT re-export VectorID (avoid collision with vector-db)
export { CompressionManager, float32ToFloat16, float16ToFloat32, encodeFloat16, decodeFloat16, trainPQCodebook, encodePQ8, decodePQ8, encodePQ4, decodePQ4, trainBinaryThresholds, encodeBinary, decodeBinary, calculateReconstructionError, cosineSimilarityCompression, uint8ToUint16, uint16ToUint8, CompressionTier, TIER_HIERARCHY, TIER_CONFIGS, DEFAULT_COMPRESSION_CONFIG, CompressionError, TierTransitionError, getTierForHeatScore, isValidTransition, getNextTier, calculateBytesForTier, } from './compression/index.js';
// Attention
export * from './attention/index.js';
// PhD Pipeline
export * from './pipeline/index.js';
export { DEFAULT_AGENT_TIMEOUT, } from './types/index.js';
// Agent Execution Service (TASK-DEV-002)
export { AgentExecutionService, createAgentExecutionService, } from './services/index.js';
// ==================== Unified Search (TASK-SEARCH-006) ====================
export { UnifiedSearch, VectorSourceAdapter, GraphSourceAdapter, MemorySourceAdapter, PatternSourceAdapter, FusionScorer, } from './search/index.js';
// ==================== Observability ====================
export * from './observability/index.js';
// ==================== Benchmarks & Validation ====================
// Performance Benchmarks (NFR-1)
export * from './benchmarks/index.js';
// Scale Tests (NFR-4)
// Note: Does NOT re-export DEFAULT_RUNNER_CONFIG to avoid collision
export { 
// Vector Scale Test
VectorScaleTest, DEFAULT_VECTOR_SCALE_CONFIG, generateNormalizedVectors, vectorScaleTest, 
// Pipeline Scale Test
PipelineScaleTest, DEFAULT_PIPELINE_SCALE_CONFIG, generatePipelineAgents, pipelineScaleTest, 
// Memory Pressure Test
MemoryPressureTest, DEFAULT_MEMORY_PRESSURE_CONFIG, memoryPressureTest, 
// Degradation Test
DegradationTest, CapacityManager, CapacityExceededError, DEFAULT_DEGRADATION_CONFIG, degradationTest, 
// Multi-Instance Test
MultiInstanceTest, SimulatedInstance, DEFAULT_MULTI_INSTANCE_CONFIG, multiInstanceTest, 
// Runner (DEFAULT_RUNNER_CONFIG excluded to avoid collision)
ScaleTestRunner, scaleTestRunner, 
// Utilities
MemoryMonitor, DEFAULT_MEMORY_THRESHOLDS, memoryMonitor, ConcurrencyTracker, AsyncSemaphore, RateLimiter, concurrencyTracker, } from './scale-tests/index.js';
// Portability (NFR-5)
export * from './portability/index.js';
// ==================== MEM-001: Multi-Process Memory Server ====================
export { 
// Server
MemoryServer, getMemoryServer, startMemoryServer, stopMemoryServer, 
// Client
MemoryClient, getMemoryClient, createMemoryClient, 
// Health
MemoryHealthMonitor, getHealthMonitor, isMemoryServerHealthy, discoverMemoryServer, 
// Errors
MemoryError, InvalidRequestError, UnknownMethodError, ValidationError, StorageError, ServerShuttingDownError, TimeoutError, MaxConnectionsError, ServerNotRunningError, ServerDisconnectedError, errorFromInfo, isMemoryError, wrapError, 
// Protocol
createRequest, createSuccessResponse, createErrorResponse, serializeMessage, parseMessage, isRequest, isResponse, isValidMethod, validateParams, MessageBuffer, 
// Constants
DEFAULT_SOCKET_PATH, DEFAULT_HTTP_PORT, DEFAULT_MAX_CONNECTIONS, DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_RECONNECT_DELAY_MS, DEFAULT_MAX_RECONNECT_ATTEMPTS, DEFAULT_HEALTH_CHECK_INTERVAL_MS, DEFAULT_HEALTH_CHECK_TIMEOUT_MS, DEFAULT_FAILURE_THRESHOLD, MEMORY_SERVER_VERSION, } from './memory-server/index.js';
// ==================== Shutdown (TASK-ERR-005) ====================
export { 
// Main class
GracefulShutdown, 
// Priority enum
ShutdownPriority, 
// Errors
ShutdownTimeoutError, ShutdownInProgressError, 
// Constants
DEFAULT_HANDLER_TIMEOUT_MS, MAX_SHUTDOWN_TIME_MS, SHUTDOWN_DEBOUNCE_MS, 
// Singleton functions
getGracefulShutdown, registerShutdownHandler, initiateShutdown, resetGracefulShutdown, 
// Component registration helpers
registerComponentShutdown, registerDatabaseShutdown, registerSonaEngineShutdown, registerGraphDBShutdown, registerEmbeddingStoreShutdown, registerServerShutdown, } from './shutdown/index.js';
// ==================== Version ====================
/**
 * God Agent version
 */
export const VERSION = '1.0.0';
/**
 * God Agent build info
 */
export const BUILD_INFO = {
    version: VERSION,
    milestone: 'D',
    tasks: 28,
    tests: 1028,
    modules: [
        'validation',
        'vector-db',
        'graph-db',
        'memory',
        'reasoning',
        'learning',
        'orchestration',
        'routing',
        'compression',
        'attention',
        'pipeline',
        'observability',
        'benchmarks',
        'scale-tests',
        'portability',
        'search',
        'shutdown',
    ],
    nfr: {
        'NFR-1': 'Performance Benchmark Suite',
        'NFR-4': 'Scalability Validation Suite',
        'NFR-5': 'Portability Validation Suite',
    },
};
//# sourceMappingURL=index.js.map