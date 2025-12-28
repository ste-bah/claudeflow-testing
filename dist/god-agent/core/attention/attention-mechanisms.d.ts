/**
 * Placeholder Attention Mechanisms
 * TASK-ATT-001 - Attention Factory Auto-Selection
 *
 * Provides placeholder implementations of attention mechanisms.
 * These are PRODUCTION code that return simplified outputs.
 *
 * FUTURE WORK: Replace each placeholder with real neural network implementations.
 * See: docs/god-agent-specs/anti-pattern-fixes/SPEC-ANTI-009-PLACEHOLDER-NEURAL-NETWORKS.md
 *
 * Currently implemented (real):
 * - RealStandardAttention (mechanisms/standard-attention.ts) - Standard O(N²) attention
 * - RealLinearAttention (mechanisms/linear-attention.ts) - O(N) complexity
 * - RealFlashAttention (mechanisms/flash-attention.ts) - IO-aware tiling
 * - RealMultiQueryAttention (mechanisms/multi-query-attention.ts) - Single shared K,V head
 * - RealGroupedQueryAttention (mechanisms/grouped-query-attention.ts) - Grouped K,V heads
 *
 * Placeholder implementations (this file):
 * - 33 remaining mechanisms use simplified weighted averaging
 *
 * ANTI-009: As real implementations are created, they should replace placeholders
 * in MECHANISM_CONSTRUCTORS below. No backwards compatibility - clean breaks only.
 */
import type { IAttentionMechanism } from './attention-types.js';
/**
 * Base class for placeholder attention mechanisms.
 *
 * PRODUCTION CODE: These placeholders are used when real implementations
 * are not yet available. They provide simplified weighted averaging.
 *
 * To implement a real mechanism:
 * 1. Create new file in mechanisms/ directory
 * 2. Implement IAttentionMechanism with actual neural network logic
 * 3. Register in MECHANISM_CONSTRUCTORS (replacing placeholder)
 * 4. See RealStandardAttention for reference implementation
 */
export declare abstract class BasePlaceholderAttention implements IAttentionMechanism {
    abstract readonly name: string;
    protected readonly dimension: number;
    protected readonly numHeads: number;
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
    });
    /**
     * Placeholder forward pass - returns simplified weighted combination.
     * Real implementations should compute actual attention scores.
     */
    forward(query: Float32Array, _key: Float32Array, value: Float32Array, _mask?: boolean[]): Float32Array;
    /**
     * Get parameter count
     */
    getParameterCount(): number;
}
/**
 * Flash Attention - IO-aware exact attention
 * PLACEHOLDER: Real implementation requires CUDA/GPU memory tiling
 */
export declare class FlashAttention extends BasePlaceholderAttention {
    readonly name = "flash";
}
/**
 * Linear Attention - O(N) complexity via kernel approximation
 * PLACEHOLDER: Real implementation requires kernel feature maps
 */
export declare class LinearAttention extends BasePlaceholderAttention {
    readonly name = "linear";
}
/**
 * Performer - FAVOR+ kernel method
 */
export declare class PerformerAttention extends BasePlaceholderAttention {
    readonly name = "performer";
}
/**
 * Linformer - Low-rank self-attention
 */
export declare class LinformerAttention extends BasePlaceholderAttention {
    readonly name = "linformer";
}
/**
 * Reformer - Locality-sensitive hashing
 */
export declare class ReformerAttention extends BasePlaceholderAttention {
    readonly name = "reformer";
}
/**
 * Hyperbolic Attention - For hierarchical data
 */
export declare class HyperbolicAttention extends BasePlaceholderAttention {
    readonly name = "hyperbolic";
}
/**
 * GraphRoPe - Rotary position embeddings for graphs
 */
export declare class GraphRoPeAttention extends BasePlaceholderAttention {
    readonly name = "graph-rope";
}
/**
 * BigBird - Sparse attention with random, window, and global tokens
 */
export declare class BigBirdAttention extends BasePlaceholderAttention {
    readonly name = "bigbird";
}
/**
 * Longformer - Sliding window + global attention
 */
export declare class LongformerAttention extends BasePlaceholderAttention {
    readonly name = "longformer";
}
/**
 * Sparse Transformer - Fixed sparse patterns
 */
export declare class SparseTransformerAttention extends BasePlaceholderAttention {
    readonly name = "sparse-transformer";
}
/**
 * Memory Compressed Attention
 */
export declare class MemoryCompressedAttention extends BasePlaceholderAttention {
    readonly name = "memory-compressed";
}
/**
 * Routing Transformer - Content-based routing
 */
export declare class RoutingTransformerAttention extends BasePlaceholderAttention {
    readonly name = "routing-transformer";
}
/**
 * Clustered Attention - Cluster-based approximation
 */
export declare class ClusteredAttention extends BasePlaceholderAttention {
    readonly name = "clustered";
}
/**
 * Set Transformer - Attention for sets
 */
export declare class SetTransformerAttention extends BasePlaceholderAttention {
    readonly name = "set-transformer";
}
/**
 * Retentive Network - Retention-based attention
 */
export declare class RetentiveAttention extends BasePlaceholderAttention {
    readonly name = "retentive";
}
/**
 * Differential Transformer - Differential attention
 */
export declare class DifferentialAttention extends BasePlaceholderAttention {
    readonly name = "differential";
}
/**
 * Hyena - Subquadratic via implicit convolutions
 */
export declare class HyenaAttention extends BasePlaceholderAttention {
    readonly name = "hyena";
}
/**
 * Mamba - State space models
 */
export declare class MambaAttention extends BasePlaceholderAttention {
    readonly name = "mamba";
}
/**
 * RWKV - Receptance Weighted Key Value
 */
export declare class RWKVAttention extends BasePlaceholderAttention {
    readonly name = "rwkv";
}
/**
 * Standard Multi-Head Attention
 */
export declare class StandardAttention extends BasePlaceholderAttention {
    readonly name = "standard";
}
/**
 * Cross Attention - For encoder-decoder
 */
export declare class CrossAttention extends BasePlaceholderAttention {
    readonly name = "cross";
}
/**
 * Local Attention - Window-based
 */
export declare class LocalAttention extends BasePlaceholderAttention {
    readonly name = "local";
}
/**
 * Global Attention - Selected global tokens
 */
export declare class GlobalAttention extends BasePlaceholderAttention {
    readonly name = "global";
}
/**
 * Axial Attention - Factored attention
 */
export declare class AxialAttention extends BasePlaceholderAttention {
    readonly name = "axial";
}
/**
 * Block Sparse Attention
 */
export declare class BlockSparseAttention extends BasePlaceholderAttention {
    readonly name = "block-sparse";
}
/**
 * Strided Attention
 */
export declare class StridedAttention extends BasePlaceholderAttention {
    readonly name = "strided";
}
/**
 * Dilated Attention
 */
export declare class DilatedAttention extends BasePlaceholderAttention {
    readonly name = "dilated";
}
/**
 * Sliding Window Attention
 */
export declare class SlidingWindowAttention extends BasePlaceholderAttention {
    readonly name = "sliding-window";
}
/**
 * Causal Attention - Left-to-right only
 */
export declare class CausalAttention extends BasePlaceholderAttention {
    readonly name = "causal";
}
/**
 * Bidirectional Attention
 */
export declare class BidirectionalAttention extends BasePlaceholderAttention {
    readonly name = "bidirectional";
}
/**
 * Multi-Query Attention - Shared KV heads
 */
export declare class MultiQueryAttention extends BasePlaceholderAttention {
    readonly name = "multi-query";
}
/**
 * Grouped Query Attention - Grouped KV heads
 */
export declare class GroupedQueryAttention extends BasePlaceholderAttention {
    readonly name = "grouped-query";
}
/**
 * Multi-Head Latent Attention
 */
export declare class MultiHeadLatentAttention extends BasePlaceholderAttention {
    readonly name = "multi-head-latent";
}
/**
 * Synthesizer - Random feature attention
 */
export declare class SynthesizerAttention extends BasePlaceholderAttention {
    readonly name = "synthesizer";
}
/**
 * Luna - Linear Unified Nested Attention
 */
export declare class LunaAttention extends BasePlaceholderAttention {
    readonly name = "luna";
}
/**
 * Nyströmformer - Nyström approximation
 */
export declare class NystromformerAttention extends BasePlaceholderAttention {
    readonly name = "nystromformer";
}
/**
 * FNet - Fourier attention
 */
export declare class FNetAttention extends BasePlaceholderAttention {
    readonly name = "fnet";
}
/**
 * AFT - Attention Free Transformer
 */
export declare class AFTAttention extends BasePlaceholderAttention {
    readonly name = "aft";
}
/**
 * Mega - Moving Average Equipped Gated Attention
 */
export declare class MegaAttention extends BasePlaceholderAttention {
    readonly name = "mega";
}
/**
 * Map of mechanism names to their constructors
 */
export declare const MECHANISM_CONSTRUCTORS: Record<string, new (config?: Record<string, unknown>) => IAttentionMechanism>;
//# sourceMappingURL=attention-mechanisms.d.ts.map