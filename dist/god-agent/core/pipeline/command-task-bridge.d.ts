/**
 * DAI-002: Command Task Bridge
 *
 * Bridges between Claude Code slash commands and Task() subagent spawning.
 * Implements RULE-008: Commands must spawn Task() subagents, never execute directly.
 *
 * US-014: /god-code Task() Spawning
 * US-015: /god-ask Task() Spawning
 * US-016: /god-research Task() Spawning
 * US-017: /god-write Task() Spawning
 * US-018: Complex Task Pipeline Triggering
 * FR-017: Task() Spawning Required
 * FR-018: Pipeline Detection
 * FR-019: Multi-Step Task Detection
 */
import { type IPipelineDefinition } from './dai-002-types.js';
/**
 * Result of task complexity analysis.
 */
export interface IComplexityAnalysis {
    /** Complexity score from 0 to 1 */
    score: number;
    /** Whether task requires multiple agents */
    isMultiStep: boolean;
    /** Detected phases in the task */
    detectedPhases: string[];
    /** Detected document types to create */
    detectedDocuments: string[];
    /** Detected action verbs indicating steps */
    detectedActions: string[];
    /** Reasoning for the complexity score */
    reasoning: string;
}
/**
 * Result of pipeline detection.
 */
export interface IPipelineDecision {
    /** Whether to use a pipeline */
    usePipeline: boolean;
    /** Reason for the decision */
    reason: string;
    /** Suggested pipeline steps if applicable */
    suggestedSteps?: string[];
    /** Complexity analysis details */
    complexity: IComplexityAnalysis;
}
/**
 * Task type mapping for agent selection.
 */
export type TaskType = 'code' | 'ask' | 'research' | 'write' | 'unknown';
/**
 * Agent mapping for different task types and phases.
 */
export interface IAgentMapping {
    /** Phase name (e.g., 'plan', 'implement', 'test') */
    phase: string;
    /** Recommended agent key */
    agentKey: string;
    /** Domain for output storage */
    outputDomain: string;
    /** Tags for output storage */
    outputTags: string[];
    /** Task template for this phase */
    taskTemplate: string;
}
/**
 * Configuration for CommandTaskBridge.
 */
export interface ICommandTaskBridgeConfig {
    /** Complexity threshold for triggering pipeline (default: 0.6) */
    pipelineThreshold?: number;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Custom phase mappings */
    phaseMappings?: Map<string, IAgentMapping>;
}
/**
 * Default complexity threshold for triggering pipeline.
 */
export declare const DEFAULT_PIPELINE_THRESHOLD = 0.6;
/**
 * Keywords indicating multiple phases.
 */
export declare const PHASE_KEYWORDS: string[];
/**
 * Document creation keywords.
 */
export declare const DOCUMENT_KEYWORDS: string[];
/**
 * Multi-step action patterns (regex).
 */
export declare const MULTI_STEP_PATTERNS: RegExp[];
/**
 * Connector words indicating sequential work.
 */
export declare const CONNECTOR_WORDS: string[];
/**
 * Default agent mappings for common phases.
 */
export declare const DEFAULT_PHASE_MAPPINGS: IAgentMapping[];
/**
 * Document type to agent mapping.
 */
export declare const DOCUMENT_AGENT_MAPPING: Record<string, string>;
/**
 * Bridges Claude Code commands to Task() subagent spawning.
 *
 * RULE-008: Commands must spawn Task() subagents, never execute directly.
 *
 * @example
 * ```typescript
 * const bridge = new CommandTaskBridge({ verbose: true });
 *
 * // Analyze complexity
 * const analysis = bridge.analyzeTaskComplexity("implement auth and test it");
 * console.log(analysis.score); // 0.7 (multi-step detected)
 *
 * // Check if pipeline needed
 * const decision = bridge.shouldUsePipeline("implement auth and test it");
 * if (decision.usePipeline) {
 *   const pipeline = bridge.buildPipelineDefinition("implement auth and test it");
 *   await agent.runPipeline(pipeline);
 * }
 * ```
 */
export declare class CommandTaskBridge {
    private readonly config;
    private readonly phaseMappings;
    constructor(config?: ICommandTaskBridgeConfig);
    /**
     * Analyze task complexity to determine if pipeline is needed.
     *
     * Implements FR-019: Multi-Step Task Detection
     *
     * @param task - The task description to analyze
     * @returns Complexity analysis with score and detected patterns
     */
    analyzeTaskComplexity(task: string): IComplexityAnalysis;
    /**
     * Determine if a pipeline should be used for the given task.
     *
     * Implements US-018: Complex Task Pipeline Triggering
     *
     * @param task - The task description
     * @returns Decision with reasoning and suggested steps
     */
    shouldUsePipeline(task: string): IPipelineDecision;
    /**
     * Build a pipeline definition from a complex task.
     *
     * Implements FR-017, FR-018, FR-019
     *
     * @param task - The task description
     * @param taskType - Type of task (code, ask, research, write)
     * @param baseName - Optional base name for the pipeline
     * @returns Pipeline definition ready for execution
     * @throws PipelineDefinitionError if pipeline cannot be built
     */
    buildPipelineDefinition(task: string, taskType?: TaskType, baseName?: string): IPipelineDefinition;
    /**
     * Get the appropriate single agent for a simple task.
     *
     * Used when shouldUsePipeline() returns false.
     *
     * @param task - The task description
     * @param taskType - Type of task
     * @returns Agent key to use
     */
    getSingleAgent(task: string, taskType: TaskType): string;
    /**
     * Generate a descriptive pipeline name from task.
     */
    private generatePipelineName;
    /**
     * Extract the phase key from a step description.
     */
    private extractPhaseKey;
    /**
     * Get a default mapping for an unknown phase.
     */
    private getDefaultMapping;
    /**
     * Get all available phase mappings.
     */
    getPhaseMappings(): Map<string, IAgentMapping>;
    /**
     * Get the configured pipeline threshold.
     */
    getThreshold(): number;
}
/**
 * Create a CommandTaskBridge instance.
 *
 * @param config - Configuration options
 * @returns Configured CommandTaskBridge instance
 */
export declare function createCommandTaskBridge(config?: ICommandTaskBridgeConfig): CommandTaskBridge;
//# sourceMappingURL=command-task-bridge.d.ts.map