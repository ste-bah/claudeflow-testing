/**
 * Coding Pipeline Types
 *
 * Extracted from coding-pipeline-orchestrator.ts for CON-002 compliance
 * (Single Responsibility Principle - interfaces in dedicated type file)
 *
 * Contains shared interface definitions used across the coding pipeline modules
 * to break circular dependencies and improve maintainability.
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-types
 * @see TASK-ORCH-004-pipeline-orchestration.md
 * @see SPEC-001-architecture.md
 */

import type { AgentRegistry } from '../agents/agent-registry.js';
import type { AgentSelector } from '../agents/agent-selector.js';
import type { InteractionStore } from '../../universal/interaction-store.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
import type { SonaEngine } from '../learning/sona-engine.js';
import type { LeannContextService } from './leann-context-service.js';
import type { IEmbeddingProvider } from '../memory/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// STEP EXECUTOR INTERFACE
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

// ═══════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR DEPENDENCIES INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

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
  embeddingProvider?: IEmbeddingProvider;
}

// ═══════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR CONFIGURATION INTERFACE
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

  /** Step executor function for agent execution (required for production) */
  stepExecutor?: IStepExecutor;

  /** Enable learning feedback to SonaEngine/ReasoningBank */
  enableLearning: boolean;
}
