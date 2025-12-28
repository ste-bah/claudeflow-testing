/**
 * Agent Execution Service
 * TASK-DEV-002 - Service for executing individual development agents
 *
 * Provides simplified API for:
 * - Single agent execution
 * - Agent listing and filtering
 * - Agent information retrieval
 * - Sequential agent chains
 */
import type { AgentRegistry } from '../agents/agent-registry.js';
import type { IAgentExecutor } from '../orchestration/orchestration-types.js';
import type { SonaEngine } from '../learning/sona-engine.js';
import type { IMemoryEngine } from '../pipeline/phd-pipeline-runner.js';
import type { IAgentExecutionOptions, IAgentExecutionResult, IAgentChainStep, IAgentChainResult, IAgentFilter, IAgentInfo, IAgentExecutionServiceConfig } from '../types/agent-execution-types.js';
/**
 * AgentExecutionService
 *
 * High-level service for executing individual development agents.
 * Wraps AgentRegistry and IAgentExecutor for simplified API.
 */
export declare class AgentExecutionService {
    private registry;
    private executor;
    private sonaEngine?;
    private memoryEngine?;
    private config;
    constructor(registry: AgentRegistry, executor: IAgentExecutor, config?: IAgentExecutionServiceConfig, sonaEngine?: SonaEngine, memoryEngine?: IMemoryEngine);
    /**
     * Execute a single agent with a task
     *
     * @param agentKey - Agent key (e.g., 'coder', 'tester')
     * @param task - Task description
     * @param options - Execution options
     * @returns Execution result
     */
    executeAgent(agentKey: string, task: string, options?: IAgentExecutionOptions): Promise<IAgentExecutionResult>;
    /**
     * Execute a chain of agents sequentially
     *
     * @param steps - Array of agent steps to execute
     * @param options - Chain-level options
     * @returns Chain execution result
     */
    executeChain(steps: IAgentChainStep[], options?: IAgentExecutionOptions): Promise<IAgentChainResult>;
    /**
     * List available agents with optional filtering
     *
     * @param filter - Filter options
     * @returns Array of agent info
     */
    listAgents(filter?: IAgentFilter): IAgentInfo[];
    /**
     * Get detailed info about a specific agent
     *
     * @param agentKey - Agent key
     * @returns Agent info or null if not found
     */
    getAgentInfo(agentKey: string): IAgentInfo | null;
    /**
     * Get all category names
     */
    getCategories(): string[];
    /**
     * Get agent count
     */
    getAgentCount(): number;
    /**
     * Convert loaded definition to agent info
     */
    private toAgentInfo;
    /**
     * Build the full prompt for agent execution
     */
    private buildPrompt;
    /**
     * Build memory key for storing agent output
     */
    private buildMemoryKey;
    /**
     * Create timeout promise
     */
    private createTimeoutPromise;
    /**
     * Create error result
     */
    private createErrorResult;
    /**
     * Log message if verbose
     */
    private log;
}
/**
 * Create an AgentExecutionService
 */
export declare function createAgentExecutionService(registry: AgentRegistry, executor: IAgentExecutor, config?: IAgentExecutionServiceConfig, sonaEngine?: SonaEngine, memoryEngine?: IMemoryEngine): AgentExecutionService;
//# sourceMappingURL=agent-execution-service.d.ts.map