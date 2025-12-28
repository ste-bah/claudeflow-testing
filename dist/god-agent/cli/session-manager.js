/**
 * SessionManager - Handles pipeline session persistence
 * Implements REQ-PIPE-020, REQ-PIPE-021, REQ-PIPE-022, REQ-PIPE-023
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { validate as isValidUUID } from 'uuid';
const SESSION_DIR = '.phd-sessions';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_WRITE_RETRIES = 3;
const RETRY_DELAY_MS = 100;
/**
 * SessionManager class for pipeline session persistence
 */
export class SessionManager {
    sessionDir;
    constructor(baseDir = process.cwd()) {
        this.sessionDir = path.join(baseDir, SESSION_DIR);
    }
    /**
     * Create new session object with initial state
     * [REQ-PIPE-020, REQ-PIPE-021, REQ-PIPE-023]
     */
    createSession(sessionId, query, styleProfileId, pipelineId) {
        // Validate UUID v4 format
        if (!isValidUUID(sessionId)) {
            throw new Error(`Invalid session ID format: ${sessionId}`);
        }
        const now = Date.now();
        return {
            sessionId,
            pipelineId,
            query,
            styleProfileId,
            status: 'running',
            currentPhase: 1,
            currentAgentIndex: 0,
            completedAgents: [],
            agentOutputs: {},
            startTime: now,
            lastActivityTime: now,
            errors: []
        };
    }
    /**
     * Save session to disk with atomic write pattern
     * Uses temp file + rename to prevent corruption
     * [REQ-PIPE-020]
     */
    async saveSession(session) {
        // Ensure directory exists
        await this.ensureSessionDirectory();
        const sessionPath = this.getSessionPath(session.sessionId);
        const tempPath = `${sessionPath}.tmp`;
        // Serialize session
        const json = JSON.stringify(session, null, 2);
        // Retry logic for disk failures
        let lastError = null;
        for (let attempt = 1; attempt <= MAX_WRITE_RETRIES; attempt++) {
            try {
                // Write to temp file
                await fs.writeFile(tempPath, json, 'utf-8');
                // Atomic rename
                await fs.rename(tempPath, sessionPath);
                return; // Success
            }
            catch (error) {
                lastError = error;
                if (attempt < MAX_WRITE_RETRIES) {
                    await this.sleep(RETRY_DELAY_MS);
                }
            }
        }
        // All retries failed
        throw new SessionPersistError(`Failed to save session after ${MAX_WRITE_RETRIES} attempts: ${lastError?.message}`, session);
    }
    /**
     * Load session from disk with validation
     * [REQ-PIPE-020]
     */
    async loadSession(sessionId) {
        // Validate UUID format
        if (!isValidUUID(sessionId)) {
            throw new SessionNotFoundError(sessionId);
        }
        const sessionPath = this.getSessionPath(sessionId);
        try {
            const content = await fs.readFile(sessionPath, 'utf-8');
            const session = JSON.parse(content);
            // Validate required fields
            this.validateSession(session);
            return session;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new SessionNotFoundError(sessionId);
            }
            if (error instanceof SyntaxError) {
                throw new SessionCorruptedError(sessionId);
            }
            throw error;
        }
    }
    /**
     * Check if session exists on disk
     */
    async sessionExists(sessionId) {
        if (!isValidUUID(sessionId)) {
            return false;
        }
        try {
            await fs.access(this.getSessionPath(sessionId));
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Check if session has expired (inactive > 24 hours)
     * [REQ-PIPE-022]
     */
    isSessionExpired(session) {
        const now = Date.now();
        const elapsed = now - session.lastActivityTime;
        return elapsed > SESSION_EXPIRY_MS;
    }
    /**
     * Update session's lastActivityTime
     * Used by next command to keep session alive
     * [REQ-PIPE-002]
     */
    async updateActivity(session) {
        session.lastActivityTime = Date.now();
        await this.saveSession(session);
    }
    /**
     * Get sessions active within last N days
     * Default: 7 days for list command
     */
    async listSessions(options = {}) {
        const { includeAll = false, maxAgeDays = 7 } = options;
        await this.ensureSessionDirectory();
        const files = await fs.readdir(this.sessionDir);
        const sessionFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.tmp'));
        const sessions = [];
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
        const now = Date.now();
        for (const file of sessionFiles) {
            try {
                const sessionId = file.replace('.json', '');
                const session = await this.loadSession(sessionId);
                // Filter by age unless includeAll
                if (includeAll) {
                    sessions.push(session);
                }
                else {
                    const age = now - session.lastActivityTime;
                    if (age <= maxAgeMs) {
                        sessions.push(session);
                    }
                }
            }
            catch (error) {
                // Skip corrupted sessions silently
                if (error instanceof SessionCorruptedError || error instanceof SessionNotFoundError) {
                    continue;
                }
                throw error;
            }
        }
        // Sort by lastActivityTime descending (most recent first)
        sessions.sort((a, b) => b.lastActivityTime - a.lastActivityTime);
        return sessions;
    }
    /**
     * Update session status
     */
    async updateStatus(session, status) {
        session.status = status;
        session.lastActivityTime = Date.now();
        await this.saveSession(session);
    }
    /**
     * Delete a session
     */
    async deleteSession(sessionId) {
        if (!isValidUUID(sessionId)) {
            throw new SessionNotFoundError(sessionId);
        }
        const sessionPath = this.getSessionPath(sessionId);
        try {
            await fs.unlink(sessionPath);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new SessionNotFoundError(sessionId);
            }
            throw error;
        }
    }
    /**
     * Get most recently active session
     */
    async getMostRecentSession() {
        const sessions = await this.listSessions({ maxAgeDays: 1 });
        return sessions.length > 0 ? sessions[0] : null;
    }
    /**
     * Get session directory path
     */
    getSessionDirectory() {
        return this.sessionDir;
    }
    /**
     * Helper: Get session file path
     */
    getSessionPath(sessionId) {
        return path.join(this.sessionDir, `${sessionId}.json`);
    }
    /**
     * Helper: Ensure session directory exists
     */
    async ensureSessionDirectory() {
        try {
            await fs.access(this.sessionDir);
        }
        catch {
            await fs.mkdir(this.sessionDir, { recursive: true });
        }
    }
    /**
     * Helper: Validate session structure
     */
    validateSession(session) {
        if (typeof session !== 'object' || session === null) {
            throw new Error('Invalid session: not an object');
        }
        const required = [
            'sessionId', 'pipelineId', 'query', 'styleProfileId', 'status',
            'currentPhase', 'currentAgentIndex', 'completedAgents',
            'startTime', 'lastActivityTime'
        ];
        for (const field of required) {
            if (!(field in session)) {
                throw new Error(`Invalid session: missing field ${field}`);
            }
        }
    }
    /**
     * Helper: Sleep utility for retry delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
/**
 * Session not found error
 */
export class SessionNotFoundError extends Error {
    sessionId;
    constructor(sessionId) {
        super(`Session not found: ${sessionId}`);
        this.name = 'SessionNotFoundError';
        this.sessionId = sessionId;
    }
}
/**
 * Session corrupted error (invalid JSON)
 */
export class SessionCorruptedError extends Error {
    sessionId;
    constructor(sessionId) {
        super(`Session corrupted: ${sessionId}`);
        this.name = 'SessionCorruptedError';
        this.sessionId = sessionId;
    }
}
/**
 * Session persist error (disk write failure)
 */
export class SessionPersistError extends Error {
    session;
    constructor(message, session) {
        super(message);
        this.name = 'SessionPersistError';
        this.session = session;
    }
}
/**
 * Session expired error
 */
export class SessionExpiredError extends Error {
    sessionId;
    constructor(sessionId) {
        super(`Session expired (inactive >24h): ${sessionId}`);
        this.name = 'SessionExpiredError';
        this.sessionId = sessionId;
    }
}
//# sourceMappingURL=session-manager.js.map