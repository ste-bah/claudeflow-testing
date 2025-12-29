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
import { type FeedbackResult } from './trajectory-bridge.js';
import { StyleProfileManager, type StoredStyleProfile, type StyleProfileMetadata } from './style-profile.js';
import type { StyleCharacteristics } from './style-analyzer.js';
import { AgentRegistry, AgentSelector, TaskExecutor, type IAgentSelectionResult } from '../core/agents/index.js';
import { PipelineExecutor, type IPipelineDefinition, type DAI002PipelineResult, type DAI002PipelineOptions } from '../core/pipeline/index.js';
import { type IRoutingResult, type IGeneratedPipeline } from '../core/routing/index.js';
import { MemoryClient } from '../core/memory-server/index.js';
export type AgentMode = 'code' | 'research' | 'write' | 'general';
export interface UniversalConfig {
    /** Enable automatic learning from all interactions */
    autoLearn?: boolean;
    /** Minimum quality threshold for auto-storing patterns (default: 0.5 per RULE-035) */
    autoStoreThreshold?: number;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Default mode */
    defaultMode?: AgentMode;
    /** Learning rate for weight updates */
    learningRate?: number;
    /** Enable web search for research mode */
    enableWebSearch?: boolean;
    /** Enable persistent storage (default: true) */
    enablePersistence?: boolean;
    /** Storage directory (default: .agentdb/universal) */
    storageDir?: string;
    /** Enable DESC episode injection for prior solutions (default: true) */
    enableDESC?: boolean;
    /** DESC similarity threshold for episode matching (default: 0.80) */
    descThreshold?: number;
    /** DESC maximum episodes to inject (default: 3 per RULE-010) */
    descMaxEpisodes?: number;
    /** Enable Core Daemon for EpisodeStore/GraphDB IPC (default: true) */
    enableCoreDaemon?: boolean;
}
export interface Interaction {
    id: string;
    /** Trajectory ID for feedback tracking (links to SonaEngine) */
    trajectoryId?: string;
    mode: AgentMode;
    input: string;
    output: string;
    embedding?: Float32Array;
    timestamp: number;
    /** Patterns used from ReasoningBank during this interaction */
    patternsUsed?: string[];
    feedback?: {
        rating: number;
        useful: boolean;
        notes?: string;
    };
    metadata?: Record<string, unknown>;
}
export interface KnowledgeEntry {
    id: string;
    content: string;
    type: 'pattern' | 'fact' | 'procedure' | 'example' | 'insight';
    domain: string;
    tags: string[];
    quality: number;
    usageCount: number;
    lastUsed: number;
    createdAt: number;
    /** Optional source URL for web-sourced knowledge */
    source?: string;
}
export interface ResearchResult {
    query: string;
    findings: Array<{
        content: string;
        source: string;
        relevance: number;
        confidence: number;
    }>;
    synthesis: string;
    knowledgeStored: number;
    /** Trajectory ID for feedback (FR-11) */
    trajectoryId?: string;
}
export interface CodeResult {
    task: string;
    code: string;
    language: string;
    patterns_used: string[];
    explanation: string;
    learned: boolean;
    /** Trajectory ID for feedback (FR-11) */
    trajectoryId?: string;
}
export interface WriteResult {
    topic: string;
    content: string;
    style: string;
    sources: string[];
    wordCount: number;
    /** Trajectory ID for feedback (FR-11) */
    trajectoryId?: string;
}
/**
 * Options for ask() method
 */
export interface AskOptions {
    mode?: AgentMode;
    context?: string;
    learnFrom?: boolean;
    /** Return full result object instead of just output string */
    returnResult?: boolean;
    /**
     * TASK-LEARN-006: Execute Task() and capture result for quality assessment
     * When true, runs Task() execution and assesses quality on the RESULT (RULE-033)
     * When false, returns the prompt for manual execution (legacy behavior)
     * Default: false (backward compatible - TASK-LEARN-007 will enable by default)
     */
    executeTask?: boolean;
    /**
     * TASK-LEARN-006: Custom Task execution function
     * If provided, used to execute the Task() call
     * If not provided, a stub implementation returns the prompt (for TASK-LEARN-007)
     */
    taskExecutionFn?: (agentType: string, prompt: string, options?: {
        timeout?: number;
    }) => Promise<string>;
}
/**
 * Extended result from ask() when returnResult is true
 */
export interface AskResult {
    /** The generated output */
    output: string;
    /** Trajectory ID for feedback submission */
    trajectoryId?: string;
    /** Pattern IDs used from knowledge base */
    patternsUsed: string[];
    /** Auto-estimated quality score */
    qualityScore: number;
    /** Whether auto-feedback was submitted */
    autoFeedbackSubmitted: boolean;
    /** DAI-001: Selected agent key */
    selectedAgent?: string;
    /** DAI-001: Selected agent category */
    selectedAgentCategory?: string;
    /** DAI-001: Task type detected */
    taskType?: string;
    /** DAI-001: Built prompt for Task() execution */
    agentPrompt?: string;
    /** Interaction ID for reference */
    interactionId: string;
    /** DESC: Number of prior solution episodes injected (RULE-010) */
    descEpisodesInjected?: number;
    /**
     * TASK-LEARN-006: Whether Task() was executed and result captured (RULE-033)
     * true = quality assessed on Task() result
     * false = quality assessed on prompt (legacy, unreliable)
     */
    taskExecuted?: boolean;
    /**
     * TASK-LEARN-006: Content type that was assessed (RULE-036 compliance)
     * 'result' = Task() execution result (reliable)
     * 'prompt' = Agent prompt (unreliable, legacy)
     */
    assessedContentType?: 'result' | 'prompt';
}
/**
 * TASK-LEARN-007: Task execution result from default executor
 * Captures execution metadata for quality assessment and learning
 *
 * Per RULE-024: Quality on RESULT (supports Task execution to get result)
 */
export interface TaskExecutionResult {
    /** The task execution output */
    result: string;
    /** Whether execution succeeded */
    success: boolean;
    /** Task type detected from agent selection */
    taskType: string;
    /** Agent key that executed the task */
    agentId: string;
    /** Execution duration in milliseconds */
    durationMs: number;
    /** Error message if execution failed */
    error?: string;
}
/**
 * Unified learning statistics combining all subsystems
 */
export interface UnifiedLearningStats {
    totalInteractions: number;
    knowledgeEntries: number;
    domainExpertise: Record<string, number>;
    topPatterns: Array<{
        id: string;
        uses: number;
    }>;
    sonaMetrics?: {
        totalTrajectories: number;
        totalRoutes: number;
        averageQualityByRoute: Record<string, number>;
        improvementPercentage: Record<string, number>;
        currentDrift: number;
    };
    learningEffectiveness?: {
        baselineQuality: number;
        learnedQuality: number;
        improvementPct: number;
        sampleSize: number;
    };
    persistenceStats?: {
        highQualityCount: number;
        oldestInteraction: number | null;
        newestInteraction: number | null;
        lastSaved: string;
    };
}
/**
 * Options for task() method (DAI-003)
 */
export interface ITaskOptions {
    /** Explicit agent override (bypass routing) */
    agent?: string;
    /** Skip confirmation flow even for low confidence */
    skipConfirmation?: boolean;
}
/**
 * Result from task() method (DAI-003)
 */
export interface ITaskResult {
    /** Task execution result */
    result: string;
    /** Routing decision metadata */
    routing: IRoutingResult;
    /** Generated pipeline if multi-step task */
    pipeline?: IGeneratedPipeline;
    /** Execution time in milliseconds */
    executionTimeMs: number;
    /** Agent that was used */
    agentUsed: string;
}
export declare class UniversalAgent {
    private agent;
    private config;
    private interactionStore;
    private initialized;
    private successfulPatterns;
    private domainExpertise;
    private trajectoryBridge?;
    private styleProfileManager?;
    private codeExecutor;
    private embeddingProvider;
    private writingGenerator;
    private webSearchProvider;
    private agentRegistry;
    private agentSelector;
    private taskExecutor;
    private pipelineExecutor;
    private taskAnalyzer;
    private capabilityIndex;
    private routingEngine;
    private pipelineGenerator;
    private routingLearner;
    private confirmationHandler;
    private failureClassifier;
    private memoryClient;
    private ucmClient;
    private coreDaemonClient;
    constructor(config?: UniversalConfig);
    initialize(): Promise<void>;
    /**
     * Ensure storage directory exists
     */
    private ensureStorageDir;
    /**
     * Load persisted state from disk
     */
    private loadPersistedState;
    /**
     * Save state to disk
     */
    private savePersistedState;
    /**
     * Create writing generator with Anthropic API (SPEC-WRT-001)
     * Returns null if ANTHROPIC_API_KEY not set (graceful degradation)
     */
    private createWritingGenerator;
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
    selectAgentForTask(task: string): Promise<{
        selection: IAgentSelectionResult;
        prompt: string;
        context?: string;
    }>;
    /**
     * Get AgentRegistry for external access (DAI-001)
     */
    getAgentRegistry(): AgentRegistry;
    /**
     * Get AgentSelector for external access (DAI-001)
     */
    getAgentSelector(): AgentSelector;
    /**
     * Get TaskExecutor for external access (DAI-001)
     */
    getTaskExecutor(): TaskExecutor;
    /**
     * Get PipelineExecutor for external access (DAI-002)
     */
    getPipelineExecutor(): PipelineExecutor;
    /**
     * Get MemoryClient for multi-process memory access (MEM-001)
     */
    getMemoryClient(): MemoryClient;
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
    private executeTaskDefault;
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
    runPipeline(pipeline: IPipelineDefinition, options?: DAI002PipelineOptions): Promise<DAI002PipelineResult>;
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
    task(description: string, options?: ITaskOptions): Promise<ITaskResult>;
    /**
     * Universal ask - routes to appropriate mode and learns
     *
     * Overloaded signatures:
     * - ask(input): Promise<string> - Simple output (backward compatible)
     * - ask(input, { returnResult: true }): Promise<AskResult> - Full result with trajectoryId
     */
    ask(input: string, options?: AskOptions & {
        returnResult?: false;
    }): Promise<string>;
    ask(input: string, options: AskOptions & {
        returnResult: true;
    }): Promise<AskResult>;
    /**
     * Code mode - write code with pattern learning
     */
    code(task: string, options?: {
        language?: string;
        context?: string;
        examples?: string[];
    }): Promise<CodeResult>;
    /**
     * Research mode - gather and synthesize knowledge
     * Automatically searches the web if knowledge base is insufficient
     */
    research(query: string, options?: {
        depth?: 'quick' | 'standard' | 'deep';
        sources?: string[];
        enableWebSearch?: boolean;
        /** Use a specific learned style profile for synthesis */
        styleProfileId?: string;
        /** Use the currently active style profile (default: true if one is set) */
        useActiveStyleProfile?: boolean;
    }): Promise<ResearchResult>;
    /**
     * Perform web search using available search tools
     * SPEC-WEB-001: Hybrid search provider (WebSearch + Perplexity MCP)
     */
    private performWebSearch;
    /**
     * Write mode - generate documents with style learning
     *
     * @param topic - The topic to write about
     * @param options - Writing options including style profile
     * @param options.styleProfileId - ID of a learned style profile to use
     * @param options.useActiveStyleProfile - Use the currently active style profile
     */
    write(topic: string, options?: {
        style?: 'academic' | 'professional' | 'casual' | 'technical';
        length?: 'short' | 'medium' | 'long' | 'comprehensive';
        format?: 'essay' | 'report' | 'article' | 'paper';
        /** Use a specific learned style profile by ID */
        styleProfileId?: string;
        /** Use the currently active style profile (default: true if one is set) */
        useActiveStyleProfile?: boolean;
    }): Promise<WriteResult>;
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
    writePaper(topic: string, options?: {
        /** Research depth */
        depth?: 'quick' | 'standard' | 'deep';
        /** Paper format */
        format?: 'essay' | 'report' | 'article' | 'paper';
        /** Paper length */
        length?: 'short' | 'medium' | 'long' | 'comprehensive';
        /** Specific style profile ID to use */
        styleProfileId?: string;
        /** Enable web search for research */
        enableWebSearch?: boolean;
    }): Promise<{
        topic: string;
        research: ResearchResult;
        paper: WriteResult;
        styleApplied: boolean;
    }>;
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
    feedback(id: string, rating: number, options?: {
        useful?: boolean;
        notes?: string;
        /** Set true if id is a trajectoryId instead of interactionId */
        isTrajectoryId?: boolean;
    }): Promise<FeedbackResult>;
    /**
     * Learn from successful interaction
     */
    private learnFromInteraction;
    /**
     * Reinforce a successful pattern
     */
    private reinforcePattern;
    /**
     * Weaken an unsuccessful pattern
     */
    private weakenPattern;
    /**
     * Store knowledge for future use
     */
    storeKnowledge(entry: Omit<KnowledgeEntry, 'id' | 'quality' | 'usageCount' | 'lastUsed' | 'createdAt'>): Promise<string>;
    /**
     * Retrieve relevant knowledge
     */
    private retrieveRelevant;
    /**
     * Maybe store a pattern if it's high quality
     */
    private maybeStorePattern;
    private updateUsageStats;
    /**
     * Inject prior solutions from DESC episodic memory (RULE-010)
     * Uses default window size of 3 episodes for general agent work
     *
     * @param prompt - The original prompt to augment
     * @param context - Additional context for logging/metadata
     * @returns Augmented prompt with prior solutions or original on error
     */
    private injectDESCEpisodes;
    /**
     * Store a completed episode for future DESC retrieval
     *
     * @param queryText - The original query/prompt
     * @param answerText - The generated response/result
     * @param context - Additional context for metadata
     */
    private storeDESCEpisode;
    private _detectMode;
    private _generateCode;
    /**
     * Build context from ReasoningBank patterns
     */
    private buildPatternContext;
    /**
     * Extract code from markdown code blocks in response
     */
    private extractCodeFromResponse;
    /**
     * Generate fallback code when CLI is not available
     * Uses ClaudeCodeExecutor for production-ready code with InteractionStore for learning
     * RULE-CLI-001-002: No fallbacks - let errors propagate
     */
    private generateFallbackCode;
    /**
     * Get relevant context from InteractionStore for code generation
     */
    private getRelevantContext;
    private _generateWriting;
    /**
     * Gather context from InteractionStore for writing generation (SPEC-WRT-001)
     */
    private gatherWritingContext;
    /**
     * Estimate word count from length string
     */
    private estimateWordCount;
    private _synthesize;
    private _processCode;
    private _processResearch;
    private _processWrite;
    private _processGeneral;
    private assessQuality;
    private extractTags;
    private embed;
    private generateId;
    private log;
    private ensureInitialized;
    /**
     * Learn a writing style from text samples
     *
     * @param name - Name for the style profile
     * @param textSamples - Array of text samples to learn from
     * @param options - Additional options
     * @returns The created style profile
     */
    learnStyle(name: string, textSamples: string[], options?: {
        description?: string;
        tags?: string[];
        setAsActive?: boolean;
    }): Promise<StoredStyleProfile | null>;
    /**
     * List all available style profiles
     */
    listStyleProfiles(): StyleProfileMetadata[];
    /**
     * Set the active style profile
     */
    setActiveStyleProfile(profileId: string | null): Promise<boolean>;
    /**
     * Get the active style profile
     */
    getActiveStyleProfile(): StoredStyleProfile | undefined;
    /**
     * Get style characteristics for a profile
     */
    getStyleCharacteristics(profileId?: string): StyleCharacteristics | null;
    /**
     * Get style profile statistics
     */
    getStyleStats(): {
        totalProfiles: number;
        activeProfile: string | null;
        totalSourceDocuments: number;
    };
    /**
     * Get the StyleProfileManager instance for direct access
     */
    getStyleProfileManager(): StyleProfileManager | undefined;
    /**
     * Get comprehensive learning statistics
     */
    getStats(): UnifiedLearningStats;
    /**
     * Calculate learning effectiveness (G3 requirement: 10-30% improvement)
     */
    private calculateLearningEffectiveness;
    /**
     * Get underlying God Agent status
     */
    getStatus(): import("../core/god-agent.js").GodAgentStatus;
    /**
     * Shutdown - saves all state before closing
     */
    shutdown(): Promise<void>;
    /**
     * Force save current state (call periodically for safety)
     */
    saveState(): Promise<void>;
}
export declare const universalAgent: UniversalAgent;
//# sourceMappingURL=universal-agent.d.ts.map