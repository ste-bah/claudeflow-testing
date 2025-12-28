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
export class HybridSearchProvider {
    verbose;
    constructor(options = {}) {
        this.verbose = options.verbose ?? false;
    }
    async search(query, options) {
        const toolInfo = this.selectToolForDepth(query, options);
        if (this.verbose) {
            console.log(`[HybridSearchProvider] Depth: ${options.depth} → Tool: ${toolInfo.tool}`);
        }
        // Return a structured result indicating what tool should be invoked
        return [{
                content: this.formatToolInvocationMessage(toolInfo),
                source: 'hybrid-search-provider',
                relevance: 1.0,
                timestamp: new Date(),
                citations: [
                    `Tool to invoke: ${toolInfo.tool}`,
                    `Parameters: ${JSON.stringify(toolInfo.parameters)}`,
                ],
            }];
    }
    /**
     * Select the appropriate tool based on search depth
     */
    selectToolForDepth(query, options) {
        switch (options.depth) {
            case 'quick':
                return this.getWebSearchInvocation(query, options);
            case 'medium':
                return this.getPerplexityAskInvocation(query, options);
            case 'deep':
                return this.getPerplexityResearchInvocation(query, options);
            default:
                return this.getWebSearchInvocation(query, options);
        }
    }
    /**
     * Get invocation details for native Claude Code WebSearch
     */
    getWebSearchInvocation(query, options) {
        return {
            tool: 'WebSearch',
            parameters: {
                query,
                allowed_domains: options.domains,
                max_results: options.maxResults ?? 10,
            },
            expectedFormat: 'Array of search results with titles, URLs, and snippets',
        };
    }
    /**
     * Get invocation details for Perplexity Ask MCP tool
     */
    getPerplexityAskInvocation(query, _options) {
        return {
            tool: 'mcp__perplexity__perplexity_ask',
            parameters: {
                messages: [{ role: 'user', content: query }],
            },
            expectedFormat: 'Conversational response with optional citations',
        };
    }
    /**
     * Get invocation details for Perplexity Research MCP tool
     */
    getPerplexityResearchInvocation(query, _options) {
        return {
            tool: 'mcp__perplexity__perplexity_research',
            parameters: {
                messages: [{ role: 'user', content: query }],
                strip_thinking: true, // Save context tokens
            },
            expectedFormat: 'Comprehensive research response with citations',
        };
    }
    /**
     * Format a human-readable message about what tool should be invoked
     */
    formatToolInvocationMessage(toolInfo) {
        return [
            `Web search required using: ${toolInfo.tool}`,
            `Query parameters: ${JSON.stringify(toolInfo.parameters, null, 2)}`,
            `Expected format: ${toolInfo.expectedFormat}`,
            '',
            'This search provider cannot directly invoke MCP tools from TypeScript.',
            'The orchestrating Claude Code agent must invoke the tool and process results.',
        ].join('\n');
    }
    getAvailableSources() {
        return ['websearch', 'perplexity-ask', 'perplexity-research'];
    }
    async isAvailable() {
        // Native WebSearch is always available in Claude Code
        // Perplexity tools are configured in .mcp.json
        return true;
    }
    /**
     * Parse results from native WebSearch tool
     * This is a utility method for when the orchestrating agent processes results
     */
    static parseWebSearchResults(result) {
        if (Array.isArray(result)) {
            return result.map((r) => ({
                content: r.snippet || r.description || r.title || '',
                source: r.url || 'websearch',
                url: r.url,
                relevance: 0.9,
                timestamp: new Date(),
            }));
        }
        // Single result
        return [{
                content: typeof result === 'string' ? result : JSON.stringify(result),
                source: 'websearch',
                relevance: 1.0,
                timestamp: new Date(),
            }];
    }
    /**
     * Parse results from Perplexity MCP tools
     * This is a utility method for when the orchestrating agent processes results
     */
    static parsePerplexityResults(result, source) {
        return [{
                content: result.content || JSON.stringify(result),
                source,
                relevance: 1.0,
                timestamp: new Date(),
                citations: result.citations || [],
            }];
    }
}
//# sourceMappingURL=hybrid-search-provider.js.map