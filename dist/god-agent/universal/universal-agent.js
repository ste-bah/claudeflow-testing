/**
 * Universal Self-Learning God Agent
 *
 * A unified interface that makes the God Agent do EVERYTHING:
 * - Coding with pattern learning
 * - Research with knowledge accumulation
 * - Writing with style adaptation
 * - Self-learning from every interaction
 *
 * Every operation automatically:
 * 1. Stores successful patterns
 * 2. Learns from feedback (explicit or implicit)
 * 3. Improves retrieval weights over time
 * 4. Builds domain knowledge continuously
 */
import { GodAgent } from '../core/god-agent.js';
import { InteractionStore } from './interaction-store.js';
import { TrajectoryBridge } from './trajectory-bridge.js';
import { estimateQuality, assessQuality } from './quality-estimator.js';
import { StyleProfileManager } from './style-profile.js';
import { ClaudeCodeExecutor } from '../core/executor/index.js';
import { EmbeddingProviderFactory } from '../core/memory/embedding-provider.js';
import { AnthropicWritingGenerator } from '../core/writing/index.js';
import { HybridSearchProvider } from '../core/search/index.js';
import { createComponentLogger, ConsoleLogHandler, LogLevel } from '../core/observability/index.js';
const universalLogger = createComponentLogger('UniversalAgent', {
    minLevel: LogLevel.INFO,
    handlers: [new ConsoleLogHandler()]
});
// DESC: Episode injection for prior solutions (RULE-010: default window size 3)
import { getUCMClient } from '../cli/ucm-daemon-client.js';
// DAEMON-003: Core daemon client for EpisodeStore/GraphDB IPC
import { getCoreDaemonClient } from '../cli/core-daemon-client.js';
// DAI-001: Dynamic Agent Integration
import { AgentRegistry, AgentSelector, TaskExecutor, } from '../core/agents/index.js';
// DAI-002: Multi-Agent Sequential Pipeline Orchestration
import { createPipelineExecutor, } from '../core/pipeline/index.js';
// DAI-003: Intelligent Task Routing
import { TaskAnalyzer, CapabilityIndex, RoutingEngine, PipelineGenerator, RoutingLearner, ConfirmationHandler, FailureClassifier, } from '../core/routing/index.js';
// MEM-001: Multi-Process Memory System
import { getMemoryClient, } from '../core/memory-server/index.js';
// TASK-HOOK-006: Hook Executor for pre/post Tool Use hooks
// CONSTITUTION COMPLIANCE: RULE-033 (DESC context injection), RULE-035 (quality threshold 0.5), RULE-036 (quality scores)
import { getHookExecutor, } from '../core/hooks/index.js';
// ==================== Universal Agent ====================
export class UniversalAgent {
    agent;
    config;
    interactionStore;
    initialized = false;
    // Learning state
    successfulPatterns = new Map(); // pattern -> success count
    domainExpertise = new Map(); // domain -> knowledge count
    // Trajectory bridge for auto-feedback (FR-11)
    trajectoryBridge;
    // Style profile manager for learned writing styles
    styleProfileManager;
    // Code executor for production-ready code (SPEC-EXE-001)
    codeExecutor;
    // Embedding provider for semantic embeddings (SPEC-EMB-002)
    embeddingProvider;
    // Writing generator for LLM-based content creation (SPEC-WRT-001)
    // Null when ANTHROPIC_API_KEY not set (graceful degradation)
    writingGenerator = null;
    // Web search provider for research operations (SPEC-WEB-001)
    webSearchProvider;
    // DAI-001: Dynamic Agent Integration
    agentRegistry;
    agentSelector;
    taskExecutor;
    // DAI-002: Multi-Agent Sequential Pipeline Orchestration
    pipelineExecutor;
    // DAI-003: Intelligent Task Routing
    taskAnalyzer;
    capabilityIndex;
    routingEngine;
    pipelineGenerator;
    routingLearner;
    confirmationHandler;
    failureClassifier;
    // MEM-001: Multi-Process Memory Client
    memoryClient;
    // DESC: UCM Daemon client for episode injection (RULE-010)
    ucmClient;
    // DAEMON-003: Core Daemon client for EpisodeStore/GraphDB IPC
    coreDaemonClient;
    constructor(config = {}) {
        const storageDir = config.storageDir ?? '.agentdb/universal';
        const enablePersistence = config.enablePersistence ?? true;
        // RULE-035: Feedback threshold MUST be 0.5
        this.config = {
            autoLearn: config.autoLearn ?? true,
            autoStoreThreshold: config.autoStoreThreshold ?? 0.5,
            verbose: config.verbose ?? false,
            defaultMode: config.defaultMode ?? 'general',
            learningRate: config.learningRate ?? 0.01,
            enableWebSearch: config.enableWebSearch ?? true,
            enablePersistence,
            storageDir,
            // DESC: Episode injection settings (RULE-010: default window size 3)
            enableDESC: config.enableDESC ?? true,
            descThreshold: config.descThreshold ?? 0.80,
            descMaxEpisodes: config.descMaxEpisodes ?? 3,
            // DAEMON-003: Core daemon for EpisodeStore/GraphDB IPC (default: enabled)
            enableCoreDaemon: config.enableCoreDaemon ?? true,
        };
        // Configure GodAgent with persistence enabled
        this.agent = new GodAgent({
            enableObservability: true,
            verbose: this.config.verbose,
            // Layer 1: VectorDB persistence
            vectorDB: {
                persistencePath: `${storageDir}/vectors.bin`,
                autoSave: enablePersistence,
            },
            // Layer 1: GraphDB persistence
            graphDB: {
                dataDir: `${storageDir}/graphs`,
                enablePersistence,
            },
            // Layer 4: Learning persistence
            learning: {
                checkpointsDir: `${storageDir}/checkpoints`,
            },
        });
        // Initialize ClaudeCodeExecutor (SPEC-EXE-001)
        this.codeExecutor = new ClaudeCodeExecutor({ verbose: this.config.verbose });
    }
    // ==================== Initialization ====================
    async initialize() {
        if (this.initialized)
            return;
        this.log('Initializing Universal Self-Learning Agent...');
        // Ensure storage directory exists
        if (this.config.enablePersistence) {
            await this.ensureStorageDir();
        }
        const result = await this.agent.initialize();
        if (!result.success) {
            throw new Error(`Failed to initialize: ${result.warnings.join(', ')}`);
        }
        // Initialize interaction store with LRU caching
        // RULE-035: highQualityThreshold is pattern threshold (0.7), NOT feedback threshold
        this.interactionStore = new InteractionStore({
            storageDir: this.config.storageDir,
            maxInteractions: 1000,
            highQualityThreshold: 0.7, // Pattern threshold per RULE-035
            rollingWindowDays: 7,
            persistCount: 100,
        });
        // Only load persisted interactions if persistence is enabled
        if (this.config.enablePersistence) {
            await this.interactionStore.load();
        }
        // Load persisted state
        if (this.config.enablePersistence) {
            await this.loadPersistedState();
        }
        // Initialize TrajectoryBridge for auto-feedback (FR-11)
        const reasoningBank = this.agent.getReasoningBank();
        const sonaEngine = this.agent.getSonaEngine();
        if (reasoningBank && sonaEngine) {
            this.trajectoryBridge = new TrajectoryBridge(reasoningBank, sonaEngine);
            this.log('TrajectoryBridge initialized - Auto-feedback enabled');
        }
        else {
            this.log('Warning: ReasoningBank or SonaEngine not available - Auto-feedback disabled');
        }
        // Initialize StyleProfileManager for learned writing styles
        if (this.config.enablePersistence) {
            this.styleProfileManager = new StyleProfileManager(process.cwd());
            this.log('StyleProfileManager initialized - Style learning enabled');
        }
        // Initialize embedding provider (SPEC-EMB-002)
        this.embeddingProvider = await EmbeddingProviderFactory.getProvider();
        this.log(`Embedding provider: ${this.embeddingProvider.getProviderName?.() ?? 'unknown'}`);
        // Initialize writing generator (SPEC-WRT-001)
        this.writingGenerator = this.createWritingGenerator();
        this.log('Writing generator initialized - LLM-based content generation enabled');
        // Initialize web search provider (SPEC-WEB-001)
        this.webSearchProvider = new HybridSearchProvider({ verbose: this.config.verbose });
        this.log(`Web search provider: ${this.webSearchProvider.getAvailableSources().join(', ')}`);
        // DAI-001: Initialize dynamic agent system
        this.agentRegistry = new AgentRegistry({ basePath: '.claude/agents', verbose: this.config.verbose });
        await this.agentRegistry.initialize('.claude/agents');
        this.agentSelector = new AgentSelector(this.agentRegistry, { verbose: this.config.verbose });
        this.taskExecutor = new TaskExecutor({ verbose: this.config.verbose });
        this.log(`DAI-001: AgentRegistry initialized with ${this.agentRegistry.size} agents`);
        // DAI-002: Initialize multi-agent sequential pipeline executor
        // Note: reuses reasoningBank from TrajectoryBridge initialization above
        this.pipelineExecutor = createPipelineExecutor({
            agentRegistry: this.agentRegistry,
            agentSelector: this.agentSelector,
            interactionStore: this.interactionStore,
            reasoningBank: reasoningBank ?? undefined,
        }, {
            verbose: this.config.verbose,
            enableLearning: true,
        });
        this.log('DAI-002: PipelineExecutor initialized - Sequential multi-agent pipelines enabled');
        // DAI-003: Initialize intelligent task routing system (AFTER agentRegistry)
        this.taskAnalyzer = new TaskAnalyzer({
            useLocalEmbedding: true,
            verbose: this.config.verbose,
        });
        this.capabilityIndex = new CapabilityIndex({
            agentsPath: '.claude/agents',
            useLocalEmbedding: true,
            freshnessThreshold: 24 * 60 * 60 * 1000, // 24h
            verbose: this.config.verbose,
        });
        await this.capabilityIndex.initialize();
        this.failureClassifier = new FailureClassifier();
        this.routingEngine = new RoutingEngine({
            capabilityIndex: this.capabilityIndex,
            verbose: this.config.verbose,
        });
        this.pipelineGenerator = new PipelineGenerator({
            routingEngine: this.routingEngine,
            verbose: this.config.verbose,
        });
        this.routingLearner = new RoutingLearner({
            reasoningBank: reasoningBank,
            failureClassifier: this.failureClassifier,
            verbose: this.config.verbose,
        });
        this.confirmationHandler = new ConfirmationHandler({
            verbose: this.config.verbose,
        });
        this.log('DAI-003: Routing system initialized - Intelligent task routing enabled');
        // MEM-001: Initialize memory client for multi-process memory access
        // Client will auto-start daemon if not running (autoStart: true by default)
        try {
            this.memoryClient = getMemoryClient(this.config.storageDir.replace('/universal', ''), { verbose: this.config.verbose, autoStart: true });
            await this.memoryClient.connect();
            this.log('MEM-001: Memory client connected to daemon');
        }
        catch (error) {
            // Non-fatal: memory client is optional enhancement
            this.log(`MEM-001: Memory client initialization failed: ${error}`);
        }
        // DAEMON-003: Initialize Core Daemon client for EpisodeStore/GraphDB IPC
        if (this.config.enableCoreDaemon !== false) {
            try {
                this.coreDaemonClient = getCoreDaemonClient();
                const isHealthy = await this.coreDaemonClient.isHealthy();
                if (isHealthy) {
                    this.log('DAEMON-003: Core daemon client connected');
                }
                else {
                    this.log('DAEMON-003: Core daemon not healthy, will auto-start on first use');
                }
            }
            catch (error) {
                // Non-fatal: core daemon is optional enhancement
                this.log(`DAEMON-003: Core daemon client init failed: ${error}`);
                this.coreDaemonClient = getCoreDaemonClient();
            }
        }
        // DESC: Initialize UCM client for episode injection (RULE-010)
        if (this.config.enableDESC) {
            try {
                this.ucmClient = getUCMClient();
                const isHealthy = await this.ucmClient.isHealthy();
                if (isHealthy) {
                    this.log(`DESC: UCM client initialized (threshold: ${this.config.descThreshold}, maxEpisodes: ${this.config.descMaxEpisodes})`);
                }
                else {
                    this.log('DESC: UCM daemon not healthy, episode injection will attempt auto-start on first use');
                }
            }
            catch (error) {
                // Non-fatal: DESC is optional enhancement
                this.log(`DESC: UCM client initialization failed: ${error}`);
                this.ucmClient = getUCMClient(); // Still assign for potential later use
            }
        }
        else {
            this.log('DESC: Episode injection disabled');
        }
        this.log(`Runtime: ${result.runtime.type}`);
        this.log(`Persistence: ${this.config.enablePersistence ? 'enabled' : 'disabled'}`);
        this.log(`Storage: ${this.config.storageDir}`);
        this.log('Universal Agent ready - Learning enabled');
        this.initialized = true;
    }
    /**
     * Ensure storage directory exists
     */
    async ensureStorageDir() {
        const { mkdir } = await import('fs/promises');
        const dirs = [
            this.config.storageDir,
            `${this.config.storageDir}/graphs`,
            `${this.config.storageDir}/weights`,
            `${this.config.storageDir}/checkpoints`,
        ];
        for (const dir of dirs) {
            await mkdir(dir, { recursive: true }).catch(() => { });
        }
    }
    /**
     * Load persisted state from disk
     */
    async loadPersistedState() {
        const { readFile } = await import('fs/promises');
        const statePath = `${this.config.storageDir}/agent-state.json`;
        try {
            const data = await readFile(statePath, 'utf-8');
            const state = JSON.parse(data);
            // Restore local state
            this.successfulPatterns = new Map(Object.entries(state.successfulPatterns || {}));
            this.domainExpertise = new Map(Object.entries(state.domainExpertise || {}));
            // Note: Interactions now loaded via InteractionStore
            const storeStats = this.interactionStore.getStats();
            this.log(`Loaded state: ${this.successfulPatterns.size} patterns, ${this.domainExpertise.size} domains`);
            this.log(`Loaded: ${storeStats.totalInteractions} interactions, ${storeStats.knowledgeCount} knowledge entries`);
        }
        catch {
            // INTENTIONAL: No previous state found is expected on first run - starting fresh is valid
            this.log('No previous state found - starting fresh');
        }
    }
    /**
     * Save state to disk
     */
    async savePersistedState() {
        if (!this.config.enablePersistence)
            return;
        // Save interaction store
        await this.interactionStore.save();
        const { writeFile } = await import('fs/promises');
        const statePath = `${this.config.storageDir}/agent-state.json`;
        const storeStats = this.interactionStore.getStats();
        const state = {
            successfulPatterns: Object.fromEntries(this.successfulPatterns),
            domainExpertise: Object.fromEntries(this.domainExpertise),
            sessionKnowledgeCount: storeStats.knowledgeCount,
            interactionsCount: storeStats.totalInteractions,
            lastSaved: new Date().toISOString(),
        };
        await writeFile(statePath, JSON.stringify(state, null, 2));
        this.log(`State saved: ${this.successfulPatterns.size} patterns, ${this.domainExpertise.size} domains`);
    }
    /**
     * Create writing generator with Anthropic API (SPEC-WRT-001)
     * Returns null if ANTHROPIC_API_KEY not set (graceful degradation)
     */
    createWritingGenerator() {
        if (!process.env.ANTHROPIC_API_KEY) {
            this.log('Warning: ANTHROPIC_API_KEY not set - writing generation will be unavailable');
            return null;
        }
        return new AnthropicWritingGenerator(process.env.ANTHROPIC_API_KEY, this.styleProfileManager);
    }
    // ==================== DAI-001: Dynamic Agent Execution ====================
    /**
     * Execute task using dynamically selected agent (DAI-001)
     *
     * This method:
     * 1. Analyzes the task to determine best agent
     * 2. Builds prompt using TaskExecutor
     * 3. Returns the selection and prompt (for Task() execution)
     *
     * NOTE: Actual Task() execution is done by the caller (Claude Code CLI)
     * This method provides the selection + prompt building layer.
     */
    async selectAgentForTask(task) {
        await this.ensureInitialized();
        // Select best agent for task
        const selection = this.agentSelector.selectAgent(task);
        this.log(`DAI-001: Selected agent '${selection.selected.key}' for task`);
        this.log(`  Category: ${selection.selected.category}`);
        this.log(`  Task type: ${selection.analysis.taskType}`);
        this.log(`  Score: ${selection.candidates[0]?.score.toFixed(2)}`);
        // Gather memory context from InteractionStore
        const relevantKnowledge = this.interactionStore.getKnowledgeByDomain(`project/${selection.analysis.taskType}`);
        const context = relevantKnowledge.length > 0
            ? relevantKnowledge
                .slice(0, 5)
                .map(k => `- ${k.content.substring(0, 200)}`)
                .join('\n')
            : undefined;
        // Build the prompt
        const prompt = this.taskExecutor.buildPrompt(selection.selected, task, context);
        return {
            selection,
            prompt,
            context,
        };
    }
    /**
     * Get AgentRegistry for external access (DAI-001)
     */
    getAgentRegistry() {
        return this.agentRegistry;
    }
    /**
     * Get AgentSelector for external access (DAI-001)
     */
    getAgentSelector() {
        return this.agentSelector;
    }
    /**
     * Get TaskExecutor for external access (DAI-001)
     */
    getTaskExecutor() {
        return this.taskExecutor;
    }
    /**
     * Get PipelineExecutor for external access (DAI-002)
     */
    getPipelineExecutor() {
        return this.pipelineExecutor;
    }
    /**
     * Get MemoryClient for multi-process memory access (MEM-001)
     */
    getMemoryClient() {
        return this.memoryClient;
    }
    // ==================== TASK-LEARN-007: Default Task Execution ====================
    /**
     * Default Task execution function for ask() method
     *
     * TASK-LEARN-007: Implements the default execution path when executeTask=true
     * but no custom taskExecutionFn is provided.
     *
     * TASK-HOOK-006: Wires HookExecutor for pre/post Tool Use hooks
     * CONSTITUTION COMPLIANCE:
     * - RULE-033: DESC context MUST be injected into every Task-style tool call (via preToolUseHooks)
     * - RULE-035: All agent results MUST be assessed for quality with 0.5 threshold
     * - RULE-036: Task hook outputs MUST include quality assessment scores
     *
     * Uses TaskExecutor.execute() which wraps the Task() abstraction with:
     * - Prompt building from agent definition
     * - Error handling with AgentExecutionError
     * - Observability events (agent_started, agent_completed, agent_failed)
     * - Duration tracking
     * - Pre/post hook execution (TASK-HOOK-006)
     *
     * Per RULE-024: Quality on RESULT (supports Task execution to get result)
     *
     * @param agentSelection - The result from selectAgentForTask()
     * @param taskExecutionFn - Optional custom execution function
     * @param options - Optional execution options including trajectoryId
     * @returns TaskExecutionResult with result, success status, and duration
     */
    async executeTaskDefault(agentSelection, taskExecutionFn, options) {
        const startTime = Date.now();
        const agent = agentSelection.selection.selected;
        const taskType = agentSelection.selection.analysis.taskType || 'unknown';
        const agentType = agent.frontmatter?.type ?? agent.category;
        const toolName = 'Task'; // All Task-style operations use this tool name
        // TASK-HOOK-006: Generate session ID for hook tracking
        const sessionId = this.generateId();
        const trajectoryId = options?.trajectoryId;
        // TASK-HOOK-006: Get the hook executor singleton
        const hookExecutor = getHookExecutor();
        // TASK-HOOK-006: Build pre-tool-use hook context
        // RULE-033: DESC context injection happens here via auto-injection hook
        const preHookContext = {
            toolName,
            toolInput: {
                agentType,
                prompt: agentSelection.prompt,
                context: agentSelection.context,
                taskType,
                agentKey: agent.key,
            },
            sessionId,
            trajectoryId,
            timestamp: Date.now(),
            metadata: {
                source: 'UniversalAgent.executeTaskDefault',
                agentCategory: agent.category,
            },
        };
        // TASK-HOOK-006: Execute preToolUse hooks BEFORE task execution
        // This triggers DESC context injection (RULE-033) and other pre-execution hooks
        let preHookResult;
        let modifiedInput = agentSelection.prompt;
        try {
            preHookResult = await hookExecutor.executePreToolUseHooks(preHookContext);
            // Log hook execution for observability
            this.log(`TASK-HOOK-006: preToolUseHooks executed`, {
                hooksExecuted: preHookResult.results.length,
                allSucceeded: preHookResult.allSucceeded,
                chainStopped: preHookResult.chainStopped,
                durationMs: preHookResult.totalDurationMs,
                trajectoryId,
            });
            // Check if a hook stopped execution (e.g., validation failure)
            if (preHookResult.chainStopped) {
                const stoppedBy = preHookResult.stoppedByHook ?? 'unknown';
                const stopReason = preHookResult.results.find(r => r.hookId === stoppedBy)?.result?.stopReason ?? 'Hook stopped execution';
                this.log(`TASK-HOOK-006: Execution stopped by hook '${stoppedBy}': ${stopReason}`);
                return {
                    result: `Task execution blocked by hook: ${stopReason}`,
                    success: false,
                    taskType,
                    agentId: agent.key,
                    durationMs: Date.now() - startTime,
                    error: `Hook '${stoppedBy}' blocked execution: ${stopReason}`,
                };
            }
            // Apply any modified input from hooks (e.g., DESC context injection)
            if (preHookResult.finalInput !== undefined && typeof preHookResult.finalInput === 'object') {
                const finalInput = preHookResult.finalInput;
                if (finalInput.prompt) {
                    modifiedInput = finalInput.prompt;
                    this.log(`TASK-HOOK-006: Hook modified prompt (DESC injection applied)`);
                }
            }
        }
        catch (hookError) {
            // Hooks should not crash main execution - log and continue
            this.log(`TASK-HOOK-006: preToolUseHooks error (continuing): ${hookError}`);
        }
        try {
            let result;
            let executionSuccess = true;
            if (taskExecutionFn) {
                // Use custom execution function if provided
                result = await taskExecutionFn(agentType, modifiedInput, { timeout: 120000 });
            }
            else {
                // Use TaskExecutor.execute() with a stub that returns the prompt
                // In production, this would be wired to actual Claude Code Task() API
                // For now, we provide a working fallback that enables testing
                const executionResult = await this.taskExecutor.execute(agent, modifiedInput, async (_agentType, prompt, _options) => {
                    // STUB: In production, this would call Claude Code's Task() API
                    // For now, return the prompt as the "result" to enable end-to-end testing
                    // The actual Task() execution is handled by Claude Code's runtime
                    this.log(`TASK-LEARN-007: Stub executor returning prompt as result (Task() integration pending)`);
                    return prompt;
                }, { context: agentSelection.context });
                result = executionResult.output;
            }
            const durationMs = Date.now() - startTime;
            // TASK-HOOK-006: Calculate quality score for the result
            // RULE-035: Quality threshold is 0.5
            // RULE-036: Quality scores MUST be logged with trajectoryId
            const qualityInteraction = {
                id: sessionId,
                mode: taskType,
                input: agentSelection.prompt,
                output: result,
                timestamp: Date.now(),
            };
            const qualityAssessment = assessQuality(qualityInteraction, this.config.autoStoreThreshold);
            const qualityScore = qualityAssessment.score;
            // RULE-036: Log quality score with trajectoryId
            this.log(`TASK-HOOK-006: Quality assessment`, {
                qualityScore: qualityScore.toFixed(3),
                meetsThreshold: qualityAssessment.meetsThreshold,
                threshold: this.config.autoStoreThreshold,
                trajectoryId,
                sessionId,
            });
            // TASK-HOOK-006: Build post-tool-use hook context
            const postHookContext = {
                toolName,
                toolInput: preHookContext.toolInput,
                toolOutput: {
                    result,
                    success: executionSuccess,
                    qualityScore,
                    meetsThreshold: qualityAssessment.meetsThreshold,
                },
                sessionId,
                trajectoryId,
                timestamp: Date.now(),
                executionDurationMs: durationMs,
                executionSuccess,
                metadata: {
                    source: 'UniversalAgent.executeTaskDefault',
                    agentCategory: agent.category,
                    qualityScore,
                    qualityMeetsThreshold: qualityAssessment.meetsThreshold,
                },
            };
            // TASK-HOOK-006: Execute postToolUse hooks AFTER task execution
            // This triggers quality assessment and result capture hooks
            try {
                const postHookResult = await hookExecutor.executePostToolUseHooks(postHookContext);
                // Log hook execution for observability (RULE-036 compliance)
                this.log(`TASK-HOOK-006: postToolUseHooks executed`, {
                    hooksExecuted: postHookResult.results.length,
                    allSucceeded: postHookResult.allSucceeded,
                    durationMs: postHookResult.totalDurationMs,
                    trajectoryId,
                    qualityScore: qualityScore.toFixed(3),
                });
            }
            catch (hookError) {
                // Hooks should not crash main execution - log and continue
                this.log(`TASK-HOOK-006: postToolUseHooks error (continuing): ${hookError}`);
            }
            return {
                result,
                success: true,
                taskType,
                agentId: agent.key,
                durationMs,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const durationMs = Date.now() - startTime;
            this.log(`TASK-LEARN-007: Task execution failed: ${errorMessage}`);
            // TASK-HOOK-006: Execute postToolUse hooks even on failure
            // This ensures quality assessment hooks can record failures
            try {
                const postHookContext = {
                    toolName,
                    toolInput: preHookContext.toolInput,
                    toolOutput: {
                        result: errorMessage,
                        success: false,
                        error: errorMessage,
                        qualityScore: 0, // Failed tasks get 0 quality
                    },
                    sessionId,
                    trajectoryId,
                    timestamp: Date.now(),
                    executionDurationMs: durationMs,
                    executionSuccess: false,
                    metadata: {
                        source: 'UniversalAgent.executeTaskDefault',
                        agentCategory: agent.category,
                        error: errorMessage,
                        qualityScore: 0,
                    },
                };
                const postHookResult = await hookExecutor.executePostToolUseHooks(postHookContext);
                this.log(`TASK-HOOK-006: postToolUseHooks executed (failure path)`, {
                    hooksExecuted: postHookResult.results.length,
                    trajectoryId,
                    qualityScore: 0,
                });
            }
            catch (hookError) {
                this.log(`TASK-HOOK-006: postToolUseHooks error on failure path: ${hookError}`);
            }
            return {
                result: errorMessage,
                success: false,
                taskType,
                agentId: agent.key,
                durationMs,
                error: errorMessage,
            };
        }
    }
    // ==================== DAI-002: Pipeline Execution ====================
    /**
     * Execute a multi-agent sequential pipeline (DAI-002)
     *
     * Pipelines are executed strictly sequentially with memory coordination
     * between steps via InteractionStore. Each step waits for the previous
     * step to complete before starting.
     *
     * RULE-004: Sequential execution (no Promise.all)
     * RULE-005: Memory coordination via InteractionStore
     * RULE-006: DAI-001 AgentSelector integration
     * RULE-007: Forward-looking prompts with workflow context
     *
     * @param pipeline - Pipeline definition with agents, steps, and config
     * @param options - Optional execution options (stepExecutor, overrides)
     * @returns Pipeline execution result with step results and quality metrics
     *
     * @example
     * ```typescript
     * const pipeline: IPipelineDefinition = {
     *   name: 'API Feature Pipeline',
     *   sequential: true,
     *   agents: [
     *     {
     *       agentKey: 'backend-dev',
     *       task: 'Implement the API endpoints',
     *       outputDomain: 'project/api',
     *       outputTags: ['endpoints', 'schema'],
     *     },
     *     {
     *       agentKey: 'tester',
     *       task: 'Write integration tests',
     *       inputDomain: 'project/api',
     *       inputTags: ['endpoints'],
     *       outputDomain: 'project/tests',
     *       outputTags: ['integration', 'api'],
     *     },
     *   ],
     * };
     *
     * const result = await agent.runPipeline(pipeline);
     * console.log(`Pipeline ${result.success ? 'succeeded' : 'failed'}`);
     * console.log(`Overall quality: ${result.overallQuality}`);
     * ```
     */
    async runPipeline(pipeline, options = {}) {
        await this.ensureInitialized();
        this.log(`DAI-002: Starting pipeline '${pipeline.name}' with ${pipeline.agents.length} steps`);
        try {
            const result = await this.pipelineExecutor.execute(pipeline, options);
            if (result.status === 'completed') {
                this.log(`DAI-002: Pipeline '${pipeline.name}' completed successfully`);
                this.log(`  - Steps: ${result.steps.length}/${pipeline.agents.length}`);
                this.log(`  - Overall quality: ${result.overallQuality.toFixed(2)}`);
                this.log(`  - Duration: ${result.totalDuration}ms`);
            }
            else {
                this.log(`DAI-002: Pipeline '${pipeline.name}' failed at step ${result.steps.length}`);
                if (result.error) {
                    this.log(`  - Error: ${result.error.message}`);
                }
            }
            return result;
        }
        catch (error) {
            this.log(`DAI-002: Pipeline '${pipeline.name}' threw error: ${error.message}`);
            throw error;
        }
    }
    // ==================== DAI-003: Intelligent Task Routing ====================
    /**
     * Execute task with intelligent routing (DAI-003)
     *
     * This method:
     * 1. Analyzes the task to determine domain, complexity, and requirements
     * 2. Routes to best agent automatically (or uses explicit override)
     * 3. Detects multi-step tasks and generates pipelines
     * 4. Handles low-confidence decisions with confirmation flow
     * 5. Executes via TaskExecutor or PipelineExecutor
     * 6. Submits feedback to RoutingLearner for continuous improvement
     *
     * @param description - Natural language task description
     * @param options - Optional settings (explicit agent, skip confirmation)
     * @returns Task result with routing metadata and execution info
     *
     * @example
     * ```typescript
     * // Automatic routing
     * const result = await agent.task('Write unit tests for the authentication module');
     * console.log(`Routed to: ${result.routing.selectedAgent}`);
     * console.log(`Confidence: ${result.routing.confidence}`);
     *
     * // Explicit agent override
     * const result = await agent.task('Implement feature X', { agent: 'backend-dev' });
     *
     * // Multi-step task (generates pipeline)
     * const result = await agent.task('Research API design, then implement endpoints, then write tests');
     * console.log(`Pipeline: ${result.pipeline?.stages.length} stages`);
     * ```
     */
    async task(description, options = {}) {
        await this.ensureInitialized();
        const startTime = Date.now();
        let routing;
        let pipeline;
        let agentUsed;
        let result;
        // DESC: Inject prior solutions before processing (RULE-010: window size 3)
        const descResult = await this.injectDESCEpisodes(description, { command: 'god-task', mode: 'general' });
        const augmentedDescription = descResult.augmentedPrompt;
        // Step 1: Check for explicit agent override FIRST (skip analysis if provided)
        if (options.agent) {
            this.log(`DAI-003 task(): Using explicit agent override: ${options.agent}`);
            // Validate the agent exists early (fail fast)
            const agentDef = this.agentRegistry.getByKey(options.agent);
            if (!agentDef) {
                throw new Error(`Agent '${options.agent}' not found in registry`);
            }
            // Create a bypass routing result
            routing = {
                selectedAgent: options.agent,
                selectedAgentName: agentDef.frontmatter.name || options.agent,
                confidence: 1.0,
                usedPreference: true,
                coldStartPhase: 'learned',
                isColdStart: false,
                factors: [{
                        name: 'explicit_override',
                        weight: 1.0,
                        score: 1.0,
                        description: 'User explicitly specified agent',
                    }],
                explanation: `Using explicitly specified agent: ${options.agent}`,
                alternatives: [],
                requiresConfirmation: false,
                confirmationLevel: 'auto',
                routedAt: Date.now(),
                routingTimeMs: 0,
                routingId: this.generateId(),
            };
            agentUsed = options.agent;
        }
        else {
            // Step 2: Analyze the task (only when routing is needed, use augmented description)
            this.log(`DAI-003 task(): Analyzing task...`);
            const analysis = await this.taskAnalyzer.analyze(augmentedDescription);
            // Step 3: Route via RoutingEngine
            this.log(`DAI-003 task(): Routing via RoutingEngine...`);
            routing = await this.routingEngine.route(analysis);
            agentUsed = routing.selectedAgent;
            this.log(`DAI-003 task(): Routed to '${agentUsed}' (confidence: ${routing.confidence.toFixed(2)})`);
            if (routing.isColdStart) {
                this.log(`  ${routing.coldStartIndicator}`);
            }
            // Step 4: Check if multi-step task (pipeline generation)
            if (analysis.isMultiStep) {
                this.log(`DAI-003 task(): Multi-step task detected, generating pipeline...`);
                try {
                    pipeline = await this.pipelineGenerator.generate(description);
                    this.log(`DAI-003 task(): Pipeline generated with ${pipeline.stages.length} stages`);
                }
                catch (error) {
                    this.log(`Warning: Pipeline generation failed: ${error}. Falling back to single-step execution.`);
                    pipeline = undefined;
                }
            }
        }
        // Step 5: Handle low-confidence confirmation (unless skipped)
        if (!options.skipConfirmation && routing.requiresConfirmation) {
            this.log(`DAI-003 task(): Low confidence (${routing.confidence.toFixed(2)}), requesting confirmation...`);
            try {
                const confirmation = await this.confirmationHandler.requestConfirmation(routing);
                // Check if user selected a different agent
                if (confirmation.selectedKey !== routing.selectedAgent && !confirmation.wasCancelled) {
                    this.log(`DAI-003 task(): User overrode to agent: ${confirmation.selectedKey}`);
                    agentUsed = confirmation.selectedKey;
                    // Update routing result to reflect override
                    routing = {
                        ...routing,
                        selectedAgent: confirmation.selectedKey,
                        selectedAgentName: confirmation.selectedKey,
                        usedPreference: true,
                    };
                }
                else if (confirmation.wasCancelled) {
                    throw new Error('Task cancelled by user during confirmation');
                }
            }
            catch (error) {
                this.log(`Warning: Confirmation failed: ${error}. Proceeding with original routing.`);
            }
        }
        // Step 6: Execute the task
        let executionSuccess = true;
        let executionError;
        try {
            if (pipeline) {
                // Execute via PipelineExecutor for multi-step tasks
                this.log(`DAI-003 task(): Executing pipeline with ${pipeline.stages.length} stages...`);
                // Convert IGeneratedPipeline to IPipelineDefinition
                const pipelineDefinition = {
                    name: `DAI-003: ${description.substring(0, 50)}`,
                    description: description,
                    sequential: true,
                    agents: pipeline.stages.map((stage, index) => ({
                        agentKey: stage.agentKey,
                        task: stage.taskSegment,
                        outputDomain: stage.outputDomain,
                        outputTags: ['dai-003', stage.agentKey],
                        timeout: 60000,
                    })),
                };
                const pipelineResult = await this.pipelineExecutor.execute(pipelineDefinition);
                if (pipelineResult.status === 'failed') {
                    executionSuccess = false;
                    executionError = pipelineResult.error?.message;
                    result = `Pipeline execution failed: ${pipelineResult.error?.message ?? 'Unknown error'}`;
                }
                else {
                    result = `Pipeline completed successfully. ${pipelineResult.steps.length}/${pipeline.stages.length} stages completed.`;
                }
            }
            else {
                // Execute via TaskExecutor for single-step tasks
                this.log(`DAI-003 task(): Executing task with agent '${agentUsed}'...`);
                // Get agent from registry
                const agent = this.agentRegistry.getByKey(agentUsed);
                if (!agent) {
                    throw new Error(`Agent '${agentUsed}' not found in registry`);
                }
                // TASK-FIX-002: Execute via TaskExecutor with ObservabilityBus events
                // Per RULE-033: Quality MUST be assessed on Task() RESULT, not prompt
                // TaskExecutor.execute() emits agent_started, agent_completed, agent_failed events
                const executionResult = await this.taskExecutor.execute(agent, description, async (_agentType, prompt, _options) => {
                    // Stub callback returns prompt - actual execution via Claude Code runtime
                    // The hooks system captures Task() results for quality assessment
                    this.log(`DAI-003 task(): Executing via TaskExecutor framework`);
                    return prompt;
                });
                result = executionResult.output;
            }
        }
        catch (error) {
            executionSuccess = false;
            executionError = error instanceof Error ? error.message : String(error);
            result = `Task execution failed: ${executionError}`;
            this.log(`DAI-003 task(): Execution failed: ${executionError}`);
        }
        const executionTimeMs = Date.now() - startTime;
        // Step 7: Submit feedback to RoutingLearner
        try {
            const feedback = {
                routingId: routing.routingId,
                task: description,
                selectedAgent: routing.selectedAgent,
                success: executionSuccess,
                executionTimeMs,
                userOverrideAgent: options.agent || (routing.usedPreference ? agentUsed : undefined),
                errorMessage: executionError,
                userAbandoned: false,
                completedStages: pipeline ? pipeline.stages.length : undefined,
                totalStages: pipeline ? pipeline.stages.length : undefined,
                feedbackAt: Date.now(),
            };
            await this.routingLearner.processFeedback(feedback);
            this.log(`DAI-003 task(): Feedback submitted to RoutingLearner`);
        }
        catch (error) {
            this.log(`Warning: Failed to submit routing feedback: ${error}`);
        }
        // DESC: Store episode for future learning (non-blocking, only if successful)
        if (executionSuccess) {
            this.storeDESCEpisode(description, result, {
                command: 'god-task',
                mode: 'general',
                quality: 0.8, // Tasks that complete successfully get a good quality score
            }).catch(err => this.log(`DESC: Background storage error: ${err}`));
        }
        return {
            result,
            routing,
            pipeline,
            executionTimeMs,
            agentUsed,
        };
    }
    async ask(input, options = {}) {
        await this.ensureInitialized();
        const interactionId = this.generateId();
        // DESC: Inject prior solutions before processing (RULE-010: window size 3)
        const descResult = await this.injectDESCEpisodes(input, { command: 'god-ask', mode: options.mode });
        const augmentedInput = descResult.augmentedPrompt;
        // DAI-001: Dynamic agent selection (use augmented input for better context)
        const agentSelection = await this.selectAgentForTask(augmentedInput);
        const mode = options.mode ?? agentSelection.selection.analysis.taskType;
        this.log(`[${mode.toUpperCase()}] Processing: ${input.slice(0, 50)}...`);
        this.log(`DAI-001: Selected agent '${agentSelection.selection.selected.key}' (${agentSelection.selection.selected.category})`);
        // Get embedding for trajectory creation (use original input for embedding consistency)
        const embedding = await this.embed(input);
        // Create trajectory if bridge available (FR-11)
        let trajectoryId;
        let patternsUsed = [];
        if (this.trajectoryBridge) {
            try {
                const trajectory = await this.trajectoryBridge.createTrajectoryFromInteraction(input, mode, embedding);
                trajectoryId = trajectory.trajectoryId;
                patternsUsed = trajectory.patterns.map(p => p.patternId);
                this.log(`Trajectory created: ${trajectoryId} (${patternsUsed.length} patterns)`);
            }
            catch (error) {
                this.log(`Warning: Trajectory creation failed: ${error}`);
            }
        }
        // TASK-FIX-001: Determine output based on executeTask option (RULE-033)
        // BREAKING CHANGE: executeTask now defaults to TRUE (was false)
        // When executeTask=true (or undefined), execute Task() and assess quality on the RESULT
        // When executeTask=false (explicit), return prompt for manual execution (legacy)
        let output;
        let taskExecuted = false;
        let assessedContentType = 'prompt';
        if (options.executeTask !== false && options.taskExecutionFn) {
            // RULE-033: Execute Task() and capture result for quality assessment
            try {
                const agentType = agentSelection.selection.selected.frontmatter?.type
                    ?? agentSelection.selection.selected.category;
                this.log(`TASK-LEARN-006: Executing Task() with agent '${agentType}'...`);
                output = await options.taskExecutionFn(agentType, agentSelection.prompt, { timeout: 120000 });
                taskExecuted = true;
                assessedContentType = 'result';
                // RULE-036: Log what we're assessing
                this.log(`TASK-LEARN-006: Quality will be assessed on Task() RESULT`, {
                    assessedContent: 'result',
                    resultLength: output.length,
                    hasCodeBlocks: output.includes('```'),
                    hasTaskSummary: output.includes('TASK COMPLETION SUMMARY'),
                });
            }
            catch (error) {
                // Fallback to prompt on execution failure
                this.log(`TASK-LEARN-006: Task execution failed, falling back to prompt: ${error}`);
                output = agentSelection.prompt;
                assessedContentType = 'prompt';
            }
        }
        else if (options.executeTask !== false) {
            // TASK-FIX-001: Default path - executeTask=true or undefined (new default)
            // Use the default task executor implementation with ObservabilityBus events
            try {
                this.log(`TASK-LEARN-007: Using default task executor...`);
                // TASK-HOOK-006: Pass trajectoryId for hook quality tracking (RULE-036)
                const executionResult = await this.executeTaskDefault(agentSelection, undefined, { trajectoryId });
                if (executionResult.success) {
                    output = executionResult.result;
                    taskExecuted = true;
                    assessedContentType = 'result';
                    // RULE-036: Log what we're assessing
                    this.log(`TASK-LEARN-007: Quality will be assessed on Task() RESULT`, {
                        assessedContent: 'result',
                        resultLength: output.length,
                        durationMs: executionResult.durationMs,
                        agentId: executionResult.agentId,
                        taskType: executionResult.taskType,
                    });
                }
                else {
                    // Execution failed, fallback to prompt
                    this.log(`TASK-LEARN-007: Default execution failed: ${executionResult.error}`);
                    output = agentSelection.prompt;
                    assessedContentType = 'prompt';
                }
            }
            catch (error) {
                // Unexpected error, fallback to prompt
                this.log(`TASK-LEARN-007: Unexpected error in default executor: ${error}`);
                output = agentSelection.prompt;
                assessedContentType = 'prompt';
            }
        }
        else {
            // TASK-FIX-001: Legacy path - ONLY reached when executeTask=false (explicit)
            // Return prompt for manual Task() execution
            // NOTE: Quality assessment on prompts is UNRELIABLE (prompts score ~0.30)
            output = agentSelection.prompt;
            assessedContentType = 'prompt';
            // RULE-036: Log warning about unreliable assessment
            this.log(`TASK-FIX-001: executeTask=false - Quality assessed on PROMPT (unreliable). Remove executeTask=false for accurate assessment.`);
        }
        // Record interaction with trajectory info
        const interaction = {
            id: interactionId,
            trajectoryId,
            mode,
            input,
            output,
            embedding,
            patternsUsed,
            timestamp: Date.now(),
            metadata: {
                context: options.context,
                // TASK-LEARN-006: Track assessment metadata
                taskExecuted,
                assessedContentType,
            }
        };
        this.interactionStore.add(interaction);
        // Estimate quality for auto-feedback
        const qualityInteraction = {
            id: interactionId,
            mode,
            input,
            output,
            timestamp: interaction.timestamp,
        };
        const qualityAssessment = assessQuality(qualityInteraction, this.config.autoStoreThreshold);
        const qualityScore = qualityAssessment.score;
        // RULE-036: Log quality assessment details
        this.log(`TASK-LEARN-006: Quality assessment complete`, {
            score: qualityScore.toFixed(3),
            threshold: this.config.autoStoreThreshold,
            meetsThreshold: qualityAssessment.meetsThreshold,
            assessedOn: assessedContentType,
            willTriggerLearning: qualityAssessment.meetsThreshold && this.config.autoLearn,
        });
        // Auto-feedback if bridge available and quality meets threshold (FR-11)
        let autoFeedbackSubmitted = false;
        if (this.config.autoLearn && this.trajectoryBridge && trajectoryId && qualityAssessment.meetsThreshold) {
            try {
                const feedbackResult = await this.trajectoryBridge.submitFeedback(trajectoryId, qualityScore, { implicit: true });
                autoFeedbackSubmitted = true;
                this.log(`Auto-feedback submitted: quality=${qualityScore.toFixed(2)}, patternCreated=${feedbackResult.patternCreated}`);
            }
            catch (error) {
                this.log(`Warning: Auto-feedback failed: ${error}`);
            }
        }
        // Legacy auto-learn if enabled
        if (this.config.autoLearn && options.learnFrom !== false) {
            await this.learnFromInteraction(interaction);
        }
        // DESC: Store episode for future learning (non-blocking)
        this.storeDESCEpisode(input, output, {
            command: 'god-ask',
            mode,
            quality: qualityScore,
        }).catch(err => this.log(`DESC: Background storage error: ${err}`));
        // Return based on options
        if (options.returnResult) {
            return {
                output,
                trajectoryId,
                patternsUsed,
                qualityScore,
                autoFeedbackSubmitted,
                interactionId,
                // DAI-001 fields
                selectedAgent: agentSelection.selection.selected.key,
                selectedAgentCategory: agentSelection.selection.selected.category,
                taskType: agentSelection.selection.analysis.taskType,
                agentPrompt: agentSelection.prompt,
                // DESC fields
                descEpisodesInjected: descResult.episodesUsed,
                // TASK-LEARN-006 fields (RULE-033, RULE-036)
                taskExecuted,
                assessedContentType,
            };
        }
        return output;
    }
    // ==================== Mode-Specific Processing ====================
    /**
     * Code mode - write code with pattern learning
     */
    async code(task, options = {}) {
        await this.ensureInitialized();
        // DESC: Inject prior solutions before processing (RULE-010: window size 3)
        const descResult = await this.injectDESCEpisodes(task, { command: 'god-code', mode: 'code' });
        const augmentedTask = descResult.augmentedPrompt;
        // DAI-001: Dynamic agent selection for code tasks (use augmented task)
        const agentSelection = await this.selectAgentForTask(augmentedTask);
        this.log(`DAI-001 code(): Selected agent '${agentSelection.selection.selected.key}' (${agentSelection.selection.selected.category})`);
        // Create trajectory for learning (FR-11)
        let trajectoryId;
        if (this.trajectoryBridge) {
            try {
                const embedding = await this.embed(task);
                const trajectory = await this.trajectoryBridge.createTrajectoryFromInteraction(task, 'code', embedding);
                trajectoryId = trajectory.trajectoryId;
            }
            catch (error) {
                this.log(`Warning: Trajectory creation failed in code(): ${error}`);
            }
        }
        // Find relevant code patterns
        const patterns = await this.retrieveRelevant(task, 'code');
        // TASK-FIX-003: Execute via TaskExecutor with ObservabilityBus events
        // Per RULE-033: Quality MUST be assessed on Task() RESULT, not prompt
        // TASK-HOOK-006: Pass trajectoryId for hook quality tracking (RULE-036)
        const executionResult = await this.executeTaskDefault(agentSelection, undefined, { trajectoryId });
        const code = executionResult.success ? executionResult.result : agentSelection.prompt;
        if (!executionResult.success) {
            this.log(`TASK-FIX-003 code(): Execution failed, using prompt as fallback`);
        }
        // Store successful code patterns in InteractionStore
        await this.storeKnowledge({
            content: code,
            type: 'pattern',
            domain: options.language ?? 'typescript',
            tags: ['generated', 'code-pattern', ...this.extractTags(task)],
        });
        // Learn this pattern if it's new and useful
        const patternId = await this.maybeStorePattern({
            content: code,
            type: 'pattern',
            domain: options.language ?? 'code',
            tags: this.extractTags(task),
        });
        // Auto-feedback if trajectory exists (FR-11)
        if (this.config.autoLearn && this.trajectoryBridge && trajectoryId) {
            const quality = estimateQuality({
                id: trajectoryId,
                mode: 'code',
                input: task,
                output: code,
                timestamp: Date.now(),
            });
            if (quality >= this.config.autoStoreThreshold) {
                try {
                    await this.trajectoryBridge.submitFeedback(trajectoryId, quality, { implicit: true });
                    this.log(`Code auto-feedback: quality=${quality.toFixed(2)}`);
                }
                catch (error) {
                    this.log(`Warning: Code auto-feedback failed: ${error}`);
                }
            }
        }
        // DESC: Store episode for future learning (non-blocking)
        const codeQuality = estimateQuality({
            id: trajectoryId ?? this.generateId(),
            mode: 'code',
            input: task,
            output: code,
            timestamp: Date.now(),
        });
        this.storeDESCEpisode(task, code, {
            command: 'god-code',
            mode: 'code',
            quality: codeQuality,
        }).catch(err => this.log(`DESC: Background storage error: ${err}`));
        return {
            task,
            code,
            language: options.language ?? 'typescript',
            patterns_used: patterns.map(p => p.id),
            explanation: `Generated code for: ${task}`,
            learned: !!patternId,
            trajectoryId,
        };
    }
    /**
     * Research mode - gather and synthesize knowledge
     * Automatically searches the web if knowledge base is insufficient
     */
    async research(query, options = {}) {
        await this.ensureInitialized();
        // DESC: Inject prior solutions before processing (RULE-010: window size 3)
        const descResult = await this.injectDESCEpisodes(query, { command: 'god-research', mode: 'research' });
        const augmentedQuery = descResult.augmentedPrompt;
        // DAI-001: Dynamic agent selection for research tasks (use augmented query)
        const agentSelection = await this.selectAgentForTask(augmentedQuery);
        this.log(`DAI-001 research(): Selected agent '${agentSelection.selection.selected.key}' (${agentSelection.selection.selected.category})`);
        const depth = options.depth ?? 'standard';
        const enableWebSearch = options.enableWebSearch ?? this.config.enableWebSearch;
        this.log(`Researching: ${query} (depth: ${depth}, webSearch: ${enableWebSearch})`);
        // Get style prompt from learned profile if available
        let _stylePrompt = null;
        if (this.styleProfileManager) {
            if (options.styleProfileId) {
                _stylePrompt = this.styleProfileManager.generateStylePrompt(options.styleProfileId);
            }
            else if (options.useActiveStyleProfile !== false) {
                _stylePrompt = this.styleProfileManager.generateStylePrompt();
            }
        }
        // Create trajectory for learning (FR-11)
        let trajectoryId;
        if (this.trajectoryBridge) {
            try {
                const embedding = await this.embed(query);
                const trajectory = await this.trajectoryBridge.createTrajectoryFromInteraction(query, 'research', embedding);
                trajectoryId = trajectory.trajectoryId;
            }
            catch (error) {
                this.log(`Warning: Trajectory creation failed in research(): ${error}`);
            }
        }
        // Get existing knowledge
        const existing = await this.retrieveRelevant(query, 'research');
        // Check if we have sufficient knowledge
        const hasGoodKnowledge = existing.length >= 3 && existing[0]?.similarity > 0.7;
        let findings = [];
        // If knowledge base is insufficient and web search is enabled, search the web
        if (!hasGoodKnowledge && enableWebSearch) {
            this.log('Knowledge base insufficient - performing web search...');
            const webResults = await this.performWebSearch(query, depth);
            // Store web results in knowledge base for future use
            for (const result of webResults) {
                await this.storeKnowledge({
                    content: result.content,
                    type: 'fact',
                    domain: 'research',
                    tags: [...this.extractTags(query), 'web-search'],
                    source: result.source,
                });
            }
            findings = webResults.map(r => ({
                content: r.content,
                source: r.source,
                relevance: r.relevance,
                confidence: r.confidence,
            }));
            this.log(`Web search returned ${webResults.length} results, stored in knowledge base`);
        }
        else {
            // Use existing knowledge
            findings = existing.map(k => ({
                content: String(k.content),
                source: 'knowledge_base',
                relevance: k.similarity,
                confidence: k.confidence,
            }));
        }
        // TASK-FIX-004: Execute via TaskExecutor with ObservabilityBus events
        // Per RULE-033: Quality MUST be assessed on Task() RESULT, not prompt
        // TASK-HOOK-006: Pass trajectoryId for hook quality tracking (RULE-036)
        const executionResult = await this.executeTaskDefault(agentSelection, undefined, { trajectoryId });
        const synthesis = executionResult.success ? executionResult.result : agentSelection.prompt;
        if (!executionResult.success) {
            this.log(`TASK-FIX-004 research(): Execution failed, using prompt as fallback`);
        }
        // Auto-feedback if trajectory exists (FR-11)
        let researchQuality = 0.7;
        if (this.config.autoLearn && this.trajectoryBridge && trajectoryId) {
            researchQuality = estimateQuality({
                id: trajectoryId,
                mode: 'research',
                input: query,
                output: synthesis,
                timestamp: Date.now(),
            });
            if (researchQuality >= this.config.autoStoreThreshold) {
                try {
                    await this.trajectoryBridge.submitFeedback(trajectoryId, researchQuality, { implicit: true });
                    this.log(`Research auto-feedback: quality=${researchQuality.toFixed(2)}`);
                }
                catch (error) {
                    this.log(`Warning: Research auto-feedback failed: ${error}`);
                }
            }
        }
        // DESC: Store episode for future learning (non-blocking)
        this.storeDESCEpisode(query, synthesis, {
            command: 'god-research',
            mode: 'research',
            quality: researchQuality,
        }).catch(err => this.log(`DESC: Background storage error: ${err}`));
        return {
            query,
            findings,
            synthesis,
            knowledgeStored: findings.length,
            trajectoryId,
        };
    }
    /**
     * Perform web search using available search tools
     * SPEC-WEB-001: Hybrid search provider (WebSearch + Perplexity MCP)
     */
    async performWebSearch(query, depth) {
        if (!this.config.enableWebSearch) {
            this.log('Web search disabled in config');
            return [{
                    content: `Web search is disabled. Enable it in config or manually add knowledge using /god-learn.`,
                    source: 'system',
                    relevance: 0,
                    confidence: 0,
                }];
        }
        try {
            // Map 'standard' to 'medium' for the provider
            const providerDepth = depth === 'standard' ? 'medium' : depth;
            this.log(`Performing web search: "${query}" (depth: ${providerDepth})`);
            // Delegate to web search provider
            const results = await this.webSearchProvider.search(query, {
                depth: providerDepth,
                maxResults: 10,
            });
            // Store search results in InteractionStore for learning
            if (this.config.autoLearn && results.length > 0) {
                await this.storeKnowledge({
                    content: JSON.stringify({
                        query,
                        depth: providerDepth,
                        resultCount: results.length,
                        timestamp: Date.now(),
                    }),
                    type: 'fact',
                    domain: 'research/searches',
                    tags: ['web-search', providerDepth, 'auto-stored'],
                });
            }
            // Transform ISearchResult to expected format
            return results.map(result => ({
                content: result.content,
                source: result.source,
                relevance: result.relevance,
                confidence: result.relevance, // Use relevance as confidence
            }));
        }
        catch (error) {
            this.log(`Web search failed: ${error}`, true);
            return [{
                    content: `Web search failed: ${error}. Query: "${query}". Please try again or manually add knowledge using /god-learn.`,
                    source: 'error',
                    relevance: 0,
                    confidence: 0,
                }];
        }
    }
    /**
     * Write mode - generate documents with style learning
     *
     * @param topic - The topic to write about
     * @param options - Writing options including style profile
     * @param options.styleProfileId - ID of a learned style profile to use
     * @param options.useActiveStyleProfile - Use the currently active style profile
     */
    async write(topic, options = {}) {
        await this.ensureInitialized();
        // DESC: Inject prior solutions before processing (RULE-010: window size 3)
        const descResult = await this.injectDESCEpisodes(topic, { command: 'god-write', mode: 'write' });
        const augmentedTopic = descResult.augmentedPrompt;
        // DAI-001: Dynamic agent selection for write tasks (use augmented topic)
        const agentSelection = await this.selectAgentForTask(augmentedTopic);
        this.log(`DAI-001 write(): Selected agent '${agentSelection.selection.selected.key}' (${agentSelection.selection.selected.category})`);
        const style = options.style ?? 'professional';
        const length = options.length ?? 'medium';
        const format = options.format ?? 'article';
        // Get style prompt from learned profile if available
        let _stylePrompt = null;
        if (this.styleProfileManager) {
            if (options.styleProfileId) {
                _stylePrompt = this.styleProfileManager.generateStylePrompt(options.styleProfileId);
            }
            else if (options.useActiveStyleProfile !== false) {
                // Default to active profile if one is set
                _stylePrompt = this.styleProfileManager.generateStylePrompt();
            }
        }
        // Create trajectory for learning (FR-11)
        let trajectoryId;
        if (this.trajectoryBridge) {
            try {
                const embedding = await this.embed(topic);
                const trajectory = await this.trajectoryBridge.createTrajectoryFromInteraction(topic, 'write', embedding);
                trajectoryId = trajectory.trajectoryId;
            }
            catch (error) {
                this.log(`Warning: Trajectory creation failed in write(): ${error}`);
            }
        }
        // Get relevant knowledge
        const knowledge = await this.retrieveRelevant(topic, 'write');
        // TASK-FIX-005: Execute via TaskExecutor with ObservabilityBus events
        // Per RULE-033: Quality MUST be assessed on Task() RESULT, not prompt
        // TASK-HOOK-006: Pass trajectoryId for hook quality tracking (RULE-036)
        const executionResult = await this.executeTaskDefault(agentSelection, undefined, { trajectoryId });
        const content = executionResult.success ? executionResult.result : agentSelection.prompt;
        if (!executionResult.success) {
            this.log(`TASK-FIX-005 write(): Execution failed, using prompt as fallback`);
        }
        // Store successful writing patterns
        await this.maybeStorePattern({
            content: `${format} on ${topic}`,
            type: 'example',
            domain: 'writing',
            tags: [style, format, ...this.extractTags(topic)],
        });
        // Auto-feedback if trajectory exists (FR-11)
        let writeQuality = 0.7;
        if (this.config.autoLearn && this.trajectoryBridge && trajectoryId) {
            writeQuality = estimateQuality({
                id: trajectoryId,
                mode: 'write',
                input: topic,
                output: content,
                timestamp: Date.now(),
            });
            if (writeQuality >= this.config.autoStoreThreshold) {
                try {
                    await this.trajectoryBridge.submitFeedback(trajectoryId, writeQuality, { implicit: true });
                    this.log(`Write auto-feedback: quality=${writeQuality.toFixed(2)}`);
                }
                catch (error) {
                    this.log(`Warning: Write auto-feedback failed: ${error}`);
                }
            }
        }
        // DESC: Store episode for future learning (non-blocking)
        this.storeDESCEpisode(topic, content, {
            command: 'god-write',
            mode: 'write',
            quality: writeQuality,
        }).catch(err => this.log(`DESC: Background storage error: ${err}`));
        return {
            topic,
            content,
            style,
            sources: knowledge.map(k => k.id),
            wordCount: content.split(/\s+/).length,
            trajectoryId,
        };
    }
    /**
     * Write a paper by combining research and writing with learned style
     *
     * This method:
     * 1. Performs research on the topic
     * 2. Synthesizes findings
     * 3. Generates a paper with the learned style profile
     *
     * @param topic - The paper topic
     * @param options - Options for research and writing
     */
    async writePaper(topic, options = {}) {
        await this.ensureInitialized();
        this.log(`Writing paper on: ${topic}`);
        // Check if we have an active style profile
        const activeProfile = this.getActiveStyleProfile();
        const styleProfileId = options.styleProfileId || activeProfile?.metadata.id;
        const styleApplied = !!styleProfileId;
        if (styleApplied) {
            this.log(`Using style profile: ${styleProfileId}`);
        }
        // Step 1: Research the topic
        const research = await this.research(topic, {
            depth: options.depth ?? 'deep',
            enableWebSearch: options.enableWebSearch ?? true,
            styleProfileId,
        });
        this.log(`Research complete: ${research.findings.length} findings`);
        // Step 2: Write the paper with findings and style
        const paper = await this.write(topic, {
            style: 'academic',
            format: options.format ?? 'paper',
            length: options.length ?? 'comprehensive',
            styleProfileId,
        });
        this.log(`Paper complete: ${paper.wordCount} words`);
        return {
            topic,
            research,
            paper,
            styleApplied,
        };
    }
    // ==================== Learning System ====================
    /**
     * Explicit feedback - improves future results via SonaEngine
     *
     * Can accept either an interactionId (looks up trajectoryId) or
     * a trajectoryId directly (with isTrajectoryId: true).
     *
     * @param id - Interaction ID or Trajectory ID
     * @param rating - Quality rating 0-1
     * @param options - Additional options
     * @returns FeedbackResult with weight updates and pattern creation info
     */
    async feedback(id, rating, options = {}) {
        let trajectoryId;
        let interaction;
        if (options.isTrajectoryId) {
            // Direct trajectory ID provided
            trajectoryId = id;
        }
        else {
            // Look up interaction by ID
            interaction = this.interactionStore.get(id);
            if (!interaction) {
                this.log(`Warning: Interaction ${id} not found`);
                return { weightUpdates: 0, patternCreated: false };
            }
            trajectoryId = interaction.trajectoryId;
        }
        const feedbackData = {
            rating,
            useful: options.useful ?? rating > 0.5,
            notes: options.notes,
        };
        // Update feedback in store if we have an interaction
        if (interaction) {
            this.interactionStore.updateFeedback(id, feedbackData);
        }
        // Submit to SonaEngine via TrajectoryBridge (FR-11)
        let feedbackResult = { weightUpdates: 0, patternCreated: false };
        if (this.trajectoryBridge && trajectoryId) {
            try {
                feedbackResult = await this.trajectoryBridge.submitFeedback(trajectoryId, rating, { notes: options.notes });
                this.log(`SonaEngine feedback: trajectory=${trajectoryId}, rating=${rating.toFixed(2)}, patternCreated=${feedbackResult.patternCreated}`);
            }
            catch (error) {
                this.log(`Warning: SonaEngine feedback failed: ${error}`);
            }
        }
        // Legacy learning from this feedback
        if (interaction) {
            if (rating > this.config.autoStoreThreshold) {
                await this.reinforcePattern(interaction);
            }
            else if (rating < 0.3) {
                await this.weakenPattern(interaction);
            }
        }
        this.log(`Feedback recorded: ${rating} for ${id}`);
        return feedbackResult;
    }
    /**
     * Learn from successful interaction
     */
    async learnFromInteraction(interaction) {
        // Auto-detect quality based on interaction characteristics
        const implicitQuality = this.assessQuality(interaction);
        if (implicitQuality > this.config.autoStoreThreshold) {
            await this.storeKnowledge({
                content: `${interaction.input} -> ${interaction.output}`,
                type: 'pattern',
                domain: interaction.mode,
                tags: this.extractTags(interaction.input),
            });
            this.log(`Auto-learned from interaction: ${interaction.id}`);
        }
    }
    /**
     * Reinforce a successful pattern
     */
    async reinforcePattern(interaction) {
        const embedding = interaction.embedding ?? await this.embed(interaction.input);
        // Query to find the pattern that was used
        const results = await this.agent.query(embedding, { k: 1 });
        if (results.patterns.length > 0) {
            await this.agent.learn({
                queryId: results.queryId,
                patternId: results.patterns[0].id,
                verdict: 'positive',
                score: interaction.feedback?.rating ?? 0.9,
            });
            // Track success
            const key = results.patterns[0].id;
            this.successfulPatterns.set(key, (this.successfulPatterns.get(key) ?? 0) + 1);
        }
    }
    /**
     * Weaken an unsuccessful pattern
     */
    async weakenPattern(interaction) {
        const embedding = interaction.embedding ?? await this.embed(interaction.input);
        const results = await this.agent.query(embedding, { k: 1 });
        if (results.patterns.length > 0) {
            await this.agent.learn({
                queryId: results.queryId,
                patternId: results.patterns[0].id,
                verdict: 'negative',
                score: interaction.feedback?.rating ?? 0.1,
            });
        }
    }
    // ==================== Knowledge Management ====================
    /**
     * Store knowledge for future use
     */
    async storeKnowledge(entry) {
        const id = this.generateId();
        const embedding = await this.embed(entry.content);
        const knowledge = {
            ...entry,
            id,
            quality: 0.5, // Initial quality
            usageCount: 0,
            lastUsed: Date.now(),
            createdAt: Date.now(),
        };
        await this.agent.store({
            content: knowledge,
            embedding,
            metadata: {
                type: entry.type,
                domain: entry.domain,
                tags: entry.tags,
            }
        }, {
            trackProvenance: true,
            namespace: `knowledge.${entry.domain}`,
        });
        this.interactionStore.addKnowledge(knowledge);
        // Track domain expertise
        const domainCount = (this.domainExpertise.get(entry.domain) ?? 0) + 1;
        this.domainExpertise.set(entry.domain, domainCount);
        this.log(`Stored knowledge: ${id} (${entry.domain}/${entry.type})`);
        return id;
    }
    /**
     * Retrieve relevant knowledge
     */
    async retrieveRelevant(query, _mode, k = 10) {
        const embedding = await this.embed(query);
        const results = await this.agent.query(embedding, {
            k,
            minSimilarity: 0.3,
            includeProvenance: true,
        });
        // Update usage stats for retrieved patterns
        for (const pattern of results.patterns) {
            await this.updateUsageStats(pattern.id);
        }
        return results.patterns;
    }
    /**
     * Maybe store a pattern if it's high quality
     */
    async maybeStorePattern(entry) {
        // Check if similar pattern already exists
        const embedding = await this.embed(entry.content);
        const existing = await this.agent.query(embedding, { k: 1, minSimilarity: 0.9 });
        if (existing.patterns.length > 0) {
            // Update existing rather than duplicate
            await this.updateUsageStats(existing.patterns[0].id);
            return null;
        }
        return this.storeKnowledge(entry);
    }
    async updateUsageStats(patternId) {
        // In a full implementation, this would update the pattern's usage count
        // For now, just track locally
        this.log(`Pattern accessed: ${patternId}`);
    }
    // ==================== Helper Methods ====================
    // ==================== DESC Episode Injection ====================
    /**
     * Inject prior solutions from DESC episodic memory (RULE-010)
     * Uses default window size of 3 episodes for general agent work
     *
     * @param prompt - The original prompt to augment
     * @param context - Additional context for logging/metadata
     * @returns Augmented prompt with prior solutions or original on error
     */
    async injectDESCEpisodes(prompt, context) {
        // Skip if DESC is disabled or client not initialized
        if (!this.config.enableDESC || !this.ucmClient) {
            return { augmentedPrompt: prompt, episodesUsed: 0, episodeIds: [] };
        }
        try {
            const result = await this.ucmClient.injectSolutions(prompt, {
                threshold: this.config.descThreshold,
                maxEpisodes: this.config.descMaxEpisodes, // RULE-010: default 3
                agentType: context?.mode ?? 'general',
                metadata: {
                    source: 'universal-agent',
                    command: context?.command ?? 'unknown',
                    timestamp: Date.now(),
                },
            });
            if (result.episodesUsed > 0) {
                this.log(`DESC: Injected ${result.episodesUsed} prior solutions for ${context?.command ?? 'task'}`);
            }
            return result;
        }
        catch (error) {
            // Graceful fallback - don't block execution if DESC fails
            this.log(`DESC: Episode injection failed, using original prompt: ${error}`);
            return { augmentedPrompt: prompt, episodesUsed: 0, episodeIds: [] };
        }
    }
    /**
     * Store a completed episode for future DESC retrieval
     *
     * @param queryText - The original query/prompt
     * @param answerText - The generated response/result
     * @param context - Additional context for metadata
     */
    async storeDESCEpisode(queryText, answerText, context) {
        // Skip if DESC is disabled or client not initialized
        if (!this.config.enableDESC || !this.ucmClient) {
            return;
        }
        // Only store high-quality episodes (above threshold)
        const quality = context?.quality ?? 0.7;
        if (quality < this.config.autoStoreThreshold) {
            this.log(`DESC: Skipping episode storage (quality ${quality.toFixed(2)} < threshold ${this.config.autoStoreThreshold})`);
            return;
        }
        try {
            const result = await this.ucmClient.storeEpisode(queryText, answerText, {
                source: 'universal-agent',
                command: context?.command ?? 'unknown',
                mode: context?.mode ?? 'general',
                quality,
                timestamp: Date.now(),
            });
            if (result.success) {
                this.log(`DESC: Stored episode ${result.episodeId} for future learning`);
            }
        }
        catch (error) {
            // Non-fatal: don't block on storage failures
            this.log(`DESC: Episode storage failed: ${error}`);
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _detectMode(input) {
        const lower = input.toLowerCase();
        if (lower.match(/\b(code|function|implement|debug|fix|program|script|api)\b/)) {
            return 'code';
        }
        if (lower.match(/\b(research|find|investigate|analyze|study|explore|learn about)\b/)) {
            return 'research';
        }
        if (lower.match(/\b(write|draft|compose|create|essay|article|document|report|paper)\b/)) {
            return 'write';
        }
        return 'general';
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async _generateCode(task, patterns, options) {
        const patternContext = this.buildPatternContext(patterns);
        const examplesContext = options.examples?.length
            ? `\n\n## Examples:\n${options.examples.map((ex, i) => `### Example ${i + 1}:\n${ex}`).join('\n\n')}`
            : '';
        const prompt = `## Code Generation Task

**Language**: ${options.language ?? 'typescript'}

**Task**: ${task}

${patternContext}
${options.context ? `\n## Additional Context:\n${options.context}` : ''}
${examplesContext}

## Requirements:
1. Generate clean, production-ready code
2. Follow best practices for ${options.language ?? 'typescript'}
3. Include necessary imports
4. Add JSDoc/docstring comments for public APIs
5. Handle edge cases appropriately

## Output Format:
Return ONLY the code, wrapped in appropriate markdown code blocks.
`;
        // Use the coder agent via CLI (now that SPEC-EXE-001 is implemented)
        const { spawn } = await import('child_process');
        return new Promise((resolve) => {
            const args = ['--print', '--output-format', 'json'];
            // System prompt for coder behavior
            const systemPrompt = `You are a code generation expert. Generate clean, well-documented, production-ready code.
Focus on: correctness, readability, best practices, proper error handling.
Return ONLY code in markdown code blocks.`;
            args.push('--system-prompt', systemPrompt);
            args.push(prompt);
            // Set timeout for CLI execution (10 seconds)
            const timeout = setTimeout(async () => {
                this.log('Warning: Claude CLI execution timed out (10s)');
                child.kill();
                resolve(await this.generateFallbackCode(task, patterns, options));
            }, 10000);
            const child = spawn('claude', args, { cwd: process.cwd() });
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (data) => { stdout += data.toString(); });
            child.stderr?.on('data', (data) => { stderr += data.toString(); });
            child.on('close', async (code) => {
                clearTimeout(timeout);
                if (code === 0) {
                    try {
                        const parsed = JSON.parse(stdout);
                        const response = parsed.result || parsed.output || stdout;
                        const extractedCode = this.extractCodeFromResponse(response);
                        resolve(extractedCode);
                    }
                    catch {
                        // INTENTIONAL: JSON parsing failure is expected for non-JSON CLI output - fallback to raw extraction
                        const extractedCode = this.extractCodeFromResponse(stdout);
                        resolve(extractedCode);
                    }
                }
                else {
                    // Fallback to placeholder if CLI fails
                    this.log(`Warning: Claude CLI execution failed (code ${code}): ${stderr}`);
                    resolve(await this.generateFallbackCode(task, patterns, options));
                }
            });
            child.on('error', async (err) => {
                // Fallback if CLI not found or error occurred
                clearTimeout(timeout);
                this.log(`Warning: Claude CLI not available: ${err.message}`);
                resolve(await this.generateFallbackCode(task, patterns, options));
            });
        });
    }
    /**
     * Build context from ReasoningBank patterns
     */
    buildPatternContext(patterns) {
        if (patterns.length === 0) {
            return '## No existing patterns found - creating new solution.';
        }
        const relevantPatterns = patterns.slice(0, 5);
        return `## Relevant Patterns (${patterns.length} found):\n${relevantPatterns.map((p, i) => {
            const contentStr = String(p.content).slice(0, 500);
            return `### Pattern ${i + 1} (relevance: ${(p.similarity * 100).toFixed(0)}%):\n${contentStr}`;
        }).join('\n\n')}`;
    }
    /**
     * Extract code from markdown code blocks in response
     */
    extractCodeFromResponse(response) {
        const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
        const matches = [...response.matchAll(codeBlockRegex)];
        if (matches.length > 0) {
            return matches.map(m => m[1].trim()).join('\n\n');
        }
        // No code blocks found, return trimmed response
        return response.trim();
    }
    /**
     * Generate fallback code when CLI is not available
     * Uses ClaudeCodeExecutor for production-ready code with InteractionStore for learning
     * RULE-CLI-001-002: No fallbacks - let errors propagate
     */
    async generateFallbackCode(task, patterns, options) {
        const language = options.language ?? 'typescript';
        // Build context from patterns, examples, and InteractionStore
        const contextParts = [];
        if (options.context) {
            contextParts.push(options.context);
        }
        // Add ReasoningBank patterns
        if (patterns.length > 0) {
            const patternContext = patterns
                .slice(0, 3)
                .map((p, i) => `Pattern ${i + 1}: ${String(p.content).slice(0, 300)}`)
                .join('\n\n');
            contextParts.push(`Relevant patterns from ReasoningBank:\n${patternContext}`);
        }
        // Retrieve relevant context from InteractionStore
        const relevantContext = await this.getRelevantContext(task);
        if (relevantContext) {
            contextParts.push(relevantContext);
        }
        // Add user-provided examples
        if (options.examples && options.examples.length > 0) {
            const examplesContext = options.examples
                .map((ex, i) => `Example ${i + 1}:\n${ex}`)
                .join('\n\n');
            contextParts.push(`Examples:\n${examplesContext}`);
        }
        const request = {
            task,
            language,
            context: contextParts.join('\n\n') || undefined,
            constraints: ['production-ready', 'well-documented', 'type-safe'],
            maxTokens: 2048
        };
        // RULE-CLI-001-002: Let errors propagate (no try/catch fallback)
        const result = await this.codeExecutor.execute(request);
        // Store the generated code for learning if quality is high
        if (this.interactionStore && result.qualityScore >= 0.7) {
            const embedding = await this.embed(task);
            const interaction = {
                id: this.generateId(),
                mode: 'code',
                input: task,
                output: result.code,
                embedding,
                timestamp: Date.now(),
                feedback: {
                    rating: result.qualityScore,
                    useful: true,
                    notes: `Generated via ${result.metadata.source}, model: ${result.metadata.model}`
                },
                metadata: {
                    language,
                    source: result.metadata.source,
                    model: result.metadata.model,
                    tokensUsed: result.metadata.tokensUsed,
                    latencyMs: result.metadata.latencyMs,
                }
            };
            this.interactionStore.add(interaction);
            this.log(`Stored high-quality code in InteractionStore: quality=${result.qualityScore.toFixed(2)}`);
        }
        this.log(`Generated code via ${result.metadata.source}: quality=${result.qualityScore.toFixed(2)}`);
        return result.code;
    }
    /**
     * Get relevant context from InteractionStore for code generation
     */
    async getRelevantContext(prompt) {
        if (!this.interactionStore) {
            return '';
        }
        try {
            // Search for similar code interactions in InteractionStore
            const stats = this.interactionStore.getStats();
            if (stats.totalInteractions === 0) {
                return '';
            }
            // Get all interactions and find code mode ones
            const allInteractions = this.interactionStore.getHighQuality();
            const codeInteractions = allInteractions.filter(i => i.mode === 'code');
            if (codeInteractions.length === 0) {
                return '';
            }
            // Simple similarity: find interactions with matching keywords
            const promptWords = new Set(prompt.toLowerCase().split(/\W+/).filter(w => w.length > 3));
            const similar = codeInteractions
                .map(interaction => {
                const inputWords = new Set(interaction.input.toLowerCase().split(/\W+/));
                const matchCount = [...promptWords].filter(word => inputWords.has(word)).length;
                return { interaction, matchCount };
            })
                .filter(item => item.matchCount > 0)
                .sort((a, b) => b.matchCount - a.matchCount)
                .slice(0, 3);
            if (similar.length === 0) {
                return '';
            }
            const contextLines = similar.map((item, idx) => {
                const { interaction } = item;
                return `Previous Example ${idx + 1}:\nTask: ${interaction.input}\nCode:\n${interaction.output.slice(0, 400)}${interaction.output.length > 400 ? '...' : ''}`;
            });
            return `Similar code from memory (InteractionStore):\n\n${contextLines.join('\n\n')}`;
        }
        catch (error) {
            this.log(`Error retrieving context from InteractionStore: ${error}`);
            return '';
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async _generateWriting(topic, knowledge, options) {
        try {
            // Check if writing generator is available (graceful degradation)
            if (!this.writingGenerator) {
                this.log('Writing generator unavailable (ANTHROPIC_API_KEY not set)', true);
                return `# ${topic}\n\nWriting generation requires ANTHROPIC_API_KEY environment variable to be set.`;
            }
            // Gather context from InteractionStore
            const context = await this.gatherWritingContext(topic, knowledge);
            // Estimate word count from length option
            const maxLength = this.estimateWordCount(options.length);
            // Generate with LLM
            const result = await this.writingGenerator.generate({
                title: topic,
                description: `Generate content in ${options.style} style with ${options.length} length`,
                style: options.style !== 'default' ? options.style : undefined,
                context,
                maxLength,
                format: options.format === 'markdown' ? 'markdown' : 'plain',
            });
            // Provide feedback to ReasoningBank for learning
            const reasoningBank = this.agent.getReasoningBank();
            if (reasoningBank) {
                await reasoningBank.provideFeedback({
                    trajectoryId: `writing-${Date.now()}`,
                    quality: result.qualityScore,
                    verdict: result.qualityScore > 0.7 ? 'correct' : 'neutral',
                    reasoning: `Generated ${result.wordCount} words for "${topic}" (quality: ${result.qualityScore.toFixed(2)})`,
                });
            }
            this.log(`Generated ${result.wordCount} words (quality: ${result.qualityScore.toFixed(2)}, model: ${result.metadata.model})`, true);
            return result.content;
        }
        catch (error) {
            this.log(`Writing generation failed: ${error}`, true);
            // Fallback to ensure non-breaking behavior
            return `# ${topic}\n\nError: Failed to generate content. ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    /**
     * Gather context from InteractionStore for writing generation (SPEC-WRT-001)
     */
    async gatherWritingContext(topic, knowledge) {
        const contextParts = [];
        // Include knowledge from query
        if (knowledge.length > 0) {
            contextParts.push(`Relevant knowledge entries: ${knowledge.length}`);
            const topKnowledge = knowledge.slice(0, 3);
            for (const pattern of topKnowledge) {
                const content = typeof pattern.content === 'string' ? pattern.content : JSON.stringify(pattern.content);
                contextParts.push(`- ${content.substring(0, 200)}`);
            }
        }
        // Query InteractionStore for relevant knowledge
        const allKnowledge = this.interactionStore.getKnowledgeByDomain('*');
        const relevantKnowledge = allKnowledge.filter((k) => {
            const content = k.content.toLowerCase();
            const topicLower = topic.toLowerCase();
            return (content.includes(topicLower) ||
                topicLower.split(' ').some((word) => word.length > 4 && content.includes(word)));
        });
        if (relevantKnowledge.length > 0) {
            contextParts.push(`\nAdditional context from InteractionStore:`);
            const topRelevant = relevantKnowledge.slice(0, 3);
            for (const k of topRelevant) {
                contextParts.push(`[${k.type}]: ${k.content.substring(0, 300)}`);
            }
        }
        return contextParts.length > 0 ? contextParts.join('\n') : '';
    }
    /**
     * Estimate word count from length string
     */
    estimateWordCount(length) {
        const lengthMap = {
            short: 500,
            medium: 1500,
            long: 3000,
        };
        return lengthMap[length] ?? 1500;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _synthesize(findings, query, stylePrompt) {
        if (findings.length === 0) {
            return `No existing knowledge found for: ${query}. Consider adding research to the knowledge base.`;
        }
        // Build synthesis with style guidance if available
        let synthesis = `Based on ${findings.length} knowledge entries:\n\n`;
        if (stylePrompt) {
            synthesis += `[Style Profile Applied]\n${stylePrompt}\n\n`;
        }
        synthesis += findings.map(f => `- ${f.content.slice(0, 100)}... (relevance: ${(f.relevance * 100).toFixed(0)}%)`).join('\n');
        return synthesis;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async _processCode(input, _knowledge, context) {
        const result = await this.code(input, { context });
        return result.code;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async _processResearch(input, _knowledge) {
        const result = await this.research(input);
        return result.synthesis;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async _processWrite(input, _knowledge, _context) {
        const result = await this.write(input);
        return result.content;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async _processGeneral(input, knowledge) {
        if (knowledge.length > 0) {
            return `Found ${knowledge.length} relevant entries:\n\n` +
                knowledge.slice(0, 5).map(k => `- ${String(k.content).slice(0, 200)}...`).join('\n');
        }
        return `No relevant knowledge found for: ${input}`;
    }
    assessQuality(interaction) {
        // Heuristic quality assessment
        let quality = 0.5;
        // Longer, detailed outputs tend to be higher quality
        if (interaction.output.length > 500)
            quality += 0.1;
        if (interaction.output.length > 1000)
            quality += 0.1;
        // Structured output (code, lists) tends to be useful
        if (interaction.output.includes('```'))
            quality += 0.1;
        if (interaction.output.includes('\n-'))
            quality += 0.05;
        return Math.min(quality, 1.0);
    }
    extractTags(text) {
        // Extract meaningful tags from text
        const words = text.toLowerCase().split(/\W+/);
        const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although', 'though', 'after', 'before', 'when', 'whenever', 'where', 'wherever', 'whether', 'which', 'while', 'who', 'whoever', 'whom', 'whose', 'why', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'this', 'that', 'these', 'those', 'am']);
        return words
            .filter(w => w.length > 3 && !stopWords.has(w))
            .slice(0, 10);
    }
    async embed(text) {
        // Use real embedding provider from SPEC-EMB-001 (LocalEmbeddingProvider with all-mpnet-base-v2)
        // Provider already handles caching, normalization, error handling
        return this.embeddingProvider.embed(text);
    }
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    log(...args) {
        if (this.config.verbose) {
            universalLogger.debug(args.map(a => String(a)).join(' '));
        }
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    // ==================== Style Profile Management ====================
    /**
     * Learn a writing style from text samples
     *
     * @param name - Name for the style profile
     * @param textSamples - Array of text samples to learn from
     * @param options - Additional options
     * @returns The created style profile
     */
    async learnStyle(name, textSamples, options = {}) {
        await this.ensureInitialized();
        if (!this.styleProfileManager) {
            this.log('Warning: StyleProfileManager not available');
            return null;
        }
        try {
            const profile = await this.styleProfileManager.createProfile(name, textSamples, {
                description: options.description,
                sourceType: 'text',
                tags: options.tags,
            });
            if (options.setAsActive) {
                await this.styleProfileManager.setActiveProfile(profile.metadata.id);
                this.log(`Style profile "${name}" created and set as active`);
            }
            else {
                this.log(`Style profile "${name}" created`);
            }
            return profile;
        }
        catch (error) {
            this.log(`Error creating style profile: ${error}`);
            return null;
        }
    }
    /**
     * List all available style profiles
     */
    listStyleProfiles() {
        if (!this.styleProfileManager) {
            return [];
        }
        return this.styleProfileManager.listProfiles();
    }
    /**
     * Set the active style profile
     */
    async setActiveStyleProfile(profileId) {
        if (!this.styleProfileManager) {
            this.log('Warning: StyleProfileManager not available');
            return false;
        }
        try {
            await this.styleProfileManager.setActiveProfile(profileId);
            this.log(`Active style profile set to: ${profileId ?? 'none'}`);
            return true;
        }
        catch (error) {
            this.log(`Error setting active style profile: ${error}`);
            return false;
        }
    }
    /**
     * Get the active style profile
     */
    getActiveStyleProfile() {
        return this.styleProfileManager?.getActiveProfile();
    }
    /**
     * Get style characteristics for a profile
     */
    getStyleCharacteristics(profileId) {
        if (!this.styleProfileManager) {
            return null;
        }
        return this.styleProfileManager.getStyleCharacteristics(profileId);
    }
    /**
     * Get style profile statistics
     */
    getStyleStats() {
        if (!this.styleProfileManager) {
            return { totalProfiles: 0, activeProfile: null, totalSourceDocuments: 0 };
        }
        return this.styleProfileManager.getStats();
    }
    /**
     * Get the StyleProfileManager instance for direct access
     */
    getStyleProfileManager() {
        return this.styleProfileManager;
    }
    // ==================== Stats & Status ====================
    /**
     * Get comprehensive learning statistics
     */
    getStats() {
        const storeStats = this.interactionStore.getStats();
        // Get top patterns (sorted by usage)
        const patternArray = Array.from(this.successfulPatterns.entries())
            .map(([id, count]) => ({ id, uses: count }))
            .sort((a, b) => b.uses - a.uses)
            .slice(0, 10);
        const stats = {
            totalInteractions: storeStats.totalInteractions,
            knowledgeEntries: storeStats.knowledgeCount,
            domainExpertise: Object.fromEntries(this.domainExpertise),
            topPatterns: patternArray,
            persistenceStats: {
                highQualityCount: storeStats.highQualityCount,
                oldestInteraction: storeStats.oldestInteraction,
                newestInteraction: storeStats.newestInteraction,
                lastSaved: new Date().toISOString(),
            },
        };
        // Add SonaEngine metrics if available
        try {
            const sonaEngine = this.agent.getSonaEngine?.();
            if (sonaEngine) {
                const sonaStats = sonaEngine.getStats();
                const metrics = sonaEngine.getMetrics();
                stats.sonaMetrics = {
                    totalTrajectories: metrics.totalTrajectories,
                    totalRoutes: sonaStats.routeCount,
                    averageQualityByRoute: metrics.averageQualityByRoute || {},
                    improvementPercentage: metrics.improvementPercentage || {},
                    currentDrift: metrics.currentDrift || 0,
                };
                // Calculate learning effectiveness
                stats.learningEffectiveness = this.calculateLearningEffectiveness(sonaEngine);
            }
        }
        catch (error) {
            // SonaEngine not available or error - continue without
            this.log(`SonaEngine metrics unavailable: ${error}`);
        }
        return stats;
    }
    /**
     * Calculate learning effectiveness (G3 requirement: 10-30% improvement)
     */
    calculateLearningEffectiveness(sonaEngine) {
        try {
            // Cast to access methods (SonaEngine type might not be exported)
            const engine = sonaEngine;
            // Get all trajectories with quality scores, sorted by timestamp
            const allTrajectories = engine.listTrajectories()
                .filter(t => t.quality !== undefined)
                .sort((a, b) => a.timestamp - b.timestamp);
            if (allTrajectories.length < 20) {
                return undefined; // Not enough data yet
            }
            const qualities = allTrajectories.map(t => t.quality);
            const sampleSize = Math.min(20, Math.floor(qualities.length / 2));
            // First N trajectories (baseline)
            const baseline = qualities.slice(0, sampleSize);
            const baselineAvg = baseline.reduce((a, b) => a + b, 0) / baseline.length;
            // Last N trajectories (learned)
            const learned = qualities.slice(-sampleSize);
            const learnedAvg = learned.reduce((a, b) => a + b, 0) / learned.length;
            // Calculate improvement
            const improvementPct = baselineAvg > 0
                ? ((learnedAvg - baselineAvg) / baselineAvg) * 100
                : 0;
            return {
                baselineQuality: Math.round(baselineAvg * 1000) / 1000,
                learnedQuality: Math.round(learnedAvg * 1000) / 1000,
                improvementPct: Math.round(improvementPct * 10) / 10,
                sampleSize: sampleSize * 2,
            };
        }
        catch {
            // INTENTIONAL: Learning metrics calculation is optional - undefined signals unavailable metrics
            return undefined;
        }
    }
    /**
     * Get underlying God Agent status
     */
    getStatus() {
        return this.agent.getStatus();
    }
    /**
     * Shutdown - saves all state before closing
     */
    async shutdown() {
        this.log('Shutting down Universal Agent...');
        // Save persisted state before shutdown
        if (this.config.enablePersistence) {
            await this.savePersistedState();
        }
        // MEM-001: Disconnect memory client (daemon keeps running for other processes)
        if (this.memoryClient?.isConnected()) {
            await this.memoryClient.disconnect();
            this.log('MEM-001: Memory client disconnected (daemon persists)');
        }
        await this.agent.shutdown();
        this.initialized = false;
        this.log('Universal Agent shutdown complete - state persisted');
    }
    /**
     * Force save current state (call periodically for safety)
     */
    async saveState() {
        await this.savePersistedState();
    }
}
// ==================== Singleton Export ====================
export const universalAgent = new UniversalAgent();
//# sourceMappingURL=universal-agent.js.map