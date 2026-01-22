/**
 * Coding Pipeline Finalization
 *
 * Extracted finalization logic for the coding pipeline orchestrator.
 * Handles learning feedback, XP aggregation, and result building.
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-finalize
 * @see coding-pipeline-orchestrator.ts
 */
// ═══════════════════════════════════════════════════════════════════════════
// FINALIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Calculate execution time from start time.
 *
 * @param startTime - Pipeline start time (Date.now())
 * @returns Execution time in milliseconds
 */
export function calculateExecutionTime(startTime) {
    return Date.now() - startTime;
}
/**
 * Calculate overall pipeline quality from phase results.
 *
 * Quality is the ratio of successful agents to total agents.
 *
 * @param phaseResults - Results from all executed phases
 * @returns Quality score between 0 and 1
 */
export function calculatePipelineQuality(phaseResults) {
    if (phaseResults.length === 0)
        return 0;
    const totalAgents = phaseResults.reduce((sum, p) => sum + p.agentResults.length, 0);
    const successfulAgents = phaseResults.reduce((sum, p) => sum + p.agentResults.filter(a => a.success).length, 0);
    return totalAgents > 0 ? successfulAgents / totalAgents : 0;
}
/**
 * Build final pipeline state for memory storage.
 *
 * @param input - Finalization input data
 * @param executionTimeMs - Calculated execution time
 * @returns Final pipeline state object
 */
export function buildFinalPipelineState(input, executionTimeMs) {
    return {
        status: input.failedPhase ? 'failed' : 'completed',
        endTime: new Date().toISOString(),
        executionTimeMs,
        totalXP: input.totalXP,
        completedPhases: input.completedPhases,
        failedPhase: input.failedPhase,
        rollbackApplied: input.rollbackApplied,
    };
}
/**
 * Build observability metadata for pipeline completion event.
 *
 * @param input - Finalization input data
 * @returns Metadata object for ObservabilityBus event
 */
export function buildCompletedMetadata(input) {
    return {
        pipelineId: input.pipelineId,
        success: input.success,
        totalXP: input.totalXP,
        completedPhases: input.completedPhases,
        failedPhase: input.failedPhase,
        rollbackApplied: input.rollbackApplied,
    };
}
/**
 * Build the final pipeline execution result.
 *
 * @param input - Finalization input data
 * @param executionTimeMs - Calculated execution time
 * @returns Complete pipeline execution result
 */
export function buildPipelineResult(input, executionTimeMs) {
    return {
        success: input.success,
        phaseResults: input.phaseResults,
        totalXP: input.totalXP,
        executionTimeMs,
        completedPhases: input.completedPhases,
        failedPhase: input.failedPhase,
        rollbackApplied: input.rollbackApplied,
    };
}
/**
 * Build XP storage object for memory.
 *
 * @param totalXP - Total XP accumulated
 * @returns XP storage object with timestamp
 */
export function buildXPStorageObject(totalXP) {
    return {
        xp: totalXP,
        timestamp: new Date().toISOString(),
    };
}
/**
 * Finalize pipeline execution - computes metrics and builds result.
 *
 * This is the main entry point that combines all finalization steps.
 * Note: Memory storage and observability emissions are handled by the
 * orchestrator wrapper to preserve coordination in one place.
 *
 * @param input - Finalization input data
 * @returns Complete finalization result with all computed values
 */
export function finalizePipelineExecution(input) {
    const executionTimeMs = calculateExecutionTime(input.startTime);
    const quality = input.success
        ? calculatePipelineQuality(input.phaseResults)
        : 0;
    const result = buildPipelineResult(input, executionTimeMs);
    return {
        result,
        executionTimeMs,
        quality,
        feedbackStatus: input.success ? 'completed' : 'failed',
    };
}
//# sourceMappingURL=coding-pipeline-finalize.js.map