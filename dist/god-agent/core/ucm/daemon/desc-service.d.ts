/**
 * DESC Service (SVC-002)
 * JSON-RPC 2.0 service for DESC (Dual Embedding Symmetric Chunking) operations
 *
 * METHODS:
 * - desc.store: Store episode with dual embeddings
 * - desc.retrieve: Retrieve similar episodes
 * - desc.inject: Augment prompt with prior solutions
 *
 * CONSTITUTION RULES: RULE-063 to RULE-070
 */
import { SymmetricChunker } from '../desc/symmetric-chunker.js';
import { DualEmbeddingStore } from '../desc/dual-embedding-store.js';
import { EpisodeRetriever } from '../desc/episode-retriever.js';
import { EmbeddingProxy } from '../desc/embedding-proxy.js';
/**
 * Configuration for DescService
 * RULE-030: DescService MUST use persistent storage
 */
export interface IDescServiceConfig {
    /** Database path for persistent storage (required if embeddingStore not provided) */
    dbPath?: string;
    /** Pre-configured embedding store (overrides dbPath) */
    embeddingStore?: DualEmbeddingStore;
    /** Pre-configured chunker (optional) */
    chunker?: SymmetricChunker;
    /** Pre-configured retriever (optional) */
    retriever?: EpisodeRetriever;
    /** Pre-configured embedding proxy (optional) */
    embeddingProxy?: EmbeddingProxy;
}
interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params: unknown;
    id: string | number | null;
}
interface JsonRpcResponse {
    jsonrpc: '2.0';
    result?: unknown;
    error?: JsonRpcError;
    id: string | number | null;
}
interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}
export declare class DescService {
    private chunker;
    private embeddingStore;
    private retriever;
    private embeddingProxy;
    private readonly logger;
    /**
     * Create a new DescService instance
     *
     * RULE-030: DescService MUST use persistent storage.
     * Either `embeddingStore` or `dbPath` must be provided.
     *
     * @param config - Configuration with persistent storage settings
     * @throws MissingConfigError if no storage configuration is provided
     */
    constructor(config: IDescServiceConfig);
    /**
     * Handle JSON-RPC 2.0 request
     */
    handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse>;
    /**
     * Handle desc.store method
     * Store episode with dual embeddings (query + answer chunks)
     */
    private handleStore;
    /**
     * Handle desc.retrieve method
     * Retrieve similar episodes using all-to-all chunk matching
     * RULE-069: All search chunks match all stored chunks
     */
    private handleRetrieve;
    /**
     * Handle desc.inject method
     * Augment prompt with relevant prior solutions
     * RULE-068: DESC injection on task start
     */
    private handleInject;
    private isStoreParams;
    private isRetrieveParams;
    private isInjectParams;
    private successResponse;
    private errorResponse;
    private handleError;
    /**
     * Retrieve relevant episodes matching a query
     * Implements IDescServiceLike interface for auto-injection hook
     *
     * RULE-033: DESC context MUST be injected into every Task-style tool call
     *
     * @param query - Search query text
     * @param options - Optional retrieval parameters
     * @returns Array of relevant episodes with id, summary, and content
     */
    retrieveRelevant(query: string, options?: {
        limit?: number;
    }): Promise<Array<{
        id: string;
        summary?: string;
        content?: string;
    }>>;
}
export {};
//# sourceMappingURL=desc-service.d.ts.map