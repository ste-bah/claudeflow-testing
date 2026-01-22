/**
 * Coding Pipeline Initialization
 *
 * Extracted initialization logic for the coding pipeline orchestrator.
 * Handles agent counting, validation building, and initial setup.
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-init
 * @see coding-pipeline-orchestrator.ts
 */
import type { PipelineValidator } from './pipeline-validator.js';
import type { IPipelineExecutionConfig } from './types.js';
/**
 * Result of pipeline initialization
 */
export interface IPipelineInitResult {
    /** Unique pipeline execution ID */
    pipelineId: string;
    /** Trajectory ID for learning/feedback */
    trajectoryId: string;
    /** Total number of agents across all phases */
    totalAgentCount: number;
    /** All agents flattened for validation */
    allAgents: IAgentValidationEntry[];
    /** Validation pipeline definition */
    validationPipeline: IValidationPipelineDefinition;
    /** Whether validation passed (warnings are non-fatal) */
    validationPassed: boolean;
    /** Validation warning message if any */
    validationWarning?: string;
}
/**
 * Agent entry for validation
 */
export interface IAgentValidationEntry {
    agentKey: string;
    task: string;
    inputDomain: string;
    inputTags: string[];
    outputDomain: string;
    outputTags: string[];
}
/**
 * Pipeline definition for validation
 */
export interface IValidationPipelineDefinition {
    name: string;
    description: string;
    agents: IAgentValidationEntry[];
    sequential: boolean;
}
/**
 * Generate unique pipeline and trajectory IDs.
 *
 * @returns Object with pipelineId and trajectoryId
 */
export declare function generatePipelineIds(): {
    pipelineId: string;
    trajectoryId: string;
};
/**
 * Count total agents and build flattened agent list for validation.
 *
 * @param pipelineConfig - Pipeline execution configuration
 * @returns Object with totalAgentCount and allAgents array
 */
export declare function countAndFlattenAgents(pipelineConfig: IPipelineExecutionConfig): {
    totalAgentCount: number;
    allAgents: IAgentValidationEntry[];
};
/**
 * Build validation pipeline definition from agents list.
 *
 * @param allAgents - Flattened list of all agents
 * @returns Validation pipeline definition
 */
export declare function buildValidationPipeline(allAgents: IAgentValidationEntry[]): IValidationPipelineDefinition;
/**
 * Run pipeline validation (non-fatal for coding pipeline).
 *
 * @param validator - PipelineValidator instance
 * @param validationPipeline - Pipeline definition to validate
 * @param log - Logging function
 * @returns Object with passed status and optional warning
 */
export declare function runPipelineValidation(validator: PipelineValidator, validationPipeline: IValidationPipelineDefinition, log: (msg: string) => void): {
    passed: boolean;
    warning?: string;
};
/**
 * Initialize pipeline execution - generates IDs, counts agents, validates.
 *
 * This is the main entry point that combines all initialization steps.
 *
 * @param pipelineConfig - Pipeline execution configuration
 * @param validator - PipelineValidator instance
 * @param log - Logging function
 * @returns Complete initialization result
 */
export declare function initializePipelineExecution(pipelineConfig: IPipelineExecutionConfig, validator: PipelineValidator, log: (msg: string) => void): IPipelineInitResult;
//# sourceMappingURL=coding-pipeline-init.d.ts.map