/**
 * Real FlashAttention Implementation with IO-Aware Tiling
 *
 * Reference: Dao et al. 2022 "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness"
 *
 * Key innovations:
 * - Tiled computation for memory efficiency (fits in SRAM)
 * - Online softmax for numerical stability
 * - Reduced HBM (High Bandwidth Memory) I/O from O(N²) to O(N)
 * - Exact attention (NOT approximate)
 *
 * Algorithm:
 * 1. Divide Q, K, V into blocks that fit in fast memory
 * 2. For each Q block: iterate over K, V blocks
 * 3. Compute block-wise attention with online softmax
 * 4. Track running max and sum for stability
 * 5. Output projection
 *
 * Complexity: O(N² × d) time, O(N × d) memory (vs O(N²) for standard)
 * Parameter Count: 4 × dim²
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real FlashAttention Implementation
 *
 * Implements IO-aware tiling for memory-efficient exact attention.
 * Reduces HBM I/O while computing identical results to standard attention.
 *
 * @example
 * ```typescript
 * // Create FlashAttention mechanism
 * const attention = new RealFlashAttention({
 *   dimension: 768,
 *   numHeads: 12,
 *   blockSize: 64,  // Tile size for SRAM (configurable)
 *   seed: 42        // Optional: deterministic init for testing
 * });
 *
 * // Single vector attention
 * const query = new Float32Array(768);
 * const output = attention.forward(query, query, query);
 *
 * // Multi-sequence attention
 * const seqLen = 1024;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 *
 * // With causal mask
 * import { createCausalMask } from '../utils/index.js';
 * const mask = createCausalMask(seqLen);
 * const output = attention.forward(query, query, query, mask, seqLen);
 * ```
 */
export declare class RealFlashAttention implements IAttentionMechanism {
    readonly name = "flash";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly scale;
    private readonly blockSize;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly rng?;
    /**
     * Initialize FlashAttention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: VECTOR_DIM=1536)
     * @param config.numHeads Number of attention heads (default: 12)
     * @param config.blockSize Tile size for SRAM (default: 64, must divide dimension)
     * @param config.seed Random seed for deterministic initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads or blockSize
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        blockSize?: number;
        seed?: number;
    });
    /**
     * Forward pass: FlashAttention with IO-aware tiling
     *
     * Computes: MultiHead(Q, K, V) = Concat(head₁, ..., headₕ) W^O
     * using tiled computation to minimize HBM I/O.
     *
     * @param query Query vectors [seq_len × dimension] (flattened)
     * @param key Key vectors [seq_len × dimension] (flattened)
     * @param value Value vectors [seq_len × dimension] (flattened)
     * @param mask Attention mask [seq_len × seq_len] (flattened row-major, optional)
     *             Semantics: true=attend, false=mask out (PyTorch convention)
     * @param seqLen Sequence length (optional, inferred from query.length if undefined)
     * @returns Output vectors [seq_len × dimension] (flattened)
     *
     * @throws Error if dimensions incompatible or contain NaN
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute FlashAttention for a single head using IO-aware tiling
     *
     * Algorithm (simplified for TypeScript):
     * 1. Divide Q, K, V into blocks
     * 2. For each Q block Qᵢ:
     *    a. Initialize output Oᵢ = 0, running stats (m, l)
     *    b. For each K, V block (Kⱼ, Vⱼ):
     *       - Compute block scores: Sᵢⱼ = Qᵢ Kⱼᵀ / √d
     *       - Apply mask to Sᵢⱼ
     *       - Update running max: m_new = max(m_old, rowmax(Sᵢⱼ))
     *       - Compute exp with correction: exp(Sᵢⱼ - m_new)
     *       - Update running sum: l_new = l_old * exp(m_old - m_new) + rowsum(exp)
     *       - Update output: Oᵢ = (Oᵢ * l_old * exp(m_old - m_new) + exp(Sᵢⱼ - m_new) Vⱼ) / l_new
     * 3. Return O
     *
     * @param Q Projected query [seq_len × dimension]
     * @param K Projected key [seq_len × dimension]
     * @param V Projected value [seq_len × dimension]
     * @param head Head index
     * @param seqLen Sequence length
     * @param mask Optional attention mask
     * @returns Head output [seq_len × headDim]
     */
    private computeFlashHeadAttention;
    /**
     * Concatenate multiple head outputs
     *
     * Transforms: [head₁[seq×d_k], head₂[seq×d_k], ...] → [seq×dim]
     *
     * @param headOutputs Array of head outputs
     * @param seqLen Sequence length
     * @returns Concatenated output [seq_len × dimension]
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Parameters: 4 weight matrices (Wq, Wk, Wv, Wo) each of size [dim × dim]
     * Same as standard attention (FlashAttention is optimization, not architectural change)
     *
     * @returns Parameter count = 4 × dim²
     *
     * @example
     * ```typescript
     * const attention = new RealFlashAttention({ dimension: 768 });
     * console.log(attention.getParameterCount()); // 2,359,296
     * ```
     */
    getParameterCount(): number;
}
//# sourceMappingURL=flash-attention.d.ts.map