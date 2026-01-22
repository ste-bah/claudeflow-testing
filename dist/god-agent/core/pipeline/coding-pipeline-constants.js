/**
 * Coding Pipeline Constants
 *
 * Extracted constants for the 47-agent coding pipeline configuration.
 * Provides centralized definitions for phase mappings, agent ordering,
 * algorithm assignments, and critical agent identification.
 *
 * IMPORTANT: ONLY for /god-code coding pipeline - NOT for PhD pipeline.
 * PhD pipeline uses separate configuration in phd-pipeline-config.ts.
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-constants
 * @see PRD Section 2.3 - Pipeline Configuration
 * @see SPEC-001-architecture.md
 */
import { CODING_MEMORY_NAMESPACE } from './types.js';
// =============================================================================
// DIRECTORY CONSTANTS
// =============================================================================
/**
 * Directory containing coding pipeline agent YAML files.
 * Relative to project root.
 */
export const AGENTS_DIR = '.claude/agents/coding-pipeline';
// =============================================================================
// AGENT TYPE TO PHASE MAPPING
// =============================================================================
/**
 * Maps YAML agent types to their corresponding pipeline phases.
 * Used during configuration loading to assign agents to phases.
 */
export const TYPE_TO_PHASE = {
    understanding: 'understanding',
    exploration: 'exploration',
    architecture: 'architecture',
    implementation: 'implementation',
    testing: 'testing',
    optimization: 'optimization',
    delivery: 'delivery',
    approval: 'delivery',
    validation: 'testing',
    'sherlock-reviewer': 'delivery',
    'sherlock-recovery': 'delivery',
};
// =============================================================================
// PHASE DEFAULT ALGORITHM MAPPING
// =============================================================================
/**
 * Default USACF algorithm assignments per phase.
 * Applied when agent YAML does not specify an algorithm.
 */
export const PHASE_DEFAULT_ALGORITHM = {
    understanding: 'ReAct',
    exploration: 'LATS',
    architecture: 'ToT',
    implementation: 'Self-Debug',
    testing: 'Self-Debug',
    optimization: 'Reflexion',
    delivery: 'Reflexion',
};
// =============================================================================
// AGENT EXECUTION ORDER (47 agents)
// =============================================================================
/**
 * Defines execution order for all 47 agents in the coding pipeline.
 * REQ-PIPE-047: 47 agents total (40 core + 7 Sherlock forensic reviewers)
 */
export const AGENT_ORDER = {
    // Phase 1: Understanding (1-6)
    'task-analyzer': 1, 'requirement-extractor': 2, 'requirement-prioritizer': 3,
    'scope-definer': 4, 'context-gatherer': 5, 'feasibility-analyzer': 6,
    // Phase 2: Exploration (7-10)
    'pattern-explorer': 7, 'technology-scout': 8, 'research-planner': 9, 'codebase-analyzer': 10,
    // Phase 3: Architecture (11-15)
    'system-designer': 11, 'component-designer': 12, 'interface-designer': 13,
    'data-architect': 14, 'integration-architect': 15,
    // Phase 4: Implementation (16-27)
    'code-generator': 16, 'type-implementer': 17, 'unit-implementer': 18,
    'service-implementer': 19, 'data-layer-implementer': 20, 'api-implementer': 21,
    'frontend-implementer': 22, 'error-handler-implementer': 23, 'config-implementer': 24,
    'logger-implementer': 25, 'dependency-manager': 26, 'implementation-coordinator': 27,
    // Phase 5: Testing (28-34)
    'test-generator': 28, 'test-runner': 29, 'integration-tester': 30, 'regression-tester': 31,
    'security-tester': 32, 'coverage-analyzer': 33, 'quality-gate': 34,
    // Phase 6: Optimization (35-39)
    'performance-optimizer': 35, 'performance-architect': 36, 'code-quality-improver': 37,
    'security-architect': 38, 'final-refactorer': 39,
    // Phase 7: Delivery (40)
    'sign-off-approver': 40,
    // Sherlock Forensic Reviewers (41-47)
    'phase-1-reviewer': 41, 'phase-2-reviewer': 42, 'phase-3-reviewer': 43,
    'phase-4-reviewer': 44, 'phase-5-reviewer': 45, 'phase-6-reviewer': 46, 'recovery-agent': 47,
};
// =============================================================================
// CRITICAL AGENTS (18 agents)
// =============================================================================
/**
 * Set of critical agent keys that halt pipeline on failure.
 * Includes core critical agents, Sherlock forensic reviewers, and key validators.
 */
export const CRITICAL_AGENT_KEYS = new Set([
    'task-analyzer', 'interface-designer', 'quality-gate', 'sign-off-approver',
    'phase-1-reviewer', 'phase-2-reviewer', 'phase-3-reviewer', 'phase-4-reviewer',
    'phase-5-reviewer', 'phase-6-reviewer', 'recovery-agent', 'system-designer',
    'code-generator', 'implementation-coordinator', 'test-runner', 'security-tester',
    'security-architect', 'feasibility-analyzer',
]);
// =============================================================================
// ORCHESTRATOR DEFAULTS
// =============================================================================
export const DEFAULT_ORCHESTRATOR_CONFIG = {
    agentTimeoutMs: 120_000, // 2 minutes per agent
    phaseTimeoutMs: 600_000, // 10 minutes per phase
    enableCheckpoints: true,
    enableParallelExecution: true,
    maxParallelAgents: 3,
    memoryNamespace: CODING_MEMORY_NAMESPACE,
    agentMdPath: '.claude/agents/coding-pipeline',
    verbose: false,
    enableLearning: true,
};
// =============================================================================
// MEM-002 CRITICAL FIX - Memory Leak Prevention
// =============================================================================
/**
 * Maximum execution results to store before pruning oldest entries
 * CRITICAL: This prevents unbounded memory growth in long-running pipelines
 */
export const MAX_EXECUTION_RESULTS = 1000;
// =============================================================================
// PHASE MAPPINGS
// =============================================================================
/**
 * Maps phase names to their sequential order (1-7)
 * Used for progress tracking and phase ordering validation
 */
export const PHASE_TO_NUMBER = {
    understanding: 1,
    exploration: 2,
    architecture: 3,
    implementation: 4,
    testing: 5,
    optimization: 6,
    delivery: 7,
};
// =============================================================================
// L-SCORE QUALITY THRESHOLDS
// =============================================================================
/**
 * Minimum L-Score threshold required to pass each phase
 * Thresholds increase progressively from 0.75 to 0.95
 * Sherlock validation uses these for GUILTY/INNOCENT verdicts
 */
export const PHASE_L_SCORE_THRESHOLDS = {
    understanding: 0.75,
    exploration: 0.78,
    architecture: 0.82,
    implementation: 0.85,
    testing: 0.88,
    optimization: 0.92,
    delivery: 0.95,
};
// =============================================================================
// RE-EXPORTS FOR CONVENIENCE
// =============================================================================
export { CODING_MEMORY_NAMESPACE };
//# sourceMappingURL=coding-pipeline-constants.js.map