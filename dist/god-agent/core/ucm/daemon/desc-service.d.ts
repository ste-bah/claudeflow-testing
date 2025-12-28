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
    constructor(chunker?: SymmetricChunker, embeddingStore?: DualEmbeddingStore, retriever?: EpisodeRetriever, embeddingProxy?: EmbeddingProxy);
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
}
export {};
//# sourceMappingURL=desc-service.d.ts.map