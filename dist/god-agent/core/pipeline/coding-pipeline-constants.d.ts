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
import type { CodingPipelinePhase, AlgorithmType } from './types.js';
import type { IOrchestratorConfig } from './coding-pipeline-types.js';
import { CODING_MEMORY_NAMESPACE } from './types.js';
/**
 * Directory containing coding pipeline agent YAML files.
 * Relative to project root.
 */
export declare const AGENTS_DIR: ".claude/agents/coding-pipeline";
/**
 * Maps YAML agent types to their corresponding pipeline phases.
 * Used during configuration loading to assign agents to phases.
 */
export declare const TYPE_TO_PHASE: Record<string, CodingPipelinePhase>;
/**
 * Default USACF algorithm assignments per phase.
 * Applied when agent YAML does not specify an algorithm.
 */
export declare const PHASE_DEFAULT_ALGORITHM: Record<CodingPipelinePhase, AlgorithmType>;
/**
 * Defines execution order for all 48 agents in the coding pipeline.
 * REQ-PIPE-048: 48 agents total (41 core + 7 Sherlock forensic reviewers)
 */
export declare const AGENT_ORDER: Record<string, number>;
/**
 * Set of critical agent keys that halt pipeline on failure.
 * Includes core critical agents, Sherlock forensic reviewers, and key validators.
 */
export declare const CRITICAL_AGENT_KEYS: ReadonlySet<string>;
export declare const DEFAULT_ORCHESTRATOR_CONFIG: IOrchestratorConfig;
/**
 * Maximum execution results to store before pruning oldest entries
 * CRITICAL: This prevents unbounded memory growth in long-running pipelines
 */
export declare const MAX_EXECUTION_RESULTS = 1000;
/**
 * Maps phase names to their sequential order (1-7)
 * Used for progress tracking and phase ordering validation
 */
export declare const PHASE_TO_NUMBER: Record<CodingPipelinePhase, number>;
/**
 * Minimum L-Score threshold required to pass each phase
 * Thresholds increase progressively from 0.75 to 0.95
 * Sherlock validation uses these for GUILTY/INNOCENT verdicts
 */
export declare const PHASE_L_SCORE_THRESHOLDS: Record<CodingPipelinePhase, number>;
export { CODING_MEMORY_NAMESPACE };
//# sourceMappingURL=coding-pipeline-constants.d.ts.map