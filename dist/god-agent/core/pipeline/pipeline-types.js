/**
 * PhD Pipeline Type Definitions
 * TASK-PHD-001 - 48-Agent PhD Pipeline Configuration
 *
 * Provides types for systematic PhD-level research pipeline:
 * - 48 agents across 7 phases
 * - DAG-based dependency management
 * - Critical agent validation
 * - Integration with Relay Race and Shadow Vector
 */
// ==================== Configuration Defaults ====================
/**
 * Default agent timeout (seconds)
 */
export const DEFAULT_AGENT_TIMEOUT = 300;
/**
 * Critical agent keys
 */
export const CRITICAL_AGENT_KEYS = [
    'step-back-analyzer',
    'contradiction-analyzer',
    'adversarial-reviewer',
];
/**
 * Phase names
 */
export const PHASE_NAMES = {
    1: 'Foundation',
    2: 'Discovery',
    3: 'Architecture',
    4: 'Synthesis',
    5: 'Design',
    6: 'Writing',
    7: 'QA',
};
// ==================== Error Types ====================
/**
 * Error thrown during pipeline configuration
 */
export class PipelineConfigError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'PipelineConfigError';
    }
}
/**
 * Error thrown during pipeline execution
 */
export class PipelineExecutionError extends Error {
    agentId;
    agentKey;
    phase;
    constructor(message, agentId, agentKey, phase) {
        super(message);
        this.agentId = agentId;
        this.agentKey = agentKey;
        this.phase = phase;
        this.name = 'PipelineExecutionError';
    }
}
/**
 * Error thrown when critical agent fails
 */
export class CriticalAgentError extends Error {
    agent;
    cause;
    constructor(agent, cause) {
        super(`Critical agent #${agent.id} (${agent.key}) failed: ${cause}`);
        this.agent = agent;
        this.cause = cause;
        this.name = 'CriticalAgentError';
    }
}
// ==================== Utility Functions ====================
/**
 * Create a default pipeline state
 */
export function createPipelineState(pipelineId) {
    return {
        pipelineId,
        currentPhase: 1,
        completedAgents: new Set(),
        agentOutputs: new Map(),
        startTime: Date.now(),
        status: 'pending',
        errors: [],
        executionRecords: new Map(),
    };
}
/**
 * Generate a unique pipeline ID
 */
export function generatePipelineId() {
    return `phd-pipeline-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
/**
 * Check if an agent is critical
 */
export function isCriticalAgent(agent) {
    return agent.critical === true || CRITICAL_AGENT_KEYS.includes(agent.key);
}
//# sourceMappingURL=pipeline-types.js.map