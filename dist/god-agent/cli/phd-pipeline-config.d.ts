/**
 * PhD Pipeline Configuration
 *
 * Complete TypeScript interfaces and configuration constants for the PhD Pipeline.
 * Implements Technical Spec Section 3 with 46 agents across 7 phases.
 *
 * @module phd-pipeline-config
 * @version 1.0.0
 *
 * Constitution Compliance:
 * - RULE-001: NO placeholder code - complete implementation only
 * - RULE-002: NO `as any` casts - explicit types only
 * - RULE-006: ALL functions must have explicit return types
 * - RULE-011: Backward compatible with existing session schema
 */
/**
 * Configuration for an individual agent in the PhD Pipeline.
 * Each agent has a unique key, belongs to a phase, and produces specific outputs.
 */
export interface AgentConfig {
    /** Unique identifier key for the agent (kebab-case, e.g., "self-ask-decomposer") */
    readonly key: string;
    /** Human-readable display name for the agent */
    readonly displayName: string;
    /** Phase number (1-7) this agent belongs to */
    readonly phase: number;
    /** Filename of the agent markdown file (without path, e.g., "self-ask-decomposer.md") */
    readonly file: string;
    /** Memory keys this agent reads from or writes to */
    readonly memoryKeys: readonly string[];
    /** Output artifacts this agent produces */
    readonly outputArtifacts: readonly string[];
}
/**
 * Definition of a pipeline phase containing multiple agents.
 * Phases are executed sequentially, with agents within each phase
 * potentially having dependencies on previous agents.
 */
export interface PhaseDefinition {
    /** Unique phase identifier (1-7) */
    readonly id: number;
    /** Human-readable phase name */
    readonly name: string;
    /** Array of agent keys belonging to this phase */
    readonly agentKeys: readonly string[];
    /** Description of the phase's purpose and objectives */
    readonly description: string;
}
/**
 * Complete pipeline configuration containing all agents, phases,
 * and operational settings.
 */
export interface PipelineConfig {
    /** Array of all agent configurations */
    readonly agents: readonly AgentConfig[];
    /** Array of all phase definitions */
    readonly phases: readonly PhaseDefinition[];
    /** Namespace for memory operations */
    readonly memoryNamespace: string;
    /** Directory path containing agent markdown files */
    readonly agentsDirectory: string;
}
/**
 * Session state for tracking pipeline execution progress.
 * Backward compatible with existing PipelineSession schema.
 */
export interface SessionState {
    /** Unique session identifier (UUID v4) */
    readonly sessionId: string;
    /** Research topic or query being investigated */
    readonly topic: string;
    /** Current phase number (1-7) */
    readonly currentPhase: number;
    /** Index of current agent within the complete agent list */
    readonly currentAgentIndex: number;
    /** Array of completed agent keys */
    readonly completedAgents: readonly string[];
    /** ISO timestamp when session started */
    readonly startedAt: string;
    /** ISO timestamp of last activity */
    readonly lastActivityAt: string;
    /** Current session status
     * TASK-CLI-004: Added 'phase8' status for Phase 8 finalization tracking
     */
    readonly status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'phase8';
}
/**
 * Complete array of all 46 PhD Pipeline agents.
 * Agents are ordered by phase and execution sequence.
 */
export declare const PHD_AGENTS: readonly AgentConfig[];
/**
 * Complete array of all 7 PhD Pipeline phases.
 * Phases are executed sequentially with agents within each phase
 * following dependency ordering.
 */
export declare const PHD_PHASES: readonly PhaseDefinition[];
/**
 * Default PhD Pipeline configuration with all 46 agents and 7 phases.
 * Memory namespace follows project/research convention for integration
 * with claude-flow memory system.
 */
export declare const DEFAULT_CONFIG: PipelineConfig;
/**
 * Get an agent configuration by its key.
 * @param key - The agent key to look up
 * @returns The agent configuration or undefined if not found
 */
export declare function getAgentByKey(key: string): AgentConfig | undefined;
/**
 * Get all agents for a specific phase.
 * @param phaseId - The phase number (1-7)
 * @returns Array of agent configurations for the phase
 */
export declare function getAgentsByPhase(phaseId: number): readonly AgentConfig[];
/**
 * Get a phase definition by its ID.
 * @param phaseId - The phase number (1-7)
 * @returns The phase definition or undefined if not found
 */
export declare function getPhaseById(phaseId: number): PhaseDefinition | undefined;
/**
 * Get the phase name for a given phase ID.
 * @param phaseId - The phase number (1-7)
 * @returns The phase name or 'Unknown' if not found
 */
export declare function getPhaseName(phaseId: number): string;
/**
 * Get the total number of agents in the pipeline.
 * @returns The total agent count (46)
 */
export declare function getTotalAgentCount(): number;
/**
 * Get the total number of phases in the pipeline.
 * @returns The total phase count (7)
 */
export declare function getTotalPhaseCount(): number;
/**
 * Get the index of an agent by its key.
 * @param key - The agent key to look up
 * @returns The agent index (0-based) or -1 if not found
 */
export declare function getAgentIndex(key: string): number;
/**
 * Get the agent at a specific index.
 * @param index - The agent index (0-based)
 * @returns The agent configuration or undefined if out of bounds
 */
export declare function getAgentByIndex(index: number): AgentConfig | undefined;
/**
 * Validate that all phase agent keys match actual agent definitions.
 * @returns True if configuration is valid, throws Error otherwise
 */
export declare function validateConfiguration(): boolean;
/**
 * Create a new session state with initial values.
 * @param sessionId - UUID v4 session identifier
 * @param topic - Research topic or query
 * @returns Initial session state
 */
export declare function createInitialSessionState(sessionId: string, topic: string): SessionState;
/**
 * Get the file path for an agent's markdown definition.
 * @param agentKey - The agent key
 * @param baseDir - Optional base directory (defaults to DEFAULT_CONFIG.agentsDirectory)
 * @returns The relative file path or undefined if agent not found
 */
export declare function getAgentFilePath(agentKey: string, baseDir?: string): string | undefined;
/**
 * Type guard to check if a value is a valid SessionState.
 * @param value - The value to check
 * @returns True if the value is a valid SessionState
 */
export declare function isSessionState(value: unknown): value is SessionState;
/**
 * Type guard to check if a value is a valid AgentConfig.
 * @param value - The value to check
 * @returns True if the value is a valid AgentConfig
 */
export declare function isAgentConfig(value: unknown): value is AgentConfig;
//# sourceMappingURL=phd-pipeline-config.d.ts.map