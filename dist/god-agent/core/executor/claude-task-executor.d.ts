/**
 * Claude Task Executor
 * TASK-EXE-001 - IAgentExecutor implementation using Claude Code Task tool
 *
 * Implements the IAgentExecutor interface from orchestration-types.ts.
 * Executes agents by spawning Claude Code Tasks with the combined prompt
 * (agent system prompt + orchestrator context).
 */
import type { IAgentExecutor, IAgentDefinition } from '../orchestration/orchestration-types.js';
import type { AgentRegistry } from '../agents/agent-registry.js';
import type { ILoadedAgentDefinition } from '../agents/agent-types.js';
import type { IExecutorConfig } from './executor-types.js';
import { HookRunner } from './hook-runner.js';
/**
 * ClaudeTaskExecutor
 *
 * Implements IAgentExecutor using Claude Code's Task tool.
 * Combines orchestrator prompts with agent system prompts from markdown definitions.
 *
 * Execution flow:
 * 1. Look up loaded agent definition by key
 * 2. Run pre-hooks (memory retrieval)
 * 3. Build combined prompt (system + context)
 * 4. Spawn Claude Code Task
 * 5. Run post-hooks (memory storage)
 * 6. Return output
 */
export declare class ClaudeTaskExecutor implements IAgentExecutor {
    private registry;
    private config;
    private hookRunner;
    constructor(registry: AgentRegistry, config?: Partial<IExecutorConfig>);
    /**
     * Execute an agent with the given prompt
     *
     * Implements IAgentExecutor interface from orchestration-types.ts
     *
     * @param prompt - Orchestrator-provided prompt with memory context
     * @param agent - Agent definition from pipeline
     * @returns Agent output string
     */
    execute(prompt: string, agent: IAgentDefinition): Promise<string>;
    /**
     * Execute agent once (internal implementation)
     */
    private executeOnce;
    /**
     * Build full prompt combining agent system prompt and orchestrator context
     */
    buildFullPrompt(orchestratorPrompt: string, loadedDef?: ILoadedAgentDefinition, agent?: IAgentDefinition): string;
    /**
     * Determine the subagent type to use for Task tool
     */
    private determineSubagentType;
    /**
     * Map agent type to Task tool subagent type
     */
    private mapToTaskToolType;
    /**
     * Spawn a Claude Code Task
     *
     * This is the core integration point with Claude Code's Task tool.
     * Executes agents via real Claude CLI or falls back to mock.
     */
    private spawnClaudeTask;
    /**
     * Execute Claude CLI with proper command structure
     *
     * CORRECT CLI SYNTAX (v1.2):
     * claude --print --system-prompt "<agentInstructions>" --output-format json "<prompt>"
     *
     * NOTE: NO --agent flag! That's for SESSION selection only, not subagent types.
     * subagentType is for INTERNAL classification only (logging, metrics).
     */
    private executeClaudeCLI;
    /**
     * Build system prompt from loaded agent definition
     *
     * Formats agent instructions for CLI --system-prompt flag.
     */
    private buildSystemPrompt;
    /**
     * Mock task execution for testing
     *
     * Replace this method with real Task tool invocation in production.
     */
    private mockTaskExecution;
    /**
     * Build environment variables for hooks
     */
    private buildHookEnv;
    /**
     * Delay helper
     */
    private delay;
    /**
     * Update configuration
     */
    setConfig(config: Partial<IExecutorConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): IExecutorConfig;
    /**
     * Get hook runner instance
     */
    getHookRunner(): HookRunner;
}
/**
 * MockClaudeTaskExecutor
 *
 * A configurable mock executor for testing.
 * Allows setting specific responses per agent.
 */
export declare class MockClaudeTaskExecutor implements IAgentExecutor {
    private responses;
    private defaultResponse;
    private failingAgents;
    private responseDelay;
    private verbose;
    /**
     * Set response for a specific agent
     */
    setResponse(agentKey: string, response: string): void;
    /**
     * Set default response for all agents
     */
    setDefaultResponse(response: string): void;
    /**
     * Mark an agent as failing
     */
    setFailing(agentKey: string, failing?: boolean): void;
    /**
     * Set response delay
     */
    setResponseDelay(delay: number): void;
    /**
     * Enable verbose logging
     */
    setVerbose(verbose: boolean): void;
    /**
     * Execute agent (mock implementation)
     */
    execute(_prompt: string, agent: IAgentDefinition): Promise<string>;
    /**
     * Clear all configuration
     */
    clear(): void;
}
/**
 * Create a Claude Task Executor
 */
export declare function createClaudeTaskExecutor(registry: AgentRegistry, config?: Partial<IExecutorConfig>): ClaudeTaskExecutor;
/**
 * Create a mock executor for testing
 */
export declare function createMockExecutor(): MockClaudeTaskExecutor;
//# sourceMappingURL=claude-task-executor.d.ts.map