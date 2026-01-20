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

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Core services for LEANN/RLM integration (from pipeline-executor.ts pattern)
import type { AgentRegistry } from '../agents/agent-registry.js';
import type { AgentSelector } from '../agents/agent-selector.js';
import type { InteractionStore } from '../../universal/interaction-store.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
import type { SonaEngine } from '../learning/sona-engine.js';
import type { IRlmContext } from '../learning/sona-types.js';

// Pipeline coordination services
import { PipelineValidator } from './pipeline-validator.js';
import { PipelinePromptBuilder, IPromptContext } from './pipeline-prompt-builder.js';
import { PipelineMemoryCoordinator } from './pipeline-memory-coordinator.js';

// LEANN semantic context
import type { LeannContextService, ISemanticContext } from './leann-context-service.js';

// Observability
import { ObservabilityBus } from '../observability/bus.js';

import type {
  CodingPipelinePhase,
  CodingPipelineAgent,
  IAgentMapping,
  IPipelineDAG,
  IPipelineExecutionConfig,
  IAgentExecutionResult,
  IPhaseExecutionResult,
  IPipelineExecutionResult,
} from './types.js';

import {
  PHASE_ORDER,
  CHECKPOINT_PHASES,
  CRITICAL_AGENTS,
  CODING_MEMORY_NAMESPACE,
} from './types.js';

// Dynamic config loader replaces hardcoded CODING_PIPELINE_MAPPINGS
import {
  CodingPipelineConfigLoader,
  type CodingAgentConfig,
} from './coding-pipeline-config-loader.js';

// Backwards compatibility - import buildPipelineDAG for DAG structure
import { buildPipelineDAG } from './command-task-bridge.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interface for step execution function.
 * Allows injection of custom execution logic (e.g., for testing or Claude Code Task()).
 */
export interface IStepExecutor {
  execute(agentKey: string, prompt: string, timeout: number): Promise<{
    output: unknown;
    quality: number;
    duration: number;
  }>;
}

/**
 * Dependencies required for CodingPipelineOrchestrator
 * Following PipelineExecutor dependency injection pattern
 */
export interface IOrchestratorDependencies {
  agentRegistry: AgentRegistry;
  agentSelector: AgentSelector;
  interactionStore: InteractionStore;
  reasoningBank?: ReasoningBank;
  sonaEngine?: SonaEngine;
  leannContextService?: LeannContextService;
}

/**
 * Configuration for the pipeline orchestrator
 */
export interface IOrchestratorConfig {
  /** Maximum time for a single agent execution (ms) */
  agentTimeoutMs: number;

  /** Maximum time for a full phase execution (ms) */
  phaseTimeoutMs: number;

  /** Enable checkpoint creation for rollback */
  enableCheckpoints: boolean;

  /** Enable parallel execution of parallelizable agents */
  enableParallelExecution: boolean;

  /** Maximum agents to run in parallel within a phase */
  maxParallelAgents: number;

  /** Memory namespace for coordination */
  memoryNamespace: string;

  /** Path to agent markdown files */
  agentMdPath: string;

  /** Enable verbose logging */
  verbose: boolean;

  /** Step executor function for agent execution (required for production) */
  stepExecutor?: IStepExecutor;

  /** Enable learning feedback to SonaEngine/ReasoningBank */
  enableLearning: boolean;
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: IOrchestratorConfig = {
  agentTimeoutMs: 120_000, // 2 minutes per agent
  phaseTimeoutMs: 600_000, // 10 minutes per phase
  enableCheckpoints: true,
  enableParallelExecution: true,
  maxParallelAgents: 3,
  memoryNamespace: CODING_MEMORY_NAMESPACE,
  agentMdPath: '.claude/agents/coding-pipeline',
  verbose: false,
  enableLearning: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// CHECKPOINT INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

interface ICheckpoint {
  phase: CodingPipelinePhase;
  timestamp: string;
  memorySnapshot: Record<string, unknown>;
  completedAgents: CodingPipelineAgent[];
  totalXP: number;
}

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
  private config: IOrchestratorConfig;
  private dag: IPipelineDAG;
  private checkpoints: Map<CodingPipelinePhase, ICheckpoint> = new Map();
  private executionResults: Map<CodingPipelineAgent, IAgentExecutionResult> = new Map();
  private totalXP = 0;

  // LEANN/RLM Integration - Pipeline coordination services
  private readonly validator: PipelineValidator;
  private readonly promptBuilder: PipelinePromptBuilder;
  private readonly memoryCoordinator: PipelineMemoryCoordinator;

  // Dynamic config loader [REQ-PIPE-047]
  private readonly configLoader: CodingPipelineConfigLoader;

  /**
   * Create a new CodingPipelineOrchestrator with dependency injection.
   *
   * @param dependencies - Required services for LEANN/RLM/Learning integration
   * @param config - Optional orchestrator configuration
   */
  constructor(
    private readonly dependencies: IOrchestratorDependencies,
    config: Partial<IOrchestratorConfig> = {}
  ) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.dag = buildPipelineDAG();

    // Initialize dynamic config loader [REQ-PIPE-047]
    this.configLoader = new CodingPipelineConfigLoader();

    // Initialize internal coordinators (from PipelineExecutor pattern)
    this.validator = new PipelineValidator(dependencies.agentRegistry);
    this.promptBuilder = new PipelinePromptBuilder(dependencies.agentRegistry);
    this.memoryCoordinator = new PipelineMemoryCoordinator(dependencies.interactionStore, {
      verbose: this.config.verbose, // FIX: Use this.config.verbose instead of config.verbose
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
  async execute(pipelineConfig: IPipelineExecutionConfig): Promise<IPipelineExecutionResult> {
    const startTime = Date.now();
    const phaseResults: IPhaseExecutionResult[] = [];
    const completedPhases: CodingPipelinePhase[] = [];
    let failedPhase: CodingPipelinePhase | undefined;
    let rollbackApplied = false;
    let errorMessage: string | undefined;

    // FIX: Generate pipelineId ONCE at start (not per-agent)
    const pipelineId = `coding-${Date.now()}`;
    const trajectoryId = `trajectory_pipeline_${pipelineId}`;

    this.log(`Starting pipeline execution with ${pipelineConfig.phases.length} phases`);

    // FIX: Validate pipeline configuration at start
    // Count total agents from agentsByPhase Map
    let totalAgentCount = 0;
    const allAgents: { agentKey: string; task: string; inputDomain: string; inputTags: string[]; outputDomain: string; outputTags: string[] }[] = [];
    for (const [phase, agents] of pipelineConfig.agentsByPhase) {
      totalAgentCount += agents.length;
      for (const agent of agents) {
        allAgents.push({
          agentKey: agent.agentKey,
          task: agent.description || `Execute ${agent.agentKey}`,
          inputDomain: agent.memoryReads[0] || '',
          inputTags: [],
          outputDomain: agent.memoryWrites[0] || `coding/${phase}/${agent.agentKey}`,
          outputTags: [agent.agentKey, phase, agent.algorithm],
        });
      }
    }

    // Build pipeline definition for validation
    const validationPipeline = {
      name: 'coding-pipeline',
      description: '40-agent coding pipeline',
      agents: allAgents,
      sequential: true,
    };

    // PipelineValidator.validate() throws on error, use try/catch
    try {
      this.validator.validate(validationPipeline);
      this.log('Pipeline validation passed');
    } catch (validationError) {
      const errorMsg = validationError instanceof Error ? validationError.message : String(validationError);
      this.log(`Pipeline validation warning: ${errorMsg}`);
      // Continue execution - validation warnings are non-fatal for coding pipeline
    }

    // FIX: Emit pipeline_started event to ObservabilityBus
    ObservabilityBus.getInstance().emit({
      component: 'pipeline',
      operation: 'pipeline_started',
      status: 'running',
      metadata: {
        pipelineId,
        phases: pipelineConfig.phases,
        totalAgents: totalAgentCount,
      },
    });

    // Initialize pipeline state in memory
    this.storeMemory('pipeline/state', {
      status: 'running',
      startTime: new Date().toISOString(),
      phases: pipelineConfig.phases,
      currentPhase: 0,
      pipelineId,
    });

    try {
      for (const phase of pipelineConfig.phases) {
        this.log(`Executing phase: ${phase}`);

        // Update current phase in memory
        this.storeMemory('pipeline/state', {
          currentPhase: PHASE_ORDER.indexOf(phase) + 1,
          currentPhaseName: phase,
        });

        // Execute the phase (pass pipelineId for consistent memory coordination)
        const phaseResult = await this.executePhase(phase, pipelineConfig, pipelineId);
        phaseResults.push(phaseResult);

        if (phaseResult.success) {
          completedPhases.push(phase);
          this.totalXP += phaseResult.totalXP;

          // Store phase XP
          this.storeMemory(`xp/phase-${PHASE_ORDER.indexOf(phase) + 1}`, {
            phase,
            xp: phaseResult.totalXP,
            timestamp: new Date().toISOString(),
          });
        } else {
          failedPhase = phase;
          errorMessage = `Phase ${phase} failed`;
          this.log(`Phase ${phase} failed, checking for rollback...`);

          // Attempt rollback if checkpoints enabled
          if (this.config.enableCheckpoints && this.checkpoints.size > 0) {
            const rolledBack = this.rollbackToLastCheckpoint();
            rollbackApplied = rolledBack;
          }

          break;
        }
      }
    } catch (error) {
      this.log(`Pipeline execution error: ${error}`);
      failedPhase = pipelineConfig.phases[completedPhases.length];
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    const executionTimeMs = Date.now() - startTime;
    const pipelineSuccess = !failedPhase;

    // FIX: Call providePipelineFeedback() for learning (REQ-LEARN-001)
    if (this.config.enableLearning) {
      const quality = pipelineSuccess ? this.calculatePipelineQuality(phaseResults) : 0;
      await this.providePipelineFeedback(
        trajectoryId,
        quality,
        pipelineSuccess ? 'completed' : 'failed',
        errorMessage
      );
    }

    // Store final XP
    this.storeMemory('xp/total', {
      xp: this.totalXP,
      timestamp: new Date().toISOString(),
    });

    // Update final pipeline state
    this.storeMemory('pipeline/state', {
      status: failedPhase ? 'failed' : 'completed',
      endTime: new Date().toISOString(),
      executionTimeMs,
      totalXP: this.totalXP,
      completedPhases,
      failedPhase,
      rollbackApplied,
    });

    // FIX: Emit pipeline_completed event to ObservabilityBus
    ObservabilityBus.getInstance().emit({
      component: 'pipeline',
      operation: 'pipeline_completed',
      status: pipelineSuccess ? 'success' : 'error',
      durationMs: executionTimeMs,
      metadata: {
        pipelineId,
        success: pipelineSuccess,
        totalXP: this.totalXP,
        completedPhases,
        failedPhase,
        rollbackApplied,
      },
    });

    return {
      success: pipelineSuccess,
      phaseResults,
      totalXP: this.totalXP,
      executionTimeMs,
      completedPhases,
      failedPhase,
      rollbackApplied,
    };
  }

  /**
   * Calculate overall pipeline quality from phase results.
   */
  private calculatePipelineQuality(phaseResults: IPhaseExecutionResult[]): number {
    if (phaseResults.length === 0) return 0;

    const totalAgents = phaseResults.reduce((sum, p) => sum + p.agentResults.length, 0);
    const successfulAgents = phaseResults.reduce(
      (sum, p) => sum + p.agentResults.filter(a => a.success).length,
      0
    );

    return totalAgents > 0 ? successfulAgents / totalAgents : 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE EXECUTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Execute a single phase of the pipeline
   */
  private async executePhase(
    phase: CodingPipelinePhase,
    config: IPipelineExecutionConfig,
    pipelineId: string
  ): Promise<IPhaseExecutionResult> {
    const startTime = Date.now();
    const agentResults: IAgentExecutionResult[] = [];
    let phaseXP = 0;
    let checkpointCreated = false;

    // Get agents for this phase [REQ-PIPE-047: Use dynamic loader]
    let phaseAgents = config.agentsByPhase.get(phase);

    // Fallback to dynamic loader if not in config
    if (!phaseAgents || phaseAgents.length === 0) {
      phaseAgents = await this.getAgentsForPhaseFromLoader(phase);
    }

    // Resolve execution order within phase (respecting dependencies)
    const executionOrder = this.resolveExecutionOrder(phaseAgents);

    this.log(`Phase ${phase}: ${executionOrder.length} agents to execute`);

    // Create checkpoint before phase if configured
    if (this.config.enableCheckpoints && CHECKPOINT_PHASES.includes(phase)) {
      this.createCheckpoint(phase);
      checkpointCreated = true;
    }

    // Execute agents in batches (parallelizable agents can run together)
    const batches = this.batchAgentsForExecution(executionOrder);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(agent => this.executeAgent(agent, phase, pipelineId))
      );

      for (const result of batchResults) {
        agentResults.push(result);

        if (result.success) {
          phaseXP += result.xpEarned;
        } else if (this.isCriticalAgent(result.agentKey)) {
          // Critical agent failed - halt phase
          this.log(`Critical agent ${result.agentKey} failed, halting phase`);
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

    return {
      phase,
      success: true,
      agentResults,
      totalXP: phaseXP,
      checkpointCreated,
      executionTimeMs: Date.now() - startTime,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT EXECUTION WITH LEANN/RLM INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Execute a single agent with LEANN semantic context and RLM memory handoffs.
   * Follows PipelineExecutor pattern for proper learning infrastructure integration.
   */
  private async executeAgent(
    agentMapping: IAgentMapping,
    phase: CodingPipelinePhase,
    pipelineId: string
  ): Promise<IAgentExecutionResult> {
    const startTime = Date.now();
    const { agentKey, algorithm, memoryReads, memoryWrites, xpReward, description } = agentMapping;
    // FIX: Use passed pipelineId instead of generating new one per-agent
    const trajectoryId = `trajectory_coding_${pipelineId}_${agentKey}`;

    this.log(`Executing agent: ${agentKey} (algorithm: ${algorithm})`);

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
      // 1. Retrieve memory context for this agent using PipelineMemoryCoordinator
      const memoryContext = this.retrieveMemoryContext(memoryReads);

      // 2. Get semantic context from LEANN if available (PipelineExecutor lines 487-513)
      let semanticContext: ISemanticContext | undefined;
      if (this.dependencies.leannContextService) {
        try {
          semanticContext = await this.dependencies.leannContextService.buildSemanticContext({
            taskDescription: description || agentKey,
            phase: PHASE_ORDER.indexOf(phase),
            previousOutput: memoryContext,
            maxResults: 5,
          });

          if (semanticContext.totalResults > 0 && this.config.verbose) {
            this.log(
              `Agent ${agentKey}: Found ${semanticContext.totalResults} ` +
              `relevant code contexts via LEANN`
            );
          }
        } catch (error) {
          this.log(
            `Agent ${agentKey}: LEANN context search failed: ` +
            `${(error as Error).message}`
          );
        }
      }

      // 3. Load agent markdown if exists
      const agentMd = this.loadAgentMarkdown(agentKey);

      // 4. Build prompt with forward-looking context (RULE-007)
      const promptContext: IPromptContext = {
        step: {
          agentKey: agentKey as string,
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
          sequential: true, // RULE-004: Sequential execution required
        },
        pipelineId,
        previousOutput: memoryContext,
        semanticContext,
      };

      const builtPrompt = this.promptBuilder.buildPrompt(promptContext);

      // 5. Execute with stepExecutor (PRODUCTION-READY: requires injected executor)
      const executionResult = await this.executeWithStepExecutor(
        agentKey,
        builtPrompt.prompt,
        algorithm,
        phase
      );

      // 6. Store agent outputs to memory using PipelineMemoryCoordinator
      const storeResult = this.memoryCoordinator.storeStepOutput(
        promptContext.step,
        agentMapping.priority,
        pipelineId,
        executionResult.output,
        agentKey
      );

      // 7. Construct RLM context for relay-race memory handoff tracking (PipelineExecutor lines 645-652)
      const rlmContext: IRlmContext = {
        injectionSuccess: Object.keys(memoryContext).length > 0,
        sourceAgentKey: undefined,
        sourceStepIndex: undefined,
        sourceDomain: memoryReads[0],
      };

      // 8. Provide feedback to SonaEngine if learning enabled (PipelineExecutor lines 825-885)
      if (this.config.enableLearning) {
        await this.provideStepFeedback(
          trajectoryId,
          executionResult.quality,
          agentKey,
          phase,
          rlmContext
        );
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

      const agentResult: IAgentExecutionResult = {
        agentKey,
        success: true,
        output: executionResult.output,
        xpEarned: xpReward,
        memoryWrites,
        executionTimeMs,
      };

      this.executionResults.set(agentKey, agentResult);
      return agentResult;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.log(`Agent ${agentKey} failed: ${errorMessage}`);

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
      if (this.config.enableLearning) {
        await this.provideStepFeedback(trajectoryId, 0, agentKey, phase);
      }

      const agentResult: IAgentExecutionResult = {
        agentKey,
        success: false,
        output: null,
        xpEarned: 0,
        memoryWrites: [],
        executionTimeMs,
        error: errorMessage,
      };

      this.executionResults.set(agentKey, agentResult);
      return agentResult;
    }
  }

  /**
   * Execute agent with stepExecutor (PRODUCTION-READY pattern from PipelineExecutor).
   * Requires stepExecutor to be injected via config for real agent execution.
   */
  private async executeWithStepExecutor(
    agentKey: CodingPipelineAgent,
    prompt: string,
    algorithm: string,
    phase: CodingPipelinePhase
  ): Promise<{ output: unknown; quality: number; duration: number }> {
    // If stepExecutor provided, use it
    if (this.config.stepExecutor) {
      return await Promise.race([
        this.config.stepExecutor.execute(agentKey, prompt, this.config.agentTimeoutMs),
        this.createTimeoutPromise(agentKey, this.config.agentTimeoutMs),
      ]);
    }

    // PRODUCTION GUARD: Do not allow silent fake execution
    throw new Error(
      `No stepExecutor provided for agent "${agentKey}". ` +
      `You must inject a stepExecutor via IOrchestratorConfig.stepExecutor ` +
      `that implements IStepExecutor.execute() to run real agents. ` +
      `For testing, see tests/god-agent/core/pipeline/coding-pipeline-orchestrator.test.ts`
    );
  }

  /**
   * Create a timeout promise that rejects with an error.
   */
  private createTimeoutPromise(
    agentKey: CodingPipelineAgent,
    timeout: number
  ): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Agent ${agentKey} timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Provide feedback to SonaEngine for an agent step (direct SQLite persistence).
   * Falls back to ReasoningBank if SonaEngine is not available.
   * Reference: PipelineExecutor lines 825-885
   */
  private async provideStepFeedback(
    trajectoryId: string,
    quality: number,
    agentKey: CodingPipelineAgent,
    phase: CodingPipelinePhase,
    rlmContext?: IRlmContext
  ): Promise<void> {
    // Prefer SonaEngine for direct SQLite persistence
    if (this.dependencies.sonaEngine) {
      try {
        await this.dependencies.sonaEngine.provideFeedback(trajectoryId, quality, {
          skipAutoSave: false, // CRITICAL: Ensure persistence to SQLite
          rlmContext, // Pass RLM context for relay-race memory tracking
        });
        return;
      } catch (error) {
        this.log(`Warning: SonaEngine feedback failed: ${(error as Error).message}`);
      }
    }

    // Fallback to ReasoningBank
    if (!this.dependencies.reasoningBank) return;

    try {
      await this.dependencies.reasoningBank.provideFeedback({
        trajectoryId,
        quality,
        feedback: `Coding pipeline agent ${agentKey} in phase ${phase}`,
        verdict: quality >= 0.7 ? 'correct' : 'incorrect',
      });
    } catch (error) {
      this.log(`Warning: Failed to provide step feedback: ${(error as Error).message}`);
    }
  }

  /**
   * Provide feedback for the entire pipeline execution.
   * Reference: PipelineExecutor lines 891-928
   */
  private async providePipelineFeedback(
    trajectoryId: string,
    quality: number,
    status: 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    if (this.dependencies.sonaEngine) {
      try {
        await this.dependencies.sonaEngine.provideFeedback(trajectoryId, quality, {
          skipAutoSave: false,
        });
        return;
      } catch (error) {
        this.log(`Warning: SonaEngine pipeline feedback failed: ${(error as Error).message}`);
      }
    }

    if (!this.dependencies.reasoningBank) return;

    try {
      const feedback = status === 'completed'
        ? 'Coding pipeline completed successfully'
        : `Coding pipeline failed: ${errorMessage}`;

      await this.dependencies.reasoningBank.provideFeedback({
        trajectoryId,
        quality,
        feedback,
        verdict: status === 'completed' ? 'correct' : 'incorrect',
      });
    } catch (error) {
      this.log(`Warning: Failed to provide pipeline feedback: ${(error as Error).message}`);
    }
  }

  // FIX: Removed dead code buildClaudeFlowPrompt() - prompt building now uses PipelinePromptBuilder

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPENDENCY RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve execution order for agents within a phase
   * Uses topological sort based on dependencies
   */
  private resolveExecutionOrder(agents: IAgentMapping[]): IAgentMapping[] {
    const agentMap = new Map(agents.map(a => [a.agentKey, a]));
    const visited = new Set<CodingPipelineAgent>();
    const result: IAgentMapping[] = [];

    const visit = (agentKey: CodingPipelineAgent) => {
      if (visited.has(agentKey)) return;
      visited.add(agentKey);

      const agent = agentMap.get(agentKey);
      if (!agent) return;

      // Visit dependencies first (within this phase only)
      for (const dep of agent.dependsOn ?? []) {
        if (agentMap.has(dep)) {
          visit(dep);
        }
      }

      result.push(agent);
    };

    // Sort by priority first, then visit
    const sortedByPriority = [...agents].sort((a, b) => a.priority - b.priority);
    for (const agent of sortedByPriority) {
      visit(agent.agentKey);
    }

    return result;
  }

  /**
   * Batch agents for parallel execution where allowed
   */
  private batchAgentsForExecution(agents: IAgentMapping[]): IAgentMapping[][] {
    if (!this.config.enableParallelExecution) {
      // Sequential: each agent in its own batch
      return agents.map(a => [a]);
    }

    const batches: IAgentMapping[][] = [];
    const executed = new Set<CodingPipelineAgent>();
    let remaining = [...agents];

    while (remaining.length > 0) {
      const batch: IAgentMapping[] = [];

      for (const agent of remaining) {
        // Check if all dependencies are satisfied
        const depsInPhase = (agent.dependsOn ?? []).filter(dep =>
          agents.some(a => a.agentKey === dep)
        );
        const depsSatisfied = depsInPhase.every(dep => executed.has(dep));

        if (depsSatisfied && agent.parallelizable && batch.length < this.config.maxParallelAgents) {
          batch.push(agent);
        } else if (depsSatisfied && batch.length === 0) {
          // Non-parallelizable agent, must run alone
          batch.push(agent);
          break;
        }
      }

      if (batch.length === 0) {
        // Shouldn't happen with valid DAG, but handle gracefully
        batch.push(remaining[0]);
      }

      batches.push(batch);
      for (const agent of batch) {
        executed.add(agent.agentKey);
      }
      remaining = remaining.filter(a => !executed.has(a.agentKey));
    }

    return batches;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKPOINT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a checkpoint at the current phase
   */
  private createCheckpoint(phase: CodingPipelinePhase): void {
    this.log(`Creating checkpoint for phase: ${phase}`);

    // Retrieve current memory state
    const memorySnapshot = this.retrieveMemoryContext([
      `${this.config.memoryNamespace}/*`,
    ]);

    const checkpoint: ICheckpoint = {
      phase,
      timestamp: new Date().toISOString(),
      memorySnapshot,
      completedAgents: Array.from(this.executionResults.keys()),
      totalXP: this.totalXP,
    };

    this.checkpoints.set(phase, checkpoint);

    // Store checkpoint in memory
    this.storeMemory(`pipeline/checkpoints/${phase}`, checkpoint);
  }

  /**
   * Rollback to the last successful checkpoint
   */
  private rollbackToLastCheckpoint(): boolean {
    if (this.checkpoints.size === 0) {
      this.log('No checkpoints available for rollback');
      return false;
    }

    // Get the most recent checkpoint
    const phases = Array.from(this.checkpoints.keys());
    const lastPhase = phases[phases.length - 1];
    const checkpoint = this.checkpoints.get(lastPhase);

    if (!checkpoint) {
      return false;
    }

    this.log(`Rolling back to checkpoint: ${lastPhase}`);

    // Restore memory state
    for (const [key, value] of Object.entries(checkpoint.memorySnapshot)) {
      this.storeMemory(key, value);
    }

    // Restore XP
    this.totalXP = checkpoint.totalXP;

    // Clear execution results after checkpoint
    const checkpointAgents = new Set(checkpoint.completedAgents);
    for (const agentKey of this.executionResults.keys()) {
      if (!checkpointAgents.has(agentKey)) {
        this.executionResults.delete(agentKey);
      }
    }

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORY COORDINATION (Using PipelineMemoryCoordinator)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Store value using PipelineMemoryCoordinator.
   * Replaces subprocess-based memory storage with internal service.
   */
  private storeMemory(key: string, value: unknown): void {
    const fullKey = key.startsWith(this.config.memoryNamespace)
      ? key
      : `${this.config.memoryNamespace}/${key}`;

    try {
      // Use PipelineMemoryCoordinator for storage
      const step = {
        agentKey: 'orchestrator',
        task: 'pipeline-state-update',
        inputDomain: '',
        inputTags: [],
        outputDomain: this.config.memoryNamespace,
        outputTags: [fullKey],
      };

      this.memoryCoordinator.storeStepOutput(
        step,
        0, // stepIndex
        `pipeline-${Date.now()}`,
        value,
        'orchestrator'
      );
    } catch (error) {
      this.log(`Warning: Failed to store memory ${fullKey}: ${error}`);
    }
  }

  /**
   * Retrieve memory context for agent execution using PipelineMemoryCoordinator.
   * Replaces subprocess-based memory retrieval with internal service.
   */
  private retrieveMemoryContext(keys: string[]): Record<string, unknown> {
    const context: Record<string, unknown> = {};

    for (const key of keys) {
      const fullKey = key.startsWith(this.config.memoryNamespace)
        ? key
        : `${this.config.memoryNamespace}/${key}`;

      try {
        const step = {
          agentKey: 'orchestrator',
          task: 'retrieve-context',
          inputDomain: fullKey,
          inputTags: [],
          outputDomain: '',
          outputTags: [],
        };

        const result = this.memoryCoordinator.retrievePreviousOutput(
          step,
          'coding-pipeline' // Use generic pipeline ID for retrieval
        );

        if (result.output !== undefined) {
          context[key] = result.output;
        }
      } catch {
        // Ignore retrieval errors - key may not exist yet
      }
    }

    return context;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DYNAMIC CONFIG LOADER METHODS [REQ-PIPE-047]
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get agents for a phase from the dynamic loader.
   * Converts CodingAgentConfig to IAgentMapping for orchestrator compatibility.
   */
  private async getAgentsForPhaseFromLoader(phase: CodingPipelinePhase): Promise<IAgentMapping[]> {
    const allMappings = await this.configLoader.getAgentMappings();
    return allMappings.filter(m => m.phase === phase);
  }

  /**
   * Get agent markdown content from loaded config.
   * Falls back to file read if not in cache.
   */
  private async getAgentMarkdownFromLoader(agentKey: string): Promise<string> {
    const agent = await this.configLoader.getAgentByKey(agentKey);
    return agent?.fullContent ?? '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load agent markdown file if it exists
   */
  private loadAgentMarkdown(agentKey: CodingPipelineAgent): string {
    const mdPath = join(process.cwd(), this.config.agentMdPath, `${agentKey}.md`);

    if (existsSync(mdPath)) {
      try {
        return readFileSync(mdPath, 'utf-8');
      } catch {
        return '';
      }
    }

    return '';
  }

  /**
   * Check if agent is critical (halts pipeline on failure)
   */
  private isCriticalAgent(agentKey: CodingPipelineAgent): boolean {
    return CRITICAL_AGENTS.includes(agentKey);
  }

  /**
   * Log message if verbose mode enabled
   */
  private log(message: string): void {
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
  getTotalXP(): number {
    return this.totalXP;
  }

  /**
   * Get all execution results
   */
  getExecutionResults(): Map<CodingPipelineAgent, IAgentExecutionResult> {
    return new Map(this.executionResults);
  }

  /**
   * Get all checkpoints
   */
  getCheckpoints(): Map<CodingPipelinePhase, ICheckpoint> {
    return new Map(this.checkpoints);
  }

  /**
   * Get the DAG
   */
  getDAG(): IPipelineDAG {
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
export function createOrchestrator(
  dependencies: IOrchestratorDependencies,
  config?: Partial<IOrchestratorConfig>
): CodingPipelineOrchestrator {
  return new CodingPipelineOrchestrator(dependencies, config);
}

/**
 * Execute a coding pipeline with dependency injection.
 *
 * @param pipelineConfig - Pipeline configuration from prepareCodeTask()
 * @param dependencies - Required services for LEANN/RLM/Learning integration
 * @param orchestratorConfig - Optional orchestrator configuration
 */
export async function executePipeline(
  pipelineConfig: IPipelineExecutionConfig,
  dependencies: IOrchestratorDependencies,
  orchestratorConfig?: Partial<IOrchestratorConfig>
): Promise<IPipelineExecutionResult> {
  const orchestrator = createOrchestrator(dependencies, orchestratorConfig);
  return orchestrator.execute(pipelineConfig);
}
