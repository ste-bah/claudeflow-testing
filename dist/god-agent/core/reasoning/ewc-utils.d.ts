/**
 * Elastic Weight Consolidation (EWC) Utilities
 *
 * Implements EWC regularization to prevent "Catastrophic Forgetting" in continual learning.
 * When the model learns new tasks, EWC prevents it from forgetting previously learned tasks
 * by adding a penalty term to the loss function that penalizes changes to important weights.
 *
 * EWC Formula:
 * L_total = L_task + (lambda/2) * sum_i F_i * (theta_i - theta_i*)^2
 *
 * Where:
 * - L_task = Task-specific loss (e.g., contrastive loss)
 * - lambda = EWC regularization strength (from LORA_PARAMS.ewcLambda)
 * - F_i = Fisher information for parameter i (importance weight)
 * - theta_i = Current parameter value
 * - theta_i* = Optimal parameter value from previous task(s)
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-GNN-008 (EWC Integration)
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-079: No magic numbers (uses LORA_PARAMS constant)
 * - RULE-028: All feedback persisted
 * - RULE-046: Atomic operations
 *
 * References:
 * - Kirkpatrick et al. "Overcoming catastrophic forgetting in neural networks"
 *   https://arxiv.org/abs/1612.00796
 * - Online EWC: Schwarz et al. "Progress & Compress: A scalable framework for
 *   continual learning" https://arxiv.org/abs/1805.06370
 *
 * @module src/god-agent/core/reasoning/ewc-utils
 */
/**
 * Configuration for EWC regularization
 * Implements: TASK-GNN-008 specification
 */
export interface EWCConfig {
    /** Regularization strength (lambda) - from LORA_PARAMS.ewcLambda */
    lambda: number;
    /** Numerical stability epsilon for divisions */
    epsilon: number;
    /** Whether to use online EWC (accumulate Fisher over tasks) */
    online: boolean;
    /** Decay factor for online EWC (gamma in [0, 1]) */
    onlineDecay: number;
    /** Minimum Fisher value to consider a weight important */
    fisherThreshold: number;
    /** Path for persisting Fisher diagonal */
    persistPath: string;
}
/**
 * Result from computing EWC penalty
 */
export interface EWCPenaltyResult {
    /** Total EWC penalty term */
    penalty: number;
    /** Number of parameters with non-zero Fisher */
    importantParams: number;
    /** Total number of parameters */
    totalParams: number;
    /** Computation time in milliseconds */
    computeTimeMs: number;
}
/**
 * Result from computing EWC gradients
 */
export interface EWCGradientResult {
    /** Gradient map per layer */
    gradients: Map<string, Float32Array>;
    /** L2 norm of gradients */
    gradientNorm: number;
    /** Number of parameters affected */
    affectedParams: number;
    /** Computation time in milliseconds */
    computeTimeMs: number;
}
/**
 * Fisher information update result
 */
export interface FisherUpdateResult {
    /** Updated Fisher diagonal */
    fisher: Map<string, Float32Array>;
    /** Number of samples used */
    numSamples: number;
    /** Computation time in milliseconds */
    computeTimeMs: number;
}
/**
 * EWCRegularizer - Elastic Weight Consolidation for Continual Learning
 *
 * Prevents catastrophic forgetting by:
 * 1. Computing Fisher information to identify important weights
 * 2. Adding penalty for changing important weights from optimal values
 * 3. Supporting online EWC for multiple sequential tasks
 *
 * Implements: TASK-GNN-008
 *
 * @example
 * ```typescript
 * const ewc = new EWCRegularizer({ lambda: 0.1 });
 *
 * // After training on task A, compute and store Fisher
 * const fisher = ewc.updateFisher(existingFisher, gradients, numSamples);
 *
 * // During training on task B, add EWC penalty
 * const penalty = ewc.computePenalty(currentWeights, optimalWeights, fisher);
 * const totalLoss = taskLoss + penalty;
 *
 * // Get EWC gradients for weight update
 * const ewcGradients = ewc.computeGradients(currentWeights, optimalWeights, fisher);
 * ```
 */
export declare class EWCRegularizer {
    private readonly config;
    private taskCount;
    /**
     * Create a new EWCRegularizer
     *
     * @param config - Partial configuration (defaults applied)
     */
    constructor(config?: Partial<EWCConfig>);
    /**
     * Ensure EWC persistence directories exist
     */
    private ensureDirectories;
    /**
     * Get current configuration
     */
    getConfig(): Readonly<EWCConfig>;
    /**
     * Get the number of tasks trained
     */
    getTaskCount(): number;
    /**
     * Compute the EWC penalty term
     *
     * Implements: TASK-GNN-008 AC-001
     *
     * Penalty = (lambda/2) * sum_i F_i * (theta_i - theta_i*)^2
     *
     * @param currentWeights - Current model weights
     * @param optimalWeights - Optimal weights from previous task(s)
     * @param fisherDiagonal - Fisher information diagonal
     * @returns EWC penalty result
     */
    computePenalty(currentWeights: Map<string, Float32Array>, optimalWeights: Map<string, Float32Array>, fisherDiagonal: Map<string, Float32Array>): EWCPenaltyResult;
    /**
     * Compute EWC gradients for weight update
     *
     * Implements: TASK-GNN-008 AC-001
     *
     * Gradient of EWC penalty with respect to theta_i:
     * d(EWC)/d(theta_i) = lambda * F_i * (theta_i - theta_i*)
     *
     * @param currentWeights - Current model weights
     * @param optimalWeights - Optimal weights from previous task(s)
     * @param fisherDiagonal - Fisher information diagonal
     * @returns EWC gradients per layer
     */
    computeGradients(currentWeights: Map<string, Float32Array>, optimalWeights: Map<string, Float32Array>, fisherDiagonal: Map<string, Float32Array>): EWCGradientResult;
    /**
     * Update Fisher information after completing a task
     *
     * Implements: TASK-GNN-008 AC-002
     *
     * Fisher information is approximated by the squared gradients:
     * F_i = E[(d(L)/d(theta_i))^2]
     *
     * For online EWC (when config.online = true):
     * F_new = gamma * F_old + (1 - gamma) * F_task
     *
     * @param existingFisher - Existing Fisher diagonal (from previous tasks)
     * @param taskGradients - Array of gradient samples from the completed task
     * @param numSamples - Number of samples used for gradient computation
     * @returns Updated Fisher diagonal
     */
    updateFisher(existingFisher: Map<string, Float32Array>, taskGradients: Map<string, Float32Array>[], numSamples: number): FisherUpdateResult;
    /**
     * Convert 2D weight matrix to 1D array for EWC operations
     *
     * @param weights - 2D weight matrix (array of rows)
     * @returns Flattened 1D array
     */
    static flattenWeights(weights: Float32Array[]): Float32Array;
    /**
     * Convert 1D array back to 2D weight matrix
     *
     * @param flat - Flattened 1D array
     * @param numRows - Number of rows in original matrix
     * @param numCols - Number of columns in original matrix
     * @returns 2D weight matrix
     */
    static unflattenWeights(flat: Float32Array, numRows: number, numCols: number): Float32Array[];
    /**
     * Save Fisher diagonal to disk
     *
     * Implements: TASK-GNN-008 AC-003
     *
     * @param fisher - Fisher diagonal to save
     * @param filename - Optional filename (default: fisher.json)
     */
    saveFisher(fisher: Map<string, Float32Array>, filename?: string): Promise<void>;
    /**
     * Load Fisher diagonal from disk
     *
     * Implements: TASK-GNN-008 AC-003
     *
     * @param filename - Optional filename (default: fisher.json)
     * @returns Loaded Fisher diagonal or null if not found
     */
    loadFisher(filename?: string): Promise<Map<string, Float32Array> | null>;
    /**
     * Compute Fisher information estimate from a single batch
     *
     * This is useful for computing Fisher incrementally during training.
     *
     * @param gradients - Gradients from a single batch
     * @returns Fisher estimate for this batch
     */
    computeBatchFisher(gradients: Map<string, Float32Array>): Map<string, Float32Array>;
    /**
     * Apply EWC-weighted update to weights
     *
     * This modifies the weight update to account for EWC:
     * theta_new = theta - lr * (g_task + g_ewc)
     *
     * Where g_ewc = lambda * F * (theta - theta*)
     *
     * @param weightUpdate - Original weight update (from task gradient)
     * @param currentWeights - Current weights
     * @param optimalWeights - Optimal weights from previous task
     * @param fisherDiagonal - Fisher information
     * @returns Combined weight update including EWC
     */
    applyEWCToUpdate(weightUpdate: Map<string, Float32Array>, currentWeights: Map<string, Float32Array>, optimalWeights: Map<string, Float32Array>, fisherDiagonal: Map<string, Float32Array>): Map<string, Float32Array>;
    /**
     * Get statistics about Fisher information
     *
     * @param fisher - Fisher diagonal
     * @returns Statistics about the Fisher distribution
     */
    getFisherStats(fisher: Map<string, Float32Array>): {
        totalParams: number;
        importantParams: number;
        meanFisher: number;
        maxFisher: number;
        minNonZeroFisher: number;
        layerStats: Map<string, {
            mean: number;
            max: number;
            important: number;
        }>;
    };
    /**
     * Reset EWC state (for testing or retraining from scratch)
     */
    reset(): void;
}
/**
 * Create an EWCRegularizer with default configuration
 *
 * @param config - Optional partial configuration
 * @returns EWCRegularizer instance
 */
export declare function createEWCRegularizer(config?: Partial<EWCConfig>): EWCRegularizer;
/**
 * Compute importance scores for each parameter
 *
 * Normalizes Fisher information to [0, 1] range for visualization/analysis.
 *
 * @param fisher - Fisher diagonal
 * @returns Normalized importance scores
 */
export declare function computeImportanceScores(fisher: Map<string, Float32Array>): Map<string, Float32Array>;
/**
 * Identify the most important parameters for visualization
 *
 * @param fisher - Fisher diagonal
 * @param topK - Number of top parameters to return
 * @returns Array of { layerId, index, fisher } for top-K parameters
 */
export declare function getTopImportantParams(fisher: Map<string, Float32Array>, topK?: number): Array<{
    layerId: string;
    index: number;
    fisher: number;
}>;
/**
 * Compute overlap between two Fisher distributions
 *
 * Useful for analyzing how similar the importance patterns are between tasks.
 *
 * @param fisher1 - First Fisher diagonal
 * @param fisher2 - Second Fisher diagonal
 * @param threshold - Threshold for considering a parameter important
 * @returns Overlap statistics
 */
export declare function computeFisherOverlap(fisher1: Map<string, Float32Array>, fisher2: Map<string, Float32Array>, threshold?: number): {
    overlapRatio: number;
    fisher1Only: number;
    fisher2Only: number;
    both: number;
};
//# sourceMappingURL=ewc-utils.d.ts.map