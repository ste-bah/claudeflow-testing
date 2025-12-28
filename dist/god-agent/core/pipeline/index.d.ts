/**
 * God Agent Pipeline Module
 *
 * TASK-PHD-001 - 48-Agent PhD Pipeline
 * - 48 agents across 7 phases
 * - DAG-based dependency management
 * - Critical agent validation
 * - Integration with Relay Race and Shadow Vector
 *
 * DAI-002 - Multi-Agent Sequential Pipeline Orchestration
 * - Sequential execution (RULE-004: no Promise.all)
 * - Memory coordination via InteractionStore (RULE-005)
 * - DAI-001 AgentSelector integration (RULE-006)
 * - Forward-looking prompts (RULE-007)
 */
export { PhDPipelineOrchestrator, type IAgentExecutor, type IShadowTracker, } from './phd-pipeline-orchestrator.js';
/**
 * Configuration interface for god-agent.ts integration
 */
export interface PhdPipelineConfig {
    relayRace?: unknown;
    attentionFactory?: unknown;
    memoryEngine?: unknown;
    verbose?: boolean;
    [key: string]: unknown;
}
/**
 * Wrapper class for god-agent.ts compatibility
 * Accepts simplified config and creates proper orchestrator
 */
export declare class PhdPipelineOrchestrator {
    private config;
    private initialized;
    constructor(config: PhdPipelineConfig);
    /**
     * Initialize the pipeline (if needed)
     */
    initialize(): Promise<{
        success: boolean;
    }>;
    /**
     * Check if pipeline is initialized
     */
    isInitialized(): boolean;
    /**
     * Get the underlying config
     */
    getConfig(): PhdPipelineConfig;
    /**
     * Get a standardized pipeline config for the full orchestrator
     */
    static getPipelineConfig(): import("./pipeline-types.js").IPipelineConfig;
}
export { PHD_PIPELINE_CONFIG, getPhDPipelineConfig, getAgentById, getAgentByKey, getAgentsByPhase, getCriticalAgents, } from './phd-pipeline-config.js';
export { DEFAULT_AGENT_TIMEOUT, CRITICAL_AGENT_KEYS, PHASE_NAMES, PipelineConfigError, PipelineExecutionError, CriticalAgentError, createPipelineState, generatePipelineId, isCriticalAgent, } from './pipeline-types.js';
export type { AgentId, AgentKey, PhaseId, IAgentConfig, IPhaseConfig, IPipelineMetadata, IPipelineConfig, AgentStatus, IAgentExecutionRecord, IPipelineState, IPipelineProgress, } from './pipeline-types.js';
export { PipelineBridge, type IPipelineBridgeConfig, type ITopologicalSortResult, type IMappedAgentDefinition, } from './pipeline-bridge.js';
export { PhDPipelineBridge, createPhDPipelineBridge, PHASE_QUALITY_REQUIREMENTS, CITATION_REQUIREMENTS, WRITING_PHASE_ID, QA_PHASE_ID, } from './phd-pipeline-bridge.js';
export { QualityGateValidator, createPhDQualityGateValidator, DEFAULT_QUALITY_RULES, type IQualityCheck, type IQualityValidationResult, type IQualityRule, } from './quality-gate-validator.js';
export { PhDPipelineRunner, createPhDPipelineRunner, type IPhDPipelineRunnerOptions, type IRunnerStats, type IRunResult, type IMemoryEngine, } from './phd-pipeline-runner.js';
export { PipelineError, PipelineDefinitionError, PipelineExecutionError as DAI002ExecutionError, // Alias to avoid conflict
MemoryCoordinationError, QualityGateError, PipelineTimeoutError, AgentSelectionError, isPipelineError, isPipelineDefinitionError, isPipelineExecutionError, isMemoryCoordinationError, isQualityGateError, isPipelineTimeoutError, isAgentSelectionError, createMissingFieldError, createInvalidAgentError, wrapAsPipelineExecutionError, } from './pipeline-errors.js';
export type { IPipelineDefinition, IPipelineStep, IPipelineStepStorage, IPipelineEvent, PipelineEventType, IStepResult as DAI002StepResult, IPipelineResult as DAI002PipelineResult, IPipelineOptions as DAI002PipelineOptions, } from './dai-002-types.js';
export { PipelineEventType as DAI002EventType, DEFAULT_STEP_TIMEOUT, DEFAULT_PIPELINE_TIMEOUT, DEFAULT_MIN_QUALITY, generatePipelineTrajectoryId, calculateOverallQuality, } from './dai-002-types.js';
export { PipelineValidator, createPipelineValidator, type IValidationResult, } from './pipeline-validator.js';
export { PipelinePromptBuilder, createPipelinePromptBuilder, type IPromptContext, type IBuiltPrompt, } from './pipeline-prompt-builder.js';
export { PipelineMemoryCoordinator, createPipelineMemoryCoordinator, type IMemoryCoordinatorConfig, type IStoreResult, type IRetrieveResult, } from './pipeline-memory-coordinator.js';
export { PipelineExecutor, createPipelineExecutor, type IPipelineExecutorConfig, type IStepExecutor, type IStepExecutionResult, } from './pipeline-executor.js';
export { CommandTaskBridge, createCommandTaskBridge, type IComplexityAnalysis, type IPipelineDecision, type IAgentMapping, type ICommandTaskBridgeConfig, type TaskType, DEFAULT_PIPELINE_THRESHOLD, PHASE_KEYWORDS, DOCUMENT_KEYWORDS, MULTI_STEP_PATTERNS, CONNECTOR_WORDS, DEFAULT_PHASE_MAPPINGS, DOCUMENT_AGENT_MAPPING, } from './command-task-bridge.js';
//# sourceMappingURL=index.d.ts.map