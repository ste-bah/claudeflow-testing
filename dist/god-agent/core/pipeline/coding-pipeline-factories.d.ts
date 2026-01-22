/**
 * Coding Pipeline Factory Functions
 *
 * Extracted factory and helper functions for the coding pipeline orchestrator.
 * Contains IntegratedValidator creation and helper methods.
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-factories
 * @see coding-pipeline-orchestrator.ts
 */
import type { PipelineMemoryCoordinator } from './pipeline-memory-coordinator.js';
import type { IntegratedValidator, IIntegratedValidationResult } from './sherlock-quality-gate-integration.js';
import type { SonaEngine } from '../learning/sona-engine.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
import type { CodingPipelineAgent, CodingPipelinePhase } from './types.js';
import type { IPhaseExecutionResult } from './types.js';
/**
 * Configuration for IntegratedValidator creation.
 */
export interface IIntegratedValidatorFactoryConfig {
    /** Memory coordinator for storage/retrieval */
    memoryCoordinator: PipelineMemoryCoordinator;
    /** Memory namespace for storage */
    memoryNamespace: string;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Enable learning integration */
    enableLearning?: boolean;
    /** SONA engine for learning (optional) */
    sonaEngine?: SonaEngine | null;
    /** ReasoningBank for learning (optional) */
    reasoningBank?: ReasoningBank | null;
    /** Logging function */
    log: (msg: string) => void;
}
/**
 * Dependencies for Sherlock validation wrapper.
 */
export interface ISherlockWrapperDependencies {
    /** IntegratedValidator instance */
    integratedValidator: IntegratedValidator | null;
    /** Memory coordinator for storage */
    memoryCoordinator: PipelineMemoryCoordinator;
    /** Memory namespace */
    memoryNamespace: string;
    /** Verbose logging */
    verbose?: boolean;
    /** Logging function */
    log: (msg: string) => void;
}
/**
 * Create an IntegratedValidator instance for Sherlock-Quality Gate integration.
 *
 * Per PRD Section 2.3: Connects forensic verdicts to learning system (RLM/LEANN).
 * This factory handles the complex configuration required for the IntegratedValidator.
 *
 * @param config - Factory configuration
 * @returns IntegratedValidator instance or null if creation fails
 */
export declare function createPipelineIntegratedValidator(config: IIntegratedValidatorFactoryConfig): IntegratedValidator | null;
/**
 * Validate phase completion with Sherlock-Quality Gate integration.
 *
 * Adds memory storage and observability emissions on top of the base
 * validatePhaseWithSherlock function from coding-pipeline-sherlock-validator.
 *
 * @param deps - Wrapper dependencies
 * @param phase - The phase that just completed
 * @param phaseResult - The execution result from the phase
 * @param retryCount - Number of times this phase has been retried
 * @returns Validation result with verdict and remediation actions
 */
export declare function validatePhaseWithSherlockAndStore(deps: ISherlockWrapperDependencies, phase: CodingPipelinePhase, phaseResult: IPhaseExecutionResult, retryCount?: number): Promise<IIntegratedValidationResult | null>;
/**
 * Handle Sherlock GUILTY verdict with remediation loop and memory storage.
 *
 * Adds memory storage on top of the base handleSherlockGuiltyVerdict function.
 *
 * @param deps - Wrapper dependencies
 * @param validationResult - The validation result from Sherlock
 * @param phase - The phase that failed validation
 * @returns Remediation actions to take
 */
export declare function handleSherlockGuiltyVerdictAndStore(deps: ISherlockWrapperDependencies, validationResult: IIntegratedValidationResult, phase: CodingPipelinePhase): string[];
/**
 * Load agent markdown file if it exists.
 *
 * @param agentKey - Agent key to load
 * @param agentMdPath - Path to agent markdown files
 * @returns Markdown content or empty string
 */
export declare function loadAgentMarkdown(agentKey: CodingPipelineAgent, agentMdPath: string): string;
/**
 * Check if agent is critical (halts pipeline on failure).
 *
 * @param agentKey - Agent key to check
 * @returns Whether agent is in CRITICAL_AGENTS list
 */
export declare function isCriticalAgent(agentKey: CodingPipelineAgent): boolean;
//# sourceMappingURL=coding-pipeline-factories.d.ts.map