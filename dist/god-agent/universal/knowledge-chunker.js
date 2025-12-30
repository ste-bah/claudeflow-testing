/**
 * KnowledgeChunker - Adapts SymmetricChunker for knowledge storage
 *
 * Implements: TASK-CHUNK-001 (Sprint 13)
 * Requirements: REQ-CHUNK-001 to REQ-CHUNK-009
 * Constitution: RULE-003 (requirement comments), RULE-064 (symmetric chunking)
 *
 * RULE-064: Uses same chunking as DESC service for consistency
 */
import { SymmetricChunker } from '../core/ucm/desc/symmetric-chunker.js';
import { TOKEN_RATIOS, ContentType as ContentTypeEnum } from '../core/ucm/types.js';
import { DEFAULT_CHUNKING_CONFIG } from '../core/ucm/config.js';
/**
 * KnowledgeChunker - Wraps SymmetricChunker with knowledge-specific metadata handling
 *
 * RULE-064: Uses same chunking algorithm as DESC service for consistency
 * REQ-CHUNK-001: Chunk knowledge content using SymmetricChunker
 * REQ-CHUNK-009: Content-aware token estimation
 */
export class KnowledgeChunker {
    chunker;
    config;
    /**
     * Create a KnowledgeChunker with optional configuration overrides
     * @param config - Partial configuration to merge with defaults
     */
    constructor(config) {
        this.config = {
            ...DEFAULT_CHUNKING_CONFIG,
            ...config
        };
        this.chunker = new SymmetricChunker(this.config);
    }
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
    async chunkForStorage(content, parentId, metadata, options) {
        // Handle empty or very small content
        if (!content || content.trim().length === 0) {
            return {
                chunks: [],
                totalTokensEstimate: 0,
                wasChunked: false,
                totalChars: 0
            };
        }
        // Check if content needs chunking (REQ-CHUNK-002: minChars threshold)
        if (!this.shouldChunk(content)) {
            // Single chunk - no need to split
            const estimatedTokens = this.estimateTokens(content, options?.contentType);
            return {
                chunks: [{
                        text: content.trim(),
                        metadata: {
                            parentId,
                            chunkIndex: 0,
                            totalChunks: 1,
                            startOffset: 0,
                            endOffset: content.length,
                            domain: metadata.domain,
                            type: metadata.type,
                            tags: metadata.tags,
                            estimatedTokens
                        }
                    }],
                totalTokensEstimate: estimatedTokens,
                wasChunked: false,
                totalChars: content.length
            };
        }
        // Use SymmetricChunker with position tracking (TASK-CHUNK-009)
        const chunksWithPositions = await this.chunker.chunkWithPositions(content);
        // Convert to KnowledgeChunks with metadata
        const contentType = options?.contentType ?? ContentTypeEnum.MIXED;
        let totalTokensEstimate = 0;
        const knowledgeChunks = chunksWithPositions.map((chunk, idx) => {
            const estimatedTokens = this.estimateTokens(chunk.text, contentType);
            totalTokensEstimate += estimatedTokens;
            return {
                text: chunk.text,
                metadata: {
                    parentId,
                    chunkIndex: idx,
                    totalChunks: chunksWithPositions.length,
                    startOffset: chunk.start,
                    endOffset: chunk.end,
                    domain: metadata.domain,
                    type: metadata.type,
                    tags: metadata.tags,
                    estimatedTokens
                }
            };
        });
        return {
            chunks: knowledgeChunks,
            totalTokensEstimate,
            wasChunked: knowledgeChunks.length > 1,
            totalChars: content.length
        };
    }
    /**
     * Estimate token count for content
     * Implements: REQ-CHUNK-009 (content-aware token estimation)
     *
     * @param text - Text to estimate tokens for
     * @param contentType - Content type for ratio selection (default: MIXED)
     * @returns Estimated token count
     */
    estimateTokens(text, contentType) {
        if (!text)
            return 0;
        const type = contentType ?? ContentTypeEnum.MIXED;
        const ratio = TOKEN_RATIOS[type] ?? TOKEN_RATIOS[ContentTypeEnum.MIXED];
        // Count words (split on whitespace)
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;
        // Apply content-type specific ratio
        return Math.ceil(wordCount * ratio);
    }
    /**
     * Check if content should be chunked
     * Implements: REQ-CHUNK-002 (minChars threshold)
     *
     * @param content - Content to check
     * @returns True if content exceeds maxChars and should be chunked
     */
    shouldChunk(content) {
        if (!content)
            return false;
        // Only chunk if content exceeds maxChars threshold
        return content.length > this.config.maxChars;
    }
    /**
     * Get current chunking configuration
     * @returns Current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Reconstruct content from chunks
     * Implements: REQ-CHUNK-010 (backward compatible retrieval)
     *
     * @param chunks - Array of KnowledgeChunks in order
     * @returns Reconstructed content string
     */
    reconstructContent(chunks) {
        if (chunks.length === 0)
            return '';
        // For single chunk: validate totalChunks === 1 (TASK-CHUNK-005 fix)
        if (chunks.length === 1) {
            if (chunks[0].metadata.totalChunks !== 1) {
                throw new Error(`Expected ${chunks[0].metadata.totalChunks} chunks, got 1 for parent ${chunks[0].metadata.parentId}`);
            }
            return chunks[0].text;
        }
        // Sort by chunk index to ensure correct order
        const sorted = [...chunks].sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex);
        // Validate chunk sequence
        const expectedTotal = sorted[0].metadata.totalChunks;
        const parentId = sorted[0].metadata.parentId;
        for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].metadata.chunkIndex !== i) {
                throw new Error(`Missing chunk at index ${i} for parent ${parentId}`);
            }
            if (sorted[i].metadata.totalChunks !== expectedTotal) {
                throw new Error(`Inconsistent totalChunks for parent ${parentId}`);
            }
        }
        if (sorted.length !== expectedTotal) {
            throw new Error(`Expected ${expectedTotal} chunks, got ${sorted.length} for parent ${parentId}`);
        }
        // Join chunks - use simple concatenation with paragraph separators
        // The overlap from chunking should make this seamless
        return sorted.map(c => c.text).join('\n\n');
    }
    /**
     * Validate that chunks can be reconstructed
     * Implements: REQ-CHUNK-010 (backward compatible retrieval)
     *
     * @param chunks - Array of KnowledgeChunks to validate
     * @returns True if chunks form a complete, valid sequence
     */
    canReconstruct(chunks) {
        if (chunks.length === 0)
            return false;
        // For single chunk: validate totalChunks === 1 (TASK-CHUNK-005 fix)
        if (chunks.length === 1) {
            return chunks[0].metadata.totalChunks === 1;
        }
        try {
            const sorted = [...chunks].sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex);
            const expectedTotal = sorted[0].metadata.totalChunks;
            const parentId = sorted[0].metadata.parentId;
            // Check all chunks have same parent and total
            for (let i = 0; i < sorted.length; i++) {
                if (sorted[i].metadata.chunkIndex !== i)
                    return false;
                if (sorted[i].metadata.totalChunks !== expectedTotal)
                    return false;
                if (sorted[i].metadata.parentId !== parentId)
                    return false;
            }
            return sorted.length === expectedTotal;
        }
        catch {
            return false;
        }
    }
    /**
     * Detect content type from text for token estimation
     * Helper method for REQ-CHUNK-009
     *
     * @param text - Text to analyze
     * @returns Detected content type
     */
    detectContentType(text) {
        // Check for code blocks
        if (/```[\s\S]*?```/.test(text) || /^\s{4}[^\s]/m.test(text)) {
            return ContentTypeEnum.CODE;
        }
        // Check for tables
        if (/\|[^\n]+\|/m.test(text)) {
            return ContentTypeEnum.TABLE;
        }
        // Check for citations
        if (/\[\d+\]|\(\d{4}\)|et al\./i.test(text)) {
            return ContentTypeEnum.CITATION;
        }
        // Default to prose
        return ContentTypeEnum.PROSE;
    }
}
/**
 * Singleton instance for common use
 */
let defaultChunker = null;
/**
 * Get or create the default KnowledgeChunker instance
 * @returns Default KnowledgeChunker singleton
 */
export function getDefaultKnowledgeChunker() {
    if (!defaultChunker) {
        defaultChunker = new KnowledgeChunker();
    }
    return defaultChunker;
}
/**
 * Create a new KnowledgeChunker with custom configuration
 * @param config - Partial configuration to merge with defaults
 * @returns New KnowledgeChunker instance
 */
export function createKnowledgeChunker(config) {
    return new KnowledgeChunker(config);
}
//# sourceMappingURL=knowledge-chunker.js.map