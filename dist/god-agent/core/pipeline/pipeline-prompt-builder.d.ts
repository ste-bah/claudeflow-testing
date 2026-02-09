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
import type { ISemanticContext } from './leann-context-service.js';
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
    /** Output retrieved from previous agent (injected by PipelineExecutor) */
    previousOutput?: unknown;
    /** Metadata about the previous step that produced the output */
    previousStepData?: {
        /** Agent key of the previous agent */
        agentKey: string;
        /** Step index of the previous step */
        stepIndex: number;
        /** Domain where the output was stored */
        domain: string;
    };
    /** Semantic context from LEANN code search (optional) */
    semanticContext?: ISemanticContext;
    /** Situational awareness section for parallel agent coordination (optional) */
    situationalAwareness?: string;
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
     * Build memory retrieval section.
     * When previousOutput is provided, injects the ACTUAL data from the previous agent.
     * Otherwise, shows fallback instructions for manual retrieval.
     *
     * @param step - Current pipeline step containing inputDomain and inputTags
     * @param pipelineId - Unique pipeline execution ID used for filtering stored knowledge
     * @param initialInput - Optional initial input for first agent (takes precedence at stepIndex=0)
     * @param stepIndex - Current step index (0-based); determines if this is the first agent
     * @param previousOutput - Actual output retrieved from previous agent; when provided, data is injected directly
     * @param previousStepData - Metadata about the previous step (agentKey, stepIndex, domain) for context
     * @returns Formatted markdown section for memory retrieval with either injected data,
     *          fallback retrieval instructions, or N/A message for first agent
     */
    buildMemoryRetrievalSection(step: IPipelineStep, pipelineId: string, initialInput?: unknown, stepIndex?: number, previousOutput?: unknown, previousStepData?: {
        agentKey: string;
        stepIndex: number;
        domain: string;
    }): string;
    /**
     * Build memory retrieval section with injected actual data.
     * This is the preferred path - agents receive real data from previous agent.
     */
    private buildInjectedMemorySection;
    /**
     * Safely stringify a value, handling circular references and BigInt.
     * Prevents JSON.stringify from throwing on circular structures.
     *
     * @param value - Value to serialize
     * @param indent - Indentation spaces (default 2)
     * @returns JSON string with circular references marked as [Circular Reference]
     */
    private safeStringify;
    /**
     * Safely truncate a string without splitting multibyte UTF-8 characters.
     * Uses code points instead of code units for proper Unicode handling.
     * Note: maxLength applies to the final string length (code units), not code points,
     * but we truncate at code point boundaries to avoid corrupting characters.
     *
     * @param str - String to truncate
     * @param maxLength - Maximum length in code units (bytes in output)
     * @returns Truncated string with indicator if truncated
     */
    private safeTruncate;
    /**
     * Build fallback retrieval section when data could not be pre-retrieved.
     * Shows instructions for manual retrieval.
     */
    private buildFallbackRetrievalSection;
    /**
     * Build semantic context section from LEANN code search results.
     * Provides relevant code snippets to help the agent understand the codebase.
     *
     * @param context - Semantic context containing code search results
     * @returns Formatted markdown section with code context
     */
    private buildSemanticContextSection;
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