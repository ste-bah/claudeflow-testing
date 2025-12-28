/**
 * Hybrid Search Provider
 *
 * Uses a hybrid approach for web search:
 * - quick: Native Claude Code WebSearch (fast, built-in)
 * - medium: Perplexity Ask MCP (conversational with citations)
 * - deep: Perplexity Research MCP (comprehensive research)
 *
 * Note: This provider returns structured instructions for tool invocation.
 * The actual tool calls must be made by the orchestrating Claude Code agent,
 * as MCP tools cannot be directly called from TypeScript runtime.
 */
import type { IWebSearchProvider, ISearchResult, ISearchOptions } from './web-search-provider.js';
export interface McpToolInvocation {
    tool: string;
    parameters: Record<string, unknown>;
    expectedFormat: string;
}
export declare class HybridSearchProvider implements IWebSearchProvider {
    private verbose;
    constructor(options?: {
        verbose?: boolean;
    });
    search(query: string, options: ISearchOptions): Promise<ISearchResult[]>;
    /**
     * Select the appropriate tool based on search depth
     */
    private selectToolForDepth;
    /**
     * Get invocation details for native Claude Code WebSearch
     */
    private getWebSearchInvocation;
    /**
     * Get invocation details for Perplexity Ask MCP tool
     */
    private getPerplexityAskInvocation;
    /**
     * Get invocation details for Perplexity Research MCP tool
     */
    private getPerplexityResearchInvocation;
    /**
     * Format a human-readable message about what tool should be invoked
     */
    private formatToolInvocationMessage;
    getAvailableSources(): string[];
    isAvailable(): Promise<boolean>;
    /**
     * Parse results from native WebSearch tool
     * This is a utility method for when the orchestrating agent processes results
     */
    static parseWebSearchResults(result: unknown): ISearchResult[];
    /**
     * Parse results from Perplexity MCP tools
     * This is a utility method for when the orchestrating agent processes results
     */
    static parsePerplexityResults(result: Record<string, unknown>, source: string): ISearchResult[];
}
//# sourceMappingURL=hybrid-search-provider.d.ts.map