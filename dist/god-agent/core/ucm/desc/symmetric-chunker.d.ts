/**
 * SPRINT 3 - DESC-001: Symmetric Chunker
 * RULE-064: Same chunking algorithm for storage AND retrieval
 *
 * Structure-aware chunking that preserves semantic boundaries
 * using protected patterns and configurable break points.
 */
import type { IChunkingConfig, ISymmetricChunker, IChunkWithPosition } from '../types.js';
/**
 * SymmetricChunker - RULE-064 compliant chunking
 *
 * Key features:
 * - Same algorithm for storage and retrieval
 * - Structure-aware (respects code blocks, tables, Task() calls)
 * - Configurable break patterns for semantic boundaries
 * - Overlap for context preservation
 */
export declare class SymmetricChunker implements ISymmetricChunker {
    private config;
    constructor(config?: Partial<IChunkingConfig>);
    /**
     * Chunk text using symmetric algorithm
     * RULE-064: This SAME method is used for both storage and retrieval
     */
    chunk(text: string): Promise<string[]>;
    /**
     * Chunk text with position metadata for reconstruction
     * Implements: REQ-CHUNK-003 (offset tracking)
     * RULE-064: Same algorithm as chunk(), returns positions for reconstruction
     */
    chunkWithPositions(text: string): Promise<IChunkWithPosition[]>;
    /**
     * Merge chunks that are smaller than minChars with adjacent chunks
     * Implements: REQ-CHUNK-002 (minimum chunk size)
     */
    private mergeTinyChunks;
    /**
     * Find regions that must not be split (code blocks, tables, Task() calls)
     */
    private findProtectedRegions;
    /**
     * Merge overlapping or adjacent ranges
     */
    private mergeRanges;
    /**
     * Perform the actual chunking with overlap
     */
    private performChunking;
    /**
     * Find the end of a chunk, respecting max size and protected regions
     */
    private findChunkEnd;
    /**
     * Find a good break point using break patterns
     * RULE-064: Uses DEFAULT_BREAK_PATTERNS for semantic boundaries
     */
    private findBreakPoint;
    /**
     * Get current chunking configuration
     */
    getConfig(): IChunkingConfig;
    /**
     * Update chunking configuration
     */
    updateConfig(config: Partial<IChunkingConfig>): void;
}
//# sourceMappingURL=symmetric-chunker.d.ts.map