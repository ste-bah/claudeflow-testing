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
import { PipelineDefinitionError, createMissingFieldError, createInvalidAgentError, } from './pipeline-errors.js';
// ==================== Pipeline Validator ====================
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
export class PipelineValidator {
    agentRegistry;
    /**
     * Create a new pipeline validator
     * @param agentRegistry - Registry to validate agent keys against
     */
    constructor(agentRegistry) {
        this.agentRegistry = agentRegistry;
    }
    /**
     * Validate a pipeline definition.
     * Throws PipelineDefinitionError if invalid.
     *
     * @param pipeline - Pipeline definition to validate
     * @throws PipelineDefinitionError if pipeline is invalid
     */
    validate(pipeline) {
        // 1. Validate pipeline name
        this.validatePipelineName(pipeline);
        // 2. Validate agents array exists and is non-empty
        this.validateAgentsArray(pipeline);
        // 3. Validate sequential is true (RULE-004)
        this.validateSequential(pipeline);
        // 4. Validate each step
        pipeline.agents.forEach((step, index) => {
            this.validateStep(step, index, pipeline.name);
        });
        // 5. Validate agent key chain makes sense (input domain matches previous output)
        this.validateDomainChain(pipeline);
    }
    /**
     * Validate without throwing - returns result object
     * @param pipeline - Pipeline definition to validate
     * @returns Validation result with valid flag and optional error
     */
    tryValidate(pipeline) {
        try {
            this.validate(pipeline);
            return { valid: true };
        }
        catch (error) {
            if (error instanceof PipelineDefinitionError) {
                return { valid: false, error };
            }
            // Wrap unexpected errors
            return {
                valid: false,
                error: new PipelineDefinitionError(`Unexpected validation error: ${error.message}`, { pipelineName: pipeline?.name, details: error }),
            };
        }
    }
    /**
     * Validate pipeline name is present and non-empty
     */
    validatePipelineName(pipeline) {
        if (!pipeline.name?.trim()) {
            throw createMissingFieldError(pipeline.name || '<unnamed>', 'name');
        }
    }
    /**
     * Validate agents array exists and is non-empty
     */
    validateAgentsArray(pipeline) {
        if (!Array.isArray(pipeline.agents)) {
            throw new PipelineDefinitionError('Pipeline agents must be an array', { pipelineName: pipeline.name, invalidField: 'agents' });
        }
        if (pipeline.agents.length === 0) {
            throw new PipelineDefinitionError('Pipeline must have at least one agent', { pipelineName: pipeline.name, invalidField: 'agents' });
        }
    }
    /**
     * Validate sequential is true (RULE-004)
     */
    validateSequential(pipeline) {
        if (pipeline.sequential !== true) {
            throw new PipelineDefinitionError('Pipeline sequential must be true (RULE-004: 99.9% sequential execution required)', {
                pipelineName: pipeline.name,
                invalidField: 'sequential',
                details: {
                    received: pipeline.sequential,
                    expected: true,
                    rule: 'RULE-004: Multi-agent pipelines MUST execute agents SYNCHRONOUSLY and SEQUENTIALLY',
                },
            });
        }
    }
    /**
     * Validate a single pipeline step
     */
    validateStep(step, index, pipelineName) {
        // Must have agentKey OR taskDescription (at least one)
        this.validateStepAgentIdentifier(step, index, pipelineName);
        // If agentKey provided, verify it exists in registry
        if (step.agentKey) {
            this.validateAgentKeyExists(step.agentKey, index, pipelineName);
        }
        // Must have task (non-empty string)
        this.validateStepTask(step, index, pipelineName);
        // Must have outputDomain (non-empty string)
        this.validateStepOutputDomain(step, index, pipelineName);
        // Must have outputTags (non-empty array)
        this.validateStepOutputTags(step, index, pipelineName);
        // Optional: validate minQuality is in range if provided
        this.validateStepMinQuality(step, index, pipelineName);
        // Optional: validate timeout is positive if provided
        this.validateStepTimeout(step, index, pipelineName);
    }
    /**
     * Validate step has agent identifier (agentKey or taskDescription)
     */
    validateStepAgentIdentifier(step, index, pipelineName) {
        if (!step.agentKey && !step.taskDescription) {
            throw createInvalidAgentError(pipelineName, index, 'Must specify agentKey or taskDescription for agent identification');
        }
        // If both provided, that's OK - agentKey takes precedence (explicit wins)
    }
    /**
     * Validate agent key exists in registry
     */
    validateAgentKeyExists(agentKey, index, pipelineName) {
        if (!this.agentRegistry.has(agentKey)) {
            throw createInvalidAgentError(pipelineName, index, `Agent '${agentKey}' not found in registry. ` +
                `Available agents can be listed via AgentRegistry.getAll()`);
        }
    }
    /**
     * Validate step task is present and non-empty
     */
    validateStepTask(step, index, pipelineName) {
        if (!step.task?.trim()) {
            throw createInvalidAgentError(pipelineName, index, 'Task is required (non-empty string describing what agent should do)');
        }
    }
    /**
     * Validate step outputDomain is present and non-empty
     */
    validateStepOutputDomain(step, index, pipelineName) {
        if (!step.outputDomain?.trim()) {
            throw createInvalidAgentError(pipelineName, index, 'outputDomain is required (domain to store agent output, e.g., "project/api")');
        }
    }
    /**
     * Validate step outputTags is present and non-empty array
     */
    validateStepOutputTags(step, index, pipelineName) {
        if (!Array.isArray(step.outputTags) || step.outputTags.length === 0) {
            throw createInvalidAgentError(pipelineName, index, 'outputTags must be a non-empty array of strings (tags for storing output)');
        }
        // Validate all tags are non-empty strings
        for (let i = 0; i < step.outputTags.length; i++) {
            const tag = step.outputTags[i];
            if (typeof tag !== 'string' || !tag.trim()) {
                throw createInvalidAgentError(pipelineName, index, `outputTags[${i}] must be a non-empty string`);
            }
        }
    }
    /**
     * Validate step minQuality is valid if provided
     */
    validateStepMinQuality(step, index, pipelineName) {
        if (step.minQuality !== undefined) {
            if (typeof step.minQuality !== 'number') {
                throw createInvalidAgentError(pipelineName, index, `minQuality must be a number (received ${typeof step.minQuality})`);
            }
            if (step.minQuality < 0 || step.minQuality > 1) {
                throw createInvalidAgentError(pipelineName, index, `minQuality must be between 0 and 1 (received ${step.minQuality})`);
            }
        }
    }
    /**
     * Validate step timeout is valid if provided
     */
    validateStepTimeout(step, index, pipelineName) {
        if (step.timeout !== undefined) {
            if (typeof step.timeout !== 'number') {
                throw createInvalidAgentError(pipelineName, index, `timeout must be a number (received ${typeof step.timeout})`);
            }
            if (step.timeout <= 0) {
                throw createInvalidAgentError(pipelineName, index, `timeout must be positive (received ${step.timeout})`);
            }
        }
    }
    /**
     * Validate domain chain - warn if inputDomain doesn't match previous outputDomain
     * This is a soft validation (warning) not a hard error
     */
    validateDomainChain(pipeline) {
        for (let i = 1; i < pipeline.agents.length; i++) {
            const currentStep = pipeline.agents[i];
            const previousStep = pipeline.agents[i - 1];
            // If current step has inputDomain, it should match previous outputDomain
            // This is informational - not a hard error since domains can be flexible
            if (currentStep.inputDomain &&
                currentStep.inputDomain !== previousStep.outputDomain) {
                // Log a warning but don't throw - user might have valid reason
                console.warn(`[PipelineValidator] Step ${i}: inputDomain '${currentStep.inputDomain}' ` +
                    `differs from previous step's outputDomain '${previousStep.outputDomain}'. ` +
                    `Ensure memory coordination is intentional.`);
            }
        }
    }
    /**
     * Validate multiple pipeline definitions
     * Stops at first invalid pipeline
     *
     * @param pipelines - Array of pipeline definitions
     * @returns Names of valid pipelines (up to first invalid)
     * @throws PipelineDefinitionError for first invalid pipeline
     */
    validateMultiple(pipelines) {
        const validNames = [];
        for (const pipeline of pipelines) {
            this.validate(pipeline);
            validNames.push(pipeline.name);
        }
        return validNames;
    }
    /**
     * Check if a single agent key is valid
     * @param agentKey - Agent key to check
     * @returns true if agent exists
     */
    isValidAgentKey(agentKey) {
        return this.agentRegistry.has(agentKey);
    }
    /**
     * Get list of valid agent keys that match a pattern
     * Useful for suggesting corrections
     *
     * @param pattern - Pattern to search for (substring)
     * @returns Array of matching agent keys
     */
    findSimilarAgentKeys(pattern) {
        const all = this.agentRegistry.getAll();
        const lower = pattern.toLowerCase();
        return all
            .filter(agent => agent.key.toLowerCase().includes(lower))
            .map(agent => agent.key);
    }
}
// ==================== Factory Function ====================
/**
 * Create a PipelineValidator with a given agent registry
 * @param agentRegistry - Initialized agent registry
 * @returns PipelineValidator instance
 */
export function createPipelineValidator(agentRegistry) {
    return new PipelineValidator(agentRegistry);
}
//# sourceMappingURL=pipeline-validator.js.map