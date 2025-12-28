/**
 * Universal Context Management (UCM) System
 * Main Module Entry Point
 *
 * Provides token management, context composition, DESC episodic memory,
 * compaction recovery, and workflow adaptation for Claude Code/God Agent.
 *
 * @module ucm
 */
export * from './types.js';
export * from './errors.js';
export { loadConfig, loadAndValidateConfig, loadConfigWithEnv, validateConfig, getEnvOverrides, DEFAULT_UCM_CONFIG, DEFAULT_TOKEN_DEFAULTS, DEFAULT_SUMMARIZATION_CONFIG, DEFAULT_PROGRESSIVE_CONFIG, DEFAULT_CHUNKING_CONFIG, DEFAULT_BREAK_PATTERNS, PROTECTED_PATTERNS } from './config.js';
export { WordCounter, ContentClassifier, TokenEstimationService, TokenBudgetManager, UsageTracker, SummarizationTrigger } from './token/index.js';
export { AdapterRegistry, adapterRegistry, PhdPipelineAdapter, CodeReviewAdapter, GeneralTaskAdapter } from './adapters/index.js';
export { SymmetricChunker, DualEmbeddingStore, EpisodeRetriever, EmbeddingProxy } from './desc/index.js';
export { CompactionDetector, MemoryReconstructor, TierBridge } from './recovery/index.js';
export { RollingWindow, DependencyTracker, PinningManager, ContextCompositionEngine } from './context/index.js';
export { ContextService, DescService, RecoveryService, HealthService, DaemonServer } from './daemon/index.js';
import { TokenEstimationService } from './token/index.js';
import { adapterRegistry } from './adapters/index.js';
import { SymmetricChunker, DualEmbeddingStore, EpisodeRetriever, EmbeddingProxy } from './desc/index.js';
import { CompactionDetector, TierBridge } from './recovery/index.js';
import { ContextCompositionEngine } from './context/index.js';
import { DaemonServer } from './daemon/index.js';
import type { IUniversalContextConfig, ITaskContext } from './types.js';
/**
 * Create a fully configured UCM instance
 */
export declare function createUCM(configOverrides?: Partial<IUniversalContextConfig>): UCMInstance;
/**
 * UCM instance interface
 */
export interface UCMInstance {
    config: IUniversalContextConfig;
    tokenEstimator: TokenEstimationService;
    chunker: SymmetricChunker;
    embeddingProxy: EmbeddingProxy;
    episodeStore: DualEmbeddingStore;
    episodeRetriever: EpisodeRetriever;
    compactionDetector: CompactionDetector;
    tierBridge: TierBridge;
    contextEngine: ContextCompositionEngine;
    adapterRegistry: typeof adapterRegistry;
    detectWorkflow(context: ITaskContext): ReturnType<typeof adapterRegistry.detectAdapter>;
    estimateTokens(text: string): ReturnType<TokenEstimationService['estimate']>;
    checkCompaction(message: string): boolean;
}
/**
 * Start the UCM daemon server
 */
export declare function startDaemon(configOverrides?: Partial<IUniversalContextConfig>): Promise<DaemonServer>;
export declare const UCM_VERSION = "1.0.0";
export declare const UCM_SPEC_ID = "UCM-001";
//# sourceMappingURL=index.d.ts.map