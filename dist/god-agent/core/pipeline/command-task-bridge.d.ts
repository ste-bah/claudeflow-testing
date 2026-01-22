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
 *
 * REFACTORED: Constitution compliance - split into 6 modules (< 500 lines each)
 */
import { type IPipelineDefinition } from './dai-002-types.js';
export type { IComplexityAnalysis, IPipelineDecision, TaskType, IAgentMapping, ICommandTaskBridgeConfig, } from './command-task-bridge-types.js';
export { DEFAULT_PIPELINE_THRESHOLD, PHASE_KEYWORDS, DOCUMENT_KEYWORDS, MULTI_STEP_PATTERNS, CONNECTOR_WORDS, DEFAULT_PHASE_MAPPINGS, DOCUMENT_AGENT_MAPPING, } from './command-task-bridge-constants.js';
export { CODING_PIPELINE_MAPPINGS, getAgentsForPhase, buildPipelineDAG, getCriticalAgents, getAgentByKey, getTotalPipelineXP, getPhaseXPTotals, validatePipelineDependencies, getAgentsByCategory, getForensicReviewAgents, getParallelizableAgents, getPhaseExecutionOrder, } from './coding-pipeline-dag-builder.js';
import type { IComplexityAnalysis, IPipelineDecision, TaskType, IAgentMapping, ICommandTaskBridgeConfig } from './command-task-bridge-types.js';
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