/**
 * Token Usage Tracker
 * TASK-MON-003
 *
 * Tracks and persists token usage for learning optimization.
 *
 * CONSTITUTION COMPLIANCE:
 * - REQ-CONST-004: Metrics persisted for learning
 * - REQ-CONST-014: Token usage tracked and persisted
 */
/** Token usage record */
export interface ITokenUsage {
    id: string;
    sessionId: string;
    requestId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    taskType: string;
    agentId: string;
    trajectoryId?: string;
    timestamp: number;
}
/** Token statistics */
export interface ITokenStats {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    averageInputTokens: number;
    averageOutputTokens: number;
    averageTotalTokens: number;
    requestCount: number;
}
/** Token usage input (without generated fields) */
export type ITokenUsageInput = Omit<ITokenUsage, 'id' | 'timestamp'>;
/** Filter for stats queries */
export interface ITokenStatsFilter {
    taskType?: string;
    agentId?: string;
    sessionId?: string;
    since?: number;
}
/**
 * Token Usage Tracker
 *
 * Tracks and persists token usage metrics to SQLite for learning optimization.
 * Implements buffered writes for performance and provides statistical queries.
 */
export declare class TokenTracker {
    private readonly buffer;
    private readonly bufferLimit;
    private flushTimeout;
    private readonly flushIntervalMs;
    private schemaInitialized;
    constructor(config?: {
        bufferLimit?: number;
        flushIntervalMs?: number;
    });
    /** Ensure database schema exists */
    private ensureSchema;
    /** Start auto-flush timer */
    private startAutoFlush;
    /** Record token usage */
    record(usage: ITokenUsageInput): void;
    /** Flush buffer to SQLite (REQ-CONST-014) */
    flush(): number;
    /** Get token statistics */
    getStats(filter?: ITokenStatsFilter): ITokenStats;
    /** Get usage by task type */
    getUsageByTaskType(taskType: string, limit?: number): ITokenUsage[];
    /** Get usage by trajectory */
    getUsageByTrajectory(trajectoryId: string): ITokenUsage[];
    /** Get usage by session */
    getUsageBySession(sessionId: string, limit?: number): ITokenUsage[];
    /** Get usage by agent */
    getUsageByAgent(agentId: string, limit?: number): ITokenUsage[];
    /** Get recent usage */
    getRecent(limit?: number): ITokenUsage[];
    /** Get usage in time range */
    getUsageInRange(startTime: number, endTime: number): ITokenUsage[];
    /** Get aggregated stats by task type */
    getStatsByTaskType(): Map<string, ITokenStats>;
    /** Get aggregated stats by agent */
    getStatsByAgent(): Map<string, ITokenStats>;
    /** Convert DB rows to ITokenUsage */
    private rowsToUsage;
    /** Generate unique ID */
    private generateId;
    /** Get buffer size (for testing) */
    getBufferSize(): number;
    /** Get pending buffer entries (for testing) */
    getBufferedEntries(): ITokenUsage[];
    /** Stop auto-flush and flush remaining */
    close(): void;
}
/**
 * Get the singleton TokenTracker instance
 */
export declare function getTokenTracker(): TokenTracker;
/**
 * Reset the TokenTracker singleton (for testing)
 */
export declare function _resetTokenTrackerForTesting(): void;
//# sourceMappingURL=token-tracker.d.ts.map