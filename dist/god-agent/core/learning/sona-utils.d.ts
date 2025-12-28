/**
 * Sona Engine Utilities
 * TASK-SON-001 - ID Generation and Validation
 *
 * Provides utility functions for trajectory management and validation.
 */
import type { TrajectoryID, Route, Weight, ITrajectoryInput, ISonaConfig } from './sona-types.js';
/** Default learning rate */
export declare const DEFAULT_LEARNING_RATE = 0.01;
/** Default EWC++ regularization strength */
export declare const DEFAULT_REGULARIZATION = 0.1;
/** Default drift alert threshold */
export declare const DEFAULT_DRIFT_ALERT_THRESHOLD = 0.3;
/** Default drift reject threshold */
export declare const DEFAULT_DRIFT_REJECT_THRESHOLD = 0.5;
/** Default auto-save interval (ms) */
export declare const DEFAULT_AUTO_SAVE_INTERVAL = 100;
/** Default maximum checkpoints to keep */
export declare const DEFAULT_MAX_CHECKPOINTS = 10;
/** Default initial weight for new patterns */
export declare const DEFAULT_INITIAL_WEIGHT = 0;
/** Weight minimum value */
export declare const WEIGHT_MIN = -1;
/** Weight maximum value */
export declare const WEIGHT_MAX = 1;
/**
 * Generate a unique TrajectoryID
 * Format: "traj-{timestamp}-{random8hex}"
 */
export declare function generateTrajectoryID(): TrajectoryID;
/**
 * Validate TrajectoryID format
 */
export declare function isValidTrajectoryID(id: string): boolean;
/**
 * Generate a unique checkpoint ID
 * Format: "ckpt-{timestamp}-{random8hex}"
 */
export declare function generateCheckpointID(): string;
/**
 * Validate checkpoint ID format
 */
export declare function isValidCheckpointID(id: string): boolean;
/**
 * Validate route string
 * @throws TrajectoryValidationError if invalid
 */
export declare function validateRoute(route: Route): void;
/**
 * Validate trajectory input
 * @throws TrajectoryValidationError if validation fails
 */
export declare function validateTrajectoryInput(input: ITrajectoryInput): void;
/**
 * Validate quality score
 * @throws TrajectoryValidationError if invalid
 */
export declare function validateQuality(quality: number): void;
/**
 * Validate learning rate
 * @throws TrajectoryValidationError if invalid
 */
export declare function validateLearningRate(rate: number): void;
/**
 * Validate regularization strength
 * @throws TrajectoryValidationError if invalid
 */
export declare function validateRegularization(lambda: number): void;
/**
 * Validate Sona configuration
 * @returns Validated config with defaults applied
 */
export declare function validateAndApplyConfig(config?: ISonaConfig): Required<ISonaConfig>;
/**
 * Clamp weight to valid range [-1, 1]
 */
export declare function clampWeight(weight: Weight): Weight;
/**
 * Check if weight is valid (not NaN, within range)
 */
export declare function isValidWeight(weight: Weight): boolean;
/**
 * Calculate cosine similarity between two weight vectors
 * Returns value in [-1, 1] range
 */
export declare function cosineSimilarity(a: Float32Array, b: Float32Array): number;
/**
 * Calculate drift score (1 - cosine similarity)
 * Returns value in [0, 2] range (0 = identical, 2 = opposite)
 */
export declare function calculateDrift(current: Float32Array, baseline: Float32Array): number;
/**
 * Calculate arithmetic mean of an array
 */
export declare function arithmeticMean(values: number[]): number;
/**
 * Calculate standard deviation
 */
export declare function standardDeviation(values: number[]): number;
/**
 * Calculate reward from trajectory quality and L-Score
 * reward = quality × lScore × trajectorySuccessRate
 */
export declare function calculateReward(quality: number, lScore: number, trajectorySuccessRate: number): number;
/**
 * Calculate gradient for weight update
 * gradient = (reward - 0.5) × similarity
 */
export declare function calculateGradient(reward: number, similarity: number): number;
/**
 * Calculate EWC++ regularized weight update
 * weightChange = α × gradient / (1 + λ × importance)
 */
export declare function calculateWeightUpdate(gradient: number, learningRate: number, regularization: number, importance: number): number;
/**
 * Calculate CRC32 checksum for a buffer
 */
export declare function crc32(buffer: Buffer | Uint8Array): number;
/**
 * Update Fisher Information using exponential moving average
 * newImportance = decay × oldImportance + (1 - decay) × gradient²
 */
export declare function updateFisherInformation(currentImportance: number, gradient: number, decay?: number): number;
/**
 * Calculate trajectory success rate (historical average quality for route)
 */
export declare function calculateSuccessRate(qualityScores: number[], defaultRate?: number): number;
/**
 * Validate feedback quality score
 * @throws TrajectoryValidationError if invalid
 */
export declare function validateFeedbackQuality(quality: number): void;
/**
 * Default Fisher Information for new patterns
 */
export declare const DEFAULT_FISHER_INFORMATION = 0.1;
/**
 * Fisher Information decay rate for EMA
 */
export declare const FISHER_DECAY_RATE = 0.9;
/**
 * Auto-save throttle interval in ms
 */
export declare const AUTO_SAVE_THROTTLE_MS = 100;
/**
 * Quality threshold for auto-creating patterns
 */
export declare const AUTO_PATTERN_QUALITY_THRESHOLD = 0.8;
/**
 * Binary weight file version
 */
export declare const WEIGHT_FILE_VERSION = 1;
//# sourceMappingURL=sona-utils.d.ts.map