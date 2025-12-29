/**
 * ClaudeCodeExecutor - Executes prompts through Claude Code Task tool
 * TASK-FIX-006 - Foundation for quality assessment bug fix
 *
 * Implements: REQ-CONST-003, REQ-EXEC-001
 * Constitution: RULE-033 (quality on result), RULE-076 (dependency injection)
 *
 * This executor is the CRITICAL component that enables:
 * 1. Actual LLM execution (not just returning the prompt)
 * 2. Event emission to ObservabilityBus for quality assessment
 * 3. Execution metadata capture for learning
 */
import type { ITaskExecutor, IExecutionResult, IExecutorConfig } from './types.js';
/**
 * ClaudeCodeExecutor
 *
 * Executes prompts through the Claude Code system and emits events
 * to ObservabilityBus for downstream quality assessment.
 *
 * ARCHITECTURE:
 * 1. Receives prompt and optional agent type
 * 2. Emits 'execution:start' event to ObservabilityBus
 * 3. Executes prompt (actual implementation or mock for testing)
 * 4. Emits 'execution:complete' event with BOTH prompt AND output
 * 5. Returns execution result
 *
 * The execution:complete event is CRITICAL for RULE-033 compliance -
 * quality assessment subscribes to this event and assesses the OUTPUT.
 */
export declare class ClaudeCodeExecutor implements ITaskExecutor {
    private readonly bus;
    private readonly defaultAgent;
    private readonly timeoutMs;
    private readonly verbose;
    constructor(config?: IExecutorConfig);
    /**
     * Execute a prompt and return the LLM response
     *
     * CRITICAL: This method MUST:
     * 1. Actually execute the prompt (not just return it)
     * 2. Emit events for quality assessment
     * 3. Capture execution metadata
     */
    execute(prompt: string, agent?: string): Promise<IExecutionResult>;
    /**
     * Internal execution - this is where actual LLM calls would happen
     *
     * In production, this calls Claude Code's Task tool
     * Can be overridden in tests or subclasses
     */
    protected executeInternal(prompt: string, agent: string): Promise<string>;
    /**
     * Generate unique execution ID
     */
    private generateExecutionId;
    /**
     * Estimate token count (rough approximation)
     */
    private estimateTokens;
    /**
     * Emit execution start event to ObservabilityBus
     */
    private emitStartEvent;
    /**
     * Emit execution complete event to ObservabilityBus
     * CRITICAL: This event includes the OUTPUT for quality assessment
     */
    private emitCompleteEvent;
}
/**
 * Factory function to create executor with ObservabilityBus
 */
export declare function createClaudeCodeExecutor(config?: IExecutorConfig): ClaudeCodeExecutor;
//# sourceMappingURL=claude-code-executor.d.ts.map