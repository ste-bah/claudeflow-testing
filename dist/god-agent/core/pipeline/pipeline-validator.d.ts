/**
 * DAI-002: Pipeline Validator
 * TASK-002: Validates pipeline definitions before execution
 *
 * RULE-003: Fail Fast with Robust Error Logging
 * - Validates immediately on creation, throws detailed errors
 * - All validation failures include exactly what's wrong and how to fix it
 *
 * RULE-004: Synchronous Sequential Execution
 * - Enforces sequential: true (rejects false)
 *
 * RULE-006: DAI-001 Integration Required
 * - Validates agent keys exist in AgentRegistry when explicit agentKey provided
 * - Accepts taskDescription for dynamic DAI-001 selection
 */
import type { AgentRegistry } from '../agents/agent-registry.js';
import type { IPipelineDefinition, IPipelineStep } from './dai-002-types.js';
import { PipelineDefinitionError } from './pipeline-errors.js';
/**
 * Result of a validation check
 */
export interface IValidationResult {
    /** Whether validation passed */
    valid: boolean;
    /** Error if validation failed */
    error?: PipelineDefinitionError;
}
/**
 * Validates pipeline definitions before execution.
 * Ensures all required fields are present and valid.
 * Verifies agent keys exist in AgentRegistry.
 *
 * @example
 * ```typescript
 * const validator = new PipelineValidator(agentRegistry);
 * validator.validate(pipeline); // throws PipelineDefinitionError if invalid
 * ```
 */
export declare class PipelineValidator {
    private readonly agentRegistry;
    /**
     * Create a new pipeline validator
     * @param agentRegistry - Registry to validate agent keys against
     */
    constructor(agentRegistry: AgentRegistry);
    /**
     * Validate a pipeline definition.
     * Throws PipelineDefinitionError if invalid.
     *
     * @param pipeline - Pipeline definition to validate
     * @throws PipelineDefinitionError if pipeline is invalid
     */
    validate(pipeline: IPipelineDefinition): void;
    /**
     * Validate without throwing - returns result object
     * @param pipeline - Pipeline definition to validate
     * @returns Validation result with valid flag and optional error
     */
    tryValidate(pipeline: IPipelineDefinition): IValidationResult;
    /**
     * Validate pipeline name is present and non-empty
     */
    private validatePipelineName;
    /**
     * Validate agents array exists and is non-empty
     */
    private validateAgentsArray;
    /**
     * Validate sequential is true (RULE-004)
     */
    private validateSequential;
    /**
     * Validate a single pipeline step
     */
    validateStep(step: IPipelineStep, index: number, pipelineName: string): void;
    /**
     * Validate step has agent identifier (agentKey or taskDescription)
     */
    private validateStepAgentIdentifier;
    /**
     * Validate agent key exists in registry
     */
    private validateAgentKeyExists;
    /**
     * Validate step task is present and non-empty
     */
    private validateStepTask;
    /**
     * Validate step outputDomain is present and non-empty
     */
    private validateStepOutputDomain;
    /**
     * Validate step outputTags is present and non-empty array
     */
    private validateStepOutputTags;
    /**
     * Validate step minQuality is valid if provided
     */
    private validateStepMinQuality;
    /**
     * Validate step timeout is valid if provided
     */
    private validateStepTimeout;
    /**
     * Validate domain chain - warn if inputDomain doesn't match previous outputDomain
     * This is a soft validation (warning) not a hard error
     */
    private validateDomainChain;
    /**
     * Validate multiple pipeline definitions
     * Stops at first invalid pipeline
     *
     * @param pipelines - Array of pipeline definitions
     * @returns Names of valid pipelines (up to first invalid)
     * @throws PipelineDefinitionError for first invalid pipeline
     */
    validateMultiple(pipelines: IPipelineDefinition[]): string[];
    /**
     * Check if a single agent key is valid
     * @param agentKey - Agent key to check
     * @returns true if agent exists
     */
    isValidAgentKey(agentKey: string): boolean;
    /**
     * Get list of valid agent keys that match a pattern
     * Useful for suggesting corrections
     *
     * @param pattern - Pattern to search for (substring)
     * @returns Array of matching agent keys
     */
    findSimilarAgentKeys(pattern: string): string[];
}
/**
 * Create a PipelineValidator with a given agent registry
 * @param agentRegistry - Initialized agent registry
 * @returns PipelineValidator instance
 */
export declare function createPipelineValidator(agentRegistry: AgentRegistry): PipelineValidator;
//# sourceMappingURL=pipeline-validator.d.ts.map