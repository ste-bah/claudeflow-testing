/**
 * Real Hyena Attention Implementation
 *
 * Reference: Poli et al. 2023 "Hyena Hierarchy: Towards Larger Convolutional Language Models"
 * https://arxiv.org/abs/2302.10866
 *
 * Key insight: Replace attention with a subquadratic O(N log N) mechanism
 * using implicit long convolutions parameterized by neural networks.
 *
 * Hyena Operator:
 *   y = (v ⊙ h₁) * (x * h₂) * ... * (x * hₙ)
 *
 * Where:
 * - v is a learned projection
 * - hᵢ are implicitly parameterized long convolution filters
 * - * denotes convolution, ⊙ denotes element-wise multiplication
 *
 * Key innovations:
 * - Long convolutions with O(N log N) FFT computation
 * - Implicit filter parameterization via small neural network
 * - Gating mechanism with element-wise products
 *
 * Complexity: O(N log N) due to FFT-based convolution
 * Parameter Count: 4 × dim² + filter parameters
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Hyena Attention Implementation
 *
 * Implements subquadratic attention via implicit long convolutions
 * for efficient sequence modeling.
 *
 * @example
 * ```typescript
 * // Create Hyena attention
 * const attention = new RealHyenaAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   order: 2,  // Hyena recursion depth
 *   seed: 42
 * });
 *
 * // Process sequence efficiently
 * const seqLen = 8192;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealHyenaAttention implements IAttentionMechanism {
    readonly name = "hyena";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly order;
    private readonly filterSize;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly shortFilter;
    private readonly filterMLP1;
    private readonly filterMLP2;
    private readonly decayRates;
    private readonly rng?;
    /**
     * Initialize Hyena attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: 768)
     * @param config.numHeads Number of attention heads (default: 8)
     * @param config.order Hyena recursion depth (default: 2)
     * @param config.filterSize Internal filter MLP size (default: 64)
     * @param config.seed Random seed for initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        order?: number;
        filterSize?: number;
        seed?: number;
    });
    /**
     * Generate implicit long convolution filter
     *
     * Uses small MLP to parameterize filter based on position
     */
    private generateFilter;
    /**
     * Apply short convolution (causal)
     */
    private shortConv;
    /**
     * Apply long convolution using implicit filters
     */
    private longConv;
    /**
     * Forward pass: Hyena attention
     *
     * Algorithm (order=2):
     * 1. Project inputs through linear layers
     * 2. Apply short convolution
     * 3. Recursively apply: z = (x ⊙ h) * z
     * 4. Project output
     *
     * @param query Query vectors [seq_len × dimension]
     * @param key Key vectors [seq_len × dimension]
     * @param value Value vectors [seq_len × dimension]
     * @param mask Optional attention mask
     * @param seqLen Sequence length (optional)
     * @returns Output vectors [seq_len × dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute Hyena operator for a single head
     *
     * Hyena(v, x) = (v ⊙ h₁(x)) * h₂(x) for order=2
     */
    private computeHeadHyena;
    /**
     * Sigmoid activation
     */
    private sigmoid;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Hyena: 4 × dim² + short filter + filter MLP
     */
    getParameterCount(): number;
}
//# sourceMappingURL=hyena-attention.d.ts.map