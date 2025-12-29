/**
 * WeightManager - Learned Weight Initialization and Persistence
 *
 * Implements: TASK-GNN-001, TASK-GNN-003
 * PRD: PRD-GOD-AGENT-001
 *
 * Provides proper neural network weight initialization (Xavier, He) and persistence
 * to replace fake simpleProjection() index cycling with real learned projections.
 *
 * TASK-GNN-003 Features:
 * - Automatic weight loading on construction (lazy loading)
 * - Version metadata tracking (model version, timestamp, checksum)
 * - Checkpoint mechanism for training recovery
 * - Weight validation on load (dimension checking, NaN detection)
 * - Corrupted weight detection and graceful handling
 *
 * Binary format: [numRows:u32 little-endian, numCols:u32, ...float32 data]
 * Metadata format: JSON file with version, timestamp, checksum
 *
 * @module src/god-agent/core/reasoning/weight-manager
 */
/**
 * Weight initialization configuration
 * Implements: TASK-GNN-001 Section 2.1.2
 */
export interface IWeightConfig {
    /** Input dimension (fan_in) */
    inputDim: number;
    /** Output dimension (fan_out) */
    outputDim: number;
    /** Initialization strategy */
    initialization: 'xavier' | 'he' | 'random' | 'zeros';
    /** Optional random seed for reproducibility */
    seed?: number;
}
/**
 * Weight metadata for versioning and validation
 * Implements: TASK-GNN-003 AC-003
 */
export interface IWeightMetadata {
    /** Model version identifier */
    version: string;
    /** Timestamp when weights were saved (ISO 8601) */
    timestamp: string;
    /** MD5 checksum of binary weight data */
    checksum: string;
    /** Number of rows in weight matrix */
    numRows: number;
    /** Number of columns in weight matrix */
    numCols: number;
    /** Total number of parameters */
    totalParams: number;
    /** Initialization strategy used */
    initialization: IWeightConfig['initialization'];
    /** Seed used for initialization (if any) */
    seed?: number;
}
/**
 * Checkpoint configuration for training recovery
 * Implements: TASK-GNN-003 AC-004
 */
export interface ICheckpointConfig {
    /** Enable automatic checkpointing */
    enabled: boolean;
    /** Number of updates between checkpoints */
    intervalUpdates: number;
    /** Maximum number of checkpoints to retain */
    maxCheckpoints: number;
    /** Checkpoint directory path */
    checkpointDir: string;
}
/**
 * Weight validation result
 * Implements: TASK-GNN-003 AC-005
 */
export interface IWeightValidationResult {
    /** Whether validation passed */
    valid: boolean;
    /** Validation errors if any */
    errors: string[];
    /** Validation warnings if any */
    warnings: string[];
}
/**
 * WeightManager - Manages learned weight matrices for GNN layers
 *
 * Implements: TASK-GNN-001
 *
 * Features:
 * - Xavier initialization: variance = 2/(fan_in + fan_out)
 * - He initialization: variance = 2/fan_in
 * - Reproducible initialization with seeds
 * - Binary persistence format for fast loading
 */
export declare class WeightManager {
    private weights;
    private configs;
    private metadata;
    private persistPath;
    private checkpointConfig;
    private updateCount;
    private autoLoadEnabled;
    private loadedFromDisk;
    /**
     * Create a WeightManager instance
     * Implements: TASK-GNN-003 AC-002 (auto-load on construction)
     *
     * @param basePath - Base path for weight persistence (default: .agentdb/gnn/weights)
     * @param checkpointConfig - Optional checkpoint configuration
     * @param autoLoad - Whether to auto-load weights on construction (default: true)
     */
    constructor(basePath?: string, checkpointConfig?: Partial<ICheckpointConfig>, autoLoad?: boolean);
    /**
     * Ensure weight and checkpoint directories exist
     * Implements: TASK-GNN-003 AC-001
     */
    private ensureDirectories;
    /**
     * Try to auto-load weights for a layer from disk
     * Implements: TASK-GNN-003 AC-002 (lazy loading)
     *
     * @param layerId - Layer identifier to try loading
     * @returns true if weights were loaded from disk
     */
    private tryAutoLoad;
    /**
     * Initialize weights for a layer using the specified strategy
     * Implements: TASK-GNN-001 Section 2.1.2
     *
     * @param layerId - Unique identifier for this layer
     * @param config - Weight configuration with dimensions and initialization
     * @returns Weight matrix as array of Float32Array rows
     */
    initializeWeights(layerId: string, config: IWeightConfig): Float32Array[];
    /**
     * Get weights for a layer, initializing if needed
     *
     * @param layerId - Layer identifier
     * @param config - Optional config for initialization if weights don't exist
     * @returns Weight matrix or empty array if no weights and no config
     */
    getWeights(layerId: string, config?: IWeightConfig): Float32Array[];
    /**
     * Check if weights exist for a layer
     */
    hasWeights(layerId: string): boolean;
    /**
     * Get the config used for a layer's weights
     */
    getConfig(layerId: string): IWeightConfig | undefined;
    /**
     * Calculate MD5 checksum of binary data
     * Implements: TASK-GNN-003 AC-003 (checksum)
     */
    private calculateChecksum;
    /**
     * Save weights to binary file with metadata
     * Implements: TASK-GNN-003 AC-001, AC-003
     *
     * Format: [numRows(4 bytes), numCols(4 bytes), ...flattened float32 data]
     * Metadata saved as JSON alongside binary file
     *
     * @param layerId - Layer to save
     */
    saveWeights(layerId: string): Promise<void>;
    /**
     * Atomically save weights with checksum verification
     * Implements: GAP-GNN-002, RULE-046
     *
     * Protocol:
     * 1. Write weights to temporary .tmp file
     * 2. Compute and verify checksum of .tmp file
     * 3. Atomic rename from .tmp to .bin (preserves .bin on failure)
     *
     * @param layerId - Layer identifier to save
     * @throws Error if checksum verification fails or atomic rename fails
     */
    saveWeightsAtomic(layerId: string): Promise<void>;
    /**
     * Verify a weight file by reading it back and comparing checksum
     * Implements: GAP-GNN-002 (checksum verification)
     *
     * @param filePath - Path to the weight file to verify
     * @param expectedChecksum - Expected MD5 checksum
     * @returns true if verification passes
     */
    private verifyWeightFile;
    /**
     * Validate weights for corruption and dimension issues
     * Implements: TASK-GNN-003 AC-005 (weight validation)
     *
     * @param weights - Weight matrix to validate
     * @param expectedRows - Expected number of rows (optional)
     * @param expectedCols - Expected number of columns (optional)
     * @returns Validation result
     */
    validateWeights(weights: Float32Array[], expectedRows?: number, expectedCols?: number): IWeightValidationResult;
    /**
     * Load weights from binary file with validation
     * Implements: TASK-GNN-003 AC-002, AC-005
     *
     * @param layerId - Layer to load
     * @param validate - Whether to validate weights after loading (default: true)
     * @returns Weight matrix or null if file doesn't exist or validation fails
     */
    loadWeights(layerId: string, validate?: boolean): Promise<Float32Array[] | null>;
    /**
     * Save all weights to disk
     */
    saveAll(): Promise<void>;
    /**
     * Load weights for multiple layers
     *
     * @param layerIds - Layer IDs to load
     * @returns Map of successfully loaded layers
     */
    loadMultiple(layerIds: string[]): Promise<Map<string, Float32Array[]>>;
    /**
     * Clear all weights from memory
     */
    clear(): void;
    /**
     * Get all layer IDs with weights
     */
    getLayerIds(): string[];
    /**
     * Get memory usage statistics
     */
    getMemoryStats(): {
        layers: number;
        totalParams: number;
        memoryBytes: number;
    };
    /**
     * Create a checkpoint for a layer's weights
     * Implements: TASK-GNN-003 AC-004 (checkpoint mechanism)
     *
     * @param layerId - Layer to checkpoint
     * @returns Checkpoint filename
     */
    createCheckpoint(layerId: string): Promise<string>;
    /**
     * Restore weights from the latest checkpoint
     * Implements: TASK-GNN-003 AC-004 (training recovery)
     *
     * @param layerId - Layer to restore
     * @returns true if restored successfully
     */
    restoreFromCheckpoint(layerId: string): Promise<boolean>;
    /**
     * List all checkpoints for a layer
     * Implements: TASK-GNN-003 AC-004
     *
     * @param layerId - Layer ID to list checkpoints for
     * @returns Array of checkpoint filenames sorted by timestamp
     */
    listCheckpoints(layerId: string): string[];
    /**
     * Cleanup old checkpoints exceeding maxCheckpoints
     * Implements: TASK-GNN-003 AC-004
     */
    private cleanupOldCheckpoints;
    /**
     * Get metadata for a layer
     * Implements: TASK-GNN-003 AC-003
     *
     * @param layerId - Layer ID
     * @returns Metadata if available
     */
    getMetadata(layerId: string): IWeightMetadata | undefined;
    /**
     * Get checkpoint configuration
     * Implements: TASK-GNN-003 AC-004
     */
    getCheckpointConfig(): ICheckpointConfig;
    /**
     * Set checkpoint configuration
     * Implements: TASK-GNN-003 AC-004
     */
    setCheckpointConfig(config: Partial<ICheckpointConfig>): void;
    /**
     * Get the update count (for checkpoint interval tracking)
     */
    getUpdateCount(): number;
    /**
     * Reset the update count
     */
    resetUpdateCount(): void;
    /**
     * Check if weights were loaded from disk for a layer
     */
    wasLoadedFromDisk(layerId: string): boolean;
    /**
     * Directly set weights for a layer, replacing existing weights
     *
     * @param layerId - Layer identifier (must exist in configs)
     * @param weights - New weight matrix (Float32Array[] where each row is outputDim)
     * @throws {Error} If layerId not found in configs
     * @throws {Error} If dimensions don't match config (inputDim x outputDim)
     * @throws {Error} If weights fail validation (NaN, Inf, inconsistent rows)
     * @example
     * // After gradient descent:
     * const updatedWeights = applyAdam(optimizer, currentWeights, gradients);
     * weightManager.setWeights('gnn-layer1', updatedWeights);
     */
    setWeights(layerId: string, weights: Float32Array[]): void;
    /**
     * Update weights by adding a delta (gradient) in-place
     *
     * Useful for gradient descent: w = w + learningRate * gradient
     *
     * @param layerId - Layer identifier (must have existing weights)
     * @param delta - Delta to add (same dimensions as weights)
     * @param scale - Optional scale factor (default 1.0), applied as w += scale * delta
     * @throws {Error} If layerId not found or has no weights
     * @throws {Error} If delta dimensions don't match weights
     * @throws {Error} If update produces NaN/Inf (gradient explosion)
     * @example
     * // Gradient descent update:
     * weightManager.updateWeights('gnn-layer1', gradients, -learningRate);
     */
    updateWeights(layerId: string, delta: Float32Array[], scale?: number): void;
    /**
     * Get the persist path
     */
    getPersistPath(): string;
    /**
     * Delete all persisted weights for a layer
     * Implements: TASK-GNN-003 (cleanup utility)
     */
    deletePersistedWeights(layerId: string): Promise<boolean>;
    /**
     * Check if persisted weights exist for a layer
     */
    hasPersistedWeights(layerId: string): boolean;
}
//# sourceMappingURL=weight-manager.d.ts.map