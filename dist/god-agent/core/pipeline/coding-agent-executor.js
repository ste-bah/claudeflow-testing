/**
 * Coding Pipeline Agent Executor
 * Extracted from coding-pipeline-orchestrator.ts for constitution.xml compliance
 *
 * Handles:
 * - Individual agent execution with LEANN/RLM integration
 * - Phase execution with batching and dependency ordering
 * - Memory coordination and observability
 *
 * ONLY for /god-code coding pipeline - NOT for PhD pipeline.
 *
 * @module src/god-agent/core/pipeline/coding-agent-executor
 * @see TASK-ORCH-004-pipeline-orchestration.md
 */
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { ObservabilityBus } from '../observability/bus.js';
import { PHASE_ORDER, CHECKPOINT_PHASES, CRITICAL_AGENTS } from './types.js';
// Extracted helper functions
import { trimExecutionResults as trimExecutionResultsFn, executeWithStepExecutor as executeWithStepExecutorFn, resolveExecutionOrder as resolveExecutionOrderFn, batchAgentsForExecution as batchAgentsForExecutionFn, provideStepFeedback as provideStepFeedbackFn, } from './coding-phase-executor.js';
import { storeMemory as storeMemoryFn, retrieveMemoryContext as retrieveMemoryContextFn, } from './coding-memory-adapter.js';
// =============================================================================
// AGENT EXECUTION
// =============================================================================
/**
 * Execute a single agent with LEANN semantic context and RLM memory handoffs.
 * Follows PipelineExecutor pattern for proper learning infrastructure integration.
 *
 * @param deps - Agent executor dependencies
 * @param config - Agent executor configuration
 * @param agentMapping - Agent mapping to execute
 * @param phase - Pipeline phase
 * @param pipelineId - Pipeline instance ID
 * @param state - Execution state (mutated)
 * @param log - Logging function
 * @returns Agent execution result
 */
export async function executeAgent(deps, config, agentMapping, phase, pipelineId, state, log) {
    const startTime = Date.now();
    const { agentKey, algorithm, memoryReads, memoryWrites, xpReward, description } = agentMapping;
    const trajectoryId = `trajectory_coding_${pipelineId}_${agentKey}`;
    log(`Executing agent: ${agentKey} (algorithm: ${algorithm})`);
    // Emit step started event to ObservabilityBus
    ObservabilityBus.getInstance().emit({
        component: 'pipeline',
        operation: 'agent_started',
        status: 'running',
        metadata: {
            pipelineId,
            agentKey,
            algorithm,
            phase,
        },
    });
    try {
        // 1. Retrieve memory context for this agent
        const memoryContext = retrieveMemoryContextFn(deps.memoryCoordinator, config.memoryNamespace, memoryReads);
        // 2. Get semantic context from LEANN if available
        let semanticContext;
        if (deps.leannContextService) {
            try {
                semanticContext = await deps.leannContextService.buildSemanticContext({
                    taskDescription: description || agentKey,
                    phase: PHASE_ORDER.indexOf(phase),
                    previousOutput: memoryContext,
                    maxResults: 5,
                });
                if (semanticContext.totalResults > 0 && config.verbose) {
                    log(`Agent ${agentKey}: Found ${semanticContext.totalResults} ` +
                        `relevant code contexts via LEANN`);
                }
            }
            catch (error) {
                log(`Agent ${agentKey}: LEANN context search failed: ` +
                    `${error.message}`);
            }
        }
        // 3. Load agent markdown if exists
        const agentMd = loadAgentMarkdown(agentKey, config.agentMdPath);
        // 4. Build prompt with forward-looking context (RULE-007)
        const promptContext = {
            step: {
                agentKey: agentKey,
                task: agentMd || `Execute ${agentKey} agent with ${algorithm} algorithm`,
                inputDomain: memoryReads[0] || '',
                inputTags: [],
                outputDomain: memoryWrites[0] || `coding/${phase}/${agentKey}`,
                outputTags: [agentKey, phase, algorithm],
            },
            stepIndex: agentMapping.priority,
            pipeline: {
                name: 'coding-pipeline',
                description: `40-agent coding pipeline - Phase: ${phase}`,
                agents: [],
                sequential: true,
            },
            pipelineId,
            previousOutput: memoryContext,
            semanticContext,
        };
        const builtPrompt = deps.promptBuilder.buildPrompt(promptContext);
        // 5. Execute with stepExecutor
        const executionResult = await executeWithStepExecutorFn(deps.stepExecutor, agentKey, builtPrompt.prompt, config.agentTimeoutMs);
        // 6. Store agent outputs to memory
        const storeResult = deps.memoryCoordinator.storeStepOutput(promptContext.step, agentMapping.priority, pipelineId, executionResult.output, agentKey);
        // 7. Construct RLM context for relay-race memory handoff tracking
        const rlmContext = {
            injectionSuccess: Object.keys(memoryContext).length > 0,
            sourceAgentKey: undefined,
            sourceStepIndex: undefined,
            sourceDomain: memoryReads[0],
        };
        // 8. Provide feedback to SonaEngine if learning enabled
        if (config.enableLearning) {
            await provideStepFeedbackFn({ sonaEngine: deps.sonaEngine, reasoningBank: deps.reasoningBank }, trajectoryId, executionResult.quality, agentKey, phase, rlmContext, log);
        }
        const executionTimeMs = Date.now() - startTime;
        // Emit step completed event to ObservabilityBus
        ObservabilityBus.getInstance().emit({
            component: 'pipeline',
            operation: 'agent_completed',
            status: 'success',
            durationMs: executionTimeMs,
            metadata: {
                pipelineId,
                agentKey,
                quality: executionResult.quality,
                memoryDomain: storeResult.domain,
                memoryTags: storeResult.tags,
            },
        });
        const agentResult = {
            agentKey,
            success: true,
            output: executionResult.output,
            xpEarned: xpReward,
            memoryWrites,
            executionTimeMs,
        };
        state.executionResults.set(agentKey, agentResult);
        trimExecutionResultsFn(state.executionResults, log);
        return agentResult;
    }
    catch (error) {
        const executionTimeMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Agent ${agentKey} failed: ${errorMessage}`);
        // Emit error event to ObservabilityBus
        ObservabilityBus.getInstance().emit({
            component: 'pipeline',
            operation: 'agent_completed',
            status: 'error',
            durationMs: executionTimeMs,
            metadata: {
                pipelineId,
                agentKey,
                error: errorMessage,
            },
        });
        // Provide failure feedback if learning enabled
        if (config.enableLearning) {
            await provideStepFeedbackFn({ sonaEngine: deps.sonaEngine, reasoningBank: deps.reasoningBank }, `trajectory_coding_${pipelineId}_${agentKey}`, 0, agentKey, phase, undefined, log);
        }
        const agentResult = {
            agentKey,
            success: false,
            output: null,
            xpEarned: 0,
            memoryWrites: [],
            executionTimeMs,
            error: errorMessage,
        };
        state.executionResults.set(agentKey, agentResult);
        trimExecutionResultsFn(state.executionResults, log);
        return agentResult;
    }
}
// =============================================================================
// PHASE EXECUTION
// =============================================================================
/**
 * Execute a single phase of the pipeline.
 *
 * @param deps - Agent executor dependencies
 * @param config - Agent executor configuration
 * @param phase - Phase to execute
 * @param pipelineConfig - Pipeline configuration
 * @param pipelineId - Pipeline instance ID
 * @param state - Execution state (mutated)
 * @param getAgentsForPhase - Function to get agents for a phase
 * @param sherlockValidator - Optional Sherlock validator adapter
 * @param log - Logging function
 * @returns Phase execution result
 */
export async function executePhase(deps, config, phase, pipelineConfig, pipelineId, state, getAgentsForPhase, sherlockValidator, log) {
    const startTime = Date.now();
    const agentResults = [];
    let phaseXP = 0;
    let checkpointCreated = false;
    // Get agents for this phase
    let phaseAgents = pipelineConfig.agentsByPhase.get(phase);
    // Fallback to dynamic loader if not in config
    if (!phaseAgents || phaseAgents.length === 0) {
        phaseAgents = await getAgentsForPhase(phase);
    }
    // Resolve execution order within phase (respecting dependencies)
    const executionOrder = resolveExecutionOrderFn(phaseAgents);
    log(`Phase ${phase}: ${executionOrder.length} agents to execute`);
    // Create checkpoint before phase if configured
    if (config.enableCheckpoints && CHECKPOINT_PHASES.includes(phase)) {
        createCheckpoint(deps.memoryCoordinator, config.memoryNamespace, phase, state, log);
        checkpointCreated = true;
    }
    // Execute agents in batches (parallelizable agents can run together)
    const batches = batchAgentsForExecutionFn(executionOrder, {
        enableParallelExecution: config.enableParallelExecution,
        maxParallelAgents: config.maxParallelAgents,
    });
    for (const batch of batches) {
        const batchResults = await Promise.all(batch.map(agent => executeAgent(deps, config, agent, phase, pipelineId, state, log)));
        for (const result of batchResults) {
            agentResults.push(result);
            if (result.success) {
                phaseXP += result.xpEarned;
            }
            else if (isCriticalAgent(result.agentKey)) {
                // Critical agent failed - halt phase
                log(`Critical agent ${result.agentKey} failed, halting phase`);
                return {
                    phase,
                    success: false,
                    agentResults,
                    totalXP: phaseXP,
                    checkpointCreated,
                    executionTimeMs: Date.now() - startTime,
                };
            }
        }
    }
    // Build preliminary result for Sherlock validation
    const preliminaryResult = {
        phase,
        success: true,
        agentResults,
        totalXP: phaseXP,
        checkpointCreated,
        executionTimeMs: Date.now() - startTime,
    };
    // Sherlock-Quality Gate validation if available
    if (sherlockValidator) {
        const validationResult = await sherlockValidator.validatePhase(phase, preliminaryResult, 0 // retryCount
        );
        if (validationResult) {
            if (!validationResult.canProceed) {
                // GUILTY verdict - phase failed validation
                const remediations = sherlockValidator.handleGuiltyVerdict(validationResult, phase);
                log(`Phase ${phase} FAILED Sherlock validation. ` +
                    `Verdict: ${validationResult.sherlockResult?.verdict ?? 'REJECTED'}. ` +
                    `Remediations: ${remediations.length}`);
                return {
                    phase,
                    success: false,
                    agentResults,
                    totalXP: phaseXP,
                    checkpointCreated,
                    executionTimeMs: Date.now() - startTime,
                    validationResult: {
                        verdict: validationResult.sherlockResult?.verdict,
                        gateResult: validationResult.gateResult.result,
                        remediations,
                    },
                };
            }
            // INNOCENT verdict - phase passed validation
            log(`Phase ${phase} PASSED Sherlock validation. ` +
                `Verdict: ${validationResult.sherlockResult?.verdict ?? 'PASSED'}. ` +
                `Investigation tier: ${validationResult.investigationTier ?? 'N/A'}`);
        }
    }
    return {
        phase,
        success: true,
        agentResults,
        totalXP: phaseXP,
        checkpointCreated,
        executionTimeMs: Date.now() - startTime,
    };
}
// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
/**
 * Load agent markdown file if it exists
 */
export function loadAgentMarkdown(agentKey, agentMdPath) {
    const mdPath = join(process.cwd(), agentMdPath, `${agentKey}.md`);
    if (existsSync(mdPath)) {
        try {
            return readFileSync(mdPath, 'utf-8');
        }
        catch {
            return '';
        }
    }
    return '';
}
/**
 * Check if agent is critical (halts pipeline on failure)
 */
export function isCriticalAgent(agentKey) {
    return CRITICAL_AGENTS.includes(agentKey);
}
/**
 * Create a checkpoint at the current phase
 */
export function createCheckpoint(memoryCoordinator, memoryNamespace, phase, state, log) {
    log(`Creating checkpoint for phase: ${phase}`);
    // Retrieve current memory state
    const memorySnapshot = retrieveMemoryContextFn(memoryCoordinator, memoryNamespace, [
        `${memoryNamespace}/*`,
    ]);
    const checkpoint = {
        phase,
        timestamp: new Date().toISOString(),
        memorySnapshot,
        completedAgents: Array.from(state.executionResults.keys()),
        totalXP: state.totalXP,
    };
    state.checkpoints.set(phase, checkpoint);
    // Store checkpoint in memory
    storeMemoryFn(memoryCoordinator, memoryNamespace, `pipeline/checkpoints/${phase}`, checkpoint, log);
}
/**
 * Rollback to the last successful checkpoint
 */
export function rollbackToLastCheckpoint(memoryCoordinator, memoryNamespace, state, log) {
    if (state.checkpoints.size === 0) {
        log('No checkpoints available for rollback');
        return false;
    }
    // Get the most recent checkpoint
    const phases = Array.from(state.checkpoints.keys());
    const lastPhase = phases[phases.length - 1];
    const checkpoint = state.checkpoints.get(lastPhase);
    if (!checkpoint) {
        return false;
    }
    log(`Rolling back to checkpoint: ${lastPhase}`);
    // Restore memory state
    for (const [key, value] of Object.entries(checkpoint.memorySnapshot)) {
        storeMemoryFn(memoryCoordinator, memoryNamespace, key, value, log);
    }
    // Restore XP
    state.totalXP = checkpoint.totalXP;
    // Clear execution results after checkpoint
    const checkpointAgents = new Set(checkpoint.completedAgents);
    for (const agentKey of state.executionResults.keys()) {
        if (!checkpointAgents.has(agentKey)) {
            state.executionResults.delete(agentKey);
        }
    }
    return true;
}
//# sourceMappingURL=coding-agent-executor.js.map