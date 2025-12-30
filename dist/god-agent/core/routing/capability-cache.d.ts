/**
 * TASK-CAPIDX-001: CapabilityIndex Hash-Based Caching
 * Agent 2: Implementation
 *
 * Constitution Compliance:
 * - RULE-008: Persist to disk (.agentdb/capability-cache/)
 * - RULE-009: Full state restore on restart
 * - RULE-015: Cache with eviction policy (hash mismatch)
 * - RULE-046: Atomic writes (temp file + rename)
 * - RULE-003: Requirement comments (REQ-CAPIDX-*)
 *
 * Performance Targets:
 * - Hash computation: < 500ms for 200 agents
 * - Cache hit load: < 100ms
 * - Cache save: < 1000ms
 *
 * @module src/god-agent/core/routing/capability-cache
 */
import type { TaskDomain } from './routing-types.js';
/**
 * REQ-CAPIDX-007: Reasons why cache is invalid
 */
export type CacheInvalidReason = 'CACHE_NOT_FOUND' | 'HASH_MISMATCH' | 'CORRUPTED_JSON' | 'DIMENSION_MISMATCH' | 'AGENT_COUNT_MISMATCH' | 'VERSION_MISMATCH' | 'METADATA_MISSING';
/**
 * REQ-CAPIDX-005: Cache validation result
 */
export interface CacheValidationResult {
    isValid: boolean;
    reason?: CacheInvalidReason;
    details?: string;
}
/**
 * REQ-CAPIDX-002: Cache metadata stored in metadata.json
 */
export interface ICacheMetadata {
    version: string;
    cacheFormatVersion: number;
    createdAt: number;
    lastValidatedAt: number;
    contentHash: string;
    agentCount: number;
    embeddingDimension: number;
    embeddingProvider: string;
    agentsPath: string;
    buildDurationMs: number;
    fileHashes: Record<string, string>;
}
/**
 * REQ-CAPIDX-002: Single cached embedding entry
 */
export interface ICachedEmbedding {
    agentKey: string;
    name: string;
    description: string;
    domains: TaskDomain[];
    keywords: string[];
    embedding: number[];
    successRate: number;
    taskCount: number;
    indexedAt: number;
}
/**
 * REQ-CAPIDX-002: Cached embeddings stored in embeddings.json
 */
export interface ICachedEmbeddings {
    version: string;
    generatedAt: number;
    embeddingDimension: number;
    agentCount: number;
    entries: Record<string, ICachedEmbedding>;
}
/**
 * REQ-CAPIDX-006: Cache statistics for monitoring
 */
export interface ICacheStats {
    exists: boolean;
    isValid: boolean;
    sizeBytes: number;
    agentCount: number;
    createdAt: number;
    currentHash: string;
    cachedHash: string | null;
    hashMatch: boolean;
}
/**
 * REQ-CAPIDX-003: Cache interface
 */
export interface ICapabilityIndexCache {
    computeContentHash(): Promise<string>;
    isValid(): Promise<boolean>;
    load(): Promise<ICachedEmbeddings | null>;
    save(embeddings: ICachedEmbeddings, hash: string): Promise<void>;
    invalidate(): Promise<void>;
    getStats(): Promise<ICacheStats | null>;
}
/**
 * CapabilityIndexCache: Hash-based cache for agent embeddings
 *
 * REQ-CAPIDX-001: Computes SHA256 hash of all agent files
 * REQ-CAPIDX-002: Stores cache in .agentdb/capability-cache/
 * REQ-CAPIDX-003: Validates cache on load
 * REQ-CAPIDX-004: Atomic writes using temp files
 * REQ-CAPIDX-005: Validates embedding dimensions and agent count
 * REQ-CAPIDX-006: Performance targets enforced
 * REQ-CAPIDX-007: Comprehensive logging
 * REQ-CAPIDX-008: No breaking changes to public API
 */
export declare class CapabilityIndexCache implements ICapabilityIndexCache {
    private readonly projectRoot;
    private readonly cacheDir;
    private readonly agentsPath;
    /** REQ-CAPIDX-006: Cached hash to avoid recomputation within same operation */
    private cachedContentHash;
    private cachedHashTimestamp;
    private static readonly HASH_CACHE_TTL_MS;
    /**
     * Initialize cache manager
     *
     * @param projectRoot - Project root directory (default: process.cwd())
     * @param agentsPath - Relative path to agents directory (default: .claude/agents)
     */
    constructor(projectRoot?: string, agentsPath?: string);
    /**
     * REQ-CAPIDX-001: Recursively find all .md files in a directory
     * Uses fs.readdir instead of glob for no external dependencies
     *
     * @param dirPath - Directory to search
     * @returns Array of absolute file paths
     */
    private findMarkdownFiles;
    /**
     * REQ-CAPIDX-001: Compute SHA256 hash of all agent files
     * REQ-CAPIDX-006: Target < 500ms for 200 agents
     *
     * Algorithm:
     * 1. Recursively find all .md files under .claude/agents/
     * 2. Sort file paths lexicographically for determinism
     * 3. Hash each file's path + content
     * 4. Return composite hash
     *
     * @returns SHA256 hash (64-character hex string)
     * @throws Error if agent directory doesn't exist or read fails
     */
    computeContentHash(): Promise<string>;
    /**
     * REQ-CAPIDX-003: Quick validation check
     * REQ-CAPIDX-005: Validates cache integrity
     *
     * Validation sequence (optimized for speed):
     * 1. Check hash.txt exists (~1ms)
     * 2. Compute current hash and compare (~100-500ms)
     * 3. If hash matches, assume cache is valid
     *
     * @returns true if cache is valid and can be loaded
     */
    isValid(): Promise<boolean>;
    /**
     * REQ-CAPIDX-003: Load cached embeddings with validation
     * REQ-CAPIDX-005: Full validation of cache integrity
     * REQ-CAPIDX-006: Target < 100ms on cache hit
     * REQ-CAPIDX-007: Comprehensive logging
     *
     * @returns Cached embeddings if valid, null if invalid or missing
     */
    load(): Promise<ICachedEmbeddings | null>;
    /**
     * REQ-CAPIDX-005: Comprehensive cache validation
     *
     * Validation rules (in order):
     * 1. RULE-VAL-001: Hash file exists
     * 2. RULE-VAL-002: Hash matches
     * 3. RULE-VAL-006: Metadata exists
     * 4. RULE-VAL-007: Version compatibility
     * 5. RULE-VAL-003: Valid JSON
     * 6. RULE-VAL-004: Dimension check
     * 7. RULE-VAL-005: Agent count match
     *
     * @returns Validation result
     */
    private validateCache;
    /**
     * REQ-CAPIDX-004: Atomic cache write
     * REQ-CAPIDX-046: Temp file + rename pattern
     * REQ-CAPIDX-006: Target < 1000ms
     * REQ-CAPIDX-007: Logging
     *
     * Write sequence:
     * 1. Ensure cache directory exists
     * 2. Write all files to .tmp versions
     * 3. Atomic rename in order: embeddings -> metadata -> hash
     * 4. Clean up any orphaned .tmp files
     *
     * Rationale: hash.txt is sentinel - its presence indicates valid cache
     *
     * @param embeddings - Embeddings to cache
     * @param hash - Content hash
     */
    save(embeddings: ICachedEmbeddings, hash: string): Promise<void>;
    /**
     * REQ-CAPIDX-003: Invalidate and delete cache
     * REQ-CAPIDX-007: Logging
     *
     * Deletes all cache files to force rebuild on next load
     */
    /**
     * Clear the in-memory hash cache.
     * Useful for tests that modify files and need fresh hash computation.
     */
    clearHashCache(): void;
    invalidate(): Promise<void>;
    /**
     * REQ-CAPIDX-006: Get cache statistics
     *
     * @returns Cache statistics or null if cache doesn't exist
     */
    getStats(): Promise<ICacheStats | null>;
    /**
     * REQ-CAPIDX-004: Clean up orphaned temporary files
     * Called on startup and after failed writes
     */
    private cleanupTempFiles;
}
//# sourceMappingURL=capability-cache.d.ts.map