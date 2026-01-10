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

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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

import {
  CODING_PIPELINE_MAPPINGS,
  getAgentsForPhase,
  buildPipelineDAG,
} from './command-task-bridge.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

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

  constructor(config: Partial<IOrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.dag = buildPipelineDAG();
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

    this.log(`Starting pipeline execution with ${pipelineConfig.phases.length} phases`);

    // Initialize pipeline state in memory
    await this.storeMemory('pipeline/state', {
      status: 'running',
      startTime: new Date().toISOString(),
      phases: pipelineConfig.phases,
      currentPhase: 0,
    });

    try {
      for (const phase of pipelineConfig.phases) {
        this.log(`Executing phase: ${phase}`);

        // Update current phase in memory
        await this.storeMemory('pipeline/state', {
          currentPhase: PHASE_ORDER.indexOf(phase) + 1,
          currentPhaseName: phase,
        });

        // Execute the phase
        const phaseResult = await this.executePhase(phase, pipelineConfig);
        phaseResults.push(phaseResult);

        if (phaseResult.success) {
          completedPhases.push(phase);
          this.totalXP += phaseResult.totalXP;

          // Store phase XP
          await this.storeMemory(`xp/phase-${PHASE_ORDER.indexOf(phase) + 1}`, {
            phase,
            xp: phaseResult.totalXP,
            timestamp: new Date().toISOString(),
          });
        } else {
          failedPhase = phase;
          this.log(`Phase ${phase} failed, checking for rollback...`);

          // Attempt rollback if checkpoints enabled
          if (this.config.enableCheckpoints && this.checkpoints.size > 0) {
            const rolledBack = await this.rollbackToLastCheckpoint();
            rollbackApplied = rolledBack;
          }

          break;
        }
      }
    } catch (error) {
      this.log(`Pipeline execution error: ${error}`);
      failedPhase = pipelineConfig.phases[completedPhases.length];
    }

    const executionTimeMs = Date.now() - startTime;

    // Store final XP
    await this.storeMemory('xp/total', {
      xp: this.totalXP,
      timestamp: new Date().toISOString(),
    });

    // Update final pipeline state
    await this.storeMemory('pipeline/state', {
      status: failedPhase ? 'failed' : 'completed',
      endTime: new Date().toISOString(),
      executionTimeMs,
      totalXP: this.totalXP,
      completedPhases,
      failedPhase,
      rollbackApplied,
    });

    return {
      success: !failedPhase,
      phaseResults,
      totalXP: this.totalXP,
      executionTimeMs,
      completedPhases,
      failedPhase,
      rollbackApplied,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE EXECUTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Execute a single phase of the pipeline
   */
  private async executePhase(
    phase: CodingPipelinePhase,
    config: IPipelineExecutionConfig
  ): Promise<IPhaseExecutionResult> {
    const startTime = Date.now();
    const agentResults: IAgentExecutionResult[] = [];
    let phaseXP = 0;
    let checkpointCreated = false;

    // Get agents for this phase
    const phaseAgents = config.agentsByPhase.get(phase) ?? getAgentsForPhase(phase);

    // Resolve execution order within phase (respecting dependencies)
    const executionOrder = this.resolveExecutionOrder(phaseAgents);

    this.log(`Phase ${phase}: ${executionOrder.length} agents to execute`);

    // Create checkpoint before phase if configured
    if (this.config.enableCheckpoints && CHECKPOINT_PHASES.includes(phase)) {
      await this.createCheckpoint(phase);
      checkpointCreated = true;
    }

    // Execute agents in batches (parallelizable agents can run together)
    const batches = this.batchAgentsForExecution(executionOrder);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(agent => this.executeAgent(agent, phase))
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
  // AGENT EXECUTION WITH CLAUDEFLOW INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Execute a single agent using ClaudeFlow subagent spawning
   */
  private async executeAgent(
    agentMapping: IAgentMapping,
    phase: CodingPipelinePhase
  ): Promise<IAgentExecutionResult> {
    const startTime = Date.now();
    const { agentKey, algorithm, memoryReads, memoryWrites, xpReward } = agentMapping;

    this.log(`Executing agent: ${agentKey} (algorithm: ${algorithm})`);

    try {
      // Retrieve memory context for this agent
      const memoryContext = await this.retrieveMemoryContext(memoryReads);

      // Load agent markdown if exists
      const agentMd = this.loadAgentMarkdown(agentKey);

      // Execute via ClaudeFlow subagent
      const result = await this.runAgentWithClaudeFlow(
        agentKey,
        agentMd,
        memoryContext,
        algorithm,
        phase
      );

      // Store agent outputs to memory
      for (const writeKey of memoryWrites) {
        await this.storeMemory(writeKey, {
          agent: agentKey,
          output: result.output,
          timestamp: new Date().toISOString(),
        });
      }

      const executionTimeMs = Date.now() - startTime;

      const agentResult: IAgentExecutionResult = {
        agentKey,
        success: true,
        output: result.output,
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
   * Execute agent using ClaudeFlow Task tool subprocess
   *
   * This replaces the mock implementation with actual ClaudeFlow integration.
   * Uses npx claude-flow task_orchestrate for subagent execution.
   */
  private async runAgentWithClaudeFlow(
    agentKey: CodingPipelineAgent,
    agentMd: string,
    memoryContext: Record<string, unknown>,
    algorithm: string,
    phase: CodingPipelinePhase
  ): Promise<{ output: unknown }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Agent ${agentKey} timed out after ${this.config.agentTimeoutMs}ms`));
      }, this.config.agentTimeoutMs);

      // Build the ClaudeFlow task prompt with 4-part context
      const taskPrompt = this.buildClaudeFlowPrompt(
        agentKey,
        agentMd,
        memoryContext,
        algorithm,
        phase
      );

      // Spawn ClaudeFlow task_orchestrate subprocess
      const child = spawn('npx', [
        'claude-flow@alpha',
        'task',
        'orchestrate',
        '--task', taskPrompt,
        '--strategy', 'sequential',
        '--priority', 'high',
      ], {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);

        if (code === 0) {
          // Parse output - try JSON first, fallback to raw
          let output: unknown;
          try {
            output = JSON.parse(stdout);
          } catch {
            output = {
              agent: agentKey,
              algorithm,
              phase,
              rawOutput: stdout.trim(),
              memoryContext: Object.keys(memoryContext),
              completedAt: new Date().toISOString(),
            };
          }

          resolve({ output });
        } else {
          reject(new Error(`Agent ${agentKey} exited with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn agent ${agentKey}: ${err.message}`));
      });
    });
  }

  /**
   * Build ClaudeFlow prompt with mandatory 4-part context
   */
  private buildClaudeFlowPrompt(
    agentKey: CodingPipelineAgent,
    agentMd: string,
    memoryContext: Record<string, unknown>,
    algorithm: string,
    phase: CodingPipelinePhase
  ): string {
    const phaseIndex = PHASE_ORDER.indexOf(phase) + 1;
    const agentMapping = CODING_PIPELINE_MAPPINGS.find(a => a.agentKey === agentKey);
    const dependsOn = agentMapping?.dependsOn ?? [];
    const memoryWrites = agentMapping?.memoryWrites ?? [];

    return `
## YOUR TASK
Execute coding pipeline agent: ${agentKey}
Algorithm: ${algorithm}
${agentMd ? `\nAgent Instructions:\n${agentMd}` : ''}

## WORKFLOW CONTEXT
Phase ${phaseIndex}/7 (${phase}) | Agent: ${agentKey}
Previous agents completed: ${dependsOn.length > 0 ? dependsOn.join(', ') : 'None (first in phase)'}
Memory context keys: ${Object.keys(memoryContext).join(', ') || 'None'}

## MEMORY RETRIEVAL
Retrieved from previous agents:
${JSON.stringify(memoryContext, null, 2)}

## MEMORY STORAGE (For Next Agents)
Store results to these keys:
${memoryWrites.map((key, i) => `${i + 1}. ${key}`).join('\n')}

## SUCCESS CRITERIA
- Complete the agent's designated task
- Store outputs to designated memory keys
- Return structured result with completedAt timestamp
`.trim();
  }

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
  private async createCheckpoint(phase: CodingPipelinePhase): Promise<void> {
    this.log(`Creating checkpoint for phase: ${phase}`);

    // Retrieve current memory state
    const memorySnapshot = await this.retrieveMemoryContext([
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
    await this.storeMemory(`pipeline/checkpoints/${phase}`, checkpoint);
  }

  /**
   * Rollback to the last successful checkpoint
   */
  private async rollbackToLastCheckpoint(): Promise<boolean> {
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
      await this.storeMemory(key, value);
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
  // MEMORY COORDINATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Store value in ClaudeFlow memory
   */
  private async storeMemory(key: string, value: unknown): Promise<void> {
    const fullKey = key.startsWith(this.config.memoryNamespace)
      ? key
      : `${this.config.memoryNamespace}/${key}`;

    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn('npx', [
          'claude-flow',
          'memory',
          'store',
          fullKey,
          JSON.stringify(value),
          '--namespace', this.config.memoryNamespace,
        ], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Memory store failed with code ${code}`));
        });

        child.on('error', reject);
      });
    } catch (error) {
      this.log(`Warning: Failed to store memory ${fullKey}: ${error}`);
    }
  }

  /**
   * Retrieve memory context for agent execution
   */
  private async retrieveMemoryContext(keys: string[]): Promise<Record<string, unknown>> {
    const context: Record<string, unknown> = {};

    for (const key of keys) {
      const fullKey = key.startsWith(this.config.memoryNamespace)
        ? key
        : `${this.config.memoryNamespace}/${key}`;

      try {
        const result = await new Promise<string>((resolve, reject) => {
          const child = spawn('npx', [
            'claude-flow',
            'memory',
            'retrieve',
            '--key', fullKey,
          ], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          let stdout = '';
          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          child.on('close', (code) => {
            if (code === 0) resolve(stdout.trim());
            else resolve(''); // Key not found is OK
          });

          child.on('error', () => resolve(''));
        });

        if (result) {
          try {
            context[key] = JSON.parse(result);
          } catch {
            context[key] = result;
          }
        }
      } catch {
        // Ignore retrieval errors - key may not exist yet
      }
    }

    return context;
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
 * Create a new CodingPipelineOrchestrator instance
 */
export function createOrchestrator(
  config: Partial<IOrchestratorConfig> = {}
): CodingPipelineOrchestrator {
  return new CodingPipelineOrchestrator(config);
}

/**
 * Execute a coding pipeline with default configuration
 */
export async function executePipeline(
  pipelineConfig: IPipelineExecutionConfig,
  orchestratorConfig: Partial<IOrchestratorConfig> = {}
): Promise<IPipelineExecutionResult> {
  const orchestrator = createOrchestrator(orchestratorConfig);
  return orchestrator.execute(pipelineConfig);
}
