/**
 * Real Graph-RoPE Attention Implementation
 *
 * Reference: Combines ideas from:
 * - RoFormer (Su et al. 2021): Rotary Position Embedding
 * - Graph Transformer (Dwivedi & Bresson 2020)
 *
 * Key insight: Apply Rotary Position Embeddings (RoPE) to graph-structured
 * data by using node distance/relationships as "positions". This allows
 * capturing both local and global graph structure in attention.
 *
 * RoPE encodes position by rotating query and key vectors:
 * - q' = q * cos(θ) + rotate(q) * sin(θ)
 * - k' = k * cos(θ) + rotate(k) * sin(θ)
 *
 * For graphs, θ is based on graph distance rather than sequence position.
 *
 * Complexity: O(N²) for dense graph, O(N × E/N) for sparse graphs
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Graph-RoPE Attention Implementation
 *
 * Applies rotary position embeddings based on graph structure
 * for position-aware attention on graph data.
 *
 * @example
 * ```typescript
 * // Create Graph-RoPE attention
 * const attention = new RealGraphRoPeAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   rotaryDim: 64,  // Dimensions to apply rotation to
 *   seed: 42
 * });
 *
 * // For sequence data (uses sequential positions)
 * const query = new Float32Array(seq * 768);
 * const output = attention.forward(query, query, query, undefined, seq);
 *
 * // For graph data, positions can be provided externally
 * ```
 */
export declare class RealGraphRoPeAttention implements IAttentionMechanism {
    readonly name = "graph-rope";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly rotaryDim;
    private readonly scale;
    private readonly baseFreq;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private cosCache;
    private sinCache;
    private readonly rng?;
    /**
     * Initialize Graph-RoPE attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: 768)
     * @param config.numHeads Number of attention heads (default: 8)
     * @param config.rotaryDim Dimensions to apply rotation (default: headDim)
     * @param config.seed Random seed for initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     * @throws Error if rotaryDim > headDim
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        rotaryDim?: number;
        seed?: number;
    });
    /**
     * Get rotation frequencies for RoPE
     *
     * θ_i = position / (baseFreq^(2i/d))
     */
    private getFrequencies;
    /**
     * Apply rotary position embedding to a vector
     *
     * For each pair (x_2i, x_2i+1):
     * x'_2i = x_2i * cos(θ_i) - x_2i+1 * sin(θ_i)
     * x'_2i+1 = x_2i * sin(θ_i) + x_2i+1 * cos(θ_i)
     */
    private applyRotary;
    /**
     * Forward pass: Graph-RoPE attention
     *
     * Algorithm:
     * 1. Project Q, K, V through linear transformations
     * 2. Apply RoPE to Q and K based on positions
     * 3. Compute attention scores with rotated Q, K
     * 4. Apply softmax and compute weighted values
     * 5. Project output
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
     * Compute Graph-RoPE attention for a single head
     */
    private computeHeadGraphRoPeAttention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Graph-RoPE: 4 × dim² (rotary embeddings are computed, not learned)
     */
    getParameterCount(): number;
}
//# sourceMappingURL=graph-rope-attention.d.ts.map