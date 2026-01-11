/**
 * Embedding Provider Implementation
 * SPEC-EMB-001 - Real Embedding Providers
 *
 * Provides semantic embedding generation via:
 * 1. LocalEmbeddingProvider - Uses local gte-Qwen2-1.5B-instruct API (PRIMARY)
 * 2. MockEmbeddingProvider - Random vectors for testing (FALLBACK)
 *
 * Local API: http://127.0.0.1:8000/embed (Alibaba-NLP/gte-Qwen2-1.5B-instruct)
 */
import type { IEmbeddingProvider } from './types.js';
/**
 * Configuration for local embedding API
 */
export interface ILocalEmbeddingConfig {
    /** API endpoint URL (default: http://127.0.0.1:8000/embed) */
    endpoint?: string;
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Whether to cache embeddings (default: true) */
    enableCache?: boolean;
    /** Maximum cache size (default: 10000) */
    maxCacheSize?: number;
}
/**
 * Local embedding provider using gte-Qwen2-1.5B-instruct API
 * Generates real 1536-dimensional semantic embeddings
 *
 * @implements IEmbeddingProvider
 */
export declare class LocalEmbeddingProvider implements IEmbeddingProvider {
    private readonly endpoint;
    private readonly timeout;
    private readonly cache;
    private readonly maxCacheSize;
    private readonly enableCache;
    constructor(config?: ILocalEmbeddingConfig);
    /**
     * Generate semantic embedding for text using local API
     * @param text - Text to embed
     * @returns 1536-dimensional L2-normalized semantic embedding
     */
    embed(text: string): Promise<Float32Array>;
    /**
     * Generate embeddings for multiple texts in a single batch request
     * @param texts - Array of texts to embed
     * @returns Array of 1536-dimensional embeddings
     */
    embedBatch(texts: string[]): Promise<Float32Array[]>;
    /**
     * Check if the local embedding API is available
     * Uses the configured timeout (default 30s) to accommodate slow model loading
     * @returns true if API is reachable
     */
    isAvailable(): Promise<boolean>;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
    };
    /**
     * Clear the embedding cache
     */
    clearCache(): void;
    /**
     * Get the provider name for debugging/logging
     */
    getProviderName(): string;
    /**
     * Get embedding dimensions
     */
    getDimensions(): number;
}
/**
 * Factory for creating embedding providers with automatic fallback
 */
export declare class EmbeddingProviderFactory {
    private static instance;
    private static localProvider;
    private static mockProvider;
    /**
     * Get the best available embedding provider
     * Tries local API first, falls back to mock if unavailable
     *
     * @param forceLocal - If true, only return local provider or throw
     * @returns Embedding provider instance
     */
    static getProvider(forceLocal?: boolean): Promise<IEmbeddingProvider>;
    /**
     * Get local provider directly (throws if unavailable)
     */
    static getLocalProvider(config?: ILocalEmbeddingConfig): LocalEmbeddingProvider;
    /**
     * Get mock provider for testing
     */
    static getMockProvider(): MockEmbeddingProvider;
    /**
     * Check if local API is running
     */
    static isLocalAvailable(): Promise<boolean>;
    /**
     * Reset factory state (for testing)
     */
    static reset(): void;
}
/**
 * Mock embedding provider for testing and development
 * Generates random L2-normalized 1536-dimensional vectors
 *
 * @deprecated Use LocalEmbeddingProvider for production
 */
export declare class MockEmbeddingProvider implements IEmbeddingProvider {
    /**
     * Generate a random L2-normalized embedding vector
     * @param _text - Text to embed (currently unused, for future deterministic seeding)
     * @returns 1536-dimensional L2-normalized vector
     */
    embed(_text: string): Promise<Float32Array>;
    /**
     * Generate embedding with deterministic seed for testing
     * @param text - Text to embed (used for seeding)
     * @returns 1536-dimensional L2-normalized vector
     */
    embedDeterministic(text: string): Promise<Float32Array>;
    /**
     * Get the provider name for debugging/logging
     */
    getProviderName(): string;
    /**
     * Get embedding dimensions
     */
    getDimensions(): number;
}
//# sourceMappingURL=embedding-provider.d.ts.map