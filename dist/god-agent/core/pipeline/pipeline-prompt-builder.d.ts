/**
 * DAI-002: Pipeline Prompt Builder
 * TASK-003: Builds forward-looking prompts for pipeline agents
 *
 * RULE-007: Forward-Looking Agent Prompts
 * - Every agent prompt MUST include workflow context
 * - Agents MUST know their position in pipeline
 * - Agents MUST know what previous agents produced
 * - Agents MUST know what next agents need
 *
 * This achieves 88% success rate vs 60% without context (per constitution)
 */
import type { AgentRegistry } from '../agents/agent-registry.js';
import type { IPipelineDefinition, IPipelineStep } from './dai-002-types.js';
/**
 * Context data used to build a pipeline prompt
 */
export interface IPromptContext {
    /** Current step being executed */
    step: IPipelineStep;
    /** Index of current step (0-based) */
    stepIndex: number;
    /** Full pipeline definition */
    pipeline: IPipelineDefinition;
    /** Unique pipeline execution ID */
    pipelineId: string;
    /** Optional initial input for first agent */
    initialInput?: unknown;
}
/**
 * Built prompt result
 */
export interface IBuiltPrompt {
    /** The complete prompt string */
    prompt: string;
    /** Agent key (resolved or from step) */
    agentKey: string | undefined;
    /** Agent description if available */
    agentDescription: string | undefined;
    /** Step number (1-based for display) */
    stepNumber: number;
    /** Total steps in pipeline */
    totalSteps: number;
}
/**
 * Builds forward-looking prompts for pipeline agents.
 * Implements RULE-007: Every prompt includes workflow context.
 *
 * @example
 * ```typescript
 * const builder = new PipelinePromptBuilder(agentRegistry);
 * const prompt = builder.buildPrompt({
 *   step: pipelineStep,
 *   stepIndex: 0,
 *   pipeline: pipelineDefinition,
 *   pipelineId: 'pip_123'
 * });
 * ```
 */
export declare class PipelinePromptBuilder {
    private readonly agentRegistry;
    /**
     * Create a new prompt builder
     * @param agentRegistry - Registry to look up agent descriptions
     */
    constructor(agentRegistry: AgentRegistry);
    /**
     * Build a forward-looking prompt for a pipeline step.
     * Includes workflow context, memory retrieval, task, and memory storage sections.
     *
     * @param context - Context containing step, pipeline, and execution info
     * @returns Built prompt with metadata
     */
    buildPrompt(context: IPromptContext): IBuiltPrompt;
    /**
     * Assemble the full prompt from sections
     */
    private assemblePrompt;
    /**
     * Build agent header section
     */
    private buildAgentHeader;
    /**
     * Build workflow context section (RULE-007 core requirement)
     */
    private buildWorkflowContext;
    /**
     * Format previous agent context
     */
    formatPreviousContext(previousStep?: IPipelineStep): string;
    /**
     * Format next agent context
     */
    formatNextContext(nextStep?: IPipelineStep): string;
    /**
     * Build memory retrieval section
     */
    buildMemoryRetrievalSection(step: IPipelineStep, pipelineId: string, initialInput?: unknown, stepIndex?: number): string;
    /**
     * Build task section
     */
    private buildTaskSection;
    /**
     * Build memory storage section
     */
    buildMemoryStorageSection(step: IPipelineStep, stepIndex: number, pipelineId: string): string;
    /**
     * Build quality requirements section
     */
    private buildQualitySection;
    /**
     * Build success criteria section
     */
    private buildSuccessCriteria;
}
/**
 * Create a PipelinePromptBuilder with a given agent registry
 * @param agentRegistry - Initialized agent registry
 * @returns PipelinePromptBuilder instance
 */
export declare function createPipelinePromptBuilder(agentRegistry: AgentRegistry): PipelinePromptBuilder;
//# sourceMappingURL=pipeline-prompt-builder.d.ts.map