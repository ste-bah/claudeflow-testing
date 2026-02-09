/**
 * Pipeline File Claims
 *
 * Advisory lock system preventing concurrent agents from editing the same files.
 * Claims are advisory only - agents see conflicts in their prompt context
 * but are not hard-blocked from accessing files.
 *
 * @module src/god-agent/core/pipeline/pipeline-file-claims
 */
// =============================================================================
// FILE CLAIMS
// =============================================================================
/**
 * Advisory file lock system for parallel agent coordination.
 *
 * Write claims are exclusive - only one agent can write-claim a file at a time.
 * Read claims are non-exclusive - multiple agents can read the same file.
 * All claims are advisory: agents see conflicts but aren't hard-blocked.
 */
export class PipelineFileClaims {
    claims = new Map();
    /**
     * Claim a file for writing. Returns false if already write-claimed by another agent.
     */
    claimForWrite(agentKey, filePath) {
        const normalized = this.normalizePath(filePath);
        const existing = this.claims.get(normalized);
        // Allow re-claiming by same agent
        if (existing && existing.claimedBy === agentKey) {
            existing.operation = 'write';
            existing.claimedAt = Date.now();
            return true;
        }
        // Deny if write-claimed by another agent
        if (existing && existing.operation === 'write') {
            return false;
        }
        this.claims.set(normalized, {
            filePath: normalized,
            claimedBy: agentKey,
            claimedAt: Date.now(),
            operation: 'write',
        });
        return true;
    }
    /**
     * Claim a file for reading. Always succeeds (reads are non-exclusive).
     */
    claimForRead(agentKey, filePath) {
        const normalized = this.normalizePath(filePath);
        const existing = this.claims.get(normalized);
        // Don't overwrite a write claim with a read claim
        if (existing && existing.operation === 'write') {
            return true; // Still succeeds - reads are always allowed
        }
        // Only set if no existing claim (don't overwrite other reads)
        if (!existing) {
            this.claims.set(normalized, {
                filePath: normalized,
                claimedBy: agentKey,
                claimedAt: Date.now(),
                operation: 'read',
            });
        }
        return true;
    }
    /**
     * Release all claims held by an agent.
     */
    releaseAll(agentKey) {
        for (const [path, claim] of this.claims.entries()) {
            if (claim.claimedBy === agentKey) {
                this.claims.delete(path);
            }
        }
    }
    /**
     * Get all claims held by an agent.
     */
    getClaimsBy(agentKey) {
        return Array.from(this.claims.values()).filter(c => c.claimedBy === agentKey);
    }
    /**
     * Get the claim on a specific file, if any.
     */
    getClaimOn(filePath) {
        return this.claims.get(this.normalizePath(filePath));
    }
    /**
     * Get all write claims across all agents.
     */
    getAllWriteClaims() {
        return Array.from(this.claims.values()).filter(c => c.operation === 'write');
    }
    /**
     * Get files that an agent should avoid (write-claimed by other agents).
     */
    getConflicts(agentKey) {
        return Array.from(this.claims.values()).filter(c => c.claimedBy !== agentKey && c.operation === 'write');
    }
    /**
     * Normalize file path for consistent lookups.
     */
    normalizePath(filePath) {
        return filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
    }
}
//# sourceMappingURL=pipeline-file-claims.js.map