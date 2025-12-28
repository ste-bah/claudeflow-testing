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
import { EmbeddingServiceUnavailableError, EmbeddingTimeoutError, DESCError } from '../errors.js';
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    baseUrl: 'http://localhost:8000',
    timeout: 30000, // 30 seconds
    maxRetries: 2,
    retryDelay: 1000 // 1 second
};
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
export class EmbeddingProxy {
    config;
    isServiceAvailable = null;
    lastHealthCheck = 0;
    healthCheckInterval = 60000; // 1 minute
    constructor(config) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config
        };
    }
    /**
     * Embed a single text string
     *
     * @param text - Text to embed
     * @returns L2-normalized embedding vector
     */
    async embed(text) {
        const embeddings = await this.embedBatch([text]);
        return embeddings[0];
    }
    /**
     * Embed multiple texts in a batch
     *
     * @param texts - Array of texts to embed
     * @returns Array of L2-normalized embedding vectors
     */
    async embedBatch(texts) {
        if (texts.length === 0) {
            return [];
        }
        // Validate input
        for (let i = 0; i < texts.length; i++) {
            if (typeof texts[i] !== 'string' || texts[i].trim().length === 0) {
                throw new DESCError(`Invalid text at index ${i}: must be non-empty string`, { index: i });
            }
        }
        let lastError = null;
        // Retry loop
        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                const embeddings = await this.makeRequest(texts);
                // Update service availability
                this.isServiceAvailable = true;
                this.lastHealthCheck = Date.now();
                return embeddings;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                // Don't retry on timeout errors
                if (error instanceof EmbeddingTimeoutError) {
                    throw error;
                }
                // Retry on service unavailable errors
                if (attempt < this.config.maxRetries) {
                    await this.delay(this.config.retryDelay * (attempt + 1));
                    continue;
                }
            }
        }
        // All retries failed
        this.isServiceAvailable = false;
        throw lastError || new EmbeddingServiceUnavailableError('Embedding service request failed after retries');
    }
    /**
     * Check if embedding service is available
     *
     * @param forceCheck - Force a new health check even if cached result exists
     * @returns true if service is available
     */
    async isAvailable(forceCheck = false) {
        const now = Date.now();
        // Use cached result if recent
        if (!forceCheck &&
            this.isServiceAvailable !== null &&
            now - this.lastHealthCheck < this.healthCheckInterval) {
            return this.isServiceAvailable;
        }
        // Perform health check using GET / (api-embedder2.py uses / for status)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000 // 5 second timeout for health check
            );
            const response = await fetch(`${this.config.baseUrl}/`, {
                signal: controller.signal,
                method: 'GET'
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                const data = await response.json();
                // api-embedder2.py returns {status: "online", model: "...", database_items: N}
                this.isServiceAvailable = data.status === 'online';
            }
            else {
                this.isServiceAvailable = false;
            }
            this.lastHealthCheck = now;
            return this.isServiceAvailable;
        }
        catch (error) {
            this.isServiceAvailable = false;
            this.lastHealthCheck = now;
            return false;
        }
    }
    /**
     * Make HTTP request to embedding service
     */
    async makeRequest(texts) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        try {
            const response = await fetch(`${this.config.baseUrl}/embed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ texts }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new EmbeddingServiceUnavailableError(`Embedding service returned status ${response.status}`, { status: response.status, statusText: response.statusText });
            }
            const data = await response.json();
            // Validate response
            if (!data.embeddings || !Array.isArray(data.embeddings)) {
                throw new EmbeddingServiceUnavailableError('Invalid response format from embedding service', { data });
            }
            if (data.embeddings.length !== texts.length) {
                throw new EmbeddingServiceUnavailableError('Embedding count does not match input count', {
                    expected: texts.length,
                    received: data.embeddings.length
                });
            }
            // Convert to Float32Array
            return data.embeddings.map((embedding, index) => {
                if (!Array.isArray(embedding) || embedding.length === 0) {
                    throw new EmbeddingServiceUnavailableError(`Invalid embedding at index ${index}`, { index });
                }
                const float32 = new Float32Array(embedding);
                // Verify L2 normalization (should be close to 1.0)
                const magnitude = Math.sqrt(float32.reduce((sum, v) => sum + v * v, 0));
                if (Math.abs(magnitude - 1.0) > 0.01) {
                    console.warn(`Warning: Embedding at index ${index} may not be L2-normalized (magnitude: ${magnitude})`);
                }
                return float32;
            });
        }
        catch (error) {
            clearTimeout(timeoutId);
            // Handle abort/timeout
            if (error instanceof Error && error.name === 'AbortError') {
                throw new EmbeddingTimeoutError(`Embedding request timed out after ${this.config.timeout}ms`, { timeout: this.config.timeout });
            }
            // Handle network errors
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new EmbeddingServiceUnavailableError(`Cannot connect to embedding service at ${this.config.baseUrl}`, { baseUrl: this.config.baseUrl, originalError: error });
            }
            // Re-throw known errors
            if (error instanceof EmbeddingServiceUnavailableError ||
                error instanceof EmbeddingTimeoutError) {
                throw error;
            }
            // Wrap unknown errors
            throw new EmbeddingServiceUnavailableError(`Embedding request failed: ${error instanceof Error ? error.message : String(error)}`, { originalError: error });
        }
    }
    /**
     * Delay helper for retries
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
        // Invalidate cached health check
        this.isServiceAvailable = null;
    }
    /**
     * Get service status
     */
    getStatus() {
        return {
            isAvailable: this.isServiceAvailable,
            lastHealthCheck: this.lastHealthCheck,
            baseUrl: this.config.baseUrl
        };
    }
}
//# sourceMappingURL=embedding-proxy.js.map