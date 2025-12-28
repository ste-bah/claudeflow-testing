/**
 * PipelineConfigLoader - Loads pipeline configuration from agent definition files
 * Implements REQ-PIPE-040 (support all 45+ agents)
 */
/**
 * Agent configuration from definition file
 */
export interface AgentConfig {
    key: string;
    name: string;
    phase: number;
    order: number;
    description: string;
    type?: string;
    dependencies: string[];
    timeout: number;
    critical: boolean;
    expectedOutputs: string[];
    inputs: string[];
    outputs: string[];
}
/**
 * Pipeline configuration
 */
export interface PipelineConfig {
    id: string;
    name: string;
    agents: AgentConfig[];
}
/**
 * PipelineConfigLoader class
 */
export declare class PipelineConfigLoader {
    private configCache;
    private basePath;
    constructor(basePath?: string);
    /**
     * Load pipeline configuration from agent definition files
     * Returns config with all 45+ agents
     * [REQ-PIPE-040]
     */
    loadPipelineConfig(): Promise<PipelineConfig>;
    /**
     * Parse agent definition markdown file
     * Extract frontmatter and content
     */
    private parseAgentDefinition;
    /**
     * Determine phase from agent key and frontmatter
     */
    private determinePhase;
    /**
     * Simple YAML parser for frontmatter
     */
    private parseYAML;
    /**
     * Get agent by index
     */
    getAgentByIndex(index: number): Promise<AgentConfig>;
    /**
     * Get agent by key
     */
    getAgentByKey(key: string): Promise<AgentConfig | undefined>;
    /**
     * Check if agent is in Phase 6 (writing phase)
     */
    isPhase6Agent(agent: AgentConfig): boolean;
    /**
     * Get agents for a specific phase
     */
    getAgentsForPhase(phase: number): Promise<AgentConfig[]>;
    /**
     * Clear cache to force reload
     */
    clearCache(): void;
}
//# sourceMappingURL=pipeline-loader.d.ts.map