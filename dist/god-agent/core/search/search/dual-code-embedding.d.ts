/**
 * Dual Code Embedding Provider
 * Combines NLP encoder (for natural language queries) with Code encoder
 * for semantic code search optimization.
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-LEANN-003
 *
 * LEANN's paper emphasizes domain-specific embeddings. For code search:
 * - NLP Encoder: Understands natural language queries ("find function that validates email")
 * - Code Encoder: Understands code structure ("def validate_email(input: str)")
 * - Fusion: Combines both for optimal search
 *
 * @module src/god-agent/core/search/dual-code-embedding
 */
import type { IEmbeddingProvider } from '../memory/types.js';
/**
 * Content type detected from input text
 */
export type ContentType = 'code' | 'natural_language' | 'mixed';
/**
 * Configuration for dual code embedding provider
 */
export interface DualCodeEmbeddingConfig {
    /** Embedding dimension (default: 1536 to match existing vector DB) */
    dimension: number;
    /** Weight for NLP embedding in fusion (default: 0.4) */
    nlpWeight: number;
    /** Weight for code embedding in fusion (default: 0.6) */
    codeWeight: number;
    /** Enable LRU cache (default: true) */
    cacheEnabled: boolean;
    /** Maximum cache size (default: 1000) */
    cacheMaxSize: number;
    /** Embedding provider type (default: 'local') */
    provider: 'openai' | 'local';
    /** Code indicator patterns (custom language detection) */
    codeIndicators?: RegExp[];
    /** Minimum confidence for code detection (default: 0.6) */
    codeDetectionThreshold?: number;
}
/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
    /** Number of cache hits */
    hits: number;
    /** Number of cache misses */
    misses: number;
    /** Current cache size */
    size: number;
    /** Cache hit ratio */
    hitRatio: number;
}
/**
 * Embedding result with metadata
 */
export interface EmbeddingResult {
    /** The embedding vector */
    embedding: Float32Array;
    /** Detected content type */
    contentType: ContentType;
    /** Whether this was a cache hit */
    fromCache: boolean;
    /** Processing time in milliseconds */
    processingTimeMs: number;
}
/**
 * Default dual code embedding configuration
 */
export declare const DEFAULT_DUAL_CODE_CONFIG: DualCodeEmbeddingConfig;
/**
 * Dual Code Embedding Provider
 *
 * Provides optimized embeddings for code search by combining:
 * 1. NLP encoder for natural language query understanding
 * 2. Code encoder for code structure understanding
 * 3. Fusion strategy with configurable weights
 *
 * @implements IEmbeddingProvider
 */
export declare class DualCodeEmbeddingProvider implements IEmbeddingProvider {
    private readonly config;
    private readonly cache;
    private readonly codeIndicators;
    private baseProvider;
    private initPromise;
    /**
     * Create a new DualCodeEmbeddingProvider
     *
     * @param config - Configuration options
     */
    constructor(config?: Partial<DualCodeEmbeddingConfig>);
    /**
     * Initialize the base embedding provider lazily
     */
    private ensureInitialized;
    private initialize;
    /**
     * Generate embedding for natural language query
     * Optimized for understanding user intent in search queries
     *
     * @param query - Natural language query text
     * @returns Embedding optimized for NLP understanding
     */
    embedQuery(query: string): Promise<Float32Array>;
    /**
     * Generate embedding for code content
     * Optimized for understanding code structure and semantics
     *
     * @param code - Code content to embed
     * @returns Embedding optimized for code understanding
     */
    embedCode(code: string): Promise<Float32Array>;
    /**
     * Generate fused embedding combining NLP and code understanding
     * Optimal for indexing code with docstrings/comments
     *
     * @param content - Content to embed (code or mixed)
     * @param isCode - Hint about content type (if known)
     * @returns Fused embedding balancing NLP and code understanding
     */
    embedFused(content: string, isCode?: boolean): Promise<Float32Array>;
    /**
     * Standard embedding implementation for IEmbeddingProvider interface
     * Uses smart detection to choose optimal embedding strategy
     *
     * @param text - Text to embed
     * @returns Optimal embedding based on content type
     */
    embed(text: string): Promise<Float32Array>;
    /**
     * Batch embedding for multiple texts
     *
     * @param texts - Array of texts to embed
     * @returns Array of embeddings
     */
    embedBatch(texts: string[]): Promise<Float32Array[]>;
    /**
     * Detect whether content is code, natural language, or mixed
     *
     * @param content - Content to analyze
     * @returns Detected content type
     */
    detectContentType(content: string): ContentType;
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats(): CacheStats;
    /**
     * Clear the embedding cache
     */
    clearCache(): void;
    /**
     * Check if provider is available
     */
    isAvailable(): Promise<boolean>;
    /**
     * Get provider name for debugging/logging
     */
    getProviderName(): string;
    /**
     * Get embedding dimensions
     */
    getDimensions(): number;
    /**
     * Get current configuration
     */
    getConfig(): Readonly<DualCodeEmbeddingConfig>;
    /**
     * Generate NLP-focused embedding
     */
    private generateNLPEmbedding;
    /**
     * Generate code-focused embedding
     */
    private generateCodeEmbedding;
    /**
     * Preprocess content for NLP embedding
     * Focuses on semantic meaning and natural language understanding
     */
    private preprocessForNLP;
    /**
     * Preprocess content for code embedding
     * Focuses on structure, identifiers, and code patterns
     */
    private preprocessForCode;
    /**
     * Fuse two embeddings with weighted combination and L2 normalization
     */
    private fuseEmbeddings;
    /**
     * Calculate how likely content is to be code
     */
    private calculateCodeScore;
    /**
     * Calculate how likely content is to be natural language
     */
    private calculateNLPScore;
    /**
     * Compute cache key for content
     */
    private computeCacheKey;
}
/**
 * Create a DualCodeEmbeddingProvider with default configuration
 *
 * @param config - Optional partial configuration
 * @returns Configured DualCodeEmbeddingProvider instance
 */
export declare function createDualCodeEmbeddingProvider(config?: Partial<DualCodeEmbeddingConfig>): DualCodeEmbeddingProvider;
/**
 * Create an embedding function compatible with LEANNSourceAdapter
 *
 * @param provider - DualCodeEmbeddingProvider instance
 * @returns Function that generates embeddings based on content type
 */
export declare function createLEANNEmbedder(provider: DualCodeEmbeddingProvider): (text: string) => Promise<Float32Array>;
//# sourceMappingURL=dual-code-embedding.d.ts.map