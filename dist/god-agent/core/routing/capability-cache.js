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
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
// ==================== Constants ====================
/** REQ-CAPIDX-002: Cache storage directory */
const CACHE_DIR = '.agentdb/capability-cache';
/** REQ-CAPIDX-005: Embedding dimension validation */
const EMBEDDING_DIMENSION = 1536;
/** REQ-CAPIDX-005: Cache format version for compatibility */
const CACHE_FORMAT_VERSION = 1;
/** REQ-CAPIDX-002: Cache file names */
const CACHE_FILES = {
    HASH: 'hash.txt',
    EMBEDDINGS: 'embeddings.json',
    METADATA: 'metadata.json',
};
// ==================== Implementation ====================
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
export class CapabilityIndexCache {
    projectRoot;
    cacheDir;
    agentsPath;
    /** REQ-CAPIDX-006: Cached hash to avoid recomputation within same operation */
    cachedContentHash = null;
    cachedHashTimestamp = 0;
    // 500ms TTL - enough for isValid()+load() sequence, short enough for tests
    static HASH_CACHE_TTL_MS = 500;
    /**
     * Initialize cache manager
     *
     * @param projectRoot - Project root directory (default: process.cwd())
     * @param agentsPath - Relative path to agents directory (default: .claude/agents)
     */
    constructor(projectRoot = process.cwd(), agentsPath = '.claude/agents') {
        this.projectRoot = projectRoot;
        this.cacheDir = path.join(projectRoot, CACHE_DIR);
        this.agentsPath = path.join(projectRoot, agentsPath);
    }
    /**
     * REQ-CAPIDX-001: Recursively find all .md files in a directory
     * Uses fs.readdir instead of glob for no external dependencies
     *
     * @param dirPath - Directory to search
     * @returns Array of absolute file paths
     */
    async findMarkdownFiles(dirPath) {
        const results = [];
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    // Recursively search subdirectories
                    const subFiles = await this.findMarkdownFiles(fullPath);
                    results.push(...subFiles);
                }
                else if (entry.isFile() && entry.name.endsWith('.md')) {
                    results.push(fullPath);
                }
            }
        }
        catch (error) {
            // Directory doesn't exist or can't be read
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        return results;
    }
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
    async computeContentHash() {
        // REQ-CAPIDX-006: Return cached hash if still fresh (within TTL)
        const now = Date.now();
        if (this.cachedContentHash !== null &&
            now - this.cachedHashTimestamp < CapabilityIndexCache.HASH_CACHE_TTL_MS) {
            return this.cachedContentHash;
        }
        const startTime = performance.now();
        try {
            // REQ-CAPIDX-001: Find all agent markdown files using recursive readdir
            const files = await this.findMarkdownFiles(this.agentsPath);
            // Sort for deterministic ordering
            files.sort();
            if (files.length === 0) {
                throw new Error(`No agent files found in ${this.agentsPath}`);
            }
            console.log(`[CapabilityCache] Computing content hash for ${files.length} files`);
            // Create hash context
            const hash = crypto.createHash('sha256');
            // Hash each file's path and content
            for (const file of files) {
                const absolutePath = path.isAbsolute(file) ? file : path.join(this.projectRoot, file);
                const relativePath = path.relative(this.projectRoot, absolutePath);
                const content = await fs.readFile(absolutePath, 'utf-8');
                // Include path to detect renames
                hash.update(relativePath);
                hash.update('\n');
                hash.update(content);
            }
            const result = hash.digest('hex');
            const duration = performance.now() - startTime;
            console.log(`[CapabilityCache] Hash computed in ${duration.toFixed(2)}ms: ${result.slice(0, 16)}...`);
            // REQ-CAPIDX-006: Warn if performance target exceeded
            if (duration > 500) {
                console.warn(`[CapabilityCache] Hash computation exceeded 500ms target: ${duration.toFixed(2)}ms`);
            }
            // REQ-CAPIDX-006: Cache the computed hash for performance
            this.cachedContentHash = result;
            this.cachedHashTimestamp = Date.now();
            return result;
        }
        catch (error) {
            throw new Error(`Failed to compute content hash: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
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
    async isValid() {
        try {
            const result = await this.validateCache();
            return result.isValid;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * REQ-CAPIDX-003: Load cached embeddings with validation
     * REQ-CAPIDX-005: Full validation of cache integrity
     * REQ-CAPIDX-006: Target < 100ms on cache hit
     * REQ-CAPIDX-007: Comprehensive logging
     *
     * @returns Cached embeddings if valid, null if invalid or missing
     */
    async load() {
        const startTime = performance.now();
        try {
            // REQ-CAPIDX-005: Validate cache
            const validation = await this.validateCache();
            if (!validation.isValid) {
                console.log(`[CapabilityCache] Cache MISS - ${validation.reason}: ${validation.details || ''}`);
                return null;
            }
            // Load embeddings
            const embeddingsPath = path.join(this.cacheDir, CACHE_FILES.EMBEDDINGS);
            const embeddingsData = await fs.readFile(embeddingsPath, 'utf-8');
            const embeddings = JSON.parse(embeddingsData);
            const duration = performance.now() - startTime;
            // REQ-CAPIDX-007: Log successful cache hit
            console.log(`[CapabilityCache] Cache HIT - loaded ${embeddings.agentCount} agents in ${duration.toFixed(2)}ms`);
            // REQ-CAPIDX-006: Warn if performance target exceeded
            if (duration > 100) {
                console.warn(`[CapabilityCache] Cache load exceeded 100ms target: ${duration.toFixed(2)}ms`);
            }
            return embeddings;
        }
        catch (error) {
            console.log(`[CapabilityCache] Cache MISS - load failed: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
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
    async validateCache() {
        try {
            // RULE-VAL-001: Check hash file exists
            const hashPath = path.join(this.cacheDir, CACHE_FILES.HASH);
            try {
                await fs.access(hashPath);
            }
            catch {
                return {
                    isValid: false,
                    reason: 'CACHE_NOT_FOUND',
                    details: 'hash.txt not found',
                };
            }
            // RULE-VAL-002: Compare hashes
            const cachedHash = (await fs.readFile(hashPath, 'utf-8')).trim();
            const currentHash = await this.computeContentHash();
            if (cachedHash !== currentHash) {
                return {
                    isValid: false,
                    reason: 'HASH_MISMATCH',
                    details: `cached=${cachedHash.slice(0, 8)}... current=${currentHash.slice(0, 8)}...`,
                };
            }
            // RULE-VAL-006: Check metadata exists
            const metadataPath = path.join(this.cacheDir, CACHE_FILES.METADATA);
            let metadata;
            try {
                const metadataData = await fs.readFile(metadataPath, 'utf-8');
                metadata = JSON.parse(metadataData);
            }
            catch {
                return {
                    isValid: false,
                    reason: 'METADATA_MISSING',
                    details: 'metadata.json not found or invalid',
                };
            }
            // RULE-VAL-007: Check version compatibility
            if (metadata.cacheFormatVersion !== CACHE_FORMAT_VERSION) {
                return {
                    isValid: false,
                    reason: 'VERSION_MISMATCH',
                    details: `cache version ${metadata.cacheFormatVersion}, expected ${CACHE_FORMAT_VERSION}`,
                };
            }
            // RULE-VAL-003: Parse embeddings JSON
            const embeddingsPath = path.join(this.cacheDir, CACHE_FILES.EMBEDDINGS);
            let embeddings;
            try {
                const embeddingsData = await fs.readFile(embeddingsPath, 'utf-8');
                embeddings = JSON.parse(embeddingsData);
            }
            catch {
                return {
                    isValid: false,
                    reason: 'CORRUPTED_JSON',
                    details: 'embeddings.json not found or invalid JSON',
                };
            }
            // RULE-VAL-004: Validate embedding dimensions (sample check)
            const sampleKeys = Object.keys(embeddings.entries).slice(0, 5);
            for (const key of sampleKeys) {
                const entry = embeddings.entries[key];
                if (entry.embedding.length !== EMBEDDING_DIMENSION) {
                    return {
                        isValid: false,
                        reason: 'DIMENSION_MISMATCH',
                        details: `agent ${key} has ${entry.embedding.length}D, expected ${EMBEDDING_DIMENSION}D`,
                    };
                }
            }
            // RULE-VAL-005: Validate agent count
            const entryCount = Object.keys(embeddings.entries).length;
            if (entryCount !== embeddings.agentCount) {
                return {
                    isValid: false,
                    reason: 'AGENT_COUNT_MISMATCH',
                    details: `entries=${entryCount}, declared=${embeddings.agentCount}`,
                };
            }
            return { isValid: true };
        }
        catch (error) {
            return {
                isValid: false,
                reason: 'CORRUPTED_JSON',
                details: error instanceof Error ? error.message : String(error),
            };
        }
    }
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
    async save(embeddings, hash) {
        const startTime = performance.now();
        const timestamp = Date.now();
        try {
            // 1. Ensure cache directory exists
            await fs.mkdir(this.cacheDir, { recursive: true });
            // 2. Clean up any orphaned temp files from previous crashes
            await this.cleanupTempFiles();
            // 3. Prepare metadata
            const metadata = {
                version: embeddings.version,
                cacheFormatVersion: CACHE_FORMAT_VERSION,
                createdAt: timestamp,
                lastValidatedAt: timestamp,
                contentHash: hash,
                agentCount: embeddings.agentCount,
                embeddingDimension: EMBEDDING_DIMENSION,
                embeddingProvider: 'local',
                agentsPath: this.agentsPath,
                buildDurationMs: 0, // Will be set by caller if needed
                fileHashes: {},
            };
            // 4. Write to temporary files
            const embeddingsTempPath = path.join(this.cacheDir, `${CACHE_FILES.EMBEDDINGS}.${timestamp}.tmp`);
            const metadataTempPath = path.join(this.cacheDir, `${CACHE_FILES.METADATA}.${timestamp}.tmp`);
            const hashTempPath = path.join(this.cacheDir, `${CACHE_FILES.HASH}.${timestamp}.tmp`);
            await fs.writeFile(embeddingsTempPath, JSON.stringify(embeddings, null, 2), 'utf-8');
            await fs.writeFile(metadataTempPath, JSON.stringify(metadata, null, 2), 'utf-8');
            await fs.writeFile(hashTempPath, hash, 'utf-8');
            // 5. Atomic rename in order: embeddings -> metadata -> hash
            // hash.txt is last so it acts as sentinel
            const embeddingsPath = path.join(this.cacheDir, CACHE_FILES.EMBEDDINGS);
            const metadataPath = path.join(this.cacheDir, CACHE_FILES.METADATA);
            const hashPath = path.join(this.cacheDir, CACHE_FILES.HASH);
            await fs.rename(embeddingsTempPath, embeddingsPath);
            await fs.rename(metadataTempPath, metadataPath);
            await fs.rename(hashTempPath, hashPath);
            const duration = performance.now() - startTime;
            // Get file size
            const stats = await fs.stat(embeddingsPath);
            const sizeBytes = stats.size;
            // REQ-CAPIDX-007: Log successful save
            console.log(`[CapabilityCache] Saved cache: ${embeddings.agentCount} agents, ${(sizeBytes / 1024 / 1024).toFixed(2)}MB in ${duration.toFixed(2)}ms`);
            // REQ-CAPIDX-006: Warn if performance target exceeded
            if (duration > 1000) {
                console.warn(`[CapabilityCache] Cache save exceeded 1000ms target: ${duration.toFixed(2)}ms`);
            }
        }
        catch (error) {
            // Clean up temp files on failure
            await this.cleanupTempFiles();
            throw new Error(`Failed to save cache: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
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
    clearHashCache() {
        this.cachedContentHash = null;
        this.cachedHashTimestamp = 0;
    }
    async invalidate() {
        // Clear in-memory hash cache
        this.clearHashCache();
        try {
            const files = [
                path.join(this.cacheDir, CACHE_FILES.HASH),
                path.join(this.cacheDir, CACHE_FILES.EMBEDDINGS),
                path.join(this.cacheDir, CACHE_FILES.METADATA),
            ];
            for (const file of files) {
                try {
                    await fs.unlink(file);
                }
                catch {
                    // Ignore if file doesn't exist
                }
            }
            console.log('[CapabilityCache] Cache invalidated');
        }
        catch (error) {
            throw new Error(`Failed to invalidate cache: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * REQ-CAPIDX-006: Get cache statistics
     *
     * @returns Cache statistics or null if cache doesn't exist
     */
    async getStats() {
        try {
            const hashPath = path.join(this.cacheDir, CACHE_FILES.HASH);
            const embeddingsPath = path.join(this.cacheDir, CACHE_FILES.EMBEDDINGS);
            const metadataPath = path.join(this.cacheDir, CACHE_FILES.METADATA);
            // Check if cache exists
            let exists = true;
            try {
                await fs.access(hashPath);
            }
            catch {
                exists = false;
            }
            if (!exists) {
                return null;
            }
            // Get current and cached hashes
            const currentHash = await this.computeContentHash();
            const cachedHash = (await fs.readFile(hashPath, 'utf-8')).trim();
            // Get metadata
            const metadataData = await fs.readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataData);
            // Get file size
            const stats = await fs.stat(embeddingsPath);
            const sizeBytes = stats.size;
            // Validate
            const validation = await this.validateCache();
            return {
                exists: true,
                isValid: validation.isValid,
                sizeBytes,
                agentCount: metadata.agentCount,
                createdAt: metadata.createdAt,
                currentHash,
                cachedHash,
                hashMatch: currentHash === cachedHash,
            };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * REQ-CAPIDX-004: Clean up orphaned temporary files
     * Called on startup and after failed writes
     */
    async cleanupTempFiles() {
        try {
            const files = await fs.readdir(this.cacheDir);
            const tempFiles = files.filter((f) => f.endsWith('.tmp'));
            for (const file of tempFiles) {
                try {
                    await fs.unlink(path.join(this.cacheDir, file));
                }
                catch {
                    // Ignore failures
                }
            }
            if (tempFiles.length > 0) {
                console.log(`[CapabilityCache] Cleaned up ${tempFiles.length} orphaned temp files`);
            }
        }
        catch {
            // Directory doesn't exist or can't be read - ignore
        }
    }
}
//# sourceMappingURL=capability-cache.js.map