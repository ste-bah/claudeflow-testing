/**
 * ContextInjector - Prior Context Retrieval and Injection
 *
 * Implements: TASK-ORC-006 (TECH-ORC-001 lines 680-756)
 *
 * Queries InteractionStore for relevant prior knowledge and injects it
 * into task prompts as a "## PRIOR CONTEXT" section with token limit enforcement.
 *
 * @module orchestration/services/context-injector
 */
import type { InteractionStore } from '../../universal/interaction-store.js';
import type { IContextInjection } from '../types.js';
/**
 * ContextInjector - Injects prior context into task prompts
 */
export declare class ContextInjector {
    private interactionStore;
    private maxContextTokens;
    /**
     * Initialize with InteractionStore
     *
     * @param interactionStore - InteractionStore instance
     * @param maxContextTokens - Maximum tokens for context (default: 8000)
     */
    constructor(interactionStore: InteractionStore, maxContextTokens?: number);
    /**
     * Inject context into prompt
     *
     * @param prompt - Original prompt
     * @param domain - Domain to query
     * @param tags - Tags for filtering
     * @returns Context injection result
     */
    injectContext(prompt: string, domain: string, tags: string[]): Promise<IContextInjection>;
    /**
     * Filter entries by tags (OR logic)
     *
     * @param entries - Knowledge entries
     * @param tags - Tags to filter by
     * @returns Filtered entries
     */
    private filterByTags;
    /**
     * Sort entries by quality (desc), then lastUsed (desc)
     *
     * @param entries - Knowledge entries
     * @returns Sorted entries
     */
    private sortEntries;
    /**
     * Summarize context entries to fit token limit
     *
     * @param entries - Knowledge entries
     * @param maxTokens - Maximum tokens
     * @returns Summarized context string
     */
    private summarizeContext;
    /**
     * Estimate token count for text
     *
     * Algorithm (from spec lines 1070-1076):
     * - Base: text.length * 0.75
     * - Non-ASCII chars: 1.5x weight
     * - Code blocks: 0.9x weight
     * - Special chars: 1.0x weight
     * - Error tolerance: ±15%
     *
     * @param text - Text to estimate
     * @returns Estimated token count
     */
    private estimateTokens;
    /**
     * Truncate content to max length
     *
     * @param content - Content to truncate
     * @param maxLength - Maximum length
     * @returns Truncated content
     */
    private truncateContent;
    /**
     * Merge with existing context section
     *
     * @param prompt - Prompt with existing context
     * @param newContext - New context to add
     * @returns Merged prompt
     */
    private mergeContextSections;
}
//# sourceMappingURL=context-injector.d.ts.map