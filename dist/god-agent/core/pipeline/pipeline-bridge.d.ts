/**
 * Pipeline Bridge
 * TASK-BRG-001 - Base class for bridging pipeline config to orchestrator format
 *
 * Converts IPipelineConfig to IPipelineDefinition with:
 * - Topological sort for dependency ordering
 * - Memory key chain building
 * - Agent config to definition mapping
 */
import type { IPipelineConfig, IAgentConfig, IPhaseConfig, AgentId } from './pipeline-types.js';
import type { IPipelineDefinition, IAgentDefinition } from '../orchestration/orchestration-types.js';
import type { AgentRegistry } from '../agents/agent-registry.js';
import type { ILoadedAgentDefinition } from '../agents/agent-types.js';
/**
 * Bridge configuration options
 */
export interface IPipelineBridgeConfig {
    /** Category prefix for memory keys (e.g., 'phd', 'core') */
    category: string;
    /** Include loaded agent prompts in task description */
    includeAgentPrompts?: boolean;
    /** Prefix for memory keys */
    memoryPrefix?: string;
    /** Enforce strict dependency ordering */
    strictOrdering?: boolean;
}
/**
 * Result of topological sort
 */
export interface ITopologicalSortResult {
    /** Sorted agents in execution order */
    sorted: IAgentConfig[];
    /** Any agents that couldn't be sorted (cycles) */
    unsortable: IAgentConfig[];
    /** Detected cycles (if any) */
    cycles: AgentId[][];
    /** Success flag */
    success: boolean;
}
/**
 * Mapped agent definition with source info
 */
export interface IMappedAgentDefinition extends IAgentDefinition {
    /** Original agent config */
    sourceConfig: IAgentConfig;
    /** Loaded definition (if found) */
    loadedDefinition?: ILoadedAgentDefinition;
}
/**
 * Base Pipeline Bridge
 *
 * Converts pipeline configuration to orchestrator-compatible format.
 * Override buildTaskDescription() and buildQualityGate() for custom behavior.
 */
export declare class PipelineBridge {
    protected config: IPipelineConfig;
    protected registry: AgentRegistry | null;
    protected bridgeConfig: IPipelineBridgeConfig;
    protected phaseMap: Map<number, IPhaseConfig>;
    constructor(config: IPipelineConfig, registry?: AgentRegistry | null, bridgeConfig?: Partial<IPipelineBridgeConfig>);
    /**
     * Build pipeline definition from config
     * @param executionId - Unique execution identifier for memory key namespacing
     */
    buildPipelineDefinition(executionId: string): IPipelineDefinition;
    /**
     * Topological sort using Kahn's algorithm
     * Returns agents in dependency-respecting order
     */
    topologicalSort(agents: IAgentConfig[]): ITopologicalSortResult;
    /**
     * Detect cycles in dependency graph
     */
    protected detectCycles(agents: IAgentConfig[], unsortable: IAgentConfig[]): AgentId[][];
    /**
     * Build memory key with proper namespacing
     */
    protected buildMemoryKey(executionId: string, agentKey: string, suffix: string): string;
    /**
     * Get phase name from phase ID
     */
    protected getPhaseName(phaseId: number): string;
    /**
     * Build task description for agent
     * Override in subclasses for custom behavior
     */
    protected buildTaskDescription(agentConfig: IAgentConfig, loadedDef: ILoadedAgentDefinition | null): string;
    /**
     * Build quality gate for agent
     * Override in subclasses for custom behavior
     */
    protected buildQualityGate(agentConfig: IAgentConfig, _loadedDef: ILoadedAgentDefinition | null): string;
    /**
     * Validate that all pipeline agents have definitions in registry
     */
    validateAgentDefinitions(): {
        valid: boolean;
        missing: string[];
        found: string[];
    };
    /**
     * Get pipeline statistics
     */
    getStatistics(): {
        totalAgents: number;
        phases: number;
        criticalAgents: number;
        avgDependencies: number;
    };
}
export type { IPipelineConfig, IAgentConfig, IPhaseConfig };
//# sourceMappingURL=pipeline-bridge.d.ts.map