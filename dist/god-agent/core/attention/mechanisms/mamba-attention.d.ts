/**
 * Real Mamba Attention Implementation (Selective State Space Model)
 *
 * Reference: Gu & Dao 2023 "Mamba: Linear-Time Sequence Modeling with Selective State Spaces"
 * https://arxiv.org/abs/2312.00752
 *
 * Key insight: Instead of attention, use a State Space Model (SSM) with
 * data-dependent (selective) parameters. This achieves O(N) complexity
 * while maintaining the ability to model long-range dependencies.
 *
 * The selective mechanism makes Δ, B, C input-dependent:
 * - Δ (discretization step): Controls how much to remember/forget
 * - B (input projection): Controls what to write to state
 * - C (output projection): Controls what to read from state
 *
 * State equation: h_t = Ā · h_{t-1} + B̄ · x_t
 * Output: y_t = C · h_t
 *
 * Complexity: O(N) time and space
 * Parameter Count: Specialized SSM parameters
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Mamba Attention Implementation
 *
 * Implements a Selective State Space Model as an attention alternative.
 * Provides O(N) complexity with content-aware processing.
 *
 * @example
 * ```typescript
 * // Create Mamba attention
 * const attention = new RealMambaAttention({
 *   dimension: 768,
 *   stateSize: 16,   // SSM state dimension
 *   seed: 42
 * });
 *
 * // Process sequence
 * const seqLen = 4096;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealMambaAttention implements IAttentionMechanism {
    readonly name = "mamba";
    private readonly dimension;
    private readonly stateSize;
    private readonly expandFactor;
    private readonly wIn;
    private readonly wDelta;
    private readonly wB;
    private readonly wC;
    private readonly wOut;
    private readonly A;
    private readonly rng?;
    /**
     * Initialize Mamba attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: VECTOR_DIM=1536)
     * @param config.stateSize SSM state dimension (default: 16)
     * @param config.expandFactor Inner dimension expansion (default: 2)
     * @param config.seed Random seed for initialization (optional)
     *
     * @throws Error if stateSize < 1
     */
    constructor(config?: {
        dimension?: number;
        stateSize?: number;
        expandFactor?: number;
        seed?: number;
    });
    /**
     * Selective scan operation (core Mamba algorithm)
     *
     * For each time step:
     * 1. Compute selective Δ, B, C from input
     * 2. Discretize: Ā = exp(Δ · A), B̄ = Δ · B
     * 3. Update state: h = Ā · h + B̄ · x
     * 4. Output: y = C · h
     */
    private selectiveScan;
    /**
     * Forward pass: Mamba selective SSM
     *
     * Algorithm:
     * 1. Project input to get x, Δ, B, C
     * 2. Run selective scan (SSM recurrence)
     * 3. Project output back to model dimension
     *
     * Note: In Mamba, query/key/value distinction doesn't apply.
     * We use query as the input; key/value are ignored (compatibility).
     *
     * @param query Input vectors [seq_len × dimension] (main input)
     * @param _key Ignored (for interface compatibility)
     * @param _value Ignored (for interface compatibility)
     * @param _mask Ignored (Mamba is naturally causal)
     * @param seqLen Sequence length (optional)
     * @returns Output vectors [seq_len × dimension]
     */
    forward(query: Float32Array, _key: Float32Array, _value: Float32Array, _mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Project input through weight matrix
     */
    private projectInput;
    /**
     * Project output back to model dimension
     */
    private projectOutput;
    /**
     * Get total parameter count
     *
     * Mamba parameters:
     * - wIn: dim × expandDim
     * - wDelta: dim × expandDim
     * - wB: dim × stateSize
     * - wC: dim × stateSize
     * - wOut: expandDim × dim
     * - A: stateSize (not learned, but counted)
     */
    getParameterCount(): number;
}
//# sourceMappingURL=mamba-attention.d.ts.map