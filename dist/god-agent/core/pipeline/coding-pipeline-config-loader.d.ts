/**
 * CodingPipelineConfigLoader - Loads pipeline configuration from agent definition files
 *
 * Implements REQ-PIPE-047 (support all 47 coding agents)
 * Pattern from: PipelineConfigLoader in pipeline-loader.ts
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-config-loader
 */
import type { CodingPipelinePhase, IAgentMapping, AlgorithmType } from './types.js';
/**
 * Coding agent configuration from definition file
 */
export interface CodingAgentConfig {
    /** Unique agent key (filename without .md) */
    key: string;
    /** Human-readable name */
    name: string;
    /** Pipeline phase */
    phase: CodingPipelinePhase;
    /** Execution order within pipeline */
    order: number;
    /** Agent description */
    description: string;
    /** Agent type from frontmatter */
    type: string;
    /** Agent category */
    category: string;
    /** Version string */
    version: string;
    /** Priority level */
    priority: 'critical' | 'high' | 'medium' | 'low';
    /** Agent capabilities */
    capabilities: string[];
    /** Available tools */
    tools: string[];
    /** Quality gates */
    qualityGates: string[];
    /** Pre/post hooks */
    hooks: {
        pre?: string;
        post?: string;
    };
    /** Algorithm for this agent */
    algorithm: AlgorithmType;
    /** Fallback algorithm */
    fallbackAlgorithm?: AlgorithmType;
    /** If true, pipeline halts on failure */
    critical: boolean;
    /** Full markdown content */
    fullContent: string;
}
/**
 * Coding pipeline configuration
 */
export interface CodingPipelineConfig {
    id: string;
    name: string;
    agents: CodingAgentConfig[];
}
/**
 * CodingPipelineConfigLoader class
 *
 * Dynamically loads agent configurations from .claude/agents/coding-pipeline/*.md files.
 * This replaces the hardcoded CODING_PIPELINE_MAPPINGS with file-driven configuration.
 */
export declare class CodingPipelineConfigLoader {
    private configCache;
    private basePath;
    constructor(basePath?: string);
    /**
     * Load pipeline configuration from agent definition files
     * Returns config with all 47 agents
     * [REQ-PIPE-047]
     */
    loadPipelineConfig(): Promise<CodingPipelineConfig>;
    /**
     * Parse agent definition markdown file
     * Extract frontmatter and content
     */
    private parseAgentDefinition;
    /**
     * Parse priority string to typed value
     */
    private parsePriority;
    /**
     * Parse string array from frontmatter
     */
    private parseStringArray;
    /**
     * Parse hooks from frontmatter
     */
    private parseHooks;
    /**
     * Derive pipeline phase from AGENT_ORDER position
     * This is the source of truth for phase assignment
     */
    private derivePhaseFromOrder;
    /**
     * Get fallback algorithm for primary algorithm
     */
    private getFallbackAlgorithm;
    /**
     * Get agent by index
     */
    getAgentByIndex(index: number): Promise<CodingAgentConfig>;
    /**
     * Get agent by key
     */
    getAgentByKey(key: string): Promise<CodingAgentConfig | undefined>;
    /**
     * Get agents for a specific phase
     */
    getAgentsForPhase(phase: CodingPipelinePhase): Promise<CodingAgentConfig[]>;
    /**
     * Get Sherlock reviewer agents
     */
    getSherlockAgents(): Promise<CodingAgentConfig[]>;
    /**
     * Get critical agents
     */
    getCriticalAgents(): Promise<CodingAgentConfig[]>;
    /**
     * Convert CodingAgentConfig to IAgentMapping for orchestrator compatibility
     */
    getAgentMappings(): Promise<IAgentMapping[]>;
    /**
     * Clear cache to force reload
     */
    clearCache(): void;
    /**
     * Validate all agent files exist and are parseable
     */
    validateAgentFiles(): Promise<{
        valid: boolean;
        errors: string[];
    }>;
}
/**
 * Create a new CodingPipelineConfigLoader instance
 */
export declare function createCodingPipelineConfigLoader(basePath?: string): CodingPipelineConfigLoader;
/**
 * Get agent mappings for the coding pipeline
 * Convenience function that loads config and returns IAgentMapping array
 */
export declare function loadCodingPipelineMappings(basePath?: string): Promise<IAgentMapping[]>;
//# sourceMappingURL=coding-pipeline-config-loader.d.ts.map