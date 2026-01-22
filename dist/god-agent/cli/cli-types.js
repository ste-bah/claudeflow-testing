/**
 * CLI Type Definitions for PhD Pipeline Orchestration
 * Implements REQ-PIPE-021, REQ-PIPE-023
 */
/**
 * Phase names constant
 * 7 phases as defined in constitution.md
 */
export const PHASE_NAMES = [
    'Foundation',
    'Discovery',
    'Architecture',
    'Synthesis',
    'Design',
    'Writing',
    'Validation'
];
/**
 * Get phase name by number (1-indexed)
 */
export function getPhaseName(phase) {
    if (phase < 1 || phase > PHASE_NAMES.length) {
        return 'Unknown';
    }
    return PHASE_NAMES[phase - 1];
}
/** Phase 1-5 agent count (indices 0-28) */
export const PHASE_1_5_AGENT_COUNT = 29;
/** Phase 6 starts at this index (introduction-writer is at index 29) */
export const PHASE_6_START_INDEX = 29;
/** Static Phase 7 agent count */
export const PHASE_7_AGENT_COUNT = 11;
/** Index where static Phase 7 agents start in PipelineConfigLoader (systematic-reviewer is at index 35) */
export const STATIC_PHASE_7_START_INDEX = 35;
/**
 * Error when agent key doesn't match current agent
 * [REQ-PIPE-003]
 */
export class AgentMismatchError extends Error {
    expected;
    got;
    constructor(expected, got) {
        super(`Expected agent ${expected}, got ${got}`);
        this.name = 'AgentMismatchError';
        this.expected = expected;
        this.got = got;
    }
}
//# sourceMappingURL=cli-types.js.map