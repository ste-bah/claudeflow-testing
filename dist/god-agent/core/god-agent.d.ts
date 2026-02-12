/**
 * God Agent - Main Orchestrator
 *
 * The unified orchestrator that integrates all God Agent subsystems:
 * - Layer 1: Native Core (VectorDB, GraphDB)
 * - Layer 2: Reasoning (ReasoningBank, PatternMatcher, CausalMemory, ProvenanceStore, ShadowVectors)
 * - Layer 3: Memory (MemoryEngine, CompressionManager)
 * - Layer 4: Learning (SonaEngine)
 * - Layer 5: Orchestration (RelayRace, AttentionFactory, PhD Pipeline)
 * - Layer 6: Intelligent Routing (DAI-003 - integrated via UniversalAgent)
 *
 * Implements: PRD Section 8 - God Agent Architecture
 */
import { VectorDB, type VectorDBConfig } from './vector-db/index.js';
import { GraphDB, type GraphDBConfig } from './graph-db/index.js';
import { type QuadFusionOptions, type QuadFusionResult, type SourceWeights } from './search/index.js';
import { MemoryEngine, type MemoryEngineConfig } from './memory/index.js';
import { ReasoningBank, PatternMatcher, type ReasoningBankConfig } from './reasoning/index.js';
import { SonaEngine, type SonaEngineConfig } from './learning/index.js';
import { RelayRaceOrchestrator, type RelayRaceConfig } from './orchestration/index.js';
import type { IRoutingConfig } from './routing/index.js';
import { CompressionManager, type CompressionConfig } from './compression/index.js';
import { AttentionFactory, type AttentionConfig } from './attention/index.js';
import { PhdPipelineOrchestrator, type PhdPipelineConfig, PhDPipelineRunner, type IPhDPipelineRunnerOptions, type IRunResult } from './pipeline/index.js';
import { type RuntimeSelection } from './portability/index.js';
import type { IAgentExecutionOptions, IAgentExecutionResult, IAgentChainStep, IAgentChainResult, IAgentFilter, IAgentInfo } from './types/index.js';
/**
 * God Agent configuration
 */
export interface GodAgentConfig {
    /** Vector database configuration */
    vectorDB?: Partial<VectorDBConfig>;
    /** Graph database configuration */
    graphDB?: Partial<GraphDBConfig>;
    /** Memory engine configuration */
    memory?: Partial<MemoryEngineConfig>;
    /** Reasoning subsystem configuration */
    reasoning?: Partial<ReasoningBankConfig>;
    /** Learning subsystem configuration */
    learning?: Partial<SonaEngineConfig>;
    /** Orchestration configuration */
    orchestration?: Partial<RelayRaceConfig>;
    /** Routing configuration */
    /** DAI-003: Intelligent routing configuration (integrated via UniversalAgent) */
    routing?: Partial<IRoutingConfig>;
    /** Compression configuration */
    compression?: Partial<CompressionConfig>;
    /** Attention configuration */
    attention?: Partial<AttentionConfig>;
    /** PhD pipeline configuration */
    pipeline?: Partial<PhdPipelineConfig>;
    /** Unified search configuration (TASK-SEARCH-006) */
    searchOptions?: Partial<QuadFusionOptions>;
    /** Enable observability */
    enableObservability?: boolean;
    /** Verbose logging */
    verbose?: boolean;
}
/**
 * God Agent initialization result
 */
export interface GodAgentInitResult {
    /** Whether initialization succeeded */
    success: boolean;
    /** Runtime selection result */
    runtime: RuntimeSelection;
    /** Initialization time in ms */
    initTimeMs: number;
    /** Component status */
    components: {
        vectorDB: boolean;
        graphDB: boolean;
        memory: boolean;
        reasoning: boolean;
        learning: boolean;
        orchestration: boolean;
        routing: boolean;
        compression: boolean;
        attention: boolean;
        observability: boolean;
    };
    /** Any warnings during initialization */
    warnings: string[];
}
/**
 * God Agent status
 */
export interface GodAgentStatus {
    /** Whether God Agent is initialized */
    initialized: boolean;
    /** Current runtime type */
    runtime: 'native' | 'wasm' | 'javascript';
    /** Memory usage */
    memory: {
        vectorCount: number;
        graphNodeCount: number;
        cacheHitRate: number;
    };
    /** Component health */
    health: {
        vectorDB: 'healthy' | 'degraded' | 'down';
        graphDB: 'healthy' | 'degraded' | 'down';
        memory: 'healthy' | 'degraded' | 'down';
        reasoning: 'healthy' | 'degraded' | 'down';
        learning: 'healthy' | 'degraded' | 'down';
    };
    /** Uptime in ms */
    uptimeMs: number;
}
/**
 * Query options for God Agent
 */
export interface QueryOptions {
    /** Number of results to return */
    k?: number;
    /** Minimum similarity threshold */
    minSimilarity?: number;
    /** Include provenance information */
    includeProvenance?: boolean;
    /** Include causal context */
    includeCausal?: boolean;
    /** Apply attention mechanisms */
    applyAttention?: boolean;
    /** Timeout in ms */
    timeoutMs?: number;
}
/**
 * Query result from God Agent
 */
export interface QueryResult {
    /** Query ID */
    queryId: string;
    /** Retrieved patterns */
    patterns: Array<{
        id: string;
        content: unknown;
        similarity: number;
        confidence: number;
        provenance?: unknown;
        causalContext?: unknown;
    }>;
    /** Query latency in ms */
    latencyMs: number;
    /** Reasoning mode used */
    reasoningMode: string;
    /** Attention mechanism applied */
    attentionMechanism?: string;
}
/**
 * Store options for God Agent
 */
export interface StoreOptions {
    /** Namespace for storage */
    namespace?: string;
    /** Track provenance */
    trackProvenance?: boolean;
    /** Compress immediately */
    compress?: boolean;
    /** TTL in ms */
    ttlMs?: number;
}
/**
 * Store result from God Agent
 */
export interface StoreResult {
    /** Generated ID */
    id: string;
    /** Vector ID in VectorDB */
    vectorId: string;
    /** Graph node ID */
    graphNodeId: string;
    /** Storage timestamp */
    timestamp: number;
    /** Whether compressed */
    compressed: boolean;
}
/**
 * God Agent - The main orchestrator for all subsystems
 *
 * @example
 * ```typescript
 * const agent = new GodAgent();
 * await agent.initialize();
 *
 * // Store knowledge
 * const result = await agent.store({
 *   content: 'Important pattern',
 *   embedding: new Float32Array(VECTOR_DIM) // 1536 dimensions
 * });
 *
 * // Query knowledge
 * const query = await agent.query(queryEmbedding, { k: 10 });
 * console.log(query.patterns);
 *
 * // Shutdown
 * await agent.shutdown();
 * ```
 */
export declare class GodAgent {
    private config;
    private initialized;
    private startTime?;
    private vectorDB?;
    private graphDB?;
    private fallbackGraph?;
    private memoryClient?;
    private unifiedSearch?;
    private reasoningBank?;
    private patternMatcher?;
    private causalMemory?;
    private provenanceStore?;
    private memoryEngine?;
    private compressionManager?;
    private sonaEngine?;
    private relayRace?;
    private attentionFactory?;
    private phdPipeline?;
    private phdPipelineRunner?;
    private agentExecutionService?;
    private agentRegistry?;
    private metrics?;
    private logger?;
    private tracer?;
    private runtimeSelector;
    private runtimeSelection?;
    constructor(config?: GodAgentConfig);
    /**
     * Initialize all God Agent subsystems
     */
    initialize(): Promise<GodAgentInitResult>;
    /**
     * Initialize Layer 1: Native Core
     */
    private initializeNativeCore;
    /**
     * Initialize Layer 2: Reasoning
     */
    private initializeReasoning;
    /**
     * Initialize Layer 3: Memory
     */
    private initializeMemory;
    /**
     * Initialize Layer 4: Learning
     */
    private initializeLearning;
    /**
     * Initialize Layer 5: Orchestration
     */
    private initializeOrchestration;
    /**
     * TASK-SEARCH-006: Initialize Unified Search
     * Integrates quad-fusion search across vector, graph, memory, and pattern sources
     */
    private initializeUnifiedSearch;
    /**
     * Initialize observability components
     */
    private initializeObservability;
    /**
     * Store knowledge in God Agent
     */
    store(data: {
        content: unknown;
        embedding: Float32Array;
        metadata?: Record<string, unknown>;
    }, options?: StoreOptions): Promise<StoreResult>;
    /**
     * Query knowledge from God Agent
     */
    query(embedding: Float32Array, options?: QueryOptions): Promise<QueryResult>;
    /**
     * Learn from feedback
     */
    learn(feedback: {
        queryId: string;
        patternId: string;
        verdict: 'positive' | 'negative' | 'neutral';
        score?: number;
    }): Promise<void>;
    /**
     * Search across all sources using quad-fusion search
     *
     * @param query - Natural language search query
     * @param options - Optional search configuration overrides
     * @returns QuadFusionResult with ranked results from all sources
     * @throws Error if GodAgent not initialized
     */
    search(query: string, options?: Partial<QuadFusionOptions>): Promise<QuadFusionResult>;
    /**
     * Search with pre-computed embedding for vector similarity
     *
     * @param query - Natural language search query (for context)
     * @param embedding - Pre-computed 1536-dimensional embedding vector
     * @param options - Optional search configuration overrides
     * @returns QuadFusionResult with ranked results from all sources
     * @throws Error if GodAgent not initialized or embedding dimension invalid
     */
    searchWithEmbedding(query: string, embedding: Float32Array, options?: Partial<QuadFusionOptions>): Promise<QuadFusionResult>;
    /**
     * Update search source weights for result ranking
     *
     * @param weights - Partial weights to update (vector, graph, memory, pattern)
     */
    updateSearchWeights(weights: Partial<SourceWeights>): void;
    /**
     * Get current search configuration
     *
     * @returns Current QuadFusionOptions or undefined if not initialized
     */
    getSearchOptions(): QuadFusionOptions | undefined;
    /**
     * Run PhD pipeline with real RelayRaceOrchestrator execution
     * Replaces the placeholder with actual agent orchestration
     */
    runPipeline(task: {
        pipelineName: string;
        input: unknown;
        maxAgents?: number;
    }): Promise<{
        success: boolean;
        output: unknown;
        agentsUsed: number;
        completionRate: number;
        executionTimeMs: number;
    }>;
    /**
     * Build pipeline definition from task
     * Creates a default pipeline with research → implementation → testing → review
     */
    private buildPipelineDefinition;
    /**
     * Helper to store knowledge if InteractionStore is available
     */
    private storeKnowledgeIfAvailable;
    /**
     * Get God Agent status
     */
    getStatus(): GodAgentStatus;
    /**
     * Get metrics snapshot
     */
    getMetrics(): Record<string, unknown>;
    /**
     * Initialize the PhD Pipeline Runner
     * Wires AgentRegistry, ClaudeTaskExecutor, PhDPipelineBridge, and PhDLearningIntegration
     *
     * @param agentsBasePath - Path to agent definitions (default: '.claude/agents')
     * @param options - Additional runner options
     */
    initializePhdPipeline(agentsBasePath?: string, options?: Partial<Omit<IPhDPipelineRunnerOptions, 'agentsBasePath'>>): Promise<void>;
    /**
     * Run PhD research pipeline
     * Executes the full 48-agent PhD research pipeline
     *
     * @param problemStatement - Research problem to investigate
     * @returns Pipeline execution result
     */
    runPhdResearch(problemStatement: string): Promise<IRunResult>;
    /**
     * Initialize the Agent Execution Service
     * Must be called before using runAgent, listAgents, etc.
     *
     * @param agentsBasePath - Base path to agent definitions (default: '.claude/agents')
     */
    initializeAgentExecution(agentsBasePath?: string): Promise<void>;
    /**
     * Execute a single agent with a task
     *
     * @param agentKey - Agent key (e.g., 'coder', 'tester', 'reviewer')
     * @param task - Task description
     * @param options - Execution options
     * @returns Execution result
     *
     * @example
     * ```typescript
     * const result = await agent.runAgent('coder', 'Create a user authentication module', {
     *   namespace: 'project/auth',
     *   trackTrajectory: true
     * });
     * console.log(result.success ? result.output : `Error: ${result.error}`);
     * ```
     */
    runAgent(agentKey: string, task: string, options?: IAgentExecutionOptions): Promise<IAgentExecutionResult>;
    /**
     * List available agents with optional filtering
     *
     * @param filter - Filter options (category, capability, priority, namePattern)
     * @returns Array of agent info
     *
     * @example
     * ```typescript
     * // All agents
     * const all = agent.listAgents();
     *
     * // Filter by category
     * const coreAgents = agent.listAgents({ category: 'core' });
     *
     * // Filter by capability
     * const testingAgents = agent.listAgents({ capability: 'unit_testing' });
     * ```
     */
    listAgents(filter?: IAgentFilter): IAgentInfo[];
    /**
     * Get detailed info about a specific agent
     *
     * @param agentKey - Agent key (e.g., 'coder', 'tester')
     * @returns Agent info or null if not found
     *
     * @example
     * ```typescript
     * const info = agent.getAgentInfo('coder');
     * console.log(info?.name, info?.description, info?.capabilities);
     * ```
     */
    getAgentInfo(agentKey: string): IAgentInfo | null;
    /**
     * Execute a chain of agents sequentially
     *
     * @param steps - Array of agent steps to execute
     * @param options - Chain-level options
     * @returns Chain execution result
     *
     * @example
     * ```typescript
     * const result = await agent.runAgentChain([
     *   { agent: 'planner', task: 'Plan implementation of user service' },
     *   { agent: 'coder', task: 'Implement based on plan' },
     *   { agent: 'tester', task: 'Write comprehensive tests' },
     *   { agent: 'reviewer', task: 'Review code quality and security' }
     * ], {
     *   namespace: 'project/user-service',
     *   trackTrajectory: true
     * });
     *
     * console.log(`Chain completed: ${result.steps.length} steps, ${result.duration}ms`);
     * ```
     */
    runAgentChain(steps: IAgentChainStep[], options?: IAgentExecutionOptions): Promise<IAgentChainResult>;
    /**
     * Get agent categories
     * @returns Array of category names
     */
    getAgentCategories(): string[];
    /**
     * Get total agent count
     * @returns Number of loaded agents
     */
    getAgentCount(): number;
    /**
     * Get PhD Pipeline Runner instance
     */
    getPhdPipelineRunner(): PhDPipelineRunner | undefined;
    /**
     * Shutdown God Agent
     */
    shutdown(): Promise<void>;
    /**
     * Ensure God Agent is initialized
     */
    private ensureInitialized;
    /**
     * Conditional logging
     */
    private log;
    /** Get VectorDB instance */
    getVectorDB(): VectorDB | undefined;
    /** Get GraphDB instance */
    getGraphDB(): GraphDB | undefined;
    /** Get MemoryEngine instance */
    getMemoryEngine(): MemoryEngine | undefined;
    /** Get ReasoningBank instance */
    getReasoningBank(): ReasoningBank | undefined;
    /**
     * Get SonaEngine instance for learning integration
     */
    getSonaEngine(): SonaEngine | undefined;
    /** Get PatternMatcher instance for pattern retrieval */
    getPatternMatcher(): PatternMatcher | undefined;
    /**
     * @deprecated DAI-003: TinyDancer removed. Use UniversalAgent.task() for intelligent routing.
     * This method is preserved for API compatibility but returns undefined.
     */
    getTinyDancer(): undefined;
    /** Get AttentionFactory instance */
    getAttentionFactory(): AttentionFactory | undefined;
    /** Get CompressionManager instance */
    getCompressionManager(): CompressionManager | undefined;
    /** Get PhdPipelineOrchestrator instance */
    getPhdPipeline(): PhdPipelineOrchestrator | undefined;
    /** Get RelayRaceOrchestrator instance */
    getRelayRace(): RelayRaceOrchestrator | undefined;
}
/**
 * Default God Agent instance
 */
export declare const godAgent: GodAgent;
//# sourceMappingURL=god-agent.d.ts.map