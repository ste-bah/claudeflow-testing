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
import { type IPipelineExecutionConfig, type IPipelineExecutionResult } from '../core/pipeline/types.js';
import { CodingPipelineOrchestrator, type IStepExecutor } from '../core/pipeline/coding-pipeline-orchestrator.js';
import { type KnowledgeChunk } from './knowledge-chunker.js';
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
 * TASK-GODCODE-001: Code task preparation result for two-phase execution
 *
 * Implements [REQ-GODCODE-001]: CLI does NOT attempt task execution
 * Implements [REQ-GODCODE-002]: CLI returns builtPrompt in JSON
 * Implements [REQ-GODCODE-003]: CLI returns agentType for Task()
 *
 * Phase 1: CLI calls prepareCodeTask() -> returns this interface
 * Phase 2: Skill executes Task() with builtPrompt and agentType
 */
export interface ICodeTaskPreparation {
    /** Agent key from registry (DAI-001) */
    selectedAgent: string;
    /** Agent type for Task() subagent_type parameter */
    agentType: string;
    /** Agent category (e.g., "development", "analysis") */
    agentCategory: string;
    /** Full prompt with DESC injection for Task() execution */
    builtPrompt: string;
    /** Original user input task */
    userTask: string;
    /** Injected DESC episodes context (RULE-010) */
    descContext: string | null;
    /** Retrieved memory context from InteractionStore */
    memoryContext: string | null;
    /** Trajectory ID for learning feedback (FR-11) */
    trajectoryId: string | null;
    /** Whether this is a multi-agent pipeline task */
    isPipeline: boolean;
    /**
     * Pipeline definition if isPipeline is true
     * TASK-PREP-003: Extended with full DAG configuration
     */
    pipeline?: {
        /** Phase names for backward compatibility */
        steps: string[];
        /** Agent keys for backward compatibility */
        agents: string[];
        /**
         * Full pipeline configuration with DAG, phases, and agent mappings
         * Implements [REQ-PREP-003]: Dynamic 40-agent DAG generation
         */
        config?: IPipelineExecutionConfig;
    };
    /** Detected or specified programming language */
    language?: string;
    /**
     * TASK-PREP-003: Whether pipeline was triggered by hook context
     * Implements [REQ-PREP-002]: Hook context detection at coding/context/task
     */
    triggeredByHook?: boolean;
}
/**
 * TASK-GODWRITE-001: Write task preparation result for two-phase execution
 *
 * Implements [REQ-GODWRITE-001]: CLI does NOT attempt task execution
 * Implements [REQ-GODWRITE-002]: CLI returns builtPrompt in JSON
 * Implements [REQ-GODWRITE-003]: CLI returns agentType for Task()
 *
 * Phase 1: CLI calls prepareWriteTask() -> returns this interface
 * Phase 2: Skill executes Task() with builtPrompt and agentType
 */
export interface IWriteTaskPreparation {
    /** Agent key from registry (DAI-001) */
    selectedAgent: string;
    /** Agent type for Task() subagent_type parameter */
    agentType: string;
    /** Agent category (e.g., "documentation", "writing") */
    agentCategory: string;
    /** Full prompt with DESC injection for Task() execution */
    builtPrompt: string;
    /** Original user input topic */
    userTask: string;
    /** Injected DESC episodes context (RULE-010) */
    descContext: string | null;
    /** Retrieved memory context from InteractionStore */
    memoryContext: string | null;
    /** Trajectory ID for learning feedback (FR-11) */
    trajectoryId: string | null;
    /** Whether this is a multi-agent pipeline task */
    isPipeline: boolean;
    /** Pipeline definition if isPipeline is true */
    pipeline?: {
        steps: string[];
        agents: string[];
    };
    /** Writing style (academic, professional, casual, technical) */
    style: 'academic' | 'professional' | 'casual' | 'technical';
    /** Document format (essay, report, article, paper) */
    format: 'essay' | 'report' | 'article' | 'paper';
    /** Content length (short, medium, long, comprehensive) */
    length: 'short' | 'medium' | 'long' | 'comprehensive';
    /** Style profile ID if using learned style (optional) */
    styleProfileId?: string;
    /** Whether a style profile was applied */
    styleProfileApplied: boolean;
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
    private leannContextService?;
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
    private knowledgeChunker;
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
     * TASK-GODCODE-001: Prepare code task for two-phase execution
     *
     * Implements [REQ-GODCODE-001]: CLI does NOT attempt task execution
     * Implements [REQ-GODCODE-002]: CLI returns builtPrompt in JSON
     * Implements [REQ-GODCODE-003]: CLI returns agentType for Task()
     * Implements [REQ-GODCODE-004]: Agent selection via AgentSelector (DAI-001)
     * Implements [REQ-GODCODE-005]: DESC episode injection (RULE-010)
     *
     * This method performs Phase 1 preparation:
     * 1. Injects DESC episodes for prior solutions (RULE-010: window size 3)
     * 2. Selects optimal agent via AgentSelector (DAI-001)
     * 3. Builds full prompt via TaskExecutor.buildPrompt()
     * 4. Creates trajectory for learning feedback (FR-11)
     * 5. Returns ICodeTaskPreparation (NO execution)
     *
     * Phase 2 execution happens in the /god-code skill via Task() tool.
     *
     * CONSTITUTION COMPLIANCE:
     * - RULE-001: All code references REQ-GODCODE-*
     * - RULE-003: Comments reference requirements
     * - RULE-010: DESC window size 3
     * - RULE-019: Real implementation, no scaffolding
     * - RULE-069: Proper try/catch for async operations
     *
     * @param task - The code task to prepare
     * @param options - Optional configuration (language, context)
     * @returns ICodeTaskPreparation with builtPrompt for Task() execution
     */
    prepareCodeTask(task: string, options?: {
        language?: string;
        context?: string;
        /** TASK-PREP-003: Start phase for partial execution (0-6) */
        startPhase?: number;
        /** TASK-PREP-003: End phase for partial execution (0-6) */
        endPhase?: number;
    }): Promise<ICodeTaskPreparation>;
    /**
     * Execute the coding pipeline via CodingPipelineOrchestrator.
     *
     * Wires all dependencies (agentRegistry, sonaEngine, reasoningBank, etc.)
     * and delegates to the orchestrator for 7-phase execution with:
     * - Trajectory persistence (PRD Section 5.1)
     * - Sherlock forensic reviews (PRD Section 2.3)
     * - Embedding-backed pattern matching (PRD Section 8.1)
     *
     * @param pipelineConfig - Configuration from prepareCodeTask()
     * @param stepExecutor - Optional step executor for agent execution
     * @returns Pipeline execution result with XP, phases, and success status
     */
    executePipeline(pipelineConfig: IPipelineExecutionConfig, stepExecutor?: IStepExecutor): Promise<IPipelineExecutionResult>;
    /**
     * TASK-GODWRITE-001: Prepare write task for two-phase execution
     *
     * Implements [REQ-GODWRITE-001]: CLI does NOT attempt task execution
     * Implements [REQ-GODWRITE-002]: CLI returns builtPrompt in JSON
     * Implements [REQ-GODWRITE-003]: CLI returns agentType for Task()
     * Implements [REQ-GODWRITE-004]: Agent selection via AgentSelector (DAI-001)
     * Implements [REQ-GODWRITE-005]: DESC episode injection (RULE-010)
     *
     * This method performs Phase 1 preparation:
     * 1. Injects DESC episodes for prior solutions (RULE-010: window size 3)
     * 2. Selects optimal agent via AgentSelector (DAI-001)
     * 3. Builds full prompt via TaskExecutor.buildPrompt()
     * 4. Creates trajectory for learning feedback (FR-11)
     * 5. Applies style profile if available (REQ-GODWRITE-009)
     * 6. Returns IWriteTaskPreparation (NO execution)
     *
     * Phase 2 execution happens in the /god-write skill via Task() tool.
     *
     * CONSTITUTION COMPLIANCE:
     * - RULE-001: All code references REQ-GODWRITE-*
     * - RULE-003: Comments reference requirements
     * - RULE-010: DESC window size 3
     * - RULE-019: Real implementation, no scaffolding
     * - RULE-069: Proper try/catch for async operations
     * - RULE-070: Errors logged with context before re-throwing
     *
     * @param topic - The writing topic
     * @param options - Writing options (style, format, length, styleProfileId)
     * @returns IWriteTaskPreparation with builtPrompt for Task() execution
     */
    prepareWriteTask(topic: string, options?: {
        style?: 'academic' | 'professional' | 'casual' | 'technical';
        format?: 'essay' | 'report' | 'article' | 'paper';
        length?: 'short' | 'medium' | 'long' | 'comprehensive';
        styleProfileId?: string;
    }): Promise<IWriteTaskPreparation>;
    /**
     * Build writing instructions with style, format, and length guidance
     * Used by prepareWriteTask() to construct the prompt
     *
     * @param style - Writing style (academic, professional, casual, technical)
     * @param format - Document format (essay, report, article, paper)
     * @param length - Content length (short, medium, long, comprehensive)
     * @param stylePrompt - Optional style profile prompt
     * @returns Formatted writing instructions string
     */
    private buildWritingInstructions;
    /**
     * Check if a writing task requires multi-agent pipeline execution
     * Used for complex documents like dissertations, multi-chapter works
     *
     * @param topic - The writing topic
     * @param format - The document format
     * @returns true if task benefits from pipeline execution
     */
    private isPipelineWritingTask;
    /**
     * Check if a task requires multi-agent pipeline execution
     * Uses sophisticated CommandTaskBridge complexity analysis with scoring system:
     * - Phase keywords: +0.15 each (implement, test, design, etc.)
     * - Document keywords: +0.2 each (api, database, authentication, etc.)
     * - Multi-step patterns: +0.25 (create...and...test, build...with...validation)
     * - Connector words: +0.1 each (and, with, including, then)
     * - Action verbs (>=2): +(verbCount-1) * 0.1
     * - Word count >15: +0.1
     *
     * TASK-PIPELINE-FIX: Replaces weak regex patterns that missed complex tasks
     * like "REST API with Auth" and "snake game with scoreboard"
     *
     * @param task - The task description
     * @returns true if complexity score >= DEFAULT_PIPELINE_THRESHOLD (0.6)
     */
    private isPipelineTask;
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
     * Store knowledge for future use with automatic chunking
     * Implements: REQ-CHUNK-001 (chunking), REQ-CHUNK-006 (token limit validation)
     * CONSTITUTION: RULE-064 (symmetric chunking), RULE-046 (atomic writes)
     */
    storeKnowledge(entry: Omit<KnowledgeEntry, 'id' | 'quality' | 'usageCount' | 'lastUsed' | 'createdAt'>): Promise<string>;
    /**
     * Retrieve relevant knowledge
     */
    private retrieveRelevant;
    /**
     * Check if a knowledge entry is chunked
     * Implements: TASK-CHUNK-010 (backward compatibility)
     * CONSTITUTION: RULE-064 (symmetric chunking)
     *
     * Detects chunked entries by checking:
     * 1. is_chunked flag (primary indicator)
     * 2. chunk_count > 1 (fallback indicator)
     * 3. totalChunks metadata field (legacy entries)
     *
     * @param entry - The entry content object from vector store
     * @returns True if entry is chunked, false for legacy single-content entries
     */
    isChunkedEntry(entry: Record<string, unknown>): boolean;
    /**
     * Retrieve knowledge by ID with backward compatibility for chunked/non-chunked entries
     * Implements: TASK-CHUNK-010 (backward compatible retrieval)
     * CONSTITUTION: RULE-064 (symmetric chunking), REQ-CHUNK-010
     *
     * Logic:
     * - For non-chunked entries: return content directly (legacy behavior)
     * - For chunked entries: reconstruct from chunks using KnowledgeChunker.reconstructContent()
     *
     * @param id - The knowledge entry ID (parentId for chunked entries)
     * @returns Full knowledge entry with reconstructed content, or null if not found
     */
    retrieveKnowledge(id: string): Promise<KnowledgeEntry | null>;
    /**
     * Reconstruct full content from chunked knowledge entries
     * Implements: REQ-CHUNK-010 (backward compatible retrieval)
     *
     * @param parentId - The parent knowledge entry ID
     * @param chunks - Array of chunk entries from vector store
     * @returns Reconstructed KnowledgeEntry with full content
     */
    private reconstructChunkedKnowledge;
    /**
     * Convert raw content object to KnowledgeEntry
     * Helper for backward compatibility with legacy non-chunked entries
     *
     * @param content - Raw content object from vector store
     * @returns KnowledgeEntry
     */
    private contentToKnowledgeEntry;
    /**
     * Get all chunks for a knowledge entry by parentId
     * Implements: TASK-CHUNK-004 (chunk retrieval)
     * CONSTITUTION: RULE-064 (symmetric chunking), REQ-CHUNK-010 (backward compatibility)
     *
     * @param knowledgeId - The parent knowledge entry ID
     * @returns Array of KnowledgeChunk objects sorted by chunkIndex, empty array if not found
     */
    getKnowledgeChunks(knowledgeId: string): Promise<KnowledgeChunk[]>;
    /**
     * Reconstruct full content from knowledge chunks
     * Implements: TASK-CHUNK-004 (content reconstruction)
     * CONSTITUTION: RULE-064 (symmetric chunking), REQ-CHUNK-010 (backward compatibility)
     *
     * @param knowledgeId - The parent knowledge entry ID
     * @returns Reconstructed full content string, or empty string if not found
     * @throws Error if chunks are incomplete or cannot be reconstructed
     */
    reconstructKnowledge(knowledgeId: string): Promise<string>;
    /**
     * Query knowledge base with automatic chunk handling
     * Implements: TASK-CHUNK-004 (chunked query results)
     * CONSTITUTION: RULE-064 (symmetric chunking), REQ-CHUNK-010 (backward compatibility)
     *
     * Returns deduplicated results where chunked entries are consolidated by parentId.
     * Each result includes the reconstructed content for chunked entries.
     *
     * @param query - Search query text
     * @param options - Query options (k, minSimilarity, domain filter)
     * @returns Array of KnowledgeEntry objects with reconstructed content
     */
    queryKnowledge(query: string, options?: {
        k?: number;
        minSimilarity?: number;
        domain?: string;
    }): Promise<KnowledgeEntry[]>;
    /**
     * Find missing chunk indices for error reporting
     * Helper for TASK-CHUNK-004
     */
    private findMissingChunkIndices;
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
     * Get coding pipeline orchestrator with all dependencies wired
     * Used by coding-pipeline-cli.ts for stateful session management
     *
     * @returns Configured CodingPipelineOrchestrator instance
     */
    getCodingOrchestrator(): Promise<CodingPipelineOrchestrator>;
    /**
     * Force save current state (call periodically for safety)
     */
    saveState(): Promise<void>;
}
export declare const universalAgent: UniversalAgent;
//# sourceMappingURL=universal-agent.d.ts.map