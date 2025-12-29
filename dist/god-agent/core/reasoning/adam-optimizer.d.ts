/**
 * Adam Optimizer - Adaptive Moment Estimation
 *
 * Implements the Adam optimization algorithm for training GNN layers.
 * Adam combines the benefits of AdaGrad and RMSProp by tracking both
 * first moment (mean) and second moment (variance) of gradients.
 *
 * Algorithm (Kingma & Ba, 2014):
 *   m_t = beta1 * m_{t-1} + (1 - beta1) * g_t
 *   v_t = beta2 * v_{t-1} + (1 - beta2) * g_t^2
 *   m_hat_t = m_t / (1 - beta1^t)
 *   v_hat_t = v_t / (1 - beta2^t)
 *   theta_t = theta_{t-1} - alpha * m_hat_t / (sqrt(v_hat_t) + epsilon)
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-GNN-006 (Adam Optimizer)
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-079: No magic numbers (all defaults documented)
 * - RULE-089: Dimension consistency enforced
 *
 * @module src/god-agent/core/reasoning/adam-optimizer
 */
/**
 * Adam optimizer configuration
 * Implements: TASK-GNN-006 AC-001
 *
 * @interface AdamConfig
 */
export interface AdamConfig {
    /**
     * Learning rate (alpha)
     * @default 0.001
     * @rationale Standard Adam default per Kingma & Ba (2014)
     */
    learningRate: number;
    /**
     * Exponential decay rate for first moment estimates (beta1)
     * @default 0.9
     * @rationale Standard Adam default, controls momentum
     */
    beta1: number;
    /**
     * Exponential decay rate for second moment estimates (beta2)
     * @default 0.999
     * @rationale Standard Adam default, controls adaptive learning rate
     */
    beta2: number;
    /**
     * Small constant for numerical stability (epsilon)
     * @default 1e-8
     * @rationale Prevents division by zero in weight update
     */
    epsilon: number;
    /**
     * L2 regularization coefficient (weight decay)
     * @default 0
     * @rationale AdamW style decoupled weight decay
     */
    weightDecay: number;
}
/**
 * Serializable optimizer state for save/restore
 * Implements: TASK-GNN-006 AC-003
 *
 * @interface AdamState
 */
export interface AdamState {
    /** First moment estimates (m) per weight key */
    m: Record<string, number[]>;
    /** Second moment estimates (v) per weight key */
    v: Record<string, number[]>;
    /** Current timestep */
    t: number;
    /** Configuration used */
    config: AdamConfig;
    /** Version for compatibility checking */
    version: string;
}
/**
 * Result of a single optimization step
 *
 * @interface StepResult
 */
export interface StepResult {
    /** Updated weights */
    weights: Map<string, Float32Array>;
    /** Maximum gradient magnitude seen */
    maxGradientMag: number;
    /** Maximum weight update magnitude */
    maxUpdateMag: number;
    /** Number of weights updated */
    weightsUpdated: number;
}
/**
 * Adam Optimizer for GNN weight updates
 *
 * Features:
 * - Adaptive learning rates per parameter
 * - Momentum for faster convergence
 * - Bias correction for early timesteps
 * - Optional weight decay (AdamW style)
 * - State save/restore for training resumption
 *
 * Implements: TASK-GNN-006
 *
 * @example
 * ```typescript
 * const optimizer = new AdamOptimizer({ learningRate: 0.001 });
 *
 * // Training loop
 * for (const batch of batches) {
 *   const gradients = computeGradients(batch);
 *   weights = optimizer.step(weights, gradients);
 * }
 *
 * // Save state for later
 * const state = optimizer.getState();
 * ```
 */
export declare class AdamOptimizer {
    /** First moment estimates (mean of gradients) */
    private m;
    /** Second moment estimates (variance of gradients) */
    private v;
    /** Current timestep */
    private t;
    /** Optimizer configuration */
    private config;
    /**
     * Create an Adam optimizer instance
     *
     * @param config - Partial configuration (merged with defaults)
     */
    constructor(config?: Partial<AdamConfig>);
    /**
     * Validate configuration values
     * @throws Error if configuration is invalid
     */
    private validateConfig;
    /**
     * Ensure moment buffers exist for a weight key
     * Implements: TASK-GNN-006 AC-002 (momentum/velocity per weight)
     *
     * @param key - Weight identifier
     * @param dim - Weight dimension
     */
    private ensureMomentBuffers;
    /**
     * Perform a single optimization step
     * Implements: TASK-GNN-006 AC-001 (Adam algorithm)
     *
     * Adam update rule:
     *   m_t = beta1 * m_{t-1} + (1 - beta1) * g_t
     *   v_t = beta2 * v_{t-1} + (1 - beta2) * g_t^2
     *   m_hat_t = m_t / (1 - beta1^t)  (bias correction)
     *   v_hat_t = v_t / (1 - beta2^t)  (bias correction)
     *   theta_t = theta_{t-1} - alpha * m_hat_t / (sqrt(v_hat_t) + epsilon)
     *
     * With optional AdamW weight decay:
     *   theta_t = theta_t - alpha * weight_decay * theta_{t-1}
     *
     * @param weights - Current weight matrices (key -> flattened weights)
     * @param gradients - Computed gradients (key -> flattened gradients)
     * @returns Updated weight matrices
     */
    step(weights: Map<string, Float32Array>, gradients: Map<string, Float32Array>): Map<string, Float32Array>;
    /**
     * Perform optimization step and return detailed results
     *
     * @param weights - Current weight matrices
     * @param gradients - Computed gradients
     * @returns StepResult with updated weights and statistics
     */
    stepWithStats(weights: Map<string, Float32Array>, gradients: Map<string, Float32Array>): StepResult;
    /**
     * Reset optimizer state
     * Implements: TASK-GNN-006 AC-003 (state management)
     *
     * Clears all moment estimates and resets timestep to zero.
     * Use this when starting fresh training or after major architecture changes.
     */
    reset(): void;
    /**
     * Get serializable optimizer state
     * Implements: TASK-GNN-006 AC-003 (state save/restore)
     *
     * @returns AdamState object that can be serialized to JSON
     */
    getState(): AdamState;
    /**
     * Restore optimizer state from saved state
     * Implements: TASK-GNN-006 AC-003 (state save/restore)
     *
     * @param state - Previously saved AdamState
     * @throws Error if state version is incompatible
     */
    setState(state: AdamState): void;
    /**
     * Get current timestep
     */
    getTimestep(): number;
    /**
     * Get current configuration
     */
    getConfig(): AdamConfig;
    /**
     * Update configuration (only affects future steps)
     *
     * @param config - Partial configuration to update
     */
    updateConfig(config: Partial<AdamConfig>): void;
    /**
     * Get learning rate (convenience method)
     */
    getLearningRate(): number;
    /**
     * Set learning rate (convenience method for learning rate scheduling)
     *
     * @param lr - New learning rate
     */
    setLearningRate(lr: number): void;
    /**
     * Get number of tracked weight tensors
     */
    getNumTrackedWeights(): number;
    /**
     * Check if a weight key is being tracked
     *
     * @param key - Weight identifier
     */
    isTracking(key: string): boolean;
    /**
     * Get moment statistics for debugging
     *
     * @param key - Weight identifier
     * @returns Moment statistics or null if not tracked
     */
    getMomentStats(key: string): {
        mMean: number;
        mMax: number;
        vMean: number;
        vMax: number;
    } | null;
    /**
     * Clear moment estimates for a specific weight key
     * Useful when a layer is re-initialized
     *
     * @param key - Weight identifier to clear
     */
    clearMoments(key: string): void;
    /**
     * Get memory usage in bytes
     */
    getMemoryUsage(): number;
}
/**
 * Create default Adam optimizer
 */
export declare function createAdamOptimizer(config?: Partial<AdamConfig>): AdamOptimizer;
/**
 * Convert 2D weight matrix to flat array for optimizer
 *
 * @param weights - 2D weight matrix (rows x cols)
 * @returns Flattened Float32Array
 */
export declare function flattenWeights(weights: Float32Array[]): Float32Array;
/**
 * Convert flat array back to 2D weight matrix
 *
 * @param flat - Flattened weight array
 * @param numRows - Number of rows (output dimension)
 * @param numCols - Number of columns (input dimension)
 * @returns 2D weight matrix
 */
export declare function unflattenWeights(flat: Float32Array, numRows: number, numCols: number): Float32Array[];
/**
 * Apply Adam optimizer to 2D weight matrices
 * Convenience function that handles flattening/unflattening
 *
 * @param optimizer - Adam optimizer instance
 * @param weights - Map of layer ID to 2D weight matrices
 * @param gradients - Map of layer ID to 2D gradient matrices
 * @returns Updated 2D weight matrices
 */
export declare function applyAdamTo2DWeights(optimizer: AdamOptimizer, weights: Map<string, Float32Array[]>, gradients: Map<string, Float32Array[]>): Map<string, Float32Array[]>;
//# sourceMappingURL=adam-optimizer.d.ts.map