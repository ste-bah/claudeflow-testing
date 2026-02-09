/**
 * Pipeline File Claims
 *
 * Advisory lock system preventing concurrent agents from editing the same files.
 * Claims are advisory only - agents see conflicts in their prompt context
 * but are not hard-blocked from accessing files.
 *
 * @module src/god-agent/core/pipeline/pipeline-file-claims
 */
export interface IFileClaim {
    /** Absolute or relative file path */
    filePath: string;
    /** Agent that claimed this file */
    claimedBy: string;
    /** Timestamp when claimed (ms) */
    claimedAt: number;
    /** Type of operation */
    operation: 'read' | 'write';
}
/**
 * Advisory file lock system for parallel agent coordination.
 *
 * Write claims are exclusive - only one agent can write-claim a file at a time.
 * Read claims are non-exclusive - multiple agents can read the same file.
 * All claims are advisory: agents see conflicts but aren't hard-blocked.
 */
export declare class PipelineFileClaims {
    private claims;
    /**
     * Claim a file for writing. Returns false if already write-claimed by another agent.
     */
    claimForWrite(agentKey: string, filePath: string): boolean;
    /**
     * Claim a file for reading. Always succeeds (reads are non-exclusive).
     */
    claimForRead(agentKey: string, filePath: string): boolean;
    /**
     * Release all claims held by an agent.
     */
    releaseAll(agentKey: string): void;
    /**
     * Get all claims held by an agent.
     */
    getClaimsBy(agentKey: string): IFileClaim[];
    /**
     * Get the claim on a specific file, if any.
     */
    getClaimOn(filePath: string): IFileClaim | undefined;
    /**
     * Get all write claims across all agents.
     */
    getAllWriteClaims(): IFileClaim[];
    /**
     * Get files that an agent should avoid (write-claimed by other agents).
     */
    getConflicts(agentKey: string): IFileClaim[];
    /**
     * Normalize file path for consistent lookups.
     */
    private normalizePath;
}
//# sourceMappingURL=pipeline-file-claims.d.ts.map