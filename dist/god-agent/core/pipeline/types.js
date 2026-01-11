/**
 * God Agent Coding Pipeline Type Definitions
 *
 * Defines the 40-agent, 7-phase coding pipeline structure.
 * Used by CommandTaskBridge and CodingPipelineOrchestrator.
 *
 * @module src/god-agent/core/pipeline/types
 * @see SPEC-001-architecture.md
 * @see TASK-WIRING-002-agent-mappings.md
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Phases in execution order
 */
export const PHASE_ORDER = [
    'understanding',
    'exploration',
    'architecture',
    'implementation',
    'testing',
    'optimization',
    'delivery',
];
/**
 * Phases where checkpoints are created for rollback
 */
export const CHECKPOINT_PHASES = [
    'understanding',
    'exploration',
    'architecture',
    'implementation',
    'testing',
];
/**
 * Number of agents per phase
 */
export const PHASE_AGENT_COUNTS = {
    understanding: 5,
    exploration: 5,
    architecture: 6,
    implementation: 8,
    testing: 8,
    optimization: 4,
    delivery: 4,
};
/**
 * Total number of core pipeline agents
 * 5 + 5 + 6 + 8 + 8 + 4 + 4 = 40
 */
export const CORE_AGENTS = 40;
/**
 * Number of Sherlock forensic review agents
 */
export const SHERLOCK_AGENT_COUNT = 7;
/**
 * Total number of agents in the pipeline
 * 40 core + 7 Sherlock = 47
 */
export const TOTAL_AGENTS = 47;
/**
 * Sherlock Forensic Review agents (41-47)
 * All are CRITICAL - they gate pipeline phase progression
 */
export const SHERLOCK_AGENTS = [
    'phase-1-reviewer', // #41 - Understanding review
    'phase-2-reviewer', // #42 - Exploration review
    'phase-3-reviewer', // #43 - Architecture review
    'phase-4-reviewer', // #44 - Implementation review
    'phase-5-reviewer', // #45 - Testing review
    'phase-6-reviewer', // #46 - Optimization review
    'recovery-agent', // #47 - Phase 7 / Recovery
];
/**
 * Critical agents that halt pipeline on failure
 * Includes core critical agents AND all Sherlock forensic reviewers
 */
export const CRITICAL_AGENTS = [
    // Core critical agents
    'task-analyzer', // #1 - Phase 1: Pipeline entry point
    'consistency-checker', // #15 - Phase 3: Design validation
    'sign-off-approver', // #40 - Phase 7: Final approval
    // Sherlock forensic reviewers (all critical - gate phase progression)
    'phase-1-reviewer', // #41 - Understanding forensic review
    'phase-2-reviewer', // #42 - Exploration forensic review
    'phase-3-reviewer', // #43 - Architecture forensic review
    'phase-4-reviewer', // #44 - Implementation forensic review
    'phase-5-reviewer', // #45 - Testing forensic review
    'phase-6-reviewer', // #46 - Optimization forensic review
    'recovery-agent', // #47 - Phase 7 forensic review / Recovery
];
/**
 * Mapping of Sherlock forensic reviewers to their phases
 */
export const SHERLOCK_PHASE_MAP = {
    'phase-1-reviewer': 'understanding',
    'phase-2-reviewer': 'exploration',
    'phase-3-reviewer': 'architecture',
    'phase-4-reviewer': 'implementation',
    'phase-5-reviewer': 'testing',
    'phase-6-reviewer': 'optimization',
    'recovery-agent': 'delivery',
};
/**
 * Memory namespace for coding pipeline
 */
export const CODING_MEMORY_NAMESPACE = 'coding';
/**
 * Memory key prefixes by phase
 */
export const MEMORY_PREFIXES = {
    understanding: 'coding/understanding',
    exploration: 'coding/exploration',
    architecture: 'coding/architecture',
    implementation: 'coding/implementation',
    testing: 'coding/testing',
    optimization: 'coding/optimization',
    delivery: 'coding/delivery',
};
//# sourceMappingURL=types.js.map