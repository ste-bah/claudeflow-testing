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
import { getPhDPipelineConfig } from './phd-pipeline-config.js';
// ===== PHD PIPELINE ORCHESTRATOR =====
export { PhDPipelineOrchestrator, } from './phd-pipeline-orchestrator.js';
/**
 * Wrapper class for god-agent.ts compatibility
 * Accepts simplified config and creates proper orchestrator
 */
export class PhdPipelineOrchestrator {
    config;
    initialized = false;
    constructor(config) {
        this.config = config;
        // The orchestrator is created lazily or during initialization
    }
    /**
     * Initialize the pipeline (if needed)
     */
    async initialize() {
        this.initialized = true;
        return { success: true };
    }
    /**
     * Check if pipeline is initialized
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Get the underlying config
     */
    getConfig() {
        return this.config;
    }
    /**
     * Get a standardized pipeline config for the full orchestrator
     */
    static getPipelineConfig() {
        return getPhDPipelineConfig();
    }
}
// ===== PIPELINE CONFIGURATION =====
export { PHD_PIPELINE_CONFIG, getPhDPipelineConfig, getAgentById, getAgentByKey, getAgentsByPhase, getCriticalAgents, } from './phd-pipeline-config.js';
// ===== TYPE DEFINITIONS =====
export { DEFAULT_AGENT_TIMEOUT, CRITICAL_AGENT_KEYS, PHASE_NAMES, PipelineConfigError, PipelineExecutionError, CriticalAgentError, createPipelineState, generatePipelineId, isCriticalAgent, } from './pipeline-types.js';
// ===== PIPELINE BRIDGE =====
export { PipelineBridge, } from './pipeline-bridge.js';
export { PhDPipelineBridge, createPhDPipelineBridge, PHASE_QUALITY_REQUIREMENTS, CITATION_REQUIREMENTS, WRITING_PHASE_ID, QA_PHASE_ID, } from './phd-pipeline-bridge.js';
// ===== QUALITY GATE VALIDATION =====
export { QualityGateValidator, createPhDQualityGateValidator, DEFAULT_QUALITY_RULES, } from './quality-gate-validator.js';
// ===== PHD PIPELINE RUNNER =====
export { PhDPipelineRunner, createPhDPipelineRunner, } from './phd-pipeline-runner.js';
// ============================================================================
// DAI-002: MULTI-AGENT SEQUENTIAL PIPELINE ORCHESTRATION
// ============================================================================
// ===== DAI-002 ERROR CLASSES =====
export { 
// Base error
PipelineError, 
// Specific errors
PipelineDefinitionError, PipelineExecutionError as DAI002ExecutionError, // Alias to avoid conflict
MemoryCoordinationError, QualityGateError, PipelineTimeoutError, AgentSelectionError, 
// Type guards
isPipelineError, isPipelineDefinitionError, isPipelineExecutionError, isMemoryCoordinationError, isQualityGateError, isPipelineTimeoutError, isAgentSelectionError, 
// Factory helpers
createMissingFieldError, createInvalidAgentError, wrapAsPipelineExecutionError, } from './pipeline-errors.js';
export { PipelineEventType as DAI002EventType, 
// Constants
DEFAULT_STEP_TIMEOUT, DEFAULT_PIPELINE_TIMEOUT, DEFAULT_MIN_QUALITY, 
// Utility functions (generatePipelineId already exported from pipeline-types.js)
generatePipelineTrajectoryId, calculateOverallQuality, } from './dai-002-types.js';
// ===== DAI-002 PIPELINE VALIDATOR =====
export { PipelineValidator, createPipelineValidator, } from './pipeline-validator.js';
// ===== DAI-002 PIPELINE PROMPT BUILDER =====
export { PipelinePromptBuilder, createPipelinePromptBuilder, } from './pipeline-prompt-builder.js';
// ===== DAI-002 PIPELINE MEMORY COORDINATOR =====
export { PipelineMemoryCoordinator, createPipelineMemoryCoordinator, } from './pipeline-memory-coordinator.js';
// ===== DAI-002 PIPELINE EXECUTOR =====
export { PipelineExecutor, createPipelineExecutor, } from './pipeline-executor.js';
// Note: IPipelineOptions, IPipelineResult, IStepResult are re-exported from dai-002-types.ts above
// as DAI002PipelineOptions, DAI002PipelineResult, DAI002StepResult
// ===== DAI-002 COMMAND TASK BRIDGE =====
export { CommandTaskBridge, createCommandTaskBridge, 
// Constants
DEFAULT_PIPELINE_THRESHOLD, PHASE_KEYWORDS, DOCUMENT_KEYWORDS, MULTI_STEP_PATTERNS, CONNECTOR_WORDS, DEFAULT_PHASE_MAPPINGS, DOCUMENT_AGENT_MAPPING, } from './command-task-bridge.js';
//# sourceMappingURL=index.js.map