/**
 * God Agent Learning Module
 * TASK-SON-001 - Sona Engine (Trajectory-Based Learning)
 * TASK-SON-002 - LoRA Weight Updates and Persistence
 *
 * Provides:
 * - Trajectory tracking for reasoning paths
 * - Weight management for pattern adaptation
 * - Route-based weight organization
 * - Learning metrics and drift detection
 * - EWC++ regularized weight updates
 * - Binary weight persistence
 *
 * Performance targets:
 * - createTrajectory(): <1ms
 * - getWeight(): <1ms
 * - getWeights(): <5ms
 * - provideFeedback(): <15ms
 */
export { SonaEngine } from './sona-engine.js';
export { TrajectoryValidationError, WeightUpdateError, DriftExceededError, FeedbackValidationError, WeightPersistenceError, RollbackLoopError, CheckpointError, } from './sona-types.js';
export type { TrajectoryID, PatternID, Route, Weight, RouteWeights, WeightStorage, ITrajectory, ITrajectoryInput, IWeightUpdateParams, ILearningMetrics, DriftStatus, IDriftMetrics, ICheckpoint, ISonaConfig, ISonaConfig as SonaEngineConfig, // Alias for compatibility
ISerializedTrajectory, ISerializedRouteWeights, ISerializedSonaState, FisherInformationStorage, IFeedbackInput, IWeightUpdateResult, IWeightFileMetadata, ISerializedFisherEntry, CheckpointReason, ICheckpointFull, ISerializedCheckpoint, IReasoningStep, ReasoningStepAction, IStepCaptureConfig, ISonaEngine, } from './sona-types.js';
export { StepCaptureService, getGlobalStepCapture, resetGlobalStepCapture } from './step-capture-service.js';
export type { TrajectoryID as StepCaptureTrajectoryID } from './step-capture-service.js';
export { generateTrajectoryID, isValidTrajectoryID, generateCheckpointID, isValidCheckpointID, validateRoute, validateTrajectoryInput, validateQuality, validateLearningRate, validateRegularization, validateAndApplyConfig, validateFeedbackQuality, clampWeight, isValidWeight, cosineSimilarity, calculateDrift, arithmeticMean, standardDeviation, calculateReward, calculateGradient, calculateWeightUpdate, updateFisherInformation, calculateSuccessRate, crc32, DEFAULT_LEARNING_RATE, DEFAULT_REGULARIZATION, DEFAULT_DRIFT_ALERT_THRESHOLD, DEFAULT_DRIFT_REJECT_THRESHOLD, DEFAULT_AUTO_SAVE_INTERVAL, DEFAULT_MAX_CHECKPOINTS, DEFAULT_INITIAL_WEIGHT, WEIGHT_MIN, WEIGHT_MAX, DEFAULT_FISHER_INFORMATION, FISHER_DECAY_RATE, AUTO_SAVE_THROTTLE_MS, AUTO_PATTERN_QUALITY_THRESHOLD, WEIGHT_FILE_VERSION, } from './sona-utils.js';
//# sourceMappingURL=index.d.ts.map