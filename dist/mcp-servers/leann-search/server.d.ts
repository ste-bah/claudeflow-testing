/**
 * LEANN Search MCP Server - Core Server Implementation
 *
 * Implements the MCP protocol server for semantic code search using LEANN backend.
 * Handles tool registration, lifecycle management, and request routing.
 *
 * Tools provided:
 * - search_code: Natural language code search
 * - index_repository: Repository indexing
 * - index_code: Single code snippet indexing
 * - find_similar_code: Code similarity search
 * - get_stats: Index statistics
 *
 * @module mcp-servers/leann-search/server
 */
import type { LEANNMCPServerConfig, LEANNMCPServerState } from './types.js';
import { type ToolExecutionContext } from './tools/semantic-code-search.js';
/**
 * LEANN MCP Server
 *
 * Main server class that:
 * 1. Initializes the MCP protocol server
 * 2. Registers all 5 code search tools
 * 3. Manages LEANN backend and embedding provider lifecycle
 * 4. Routes tool calls to appropriate handlers
 * 5. Handles graceful shutdown and persistence
 */
export declare class LEANNMCPServer {
    private readonly server;
    private readonly config;
    private readonly logger;
    /** LEANN backend instance */
    private backend;
    /** Dual code embedding provider instance */
    private embeddingProvider;
    /** Metadata storage (maps vector IDs to code metadata) */
    private metadataStore;
    /** Code content storage (maps vector IDs to actual code) */
    private codeStore;
    /** Server state tracking */
    private state;
    /** Auto-save interval handle */
    private autoSaveInterval;
    /**
     * Create a new LEANN MCP Server
     *
     * @param config - Server configuration options
     */
    constructor(config?: Partial<LEANNMCPServerConfig>);
    /**
     * Set up MCP request handlers for tools listing and tool calls
     */
    private setupHandlers;
    /**
     * Execute a tool by name
     *
     * @param name - Tool name
     * @param args - Tool arguments
     * @param context - Execution context
     * @returns Tool result
     */
    private executeTool;
    /**
     * Initialize the server components
     *
     * Initializes:
     * 1. DualCodeEmbeddingProvider for query/code embeddings
     * 2. LEANNBackend for vector storage and search
     * 3. Auto-save interval (if configured)
     *
     * @throws Error if initialization fails
     */
    initialize(): Promise<void>;
    /**
     * Start the MCP server with stdio transport
     *
     * This connects the server to stdin/stdout for communication
     * with MCP clients.
     */
    start(): Promise<void>;
    /**
     * Gracefully shutdown the server
     *
     * Performs:
     * 1. Stops auto-save interval
     * 2. Persists index to disk
     * 3. Closes MCP server connection
     */
    shutdown(): Promise<void>;
    /**
     * Load index from disk
     */
    private loadIndex;
    /**
     * Save index to disk
     */
    private saveIndex;
    /**
     * Start auto-save interval
     */
    private startAutoSave;
    /**
     * Get current server state
     */
    getState(): LEANNMCPServerState;
    /**
     * Get server configuration
     */
    getConfig(): LEANNMCPServerConfig;
    /**
     * Get indexed item count
     */
    getIndexedCount(): number;
    /**
     * Get tool execution context for external use
     * (useful for testing or programmatic access)
     */
    getExecutionContext(): ToolExecutionContext | null;
}
/**
 * Main entry point for CLI execution
 *
 * Creates server, sets up signal handlers, and starts serving.
 */
export declare function main(): Promise<void>;
export type { ToolExecutionContext };
//# sourceMappingURL=server.d.ts.map