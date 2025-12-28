/**
 * SPRINT 3 - DESC-004: Embedding Proxy
 *
 * HTTP proxy to local embedding service (gte-Qwen2-1.5B-instruct)
 * running on localhost:8000
 *
 * Features:
 * - Timeout handling (30000ms)
 * - Connection error handling
 * - Batch embedding support
 * - Service availability checking
 */
import type { IEmbeddingProvider } from '../types.js';
/**
 * Configuration for embedding service
 */
interface EmbeddingProxyConfig {
    baseUrl: string;
    timeout: number;
    maxRetries: number;
    retryDelay: number;
}
/**
 * EmbeddingProxy - HTTP client for gte-Qwen2-1.5B-instruct service
 *
 * Key features:
 * - Connects to localhost:8000
 * - L2-normalized embeddings (1536 dimensions)
 * - Timeout and error handling
 * - Batch processing support
 * - Service health checks
 */
export declare class EmbeddingProxy implements IEmbeddingProvider {
    private config;
    private isServiceAvailable;
    private lastHealthCheck;
    private readonly healthCheckInterval;
    constructor(config?: Partial<EmbeddingProxyConfig>);
    /**
     * Embed a single text string
     *
     * @param text - Text to embed
     * @returns L2-normalized embedding vector
     */
    embed(text: string): Promise<Float32Array>;
    /**
     * Embed multiple texts in a batch
     *
     * @param texts - Array of texts to embed
     * @returns Array of L2-normalized embedding vectors
     */
    embedBatch(texts: string[]): Promise<Float32Array[]>;
    /**
     * Check if embedding service is available
     *
     * @param forceCheck - Force a new health check even if cached result exists
     * @returns true if service is available
     */
    isAvailable(forceCheck?: boolean): Promise<boolean>;
    /**
     * Make HTTP request to embedding service
     */
    private makeRequest;
    /**
     * Delay helper for retries
     */
    private delay;
    /**
     * Get current configuration
     */
    getConfig(): EmbeddingProxyConfig;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<EmbeddingProxyConfig>): void;
    /**
     * Get service status
     */
    getStatus(): {
        isAvailable: boolean | null;
        lastHealthCheck: number;
        baseUrl: string;
    };
}
export {};
//# sourceMappingURL=embedding-proxy.d.ts.map