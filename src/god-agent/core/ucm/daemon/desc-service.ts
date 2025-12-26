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

import type {
  IEpisodeInput,
  IStoredEpisode,
  IRetrievalResult,
  IRetrievalOptions
} from '../types.js';
import { SymmetricChunker } from '../desc/symmetric-chunker.js';
import { DualEmbeddingStore } from '../desc/dual-embedding-store.js';
import { EpisodeRetriever } from '../desc/episode-retriever.js';
import { EmbeddingProxy } from '../desc/embedding-proxy.js';
import { ServiceError } from '../errors.js';

// ============================================================================
// JSON-RPC 2.0 Types
// ============================================================================

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

const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603
} as const;

// ============================================================================
// Request Parameter Types
// ============================================================================

interface StoreParams {
  queryText: string;
  answerText: string;
  metadata?: Record<string, unknown>;
}

interface RetrieveParams {
  searchText: string;
  threshold?: number;
  maxResults?: number;
  includeQueryMatch?: boolean;
  includeAnswerMatch?: boolean;
}

interface InjectParams {
  prompt: string;
  threshold?: number;
  maxEpisodes?: number;
}

interface InjectionResult {
  augmentedPrompt: string;
  episodesUsed: number;
  episodeIds: string[];
  originalPromptTokens: number;
  augmentedPromptTokens: number;
}

// ============================================================================
// DESC Service
// ============================================================================

export class DescService {
  private chunker: SymmetricChunker;
  private embeddingStore: DualEmbeddingStore;
  private retriever: EpisodeRetriever;
  private embeddingProxy: EmbeddingProxy;

  constructor(
    chunker?: SymmetricChunker,
    embeddingStore?: DualEmbeddingStore,
    retriever?: EpisodeRetriever,
    embeddingProxy?: EmbeddingProxy
  ) {
    this.chunker = chunker ?? new SymmetricChunker();
    this.embeddingStore = embeddingStore ?? new DualEmbeddingStore();
    this.retriever = retriever ?? new EpisodeRetriever(
      this.embeddingStore,
      embeddingProxy ?? new EmbeddingProxy(),
      this.chunker
    );
    this.embeddingProxy = embeddingProxy ?? new EmbeddingProxy();
  }

  /**
   * Handle JSON-RPC 2.0 request
   */
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, params, id } = request;

    try {
      if (request.jsonrpc !== '2.0') {
        return this.errorResponse(
          ERROR_CODES.INVALID_REQUEST,
          'Invalid JSON-RPC version',
          id
        );
      }

      let result: unknown;

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
          return this.errorResponse(
            ERROR_CODES.METHOD_NOT_FOUND,
            `Method not found: ${method}`,
            id
          );
      }

      return this.successResponse(result, id);

    } catch (error) {
      return this.handleError(error, id);
    }
  }

  /**
   * Handle desc.store method
   * Store episode with dual embeddings (query + answer chunks)
   */
  private async handleStore(params: unknown): Promise<{ episodeId: string; chunksStored: number }> {
    if (!this.isStoreParams(params)) {
      throw new ServiceError(
        ERROR_CODES.INVALID_PARAMS,
        'Invalid params: expected { queryText, answerText, metadata? }'
      );
    }

    const { queryText, answerText, metadata } = params;

    // Chunk both query and answer
    const queryChunks = this.chunker.chunk(queryText);
    const answerChunks = this.chunker.chunk(answerText);

    // Generate embeddings
    const queryEmbeddings = await this.embeddingProxy.embedBatch(queryChunks);
    const answerEmbeddings = await this.embeddingProxy.embedBatch(answerChunks);

    // Store episode
    const episodeInput: IEpisodeInput = {
      queryText,
      answerText,
      metadata
    };

    const episodeId = await this.embeddingStore.storeEpisode(
      episodeInput,
      queryEmbeddings,
      answerEmbeddings
    );

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
  private async handleRetrieve(params: unknown): Promise<IRetrievalResult[]> {
    if (!this.isRetrieveParams(params)) {
      throw new ServiceError(
        ERROR_CODES.INVALID_PARAMS,
        'Invalid params: expected { searchText, threshold?, maxResults?, includeQueryMatch?, includeAnswerMatch? }'
      );
    }

    const { searchText, threshold, maxResults, includeQueryMatch, includeAnswerMatch } = params;

    const options: IRetrievalOptions = {
      threshold: threshold ?? 0.80,
      maxResults: maxResults ?? 2,
      includeQueryMatch: includeQueryMatch ?? true,
      includeAnswerMatch: includeAnswerMatch ?? true
    };

    return this.retriever.retrieve(searchText, options);
  }

  /**
   * Handle desc.inject method
   * Augment prompt with relevant prior solutions
   * RULE-068: DESC injection on task start
   */
  private async handleInject(params: unknown): Promise<InjectionResult> {
    if (!this.isInjectParams(params)) {
      throw new ServiceError(
        ERROR_CODES.INVALID_PARAMS,
        'Invalid params: expected { prompt, threshold?, maxEpisodes? }'
      );
    }

    const { prompt, threshold, maxEpisodes } = params;

    // Retrieve relevant episodes
    const options: IRetrievalOptions = {
      threshold: threshold ?? 0.80,
      maxResults: maxEpisodes ?? 2,
      includeQueryMatch: true,
      includeAnswerMatch: true
    };

    const results = await this.retriever.retrieve(prompt, options);

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

  private isStoreParams(params: unknown): params is StoreParams {
    if (!params || typeof params !== 'object') return false;
    const p = params as Record<string, unknown>;
    return (
      typeof p.queryText === 'string' &&
      typeof p.answerText === 'string'
    );
  }

  private isRetrieveParams(params: unknown): params is RetrieveParams {
    if (!params || typeof params !== 'object') return false;
    const p = params as Record<string, unknown>;
    return typeof p.searchText === 'string';
  }

  private isInjectParams(params: unknown): params is InjectParams {
    if (!params || typeof params !== 'object') return false;
    const p = params as Record<string, unknown>;
    return typeof p.prompt === 'string';
  }

  // ============================================================================
  // Response Helpers
  // ============================================================================

  private successResponse(result: unknown, id: string | number | null): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      result,
      id
    };
  }

  private errorResponse(
    code: number,
    message: string,
    id: string | number | null,
    data?: unknown
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      error: { code, message, data },
      id
    };
  }

  private handleError(error: unknown, id: string | number | null): JsonRpcResponse {
    if (error instanceof ServiceError) {
      return this.errorResponse(error.code, error.message, id, error.details);
    }

    const message = error instanceof Error ? error.message : 'Internal error';
    return this.errorResponse(ERROR_CODES.INTERNAL_ERROR, message, id);
  }
}
