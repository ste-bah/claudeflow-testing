/**
 * UCM Daemon Client for phd-cli
 * Provides JSON-RPC 2.0 communication with the UCM daemon
 *
 * Used to integrate DESC episode injection and storage
 * directly into the PhD pipeline CLI commands.
 *
 * Features auto-start: if daemon is not running, automatically starts it.
 */
interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
        context: boolean;
        embedding: boolean;
        desc: boolean;
        recovery: boolean;
    };
    timestamp: string;
}
interface RetrievalResult {
    episodeId: string;
    answerText: string;
    maxSimilarity: number;
    matchedChunkType: 'query' | 'answer';
    matchedChunkIndex: number;
    searchChunkIndex: number;
    metadata?: Record<string, unknown>;
}
export declare class UCMDaemonClient {
    private socketPath;
    private timeout;
    private requestId;
    private autoStartAttempted;
    constructor(options?: {
        socketPath?: string;
        timeout?: number;
    });
    /**
     * Check if daemon socket exists
     */
    private socketExists;
    /**
     * Start the UCM daemon in background
     * Returns true if daemon started successfully
     */
    private startDaemon;
    /**
     * Ensure daemon is running, start if needed
     */
    private ensureDaemonRunning;
    /**
     * Call UCM daemon via JSON-RPC over Unix socket
     * Auto-starts daemon if not running
     */
    private call;
    /**
     * Check if UCM daemon is healthy
     */
    isHealthy(): Promise<boolean>;
    /**
     * Get detailed health status
     */
    healthCheck(): Promise<HealthCheckResult | null>;
    /**
     * Inject similar prior solutions into a prompt
     * Returns the augmented prompt or original if no matches/error
     */
    injectSolutions(prompt: string, options?: {
        threshold?: number;
        maxEpisodes?: number;
        agentType?: string;
        metadata?: Record<string, unknown>;
    }): Promise<{
        augmentedPrompt: string;
        episodesUsed: number;
        episodeIds: string[];
    }>;
    /**
     * Store a completed episode (agent result) for future retrieval
     */
    storeEpisode(queryText: string, answerText: string, metadata?: Record<string, unknown>): Promise<{
        episodeId: string;
        success: boolean;
    }>;
    /**
     * Retrieve similar episodes for a query
     */
    retrieveSimilar(searchText: string, options?: {
        threshold?: number;
        maxResults?: number;
    }): Promise<RetrievalResult[]>;
}
export declare function getUCMClient(): UCMDaemonClient;
export declare function resetUCMClient(): void;
export {};
//# sourceMappingURL=ucm-daemon-client.d.ts.map