/**
 * SPRINT 3 - DESC-001: Symmetric Chunker
 * RULE-064: Same chunking algorithm for storage AND retrieval
 *
 * Structure-aware chunking that preserves semantic boundaries
 * using protected patterns and configurable break points.
 */
import { DEFAULT_CHUNKING_CONFIG, PROTECTED_PATTERNS, DEFAULT_BREAK_PATTERNS } from '../config.js';
import { DESCChunkingError } from '../errors.js';
/**
 * SymmetricChunker - RULE-064 compliant chunking
 *
 * Key features:
 * - Same algorithm for storage and retrieval
 * - Structure-aware (respects code blocks, tables, Task() calls)
 * - Configurable break patterns for semantic boundaries
 * - Overlap for context preservation
 */
export class SymmetricChunker {
    config;
    constructor(config) {
        this.config = {
            ...DEFAULT_CHUNKING_CONFIG,
            ...config
        };
    }
    /**
     * Chunk text using symmetric algorithm
     * RULE-064: This SAME method is used for both storage and retrieval
     */
    async chunk(text) {
        try {
            // Validate input
            if (!text || text.trim().length === 0) {
                return [];
            }
            // Find all protected regions that should not be split
            const protectedRegions = this.findProtectedRegions(text);
            // Perform chunking while respecting protected regions
            const chunks = this.performChunking(text, protectedRegions);
            // Enforce maximum chunk limit
            if (chunks.length > this.config.maxChunks) {
                throw new DESCChunkingError(`Text produced ${chunks.length} chunks, exceeding maximum of ${this.config.maxChunks}`, { chunkCount: chunks.length, maxChunks: this.config.maxChunks });
            }
            return chunks.map(c => c.text);
        }
        catch (error) {
            if (error instanceof DESCChunkingError) {
                throw error;
            }
            throw new DESCChunkingError(`Chunking failed: ${error instanceof Error ? error.message : String(error)}`, { originalError: error });
        }
    }
    /**
     * Find regions that must not be split (code blocks, tables, Task() calls)
     */
    findProtectedRegions(text) {
        const regions = [];
        for (const regex of PROTECTED_PATTERNS) {
            // Reset lastIndex for global regexes
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                regions.push({
                    start: match.index,
                    end: match.index + match[0].length
                });
            }
        }
        // Merge overlapping regions
        return this.mergeRanges(regions);
    }
    /**
     * Merge overlapping or adjacent ranges
     */
    mergeRanges(ranges) {
        if (ranges.length === 0)
            return [];
        // Sort by start position
        const sorted = [...ranges].sort((a, b) => a.start - b.start);
        const merged = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const last = merged[merged.length - 1];
            if (current.start <= last.end) {
                // Overlapping or adjacent - merge
                last.end = Math.max(last.end, current.end);
            }
            else {
                // Non-overlapping - add new range
                merged.push(current);
            }
        }
        return merged;
    }
    /**
     * Perform the actual chunking with overlap
     */
    performChunking(text, protectedRegions) {
        const chunks = [];
        let position = 0;
        let chunkIndex = 0;
        while (position < text.length) {
            // Find the end of this chunk
            const chunkEnd = this.findChunkEnd(text, position, protectedRegions);
            // Extract chunk text
            const chunkText = text.substring(position, chunkEnd).trim();
            if (chunkText.length > 0) {
                chunks.push({
                    text: chunkText,
                    start: position,
                    end: chunkEnd,
                    index: chunkIndex++
                });
            }
            // Move position forward, accounting for overlap
            if (chunkEnd >= text.length) {
                break;
            }
            // Calculate next position with overlap
            const overlapStart = Math.max(position, chunkEnd - this.config.overlap);
            // Find a good break point within the overlap region
            position = this.findBreakPoint(text, overlapStart, chunkEnd);
        }
        return chunks;
    }
    /**
     * Find the end of a chunk, respecting max size and protected regions
     */
    findChunkEnd(text, start, protectedRegions) {
        const maxEnd = Math.min(start + this.config.maxChars, text.length);
        // Check if we're inside a protected region
        const inProtected = protectedRegions.find(r => start >= r.start && start < r.end);
        if (inProtected) {
            // We're inside a protected region - include the entire region
            return Math.min(inProtected.end, text.length);
        }
        // Find the ideal break point before maxEnd
        let breakPoint = this.findBreakPoint(text, start, maxEnd);
        // Check if break point would split a protected region
        const wouldSplitProtected = protectedRegions.find(r => breakPoint > r.start && breakPoint < r.end);
        if (wouldSplitProtected) {
            // Either include the whole region or stop before it
            if (wouldSplitProtected.start - start < this.config.maxChars / 2) {
                // Region is close to start - include it
                breakPoint = Math.min(wouldSplitProtected.end, text.length);
            }
            else {
                // Region is far - stop before it
                breakPoint = wouldSplitProtected.start;
            }
        }
        return breakPoint;
    }
    /**
     * Find a good break point using break patterns
     * RULE-064: Uses DEFAULT_BREAK_PATTERNS for semantic boundaries
     */
    findBreakPoint(text, start, maxEnd) {
        const searchText = text.substring(start, maxEnd);
        let bestBreak = maxEnd;
        let bestPriority = -1;
        // Try each break pattern in priority order
        for (const breakPattern of DEFAULT_BREAK_PATTERNS) {
            // Clone regex to reset lastIndex
            const regex = new RegExp(breakPattern.pattern.source, breakPattern.pattern.flags || 'g');
            let match;
            let lastMatch = null;
            while ((match = regex.exec(searchText)) !== null) {
                lastMatch = match;
            }
            if (lastMatch) {
                const breakPos = start + lastMatch.index + lastMatch[0].length;
                if (breakPattern.priority > bestPriority && breakPos < maxEnd) {
                    bestBreak = breakPos;
                    bestPriority = breakPattern.priority;
                }
            }
        }
        // If no good break point found, use maxEnd
        if (bestBreak === maxEnd) {
            return maxEnd;
        }
        return bestBreak;
    }
    /**
     * Get current chunking configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update chunking configuration
     */
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
    }
}
//# sourceMappingURL=symmetric-chunker.js.map