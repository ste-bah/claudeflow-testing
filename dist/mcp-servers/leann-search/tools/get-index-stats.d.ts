/**
 * LEANN Search MCP Server - Get Index Stats Tool
 *
 * Implements index statistics retrieval for the LEANN semantic code search.
 * Provides detailed information about indexed code, memory usage, and LEANN metrics.
 *
 * @module mcp-servers/leann-search/tools/get-index-stats
 */
import type { ToolExecutionContext } from './semantic-code-search.js';
import type { GetStatsInput, GetStatsOutput } from '../types.js';
/**
 * Get comprehensive index statistics
 *
 * This tool:
 * 1. Retrieves basic counts (vectors, files, repositories)
 * 2. Optionally calculates breakdowns by language, repository, symbol type
 * 3. Optionally includes memory usage details
 * 4. Optionally includes LEANN-specific statistics
 *
 * @param input - Options for what statistics to include
 * @param context - Tool execution context
 * @returns Detailed index statistics
 */
export declare function getIndexStats(input: GetStatsInput, context: ToolExecutionContext): Promise<GetStatsOutput>;
/**
 * MCP Tool definition for get_stats
 */
export declare const GET_INDEX_STATS_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            includeLanguageBreakdown: {
                type: string;
                description: string;
                default: boolean;
            };
            includeRepositoryBreakdown: {
                type: string;
                description: string;
                default: boolean;
            };
            includeSymbolBreakdown: {
                type: string;
                description: string;
                default: boolean;
            };
            includeMemoryDetails: {
                type: string;
                description: string;
                default: boolean;
            };
            includeLeannDetails: {
                type: string;
                description: string;
                default: boolean;
            };
        };
        required: never[];
    };
};
/**
 * Quick summary function for simple stats check
 */
export declare function getQuickStats(context: ToolExecutionContext): Promise<{
    totalIndexed: number;
    uniqueFiles: number;
    hubCacheHitRatio: number;
}>;
//# sourceMappingURL=get-index-stats.d.ts.map