/**
 * AgentExecutionTracker - Track agent lifecycle from spawn to completion
 *
 * Implements agent execution tracking with timing, status, and memory coordination.
 * Maintains bounded list of active and completed executions with FIFO eviction.
 *
 * @module observability/agent-tracker
 * @see TASK-OBS-003-AGENT-TRACKER.md
 * @see TECH-OBS-001-IMPLEMENTATION.md Section 3.4
 */
import { IAgentExecution, IMemoryEntry } from './types.js';
import { IActivityStream } from './activity-stream.js';
/**
 * Agent result data after completion
 */
export interface IAgentResult {
    /** Result output/summary */
    output: string;
    /** Quality score 0-1 */
    qualityScore?: number;
    /** Memory entries stored by this agent */
    memoryStored?: IMemoryEntry[];
}
/**
 * Input for starting agent from IPC event
 */
export interface IAgentStartInput {
    id: string;
    agentKey: string;
    agentName: string;
    category: string;
    pipelineId?: string;
    input: string;
    startTime: number;
}
/**
 * Input for completing agent from IPC event
 */
export interface IAgentCompleteInput {
    output: string;
    qualityScore?: number;
    durationMs: number;
}
/**
 * AgentExecutionTracker interface
 * Implements [REQ-OBS-04]: AgentExecutionTracker MUST track agent lifecycle
 */
export interface IAgentExecutionTracker {
    /**
     * Start tracking a new agent execution
     * @param execution Agent execution data (without endTime, durationMs, status)
     * @returns Unique execution ID
     */
    startAgent(execution: Omit<IAgentExecution, 'endTime' | 'durationMs' | 'status'>): string;
    /**
     * Start tracking agent from IPC event (with pre-generated ID)
     * Used by SocketServer when receiving events from God Agent processes
     * @param input Agent start input with pre-generated executionId
     */
    startAgentFromEvent(input: IAgentStartInput): void;
    /**
     * Mark agent execution as completed successfully
     * @param executionId The execution ID to complete
     * @param result Result data from agent execution
     */
    completeAgent(executionId: string, result: IAgentResult): void;
    /**
     * Mark agent as completed from IPC event
     * @param executionId The execution ID to complete
     * @param input Completion data from event
     */
    completeAgentFromEvent(executionId: string, input: IAgentCompleteInput): void;
    /**
     * Mark agent execution as failed
     * @param executionId The execution ID that failed
     * @param error The error that caused failure
     */
    failAgent(executionId: string, error: Error): void;
    /**
     * Mark agent as failed from IPC event
     * @param executionId The execution ID that failed
     * @param errorMessage Error message from event
     * @param durationMs Execution duration
     */
    failAgentFromEvent(executionId: string, errorMessage: string, durationMs: number): void;
    /**
     * Get all currently active agent executions
     * @returns Array of active executions
     */
    getActive(): IAgentExecution[];
    /**
     * Get executions by agent key (active + recent completed)
     * @param agentKey The agent key to filter by
     * @returns Array of matching executions
     */
    getByType(agentKey: string): IAgentExecution[];
    /**
     * Get a specific execution by ID
     * @param executionId The execution ID to retrieve
     * @returns The execution or null if not found
     */
    getById(executionId: string): IAgentExecution | null;
}
/**
 * AgentExecutionTracker implementation
 *
 * Implements:
 * - [REQ-OBS-04]: Agent lifecycle tracking
 * - [REQ-OBS-05]: Output summary, quality score, memory capture
 * - [RULE-OBS-004]: Memory bounds enforcement (50 completed max)
 */
export declare class AgentExecutionTracker implements IAgentExecutionTracker {
    private activityStream;
    private active;
    private completed;
    private readonly MAX_COMPLETED;
    /**
     * Create a new AgentExecutionTracker
     * @param activityStream ActivityStream for event emission
     */
    constructor(activityStream: IActivityStream);
    /**
     * Start tracking a new agent execution
     * Implements [REQ-OBS-04]: Track agent start
     *
     * @param execution Agent execution data
     * @returns Unique execution ID (format: exec_{agentKey}_{timestamp}_{random})
     */
    startAgent(execution: Omit<IAgentExecution, 'endTime' | 'durationMs' | 'status'>): string;
    /**
     * Mark agent execution as completed successfully
     * Implements [REQ-OBS-05]: Capture output, quality, memory
     *
     * @param executionId The execution ID to complete
     * @param result Result data from agent execution
     */
    completeAgent(executionId: string, result: IAgentResult): void;
    /**
     * Mark agent execution as failed
     *
     * @param executionId The execution ID that failed
     * @param error The error that caused failure
     */
    failAgent(executionId: string, error: Error): void;
    /**
     * Start tracking agent from IPC event (with pre-generated ID)
     * Used by SocketServer when receiving events from God Agent processes
     *
     * NOTE: This does NOT emit an event (the event already came from the God Agent
     * process via IPC). It just updates the tracker state.
     *
     * @param input Agent start input with pre-generated executionId
     */
    startAgentFromEvent(input: IAgentStartInput): void;
    /**
     * Mark agent as completed from IPC event
     * Used by SocketServer when receiving events from God Agent processes
     *
     * NOTE: This does NOT emit an event (the event already came from IPC).
     *
     * @param executionId The execution ID to complete
     * @param input Completion data from event
     */
    completeAgentFromEvent(executionId: string, input: IAgentCompleteInput): void;
    /**
     * Mark agent as failed from IPC event
     * Used by SocketServer when receiving events from God Agent processes
     *
     * NOTE: This does NOT emit an event (the event already came from IPC).
     *
     * @param executionId The execution ID that failed
     * @param errorMessage Error message from event
     * @param durationMs Execution duration
     */
    failAgentFromEvent(executionId: string, errorMessage: string, durationMs: number): void;
    /**
     * Get all currently active agent executions
     * @returns Array of active executions
     */
    getActive(): IAgentExecution[];
    /**
     * Get executions by agent key (active + recent completed)
     * @param agentKey The agent key to filter by
     * @returns Array of matching executions
     */
    getByType(agentKey: string): IAgentExecution[];
    /**
     * Get a specific execution by ID
     * @param executionId The execution ID to retrieve
     * @returns The execution or null if not found
     */
    getById(executionId: string): IAgentExecution | null;
    /**
     * Get statistics about tracker state
     */
    getStats(): {
        activeCount: number;
        completedCount: number;
        maxCompleted: number;
    };
    /**
     * Generate a unique execution ID
     * Format: exec_{agentKey}_{timestamp}_{random}
     *
     * @param agentKey The agent key
     * @returns Unique execution ID
     */
    private generateExecutionId;
    /**
     * Generate a random 6-character ID
     * @returns Random alphanumeric string
     */
    private randomId;
    /**
     * Add a completed execution to the completed list
     * Implements FIFO eviction when exceeding MAX_COMPLETED
     *
     * @param execution The completed execution
     */
    private addCompleted;
}
export default AgentExecutionTracker;
//# sourceMappingURL=agent-tracker.d.ts.map