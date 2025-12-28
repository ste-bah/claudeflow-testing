/**
 * Orchestration Types
 * TASK-ORC-001 - Relay Race Protocol Type Definitions
 *
 * Defines types for agent orchestration, pipeline execution,
 * and memory key passing in sequential agent workflows.
 */
// ==================== Error Types ====================
/**
 * Error thrown when pipeline validation fails
 */
export class PipelineValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PipelineValidationError';
    }
}
/**
 * Error thrown when agent execution fails
 */
export class AgentExecutionError extends Error {
    agentName;
    position;
    constructor(agentName, position, message) {
        super(`Agent ${agentName} (${position}) failed: ${message}`);
        this.agentName = agentName;
        this.position = position;
        this.name = 'AgentExecutionError';
    }
}
/**
 * Error thrown when memory key validation fails
 */
export class MemoryKeyError extends Error {
    key;
    operation;
    constructor(key, operation, message) {
        super(`Memory key ${operation} failed for ${key}: ${message}`);
        this.key = key;
        this.operation = operation;
        this.name = 'MemoryKeyError';
    }
}
/**
 * Error thrown when quality gate fails
 */
export class QualityGateError extends Error {
    agentName;
    qualityGate;
    constructor(agentName, qualityGate, message) {
        super(`Quality gate failed for ${agentName}: ${qualityGate}. ${message}`);
        this.agentName = agentName;
        this.qualityGate = qualityGate;
        this.name = 'QualityGateError';
    }
}
//# sourceMappingURL=orchestration-types.js.map