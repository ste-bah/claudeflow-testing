/**
 * Contrastive Quality Loss for Trajectory Learning
 *
 * Implements margin ranking loss to guide the embedding space based on
 * user quality scores. High-quality trajectories are pulled closer to queries,
 * low-quality trajectories are pushed further away.
 *
 * Loss Function:
 * L = max(0, d(Q, T_pos) - d(Q, T_neg) + margin)
 *
 * Where:
 * - Q = Query embedding
 * - T_pos = High-quality trajectory (quality >= 0.7 per RULE-035)
 * - T_neg = Low-quality trajectory (quality < 0.5 per RULE-035)
 * - d = Euclidean distance
 * - margin = Configurable (default 0.5)
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-GNN-007
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-033: Quality assessed on result, not prompt
 * - RULE-035: Thresholds 0.7 (positive), 0.5 (negative)
 * - RULE-079: No magic numbers (uses CONSTITUTION constants)
 *
 * @module src/god-agent/core/reasoning/contrastive-loss
 */
import type { TrajectoryRecord, ILearningFeedback } from './reasoning-types.js';
/**
 * Quality threshold for positive samples (high quality)
 * Per CONSTITUTION RULE-035: pattern threshold = 0.7
 */
export declare const POSITIVE_QUALITY_THRESHOLD = 0.7;
/**
 * Quality threshold for negative samples (low quality)
 * Per CONSTITUTION RULE-035: feedback threshold = 0.5
 */
export declare const NEGATIVE_QUALITY_THRESHOLD = 0.5;
/**
 * Default margin for margin ranking loss
 * @rationale Empirically tuned for embedding space separation
 */
export declare const DEFAULT_MARGIN = 0.5;
/**
 * Configuration for ContrastiveLoss
 * Implements: TASK-GNN-007 specification
 */
export interface ContrastiveLossConfig {
    /** Margin for ranking loss (default: 0.5) */
    margin: number;
    /** Quality threshold for positive samples (default: 0.7 per RULE-035) */
    positiveThreshold: number;
    /** Quality threshold for negative samples (default: 0.5 per RULE-035) */
    negativeThreshold: number;
    /** Maximum gradient norm for clipping (default: 1.0) */
    maxGradientNorm: number;
    /** Epsilon for numerical stability (default: 1e-8) */
    epsilon: number;
}
/**
 * A triplet of query, positive, and negative embeddings
 * Used for contrastive learning
 */
export interface TrajectoryPair {
    /** Query embedding (1536D) */
    query: Float32Array;
    /** High-quality trajectory embedding (quality >= 0.7) */
    positive: Float32Array;
    /** Low-quality trajectory embedding (quality < 0.5) */
    negative: Float32Array;
    /** Quality score of positive trajectory [0, 1] */
    positiveQuality: number;
    /** Quality score of negative trajectory [0, 1] */
    negativeQuality: number;
}
/**
 * Gradient information for a single triplet
 */
export interface TripletGradient {
    /** Gradient with respect to query embedding */
    dQuery: Float32Array;
    /** Gradient with respect to positive embedding */
    dPositive: Float32Array;
    /** Gradient with respect to negative embedding */
    dNegative: Float32Array;
    /** Loss value for this triplet */
    loss: number;
    /** Whether the triplet contributed to the loss (loss > 0) */
    active: boolean;
}
/**
 * Batch of gradients from multiple triplets
 */
export interface GradientBatch {
    /** Accumulated gradient for query embeddings */
    dQuery: Float32Array;
    /** Accumulated gradient for positive embeddings */
    dPositive: Float32Array;
    /** Accumulated gradient for negative embeddings */
    dNegative: Float32Array;
    /** Total loss over the batch */
    totalLoss: number;
    /** Number of active triplets (loss > 0) */
    activeCount: number;
    /** Number of triplets in the batch */
    batchSize: number;
    /** Individual triplet gradients (for detailed analysis) */
    tripletGradients: TripletGradient[];
}
/**
 * Interface for trajectory with quality feedback
 * Adapts TrajectoryRecord for contrastive learning
 */
export interface ITrajectoryWithFeedback {
    /** Unique trajectory ID */
    id: string;
    /** Trajectory embedding (base or enhanced) */
    embedding: Float32Array;
    /** Enhanced embedding if available */
    enhancedEmbedding?: Float32Array;
    /** Quality score from feedback [0, 1] */
    quality: number;
    /** Original feedback data */
    feedback?: ILearningFeedback;
}
/**
 * ContrastiveLoss - Margin Ranking Loss for Quality-Guided Embeddings
 *
 * This class implements contrastive learning to shape the embedding space
 * based on user quality feedback. The goal is to:
 * 1. Pull high-quality trajectories closer to similar queries
 * 2. Push low-quality trajectories further from similar queries
 *
 * The loss function is:
 * L = max(0, d(Q, T_pos) - d(Q, T_neg) + margin)
 *
 * Where d is Euclidean distance. When the loss is positive (i.e., the
 * negative sample is too close or the positive sample is too far), gradients
 * are computed to correct this.
 *
 * Implements: TASK-GNN-007
 * Constitution: RULE-033, RULE-035
 */
export declare class ContrastiveLoss {
    private readonly config;
    /**
     * Create a new ContrastiveLoss instance
     *
     * @param config - Partial configuration (defaults applied)
     */
    constructor(config?: Partial<ContrastiveLossConfig>);
    /**
     * Get current configuration
     */
    getConfig(): Readonly<ContrastiveLossConfig>;
    /**
     * Compute the total contrastive loss over a batch of triplets
     *
     * Loss formula: L = (1/N) * sum_i max(0, d(Q_i, P_i) - d(Q_i, N_i) + margin)
     *
     * @param pairs - Array of trajectory triplets
     * @returns Average loss over the batch
     */
    compute(pairs: TrajectoryPair[]): number;
    /**
     * Compute gradients for all triplets in the batch (backward pass)
     *
     * The gradient flow for margin ranking loss is:
     * - If loss > 0 (triplet is active):
     *   - dL/d(query) = (query - positive)/d_pos - (query - negative)/d_neg
     *   - dL/d(positive) = -(query - positive)/d_pos
     *   - dL/d(negative) = (query - negative)/d_neg
     * - If loss <= 0 (margin satisfied):
     *   - All gradients are zero
     *
     * Mathematical derivation:
     * L = max(0, ||Q - P|| - ||Q - N|| + m)
     *
     * For d = ||x - y|| = sqrt(sum((x_i - y_i)^2)):
     * dd/dx_i = (x_i - y_i) / ||x - y||
     *
     * @param pairs - Array of trajectory triplets
     * @returns GradientBatch with accumulated gradients and per-triplet details
     */
    backward(pairs: TrajectoryPair[]): GradientBatch;
    /**
     * Create trajectory pairs from a collection of trajectories and a query
     *
     * This is a static factory method that:
     * 1. Separates trajectories into positive (quality >= 0.7) and negative (quality < 0.5)
     * 2. Creates all valid pairs of (query, positive, negative)
     *
     * Per CONSTITUTION RULE-035:
     * - Positive threshold: 0.7
     * - Negative threshold: 0.5
     *
     * @param trajectories - Array of trajectories with quality feedback
     * @param queryEmbedding - Query embedding to compare against
     * @param config - Optional configuration for thresholds
     * @returns Array of trajectory pairs for contrastive learning
     */
    static createPairs(trajectories: ITrajectoryWithFeedback[], queryEmbedding: Float32Array, config?: Partial<ContrastiveLossConfig>): TrajectoryPair[];
    /**
     * Create pairs from TrajectoryRecord objects (adapts the interface)
     *
     * @param records - Array of trajectory records with feedback
     * @param queryEmbedding - Query embedding
     * @param config - Optional configuration
     * @returns Array of trajectory pairs
     */
    static createPairsFromRecords(records: TrajectoryRecord[], queryEmbedding: Float32Array, config?: Partial<ContrastiveLossConfig>): TrajectoryPair[];
    /**
     * Compute gradient for a single triplet
     *
     * @param pair - The trajectory triplet
     * @returns TripletGradient with gradients and loss
     */
    private computeTripletGradient;
    /**
     * Compute Euclidean distance between two embeddings
     *
     * @param a - First embedding
     * @param b - Second embedding
     * @returns Euclidean distance
     */
    private euclideanDistance;
    /**
     * Validate a trajectory pair
     *
     * @param pair - The pair to validate
     * @returns true if valid
     */
    private validatePair;
}
/**
 * Compute hard negative mining scores
 *
 * Hard negatives are low-quality trajectories that are close to the query.
 * These provide the most informative gradients for learning.
 *
 * @param query - Query embedding
 * @param negatives - Array of negative trajectory embeddings with quality
 * @param topK - Number of hard negatives to return
 * @returns Array of (index, distance) pairs sorted by distance (ascending)
 */
export declare function mineHardNegatives(query: Float32Array, negatives: Array<{
    embedding: Float32Array;
    quality: number;
}>, topK?: number): Array<{
    index: number;
    distance: number;
    quality: number;
}>;
/**
 * Compute hard positive mining scores
 *
 * Hard positives are high-quality trajectories that are far from the query.
 * These help expand the positive region of the embedding space.
 *
 * @param query - Query embedding
 * @param positives - Array of positive trajectory embeddings with quality
 * @param topK - Number of hard positives to return
 * @returns Array of (index, distance) pairs sorted by distance (descending)
 */
export declare function mineHardPositives(query: Float32Array, positives: Array<{
    embedding: Float32Array;
    quality: number;
}>, topK?: number): Array<{
    index: number;
    distance: number;
    quality: number;
}>;
/**
 * Create hard triplets using semi-hard mining strategy
 *
 * Semi-hard triplets satisfy: d(q, p) < d(q, n) < d(q, p) + margin
 * These provide stable gradients without being too easy or too hard.
 *
 * @param query - Query embedding
 * @param positives - Array of positive trajectories
 * @param negatives - Array of negative trajectories
 * @param margin - Margin for semi-hard selection
 * @returns Array of trajectory pairs that satisfy semi-hard criterion
 */
export declare function createSemiHardTriplets(query: Float32Array, positives: ITrajectoryWithFeedback[], negatives: ITrajectoryWithFeedback[], margin?: number): TrajectoryPair[];
//# sourceMappingURL=contrastive-loss.d.ts.map