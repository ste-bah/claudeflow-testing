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
// ═════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════════════════
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
 * Number of agents per phase (includes Sherlock forensic reviewers in their respective phases)
 * Each phase-N-reviewer runs at the END of its phase, gating progression to the next phase.
 * recovery-agent + sign-off-approver are in delivery.
 * REQ-PIPE-047: Matches actual .claude/agents/coding-pipeline/*.md files
 */
export const PHASE_AGENT_COUNTS = {
    understanding: 7, // 6 core + phase-1-reviewer
    exploration: 5, // 4 core + phase-2-reviewer
    architecture: 6, // 5 core + phase-3-reviewer
    implementation: 13, // 12 core + phase-4-reviewer
    testing: 9, // 8 core (includes test-fixer) + phase-5-reviewer
    optimization: 6, // 5 core (includes final-refactorer) + phase-6-reviewer
    delivery: 2, // recovery-agent + sign-off-approver
};
/**
 * Total number of core pipeline agents
 * 6 + 4 + 5 + 12 + 7 + 5 + 1 = 40
 * REQ-PIPE-047: Verified against actual .claude/agents/coding-pipeline/*.md files
 */
export const CORE_AGENTS = 40;
/**
 * Number of Sherlock forensic review agents
 */
export const SHERLOCK_AGENT_COUNT = 7;
/**
 * Total number of agents in the pipeline
 * 41 core + 7 Sherlock = 48
 */
export const TOTAL_AGENTS = 48;
/**
 * Sherlock Forensic Review agents (42-48)
 * All are CRITICAL - they gate pipeline phase progression
 */
export const SHERLOCK_AGENTS = [
    'phase-1-reviewer', // #42 - Understanding review
    'phase-2-reviewer', // #43 - Exploration review
    'phase-3-reviewer', // #44 - Architecture review
    'phase-4-reviewer', // #45 - Implementation review
    'phase-5-reviewer', // #46 - Testing review
    'phase-6-reviewer', // #47 - Optimization review
    'recovery-agent', // #48 - Phase 7 / Recovery
];
/**
 * Critical agents that halt pipeline on failure
 * Includes core critical agents AND all Sherlock forensic reviewers
 * REQ-PIPE-048: Matches actual .claude/agents/coding-pipeline/*.md files
 */
export const CRITICAL_AGENTS = [
    // Core critical agents
    'task-analyzer', // #1 - Phase 1: Pipeline entry point (CRITICAL in frontmatter)
    'interface-designer', // #13 - Phase 3: API contract validation
    'quality-gate', // #34 - Phase 5: L-Score validation gateway
    'sign-off-approver', // #41 - Phase 7: Final approval
    // Sherlock forensic reviewers (all critical - gate phase progression)
    'phase-1-reviewer', // #42 - Understanding forensic review
    'phase-2-reviewer', // #43 - Exploration forensic review
    'phase-3-reviewer', // #44 - Architecture forensic review
    'phase-4-reviewer', // #45 - Implementation forensic review
    'phase-5-reviewer', // #46 - Testing forensic review
    'phase-6-reviewer', // #47 - Optimization forensic review
    'recovery-agent', // #48 - Phase 7 forensic review / Recovery
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
// ═════════════════════════════════════════════════════════════════════════
// SHERLOCK FORENSIC VERIFICATION TYPES
// ═════════════════════════════════════════════════════════════════════════
/**
 * Sherlock forensic verification verdict values.
 * Used by agents 41-47 in Phase 6 for code review.
 */
export var SherlockVerdict;
(function (SherlockVerdict) {
    /** Code passes all forensic checks */
    SherlockVerdict["INNOCENT"] = "INNOCENT";
    /** Code has critical issues requiring remediation */
    SherlockVerdict["GUILTY"] = "GUILTY";
    /** Not enough information to make determination */
    SherlockVerdict["INSUFFICIENT_EVIDENCE"] = "INSUFFICIENT_EVIDENCE";
})(SherlockVerdict || (SherlockVerdict = {}));
//# sourceMappingURL=types.js.map