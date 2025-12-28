/**
 * DAI-002: Multi-Agent Sequential Pipeline Type Definitions
 *
 * Types for the multi-agent sequential pipeline orchestration system.
 * RULE-004: Synchronous Sequential Execution (99.9% Rule)
 * RULE-005: Mandatory Memory Coordination
 * RULE-006: DAI-001 Integration Required
 * RULE-007: Forward-Looking Agent Prompts
 */
// ==================== Pipeline Events ====================
/**
 * Pipeline lifecycle event types.
 * Used for monitoring and debugging.
 */
export var PipelineEventType;
(function (PipelineEventType) {
    /** Pipeline execution started */
    PipelineEventType["PIPELINE_STARTED"] = "PIPELINE_STARTED";
    /** Agent step started */
    PipelineEventType["AGENT_STARTED"] = "AGENT_STARTED";
    /** Agent step completed successfully */
    PipelineEventType["AGENT_COMPLETED"] = "AGENT_COMPLETED";
    /** Agent output stored in memory */
    PipelineEventType["MEMORY_STORED"] = "MEMORY_STORED";
    /** Quality gate checked */
    PipelineEventType["QUALITY_CHECKED"] = "QUALITY_CHECKED";
    /** Pipeline completed successfully */
    PipelineEventType["PIPELINE_COMPLETED"] = "PIPELINE_COMPLETED";
    /** Pipeline failed */
    PipelineEventType["PIPELINE_FAILED"] = "PIPELINE_FAILED";
    /** Memory retrieval performed */
    PipelineEventType["MEMORY_RETRIEVED"] = "MEMORY_RETRIEVED";
    /** DAI-001 agent selection performed */
    PipelineEventType["AGENT_SELECTED"] = "AGENT_SELECTED";
    /** Feedback provided to ReasoningBank */
    PipelineEventType["FEEDBACK_PROVIDED"] = "FEEDBACK_PROVIDED";
})(PipelineEventType || (PipelineEventType = {}));
// ==================== Constants ====================
/**
 * Default step timeout (5 minutes).
 */
export const DEFAULT_STEP_TIMEOUT = 300000;
/**
 * Default pipeline timeout (30 minutes).
 */
export const DEFAULT_PIPELINE_TIMEOUT = 1800000;
/**
 * Default quality threshold.
 */
export const DEFAULT_MIN_QUALITY = 0.7;
/**
 * Pipeline ID prefix.
 */
export const PIPELINE_ID_PREFIX = 'pip';
/**
 * Pipeline trajectory ID prefix.
 */
export const PIPELINE_TRAJECTORY_PREFIX = 'trj_pipeline';
// ==================== Utility Functions ====================
/**
 * Generate a unique pipeline execution ID.
 */
export function generatePipelineId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `${PIPELINE_ID_PREFIX}_${timestamp}_${random}`;
}
/**
 * Generate a trajectory ID for a pipeline.
 */
export function generatePipelineTrajectoryId(pipelineId) {
    return `${PIPELINE_TRAJECTORY_PREFIX}_${pipelineId}`;
}
/**
 * Generate a trajectory ID for a pipeline step.
 */
export function generateStepTrajectoryId(pipelineTrajectoryId, stepIndex) {
    return `${pipelineTrajectoryId}_step_${stepIndex}`;
}
/**
 * Calculate overall quality from step results.
 */
export function calculateOverallQuality(steps) {
    if (steps.length === 0)
        return 0;
    const sum = steps.reduce((acc, step) => acc + step.quality, 0);
    return sum / steps.length;
}
/**
 * Validate that a pipeline definition has basic required fields.
 * Does NOT validate against AgentRegistry (that's PipelineValidator's job).
 */
export function hasRequiredFields(pipeline) {
    if (!pipeline.name?.trim())
        return false;
    if (!Array.isArray(pipeline.agents) || pipeline.agents.length === 0)
        return false;
    if (pipeline.sequential !== true)
        return false;
    for (const step of pipeline.agents) {
        if (!step.agentKey && !step.taskDescription)
            return false;
        if (!step.task?.trim())
            return false;
        if (!step.outputDomain?.trim())
            return false;
        if (!Array.isArray(step.outputTags) || step.outputTags.length === 0)
            return false;
    }
    return true;
}
//# sourceMappingURL=dai-002-types.js.map