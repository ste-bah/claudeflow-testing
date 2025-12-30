/**
 * KnowledgeChunker - Adapts SymmetricChunker for knowledge storage
 *
 * Implements: TASK-CHUNK-001 (Sprint 13)
 * Requirements: REQ-CHUNK-001 to REQ-CHUNK-009
 * Constitution: RULE-003 (requirement comments), RULE-064 (symmetric chunking)
 *
 * RULE-064: Uses same chunking as DESC service for consistency
 */
import type { IChunkingConfig, ContentType } from '../core/ucm/types.js';
/**
 * Chunk metadata for knowledge entries
 * Implements: REQ-CHUNK-004 (parent tracking), REQ-CHUNK-007 (offset tracking)
 */
export interface KnowledgeChunkMetadata {
    /** Parent knowledge entry ID (for chunk reconstruction) */
    parentId: string;
    /** Zero-indexed position in chunk sequence */
    chunkIndex: number;
    /** Total number of chunks for this knowledge entry */
    totalChunks: number;
    /** Start character offset in original content (tracked BEFORE trim per TASK-CHUNK-009) */
    startOffset: number;
    /** End character offset in original content (tracked BEFORE trim per TASK-CHUNK-009) */
    endOffset: number;
    /** Domain namespace from parent knowledge entry */
    domain: string;
    /** Category type from parent knowledge entry */
    type: string;
    /** Tags from parent knowledge entry */
    tags: string[];
    /** Estimated token count for this chunk */
    estimatedTokens: number;
}
/**
 * A chunk of knowledge content with its metadata
 */
export interface KnowledgeChunk {
    /** Chunk text content (trimmed for storage) */
    text: string;
    /** Full metadata for this chunk */
    metadata: KnowledgeChunkMetadata;
}
/**
 * Result of chunking a knowledge entry
 * Implements: REQ-CHUNK-001
 */
export interface ChunkingResult {
    /** Array of chunks with metadata */
    chunks: KnowledgeChunk[];
    /** Total estimated tokens across all chunks */
    totalTokensEstimate: number;
    /** True if content was chunked (more than 1 chunk), false if single chunk */
    wasChunked: boolean;
    /** Total character count of original content */
    totalChars: number;
}
/**
 * Options for chunking operation
 * Implements: REQ-CHUNK-009 (content-aware token estimation)
 */
export interface ChunkingOptions {
    /** Content type hint for accurate token estimation (default: MIXED) */
    contentType?: ContentType;
}
/**
 * Metadata required from parent knowledge entry
 */
export interface ParentMetadata {
    /** Domain namespace (e.g., 'project/api') */
    domain: string;
    /** Category type (e.g., 'schema', 'analysis') */
    type: string;
    /** Searchable tags */
    tags: string[];
}
/**
 * KnowledgeChunker - Wraps SymmetricChunker with knowledge-specific metadata handling
 *
 * RULE-064: Uses same chunking algorithm as DESC service for consistency
 * REQ-CHUNK-001: Chunk knowledge content using SymmetricChunker
 * REQ-CHUNK-009: Content-aware token estimation
 */
export declare class KnowledgeChunker {
    private chunker;
    private config;
    /**
     * Create a KnowledgeChunker with optional configuration overrides
     * @param config - Partial configuration to merge with defaults
     */
    constructor(config?: Partial<IChunkingConfig>);
    /**
     * Chunk content for knowledge storage
     * Implements: REQ-CHUNK-001 (chunking), REQ-CHUNK-003 (offset tracking), REQ-CHUNK-009 (token estimation)
     *
     * @param content - Raw text content to chunk
     * @param parentId - ID of parent KnowledgeEntry
     * @param metadata - Domain, type, tags from parent
     * @param options - Optional chunking options (contentType for token estimation)
     * @returns ChunkingResult with chunks and metadata
     */
    chunkForStorage(content: string, parentId: string, metadata: ParentMetadata, options?: ChunkingOptions): Promise<ChunkingResult>;
    /**
     * Estimate token count for content
     * Implements: REQ-CHUNK-009 (content-aware token estimation)
     *
     * @param text - Text to estimate tokens for
     * @param contentType - Content type for ratio selection (default: MIXED)
     * @returns Estimated token count
     */
    estimateTokens(text: string, contentType?: ContentType): number;
    /**
     * Check if content should be chunked
     * Implements: REQ-CHUNK-002 (minChars threshold)
     *
     * @param content - Content to check
     * @returns True if content exceeds maxChars and should be chunked
     */
    shouldChunk(content: string): boolean;
    /**
     * Get current chunking configuration
     * @returns Current configuration
     */
    getConfig(): IChunkingConfig;
    /**
     * Reconstruct content from chunks
     * Implements: REQ-CHUNK-010 (backward compatible retrieval)
     *
     * @param chunks - Array of KnowledgeChunks in order
     * @returns Reconstructed content string
     */
    reconstructContent(chunks: KnowledgeChunk[]): string;
    /**
     * Validate that chunks can be reconstructed
     * Implements: REQ-CHUNK-010 (backward compatible retrieval)
     *
     * @param chunks - Array of KnowledgeChunks to validate
     * @returns True if chunks form a complete, valid sequence
     */
    canReconstruct(chunks: KnowledgeChunk[]): boolean;
    /**
     * Detect content type from text for token estimation
     * Helper method for REQ-CHUNK-009
     *
     * @param text - Text to analyze
     * @returns Detected content type
     */
    detectContentType(text: string): ContentType;
}
/**
 * Get or create the default KnowledgeChunker instance
 * @returns Default KnowledgeChunker singleton
 */
export declare function getDefaultKnowledgeChunker(): KnowledgeChunker;
/**
 * Create a new KnowledgeChunker with custom configuration
 * @param config - Partial configuration to merge with defaults
 * @returns New KnowledgeChunker instance
 */
export declare function createKnowledgeChunker(config?: Partial<IChunkingConfig>): KnowledgeChunker;
//# sourceMappingURL=knowledge-chunker.d.ts.map