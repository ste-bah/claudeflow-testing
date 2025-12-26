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

// ===== ATTENTION FACTORY =====

export { AttentionFactory } from './attention-factory.js';

// ===== REGISTRY & SELECTOR =====

export { AttentionMechanismRegistry } from './attention-registry.js';
export { AttentionMechanismRegistry as AttentionRegistry } from './attention-registry.js'; // Alias
export { AttentionSelector } from './attention-selector.js';

// ===== DUALSPACE ATTENTION =====

export { DualSpaceAttention } from './dual-space-attention.js';

// ===== REAL IMPLEMENTATIONS =====
// See: docs/god-agent-specs/anti-pattern-fixes/SPEC-ANTI-009-PLACEHOLDER-NEURAL-NETWORKS.md

export { RealStandardAttention } from './mechanisms/standard-attention.js';

// ===== PLACEHOLDER MECHANISMS =====
// Note: These are production placeholders, NOT test mocks
// ANTI-009: Replace with real implementations as they are developed

export {
  BasePlaceholderAttention,
  BasePlaceholderAttention as BaseMockAttention, // Alias for backwards compatibility
  FlashAttention,
  LinearAttention,
  PerformerAttention,
  LinformerAttention,
  ReformerAttention,
  HyperbolicAttention,
  GraphRoPeAttention,
  BigBirdAttention,
  LongformerAttention,
  SparseTransformerAttention,
  MemoryCompressedAttention,
  RoutingTransformerAttention,
  ClusteredAttention,
  SetTransformerAttention,
  RetentiveAttention,
  DifferentialAttention,
  HyenaAttention,
  MambaAttention,
  RWKVAttention,
  StandardAttention,
  CrossAttention,
  LocalAttention,
  GlobalAttention,
  AxialAttention,
  BlockSparseAttention,
  StridedAttention,
  DilatedAttention,
  SlidingWindowAttention,
  CausalAttention,
  BidirectionalAttention,
  MultiQueryAttention,
  GroupedQueryAttention,
  MultiHeadLatentAttention,
  SynthesizerAttention,
  LunaAttention,
  NystromformerAttention,
  FNetAttention,
  AFTAttention,
  MegaAttention,
  MECHANISM_CONSTRUCTORS,
} from './attention-mechanisms.js';

// ===== TYPE DEFINITIONS =====

export {
  ComplexityClass,
  DEFAULT_SELECTION_THRESHOLDS,
  DEFAULT_ATTENTION_CONFIG,
  AttentionError,
  createDefaultDataProfile,
  hashDataProfile,
} from './attention-types.js';

export type {
  IDataProfile,
  IAttentionCapabilities,
  IPerformanceProfile,
  IAttentionMechanism,
  AttentionMechanismFactory,
  IAttentionMechanismDescriptor,
  ISelectionResult,
  ISelectionThresholds,
  IAttentionConfig,
  IAttentionConfig as AttentionConfig, // Alias for compatibility
  ISelectionMetrics,
} from './attention-types.js';
