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
import { ServiceError } from '../errors.js';
const ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603
};
// ============================================================================
// DESC Service
// ============================================================================
export class DescService {
    chunker;
    embeddingStore;
    retriever;
    embeddingProxy;
    constructor(chunker, embeddingStore, retriever, embeddingProxy) {
        this.chunker = chunker ?? new SymmetricChunker();
        this.embeddingStore = embeddingStore ?? new DualEmbeddingStore();
        this.embeddingProxy = embeddingProxy ?? new EmbeddingProxy();
        // EpisodeRetriever takes (store, options?, filter?) - DescService handles chunking/embedding
        this.retriever = retriever ?? new EpisodeRetriever(this.embeddingStore);
    }
    /**
     * Handle JSON-RPC 2.0 request
     */
    async handleRequest(request) {
        const { method, params, id } = request;
        try {
            if (request.jsonrpc !== '2.0') {
                return this.errorResponse(ERROR_CODES.INVALID_REQUEST, 'Invalid JSON-RPC version', id);
            }
            let result;
            switch (method) {
                case 'desc.store':
                    result = await this.handleStore(params);
                    break;
                case 'desc.retrieve':
                    result = await this.handleRetrieve(params);
                    break;
                case 'desc.inject':
                    result = await this.handleInject(params);
                    break;
                default:
                    return this.errorResponse(ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`, id);
            }
            return this.successResponse(result, id);
        }
        catch (error) {
            return this.handleError(error, id);
        }
    }
    /**
     * Handle desc.store method
     * Store episode with dual embeddings (query + answer chunks)
     */
    async handleStore(params) {
        if (!this.isStoreParams(params)) {
            throw new ServiceError(ERROR_CODES.INVALID_PARAMS, 'Invalid params: expected { queryText, answerText, metadata? }');
        }
        const { queryText, answerText, metadata } = params;
        // Chunk both query and answer (async)
        const queryChunks = await this.chunker.chunk(queryText);
        const answerChunks = await this.chunker.chunk(answerText);
        // Generate embeddings
        const queryEmbeddings = await this.embeddingProxy.embedBatch(queryChunks);
        const answerEmbeddings = await this.embeddingProxy.embedBatch(answerChunks);
        // Store episode
        const episodeInput = {
            queryText,
            answerText,
            metadata
        };
        const episodeId = await this.embeddingStore.storeEpisode(episodeInput, queryEmbeddings, answerEmbeddings);
        return {
            episodeId,
            chunksStored: queryChunks.length + answerChunks.length
        };
    }
    /**
     * Handle desc.retrieve method
     * Retrieve similar episodes using all-to-all chunk matching
     * RULE-069: All search chunks match all stored chunks
     */
    async handleRetrieve(params) {
        if (!this.isRetrieveParams(params)) {
            throw new ServiceError(ERROR_CODES.INVALID_PARAMS, 'Invalid params: expected { searchText, threshold?, maxResults?, includeQueryMatch?, includeAnswerMatch? }');
        }
        const { searchText, threshold, maxResults } = params;
        // Chunk the search text (async)
        const searchChunks = await this.chunker.chunk(searchText);
        // Generate embeddings for search chunks
        const searchEmbeddings = await this.embeddingProxy.embedBatch(searchChunks);
        const options = {
            threshold: threshold ?? 0.80,
            maxResults: maxResults ?? 2,
            includeQueryMatch: true,
            includeAnswerMatch: true
        };
        return this.retriever.retrieve(searchChunks, searchEmbeddings, options);
    }
    /**
     * Handle desc.inject method
     * Augment prompt with relevant prior solutions
     * RULE-068: DESC injection on task start
     */
    async handleInject(params) {
        if (!this.isInjectParams(params)) {
            throw new ServiceError(ERROR_CODES.INVALID_PARAMS, 'Invalid params: expected { prompt, threshold?, maxEpisodes? }');
        }
        const { prompt, threshold, maxEpisodes } = params;
        // Chunk the prompt (async)
        const promptChunks = await this.chunker.chunk(prompt);
        // Generate embeddings for prompt chunks
        const promptEmbeddings = await this.embeddingProxy.embedBatch(promptChunks);
        // Retrieve relevant episodes
        const options = {
            threshold: threshold ?? 0.80,
            maxResults: maxEpisodes ?? 2,
            includeQueryMatch: true,
            includeAnswerMatch: true
        };
        const results = await this.retriever.retrieve(promptChunks, promptEmbeddings, options);
        // Build augmented prompt
        let augmentedPrompt = prompt;
        if (results.length > 0) {
            const priorSolutions = results
                .map((r, idx) => `\n## Prior Solution ${idx + 1} (similarity: ${r.maxSimilarity.toFixed(2)})\n${r.answerText}`)
                .join('\n');
            augmentedPrompt = `${prompt}\n\n---\n# Relevant Prior Solutions\n${priorSolutions}\n---\n`;
        }
        // Estimate tokens (rough estimate: 1.3 tokens per word)
        const originalTokens = Math.round(prompt.split(/\s+/).length * 1.3);
        const augmentedTokens = Math.round(augmentedPrompt.split(/\s+/).length * 1.3);
        return {
            augmentedPrompt,
            episodesUsed: results.length,
            episodeIds: results.map(r => r.episodeId),
            originalPromptTokens: originalTokens,
            augmentedPromptTokens: augmentedTokens
        };
    }
    // ============================================================================
    // Type Guards
    // ============================================================================
    isStoreParams(params) {
        if (!params || typeof params !== 'object')
            return false;
        const p = params;
        return (typeof p.queryText === 'string' &&
            typeof p.answerText === 'string');
    }
    isRetrieveParams(params) {
        if (!params || typeof params !== 'object')
            return false;
        const p = params;
        return typeof p.searchText === 'string';
    }
    isInjectParams(params) {
        if (!params || typeof params !== 'object')
            return false;
        const p = params;
        return typeof p.prompt === 'string';
    }
    // ============================================================================
    // Response Helpers
    // ============================================================================
    successResponse(result, id) {
        return {
            jsonrpc: '2.0',
            result,
            id
        };
    }
    errorResponse(code, message, id, data) {
        return {
            jsonrpc: '2.0',
            error: { code, message, data },
            id
        };
    }
    handleError(error, id) {
        if (error instanceof ServiceError) {
            return this.errorResponse(error.errorCode, error.message, id, error.details);
        }
        const message = error instanceof Error ? error.message : 'Internal error';
        return this.errorResponse(ERROR_CODES.INTERNAL_ERROR, message, id);
    }
}
//# sourceMappingURL=desc-service.js.map