/**
 * God Agent Attention Module
 * TASK-ATT-001 - Attention Factory Auto-Selection
 *
 * Provides automatic attention mechanism selection:
 * - IDataProfile analysis
 * - 39+ attention mechanisms registry
 * - Rule-based selection engine
 * - DualSpace attention for mixed workloads
 *
 * Performance target: <1ms selection overhead
 */
export { AttentionFactory } from './attention-factory.js';
export { AttentionMechanismRegistry } from './attention-registry.js';
export { AttentionMechanismRegistry as AttentionRegistry } from './attention-registry.js';
export { AttentionSelector } from './attention-selector.js';
export { DualSpaceAttention } from './dual-space-attention.js';
export { RealStandardAttention } from './mechanisms/standard-attention.js';
export { BasePlaceholderAttention, BasePlaceholderAttention as BaseMockAttention, // Alias for backwards compatibility
FlashAttention, LinearAttention, PerformerAttention, LinformerAttention, ReformerAttention, HyperbolicAttention, GraphRoPeAttention, BigBirdAttention, LongformerAttention, SparseTransformerAttention, MemoryCompressedAttention, RoutingTransformerAttention, ClusteredAttention, SetTransformerAttention, RetentiveAttention, DifferentialAttention, HyenaAttention, MambaAttention, RWKVAttention, StandardAttention, CrossAttention, LocalAttention, GlobalAttention, AxialAttention, BlockSparseAttention, StridedAttention, DilatedAttention, SlidingWindowAttention, CausalAttention, BidirectionalAttention, MultiQueryAttention, GroupedQueryAttention, MultiHeadLatentAttention, SynthesizerAttention, LunaAttention, NystromformerAttention, FNetAttention, AFTAttention, MegaAttention, MECHANISM_CONSTRUCTORS, } from './attention-mechanisms.js';
export { ComplexityClass, DEFAULT_SELECTION_THRESHOLDS, DEFAULT_ATTENTION_CONFIG, AttentionError, createDefaultDataProfile, hashDataProfile, } from './attention-types.js';
export type { IDataProfile, IAttentionCapabilities, IPerformanceProfile, IAttentionMechanism, AttentionMechanismFactory, IAttentionMechanismDescriptor, ISelectionResult, ISelectionThresholds, IAttentionConfig, IAttentionConfig as AttentionConfig, // Alias for compatibility
ISelectionMetrics, } from './attention-types.js';
//# sourceMappingURL=index.d.ts.map