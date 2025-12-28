/**
 * SessionManager - Handles pipeline session persistence
 * Implements REQ-PIPE-020, REQ-PIPE-021, REQ-PIPE-022, REQ-PIPE-023
 */
import type { PipelineSession, SessionStatus } from './cli-types.js';
/**
 * SessionManager class for pipeline session persistence
 */
export declare class SessionManager {
    private sessionDir;
    constructor(baseDir?: string);
    /**
     * Create new session object with initial state
     * [REQ-PIPE-020, REQ-PIPE-021, REQ-PIPE-023]
     */
    createSession(sessionId: string, query: string, styleProfileId: string, pipelineId: string): PipelineSession;
    /**
     * Save session to disk with atomic write pattern
     * Uses temp file + rename to prevent corruption
     * [REQ-PIPE-020]
     */
    saveSession(session: PipelineSession): Promise<void>;
    /**
     * Load session from disk with validation
     * [REQ-PIPE-020]
     */
    loadSession(sessionId: string): Promise<PipelineSession>;
    /**
     * Check if session exists on disk
     */
    sessionExists(sessionId: string): Promise<boolean>;
    /**
     * Check if session has expired (inactive > 24 hours)
     * [REQ-PIPE-022]
     */
    isSessionExpired(session: PipelineSession): boolean;
    /**
     * Update session's lastActivityTime
     * Used by next command to keep session alive
     * [REQ-PIPE-002]
     */
    updateActivity(session: PipelineSession): Promise<void>;
    /**
     * Get sessions active within last N days
     * Default: 7 days for list command
     */
    listSessions(options?: {
        includeAll?: boolean;
        maxAgeDays?: number;
    }): Promise<PipelineSession[]>;
    /**
     * Update session status
     */
    updateStatus(session: PipelineSession, status: SessionStatus): Promise<void>;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string): Promise<void>;
    /**
     * Get most recently active session
     */
    getMostRecentSession(): Promise<PipelineSession | null>;
    /**
     * Get session directory path
     */
    getSessionDirectory(): string;
    /**
     * Helper: Get session file path
     */
    private getSessionPath;
    /**
     * Helper: Ensure session directory exists
     */
    private ensureSessionDirectory;
    /**
     * Helper: Validate session structure
     */
    private validateSession;
    /**
     * Helper: Sleep utility for retry delay
     */
    private sleep;
}
/**
 * Session not found error
 */
export declare class SessionNotFoundError extends Error {
    readonly sessionId: string;
    constructor(sessionId: string);
}
/**
 * Session corrupted error (invalid JSON)
 */
export declare class SessionCorruptedError extends Error {
    readonly sessionId: string;
    constructor(sessionId: string);
}
/**
 * Session persist error (disk write failure)
 */
export declare class SessionPersistError extends Error {
    readonly session: PipelineSession;
    constructor(message: string, session: PipelineSession);
}
/**
 * Session expired error
 */
export declare class SessionExpiredError extends Error {
    readonly sessionId: string;
    constructor(sessionId: string);
}
//# sourceMappingURL=session-manager.d.ts.map