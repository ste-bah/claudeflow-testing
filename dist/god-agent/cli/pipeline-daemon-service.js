/**
 * Pipeline Daemon Service Handler
 *
 * Wraps the coding pipeline CLI functions with a warm orchestrator bundle.
 * Holds UniversalAgent, orchestrator, agentRegistry, and patternMatcher
 * in memory so RPC calls avoid the ~1-30s cold-start penalty.
 *
 * Used by pipeline-daemon.ts via DaemonServer's registerService() pattern.
 */
import { init, next, complete, resume, } from './coding-pipeline-cli.js';
import { UniversalAgent } from '../universal/universal-agent.js';
/**
 * Pipeline service handler for daemon registration.
 *
 * Lifecycle:
 *   1. `initialize()` — creates warm orchestrator bundle (call once at daemon startup)
 *   2. RPC methods — thin wrappers that pass the warm bundle to CLI functions
 *   3. `getHealthInfo()` — returns memory usage + request counts for monitoring
 */
export class PipelineDaemonService {
    bundle = null;
    requestCount = 0;
    lastRequestAt = 0;
    initStartedAt = 0;
    /**
     * Initialize the warm orchestrator bundle.
     * This is the expensive operation (~1-30s) that the daemon amortizes.
     */
    async initialize() {
        this.initStartedAt = Date.now();
        console.error('[PipelineService] Initializing warm orchestrator bundle...');
        // Reduce embedding health check timeout for daemon startup
        process.env.EMBEDDING_HEALTH_TIMEOUT = '2000';
        const godAgent = new UniversalAgent({ verbose: false });
        await godAgent.initialize();
        const orchestrator = await godAgent.getCodingOrchestrator({
            enableParallelExecution: false,
            maxParallelAgents: 1,
        });
        const agentRegistry = godAgent.getAgentRegistry();
        const patternMatcher = godAgent
            .agent?.getPatternMatcher?.();
        this.bundle = { godAgent, orchestrator, agentRegistry, patternMatcher };
        const elapsed = Date.now() - this.initStartedAt;
        console.error(`[PipelineService] Bundle ready in ${elapsed}ms`);
    }
    /**
     * Re-initialize the orchestrator bundle (for memory leak recovery).
     */
    async reinitialize() {
        console.error('[PipelineService] Reinitializing bundle...');
        this.bundle = null;
        await this.initialize();
    }
    /**
     * Create the service handler function for DaemonServer.registerService().
     * Returns a function that routes `method` strings to the appropriate handler.
     */
    createHandler() {
        return async (method, params) => {
            if (!this.bundle) {
                throw new Error('Pipeline service not initialized — call initialize() first');
            }
            this.requestCount++;
            this.lastRequestAt = Date.now();
            const p = params ?? {};
            switch (method) {
                case 'init':
                    return this.handleInit(p);
                case 'next':
                    return this.handleNext(p);
                case 'complete':
                    return this.handleComplete(p);
                case 'completeAndNext':
                    return this.handleCompleteAndNext(p);
                case 'status':
                    return this.handleStatus(p);
                case 'resume':
                    return this.handleResume(p);
                case 'health':
                    return this.getHealthInfo();
                case 'restart':
                    await this.reinitialize();
                    return { restarted: true, timestamp: Date.now() };
                default:
                    throw new Error(`Unknown pipeline method: ${method}`);
            }
        };
    }
    /**
     * List of methods supported by this service (for registerService()).
     */
    getMethods() {
        return ['init', 'next', 'complete', 'completeAndNext', 'status', 'resume', 'health', 'restart'];
    }
    // ── RPC Method Handlers ────────────────────────────────────────────────
    async handleInit(params) {
        const task = params.task;
        if (!task)
            throw new Error('Missing required parameter: task');
        return init(task, this.bundle);
    }
    async handleNext(params) {
        const sessionId = params.sessionId;
        if (!sessionId)
            throw new Error('Missing required parameter: sessionId');
        return next(sessionId, this.bundle);
    }
    async handleComplete(params) {
        const sessionId = params.sessionId;
        const agentKey = params.agentKey;
        if (!sessionId || !agentKey)
            throw new Error('Missing required parameters: sessionId, agentKey');
        const file = params.file;
        return complete(sessionId, agentKey, file ? { file } : undefined, this.bundle);
    }
    async handleCompleteAndNext(params) {
        const sessionId = params.sessionId;
        const agentKey = params.agentKey;
        if (!sessionId || !agentKey)
            throw new Error('Missing required parameters: sessionId, agentKey');
        const file = params.file;
        // Use the daemon's warm bundle directly (bypasses completeAndNext's own bundle creation)
        const completedData = await complete(sessionId, agentKey, file ? { file } : undefined, this.bundle);
        const nextData = await next(sessionId, this.bundle);
        return { completed: completedData, next: nextData };
    }
    async handleStatus(params) {
        const sessionId = params.sessionId;
        if (!sessionId)
            throw new Error('Missing required parameter: sessionId');
        // status() reads disk directly, doesn't need the bundle
        // Capture its console.log output
        return this.captureStatusOutput(sessionId);
    }
    async handleResume(params) {
        const sessionId = params.sessionId;
        if (!sessionId)
            throw new Error('Missing required parameter: sessionId');
        return resume(sessionId, this.bundle);
    }
    // ── Helpers ────────────────────────────────────────────────────────────
    /**
     * status() writes to console.log directly. Capture its output.
     */
    async captureStatusOutput(sessionId) {
        // status() is a simple disk read — call it directly but capture output
        const { promises: fsP } = await import('fs');
        const sessionPath = `.god-agent/coding-sessions/${sessionId}.json`;
        const data = JSON.parse(await fsP.readFile(sessionPath, 'utf-8'));
        const total = data.batches.flat().flat().length;
        const phase = data.config.phases[data.currentPhaseIndex] || 'complete';
        const currentAgentKey = data.status !== 'complete'
            ? data.batches[data.currentPhaseIndex]?.[data.currentBatchIndex]?.[0]?.agentKey || null
            : null;
        const xpBreakdown = data.xp?.breakdown || [];
        const avgQuality = xpBreakdown.length > 0
            ? xpBreakdown.reduce((sum, b) => sum + b.quality, 0) / xpBreakdown.length
            : 0;
        const topAgent = xpBreakdown.length > 0
            ? xpBreakdown.reduce((best, b) => b.total > best.total ? b : best, xpBreakdown[0])
            : null;
        return {
            sessionId: data.sessionId,
            status: data.status,
            currentPhase: phase,
            currentAgent: currentAgentKey,
            completedAgents: data.completedAgents.length,
            totalAgents: total,
            percentage: Math.round((data.completedAgents.length / total) * 100),
            xp: {
                total: data.xp?.total || 0,
                agentsScored: xpBreakdown.length,
                avgQuality: avgQuality.toFixed(2),
                topAgent: topAgent ? { key: topAgent.agentKey, xp: topAgent.total } : null,
            },
        };
    }
    /**
     * Health info for monitoring (memory leaks, request stats).
     */
    getHealthInfo() {
        const mem = process.memoryUsage();
        return {
            status: this.bundle ? 'ready' : 'uninitialized',
            requestCount: this.requestCount,
            lastRequestAt: this.lastRequestAt,
            initDurationMs: this.bundle ? Date.now() - this.initStartedAt : 0,
            memory: {
                rss: Math.round(mem.rss / 1024 / 1024),
                heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
                heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
            },
            uptime: Math.round(process.uptime()),
        };
    }
}
//# sourceMappingURL=pipeline-daemon-service.js.map