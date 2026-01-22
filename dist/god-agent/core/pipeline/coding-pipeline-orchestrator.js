/**
 * Coding Pipeline Orchestrator
 *
 * Executes the 40-agent, 7-phase coding pipeline with:
 * - DAG-based dependency resolution
 * - Checkpoint management for rollback
 * - XP tracking and aggregation
 * - ClaudeFlow subagent integration
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-orchestrator
 * @see TASK-ORCH-004-pipeline-orchestration.md
 * @see SPEC-001-architecture.md
 */
// Pipeline coordination services
import { PipelineValidator } from './pipeline-validator.js';
import { PipelinePromptBuilder } from './pipeline-prompt-builder.js';
import { PipelineMemoryCoordinator } from './pipeline-memory-coordinator.js';
// Extracted modules [REQ-REFACTOR-001 through REQ-REFACTOR-004]
import { providePipelineFeedback as providePipelineFeedbackFn } from './coding-phase-executor.js';
import { storeMemory as storeMemoryFn } from './coding-memory-adapter.js';
import { executePhase as executePhaseFn, rollbackToLastCheckpoint as rollbackToLastCheckpointFn, } from './coding-agent-executor.js';
import { initializePipelineExecution } from './coding-pipeline-init.js';
import { finalizePipelineExecution, buildFinalPipelineState, buildCompletedMetadata, buildXPStorageObject, } from './coding-pipeline-finalize.js';
// Observability
import { ObservabilityBus } from '../observability/bus.js';
import { PHASE_ORDER, } from './types.js';
// Dynamic config loader replaces hardcoded CODING_PIPELINE_MAPPINGS
import { CodingPipelineConfigLoader, } from './coding-pipeline-config-loader.js';
// Backwards compatibility - import buildPipelineDAG for DAG structure
import { buildPipelineDAG } from './command-task-bridge.js';
import { DEFAULT_ORCHESTRATOR_CONFIG } from './coding-pipeline-constants.js';
// Extracted factory functions [REQ-REFACTOR-005]
import { createPipelineIntegratedValidator, validatePhaseWithSherlockAndStore, handleSherlockGuiltyVerdictAndStore, } from './coding-pipeline-factories.js';
// Note: ICheckpointData imported from coding-agent-executor.ts
// ═══════════════════════════════════════════════════════════════════════════
// CODING PIPELINE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Orchestrates the 40-agent coding pipeline execution
 *
 * The orchestrator:
 * 1. Builds execution order from DAG
 * 2. Executes agents phase by phase
 * 3. Creates checkpoints for rollback
 * 4. Tracks XP and metrics
 * 5. Handles critical agent failures
 */
export class CodingPipelineOrchestrator {
    dependencies;
    config;
    dag;
    executionState;
    // LEANN/RLM Integration - Pipeline coordination services
    validator;
    promptBuilder;
    memoryCoordinator;
    // Dynamic config loader [REQ-PIPE-047]
    configLoader;
    // Sherlock-Quality Gate Integration [PRD Section 2.3]
    // Connects forensic verdicts to learning system (RLM/LEANN)
    integratedValidator;
    /**
     * Create a new CodingPipelineOrchestrator with dependency injection.
     *
     * @param dependencies - Required services for LEANN/RLM/Learning integration
     * @param config - Optional orchestrator configuration
     */
    constructor(dependencies, config = {}) {
        this.dependencies = dependencies;
        this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
        this.dag = buildPipelineDAG();
        // Initialize execution state
        this.executionState = {
            executionResults: new Map(),
            checkpoints: new Map(),
            totalXP: 0,
        };
        // Initialize dynamic config loader [REQ-PIPE-047]
        this.configLoader = new CodingPipelineConfigLoader();
        // Initialize internal coordinators (from PipelineExecutor pattern)
        this.validator = new PipelineValidator(dependencies.agentRegistry);
        this.promptBuilder = new PipelinePromptBuilder(dependencies.agentRegistry);
        this.memoryCoordinator = new PipelineMemoryCoordinator(dependencies.interactionStore, {
            verbose: this.config.verbose,
        });
        // Initialize Sherlock-Quality Gate Integration [PRD Section 2.3] via factory
        this.integratedValidator = createPipelineIntegratedValidator({
            memoryCoordinator: this.memoryCoordinator,
            memoryNamespace: this.config.memoryNamespace,
            verbose: this.config.verbose,
            enableLearning: this.config.enableLearning,
            sonaEngine: dependencies.sonaEngine,
            reasoningBank: dependencies.reasoningBank,
            log: this.log.bind(this),
        });
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN EXECUTION METHOD
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Execute the full coding pipeline
     *
     * @param pipelineConfig - Pipeline configuration from prepareCodeTask()
     * @returns Complete pipeline execution result
     */
    async execute(pipelineConfig) {
        const startTime = Date.now();
        const phaseResults = [];
        const completedPhases = [];
        let failedPhase;
        let rollbackApplied = false;
        let errorMessage;
        // [REQ-REFACTOR-003] Use extracted initialization function
        const initResult = initializePipelineExecution(pipelineConfig, this.validator, this.log.bind(this));
        const { pipelineId, trajectoryId, totalAgentCount } = initResult;
        // Emit pipeline_started event (preserve in orchestrator for observability)
        ObservabilityBus.getInstance().emit({
            component: 'pipeline',
            operation: 'pipeline_started',
            status: 'running',
            metadata: { pipelineId, phases: pipelineConfig.phases, totalAgents: totalAgentCount },
        });
        // Initialize pipeline state in memory (preserve in orchestrator for memory coordination)
        storeMemoryFn(this.memoryCoordinator, this.config.memoryNamespace, 'pipeline/state', {
            status: 'running',
            startTime: new Date().toISOString(),
            phases: pipelineConfig.phases,
            currentPhase: 0,
            pipelineId,
        }, this.log.bind(this));
        // Execute phases
        try {
            for (const phase of pipelineConfig.phases) {
                this.log(`Executing phase: ${phase}`);
                // Update current phase in memory
                storeMemoryFn(this.memoryCoordinator, this.config.memoryNamespace, 'pipeline/state', {
                    currentPhase: PHASE_ORDER.indexOf(phase) + 1,
                    currentPhaseName: phase,
                }, this.log.bind(this));
                const phaseResult = await this.executePhaseWrapper(phase, pipelineConfig, pipelineId);
                phaseResults.push(phaseResult);
                if (phaseResult.success) {
                    completedPhases.push(phase);
                    this.executionState.totalXP += phaseResult.totalXP;
                    // Store phase XP
                    storeMemoryFn(this.memoryCoordinator, this.config.memoryNamespace, `xp/phase-${PHASE_ORDER.indexOf(phase) + 1}`, {
                        phase,
                        xp: phaseResult.totalXP,
                        timestamp: new Date().toISOString(),
                    }, this.log.bind(this));
                }
                else {
                    failedPhase = phase;
                    errorMessage = `Phase ${phase} failed`;
                    this.log(`Phase ${phase} failed, checking for rollback...`);
                    if (this.config.enableCheckpoints && this.executionState.checkpoints.size > 0) {
                        rollbackApplied = rollbackToLastCheckpointFn(this.memoryCoordinator, this.config.memoryNamespace, this.executionState, this.log.bind(this));
                    }
                    break;
                }
            }
        }
        catch (error) {
            this.log(`Pipeline execution error: ${error}`);
            failedPhase = pipelineConfig.phases[completedPhases.length];
            errorMessage = error instanceof Error ? error.message : String(error);
        }
        // [REQ-REFACTOR-003] Use extracted finalization function
        const finalizeInput = {
            success: !failedPhase,
            phaseResults,
            completedPhases,
            failedPhase,
            rollbackApplied,
            errorMessage,
            startTime,
            totalXP: this.executionState.totalXP,
            pipelineId,
            trajectoryId,
        };
        const finalizeResult = finalizePipelineExecution(finalizeInput);
        // Learning feedback (preserve in orchestrator)
        // Convert feedbackStatus to 'completed' | 'failed' (skip 'skipped' status)
        if (this.config.enableLearning && finalizeResult.feedbackStatus !== 'skipped') {
            await providePipelineFeedbackFn({ sonaEngine: this.dependencies.sonaEngine, reasoningBank: this.dependencies.reasoningBank }, trajectoryId, finalizeResult.quality, finalizeResult.feedbackStatus, errorMessage, this.log.bind(this));
        }
        // Store final XP (preserve in orchestrator for memory coordination)
        storeMemoryFn(this.memoryCoordinator, this.config.memoryNamespace, 'xp/total', buildXPStorageObject(this.executionState.totalXP), this.log.bind(this));
        // Update final pipeline state (preserve in orchestrator for memory coordination)
        storeMemoryFn(this.memoryCoordinator, this.config.memoryNamespace, 'pipeline/state', buildFinalPipelineState(finalizeInput, finalizeResult.executionTimeMs), this.log.bind(this));
        // Emit pipeline_completed event (preserve in orchestrator for observability)
        ObservabilityBus.getInstance().emit({
            component: 'pipeline',
            operation: 'pipeline_completed',
            status: finalizeResult.result.success ? 'success' : 'error',
            durationMs: finalizeResult.executionTimeMs,
            metadata: { ...buildCompletedMetadata(finalizeInput) },
        });
        return finalizeResult.result;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE EXECUTION WRAPPER
    // Delegates to extracted executePhase function in coding-agent-executor.ts
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Execute a single phase of the pipeline.
     * Wrapper that builds dependencies and delegates to extracted function.
     */
    async executePhaseWrapper(phase, config, pipelineId) {
        // Build dependencies for extracted function
        const deps = {
            sonaEngine: this.dependencies.sonaEngine,
            reasoningBank: this.dependencies.reasoningBank,
            leannContextService: this.dependencies.leannContextService,
            memoryCoordinator: this.memoryCoordinator,
            promptBuilder: this.promptBuilder,
            stepExecutor: this.config.stepExecutor,
        };
        // Build config for extracted function
        const executorConfig = {
            agentTimeoutMs: this.config.agentTimeoutMs,
            memoryNamespace: this.config.memoryNamespace,
            agentMdPath: this.config.agentMdPath,
            enableLearning: this.config.enableLearning,
            verbose: this.config.verbose,
            enableParallelExecution: this.config.enableParallelExecution,
            maxParallelAgents: this.config.maxParallelAgents,
            enableCheckpoints: this.config.enableCheckpoints,
        };
        // Build Sherlock validator adapter
        const sherlockValidator = this.integratedValidator
            ? {
                validatePhase: async (p, result, retryCount) => this.validatePhaseWithSherlockWrapper(p, result, retryCount),
                handleGuiltyVerdict: (result, p) => this.handleSherlockGuiltyVerdictWrapper(result, p),
            }
            : null;
        // Delegate to extracted function
        return executePhaseFn(deps, executorConfig, phase, config, pipelineId, this.executionState, this.getAgentsForPhaseFromLoader.bind(this), sherlockValidator, this.log.bind(this));
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // SHERLOCK-QUALITY GATE VALIDATION [PRD Section 2.3]
    // Thin wrappers that delegate to extracted factory functions.
    // ═══════════════════════════════════════════════════════════════════════════
    /** Build Sherlock wrapper dependencies for extracted functions */
    getSherlockDeps() {
        return {
            integratedValidator: this.integratedValidator,
            memoryCoordinator: this.memoryCoordinator,
            memoryNamespace: this.config.memoryNamespace,
            verbose: this.config.verbose,
            log: this.log.bind(this),
        };
    }
    /** Validate phase with Sherlock-Quality Gate (delegates to factory function) */
    async validatePhaseWithSherlockWrapper(phase, phaseResult, retryCount = 0) {
        return validatePhaseWithSherlockAndStore(this.getSherlockDeps(), phase, phaseResult, retryCount);
    }
    /** Handle GUILTY verdict (delegates to factory function) */
    handleSherlockGuiltyVerdictWrapper(validationResult, phase) {
        return handleSherlockGuiltyVerdictAndStore(this.getSherlockDeps(), validationResult, phase);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // DYNAMIC CONFIG LOADER METHODS [REQ-PIPE-047]
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Get agents for a phase from the dynamic loader.
     * Converts CodingAgentConfig to IAgentMapping for orchestrator compatibility.
     */
    async getAgentsForPhaseFromLoader(phase) {
        const allMappings = await this.configLoader.getAgentMappings();
        return allMappings.filter(m => m.phase === phase);
    }
    /**
     * Get agent markdown content from loaded config.
     * Falls back to file read if not in cache.
     */
    async getAgentMarkdownFromLoader(agentKey) {
        const agent = await this.configLoader.getAgentByKey(agentKey);
        return agent?.fullContent ?? '';
    }
    /** Log message if verbose mode enabled */
    log(message) {
        if (this.config.verbose) {
            console.log(`[CodingPipelineOrchestrator] ${message}`);
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC GETTERS
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Get current total XP
     */
    getTotalXP() {
        return this.executionState.totalXP;
    }
    /**
     * Get all execution results
     */
    getExecutionResults() {
        return new Map(this.executionState.executionResults);
    }
    /**
     * Get all checkpoints
     */
    getCheckpoints() {
        return new Map(this.executionState.checkpoints);
    }
    /**
     * Get the DAG
     */
    getDAG() {
        return this.dag;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Create a new CodingPipelineOrchestrator instance with dependency injection.
 *
 * @param dependencies - Required services for LEANN/RLM/Learning integration
 * @param config - Optional orchestrator configuration
 */
export function createOrchestrator(dependencies, config) {
    return new CodingPipelineOrchestrator(dependencies, config);
}
/**
 * Execute a coding pipeline with dependency injection.
 *
 * @param pipelineConfig - Pipeline configuration from prepareCodeTask()
 * @param dependencies - Required services for LEANN/RLM/Learning integration
 * @param orchestratorConfig - Optional orchestrator configuration
 */
export async function executePipeline(pipelineConfig, dependencies, orchestratorConfig) {
    const orchestrator = createOrchestrator(dependencies, orchestratorConfig);
    return orchestrator.execute(pipelineConfig);
}
export { DEFAULT_ORCHESTRATOR_CONFIG };
//# sourceMappingURL=coding-pipeline-orchestrator.js.map