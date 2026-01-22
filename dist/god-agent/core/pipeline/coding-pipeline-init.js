/**
 * Coding Pipeline Initialization
 *
 * Extracted initialization logic for the coding pipeline orchestrator.
 * Handles agent counting, validation building, and initial setup.
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-init
 * @see coding-pipeline-orchestrator.ts
 */
// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Generate unique pipeline and trajectory IDs.
 *
 * @returns Object with pipelineId and trajectoryId
 */
export function generatePipelineIds() {
    const pipelineId = `coding-${Date.now()}`;
    const trajectoryId = `trajectory_pipeline_${pipelineId}`;
    return { pipelineId, trajectoryId };
}
/**
 * Count total agents and build flattened agent list for validation.
 *
 * @param pipelineConfig - Pipeline execution configuration
 * @returns Object with totalAgentCount and allAgents array
 */
export function countAndFlattenAgents(pipelineConfig) {
    let totalAgentCount = 0;
    const allAgents = [];
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
    return { totalAgentCount, allAgents };
}
/**
 * Build validation pipeline definition from agents list.
 *
 * @param allAgents - Flattened list of all agents
 * @returns Validation pipeline definition
 */
export function buildValidationPipeline(allAgents) {
    return {
        name: 'coding-pipeline',
        description: '40-agent coding pipeline',
        agents: allAgents,
        sequential: true,
    };
}
/**
 * Run pipeline validation (non-fatal for coding pipeline).
 *
 * @param validator - PipelineValidator instance
 * @param validationPipeline - Pipeline definition to validate
 * @param log - Logging function
 * @returns Object with passed status and optional warning
 */
export function runPipelineValidation(validator, validationPipeline, log) {
    try {
        validator.validate(validationPipeline);
        log('Pipeline validation passed');
        return { passed: true };
    }
    catch (validationError) {
        const errorMsg = validationError instanceof Error
            ? validationError.message
            : String(validationError);
        log(`Pipeline validation warning: ${errorMsg}`);
        // Continue execution - validation warnings are non-fatal for coding pipeline
        return { passed: true, warning: errorMsg };
    }
}
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
export function initializePipelineExecution(pipelineConfig, validator, log) {
    // Generate unique IDs
    const { pipelineId, trajectoryId } = generatePipelineIds();
    log(`Starting pipeline execution with ${pipelineConfig.phases.length} phases`);
    // Count agents and build flattened list
    const { totalAgentCount, allAgents } = countAndFlattenAgents(pipelineConfig);
    // Build validation pipeline
    const validationPipeline = buildValidationPipeline(allAgents);
    // Run validation
    const validationResult = runPipelineValidation(validator, validationPipeline, log);
    return {
        pipelineId,
        trajectoryId,
        totalAgentCount,
        allAgents,
        validationPipeline,
        validationPassed: validationResult.passed,
        validationWarning: validationResult.warning,
    };
}
//# sourceMappingURL=coding-pipeline-init.js.map