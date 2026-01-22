/**
 * DAI-002: Coding Pipeline DAG Builder
 *
 * Functions for building and validating the coding pipeline DAG.
 * Extracted for constitution compliance (< 500 lines per file).
 *
 * @see command-task-bridge.ts
 * @see SPEC-001-architecture.md
 */
import { PHASE_ORDER, CHECKPOINT_PHASES, TOTAL_AGENTS, } from './types.js';
import { CODING_PIPELINE_MAPPINGS_PHASE_1_3 } from './coding-pipeline-agents-phase1-3.js';
import { CODING_PIPELINE_MAPPINGS_PHASE_4_7 } from './coding-pipeline-agents-phase4-7.js';
/**
 * Combined mapping of all 47 agents across all phases.
 * Re-exported for backward compatibility.
 */
export const CODING_PIPELINE_MAPPINGS = [
    ...CODING_PIPELINE_MAPPINGS_PHASE_1_3,
    ...CODING_PIPELINE_MAPPINGS_PHASE_4_7,
];
/**
 * Get all agents for a specific phase.
 *
 * @param phase - The pipeline phase to get agents for
 * @returns Array of agent mappings for the phase, sorted by priority
 */
export function getAgentsForPhase(phase) {
    return CODING_PIPELINE_MAPPINGS
        .filter(agent => agent.phase === phase)
        .sort((a, b) => a.priority - b.priority);
}
/**
 * Build the complete pipeline DAG from agent mappings.
 *
 * @returns Complete DAG structure for pipeline execution
 */
export function buildPipelineDAG() {
    const nodes = new Map();
    const phases = new Map();
    // Initialize phases map
    for (const phase of PHASE_ORDER) {
        phases.set(phase, []);
    }
    // Create nodes for each agent
    for (const mapping of CODING_PIPELINE_MAPPINGS) {
        const node = {
            agentKey: mapping.agentKey,
            phase: mapping.phase,
            dependsOn: mapping.dependsOn ?? [],
            dependents: [],
        };
        nodes.set(mapping.agentKey, node);
        phases.get(mapping.phase).push(mapping.agentKey);
    }
    // Build dependents (reverse dependencies)
    for (const mapping of CODING_PIPELINE_MAPPINGS) {
        if (mapping.dependsOn) {
            for (const dep of mapping.dependsOn) {
                const depNode = nodes.get(dep);
                if (depNode) {
                    depNode.dependents.push(mapping.agentKey);
                }
            }
        }
    }
    // Build topological order using Kahn's algorithm
    const topologicalOrder = [];
    const inDegree = new Map();
    // Initialize in-degrees
    for (const [agentKey, node] of nodes) {
        inDegree.set(agentKey, node.dependsOn.length);
    }
    // Find all nodes with no dependencies
    const queue = [];
    for (const [agentKey, degree] of inDegree) {
        if (degree === 0) {
            queue.push(agentKey);
        }
    }
    // Process queue
    while (queue.length > 0) {
        const agentKey = queue.shift();
        topologicalOrder.push(agentKey);
        const node = nodes.get(agentKey);
        for (const dependent of node.dependents) {
            const newDegree = inDegree.get(dependent) - 1;
            inDegree.set(dependent, newDegree);
            if (newDegree === 0) {
                queue.push(dependent);
            }
        }
    }
    return {
        nodes,
        phases,
        topologicalOrder,
        checkpointPhases: CHECKPOINT_PHASES,
    };
}
/**
 * Get all critical agents that halt the pipeline on failure.
 *
 * @returns Array of critical agent mappings
 */
export function getCriticalAgents() {
    return CODING_PIPELINE_MAPPINGS.filter(agent => agent.critical === true);
}
/**
 * Get a specific agent mapping by key.
 *
 * @param key - The agent key to find
 * @returns The agent mapping or undefined if not found
 */
export function getAgentByKey(key) {
    return CODING_PIPELINE_MAPPINGS.find(agent => agent.agentKey === key);
}
/**
 * Get the total XP available in the pipeline.
 *
 * @returns Total XP reward sum across all agents
 */
export function getTotalPipelineXP() {
    return CODING_PIPELINE_MAPPINGS.reduce((sum, agent) => sum + agent.xpReward, 0);
}
/**
 * Get XP totals grouped by phase.
 *
 * @returns Map of phase to total XP for that phase
 */
export function getPhaseXPTotals() {
    const totals = new Map();
    for (const phase of PHASE_ORDER) {
        const phaseAgents = CODING_PIPELINE_MAPPINGS.filter(a => a.phase === phase);
        const phaseXP = phaseAgents.reduce((sum, agent) => sum + agent.xpReward, 0);
        totals.set(phase, phaseXP);
    }
    return totals;
}
/**
 * Validate that all dependencies are valid.
 *
 * @returns Array of validation errors (empty if valid)
 */
export function validatePipelineDependencies() {
    const errors = [];
    const agentKeys = new Set(CODING_PIPELINE_MAPPINGS.map(a => a.agentKey));
    for (const mapping of CODING_PIPELINE_MAPPINGS) {
        if (mapping.dependsOn) {
            for (const dep of mapping.dependsOn) {
                if (!agentKeys.has(dep)) {
                    errors.push(`Agent "${mapping.agentKey}" depends on unknown agent "${dep}"`);
                }
            }
        }
    }
    // Check for cycles
    const dag = buildPipelineDAG();
    if (dag.topologicalOrder.length !== TOTAL_AGENTS) {
        errors.push(`Cycle detected: topological order has ${dag.topologicalOrder.length} agents but expected ${TOTAL_AGENTS}`);
    }
    return errors;
}
/**
 * Get agents by category.
 *
 * @param category - The category to filter by
 * @returns Array of agent mappings in that category
 */
export function getAgentsByCategory(category) {
    return CODING_PIPELINE_MAPPINGS.filter(agent => agent.category === category);
}
/**
 * Get all forensic review agents (Sherlock agents).
 *
 * @returns Array of forensic review agent mappings
 */
export function getForensicReviewAgents() {
    return CODING_PIPELINE_MAPPINGS.filter(agent => agent.category === 'forensic-review');
}
/**
 * Get agents that can run in parallel for a given phase.
 *
 * @param phase - The pipeline phase
 * @returns Array of parallelizable agents for the phase
 */
export function getParallelizableAgents(phase) {
    return CODING_PIPELINE_MAPPINGS.filter(agent => agent.phase === phase && agent.parallelizable === true);
}
/**
 * Get the execution order for a phase considering dependencies.
 *
 * @param phase - The pipeline phase
 * @returns Ordered array of agent keys for execution
 */
export function getPhaseExecutionOrder(phase) {
    const dag = buildPipelineDAG();
    const phaseAgents = new Set(dag.phases.get(phase) ?? []);
    // Filter topological order to only include agents from this phase
    return dag.topologicalOrder.filter(agent => phaseAgents.has(agent));
}
//# sourceMappingURL=coding-pipeline-dag-builder.js.map