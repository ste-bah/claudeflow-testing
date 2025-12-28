/**
 * Orchestration Memory Manager
 *
 * Implements: TASK-ORC-002 (TECH-ORC-001 lines 410-598)
 *
 * Primary orchestrator for all memory operations in the God Agent system.
 * Coordinates storage, retrieval, context injection, and feedback submission.
 *
 * @module orchestration/orchestration-memory-manager
 */
import type { InteractionStore } from '../universal/interaction-store.js';
import type { ReasoningBank } from '../core/reasoning/reasoning-bank.js';
import type { IWorkflowState, IStorageResult, IContextInjection, IQualityEstimate, IOrchestrationMetrics } from './types.js';
/**
 * Configuration for OrchestrationMemoryManager
 */
export interface IOrchestrationMemoryConfig {
    /** Storage directory for workflow state */
    storageDir: string;
    /** Enable automatic memory operations */
    enableAutoMemory: boolean;
    /** Enable verbose logging */
    verbose: boolean;
    /** Maximum context tokens for injection */
    maxContextTokens: number;
    /** Enable workflow state persistence */
    enablePersistence: boolean;
    /** Enable delegation detection */
    enableDelegation: boolean;
    /** Enable agent routing */
    enableRouting: boolean;
}
/**
 * Options for Task() wrapping
 */
export interface ITaskOptions {
    /** Skip all memory operations */
    skipMemory?: boolean;
    /** Workflow ID for context */
    workflowId?: string;
}
/**
 * Task metadata for storage and feedback
 */
export interface ITaskMetadata {
    workflowId: string;
    taskId: string;
    agentType: string;
    durationMs: number;
    success: boolean;
    error?: string;
}
/**
 * Feedback metadata
 */
export interface IFeedbackMetadata {
    trajectoryId: string;
    agentType: string;
    taskType: string;
    durationMs: number;
    success: boolean;
    error?: string;
}
/**
 * OrchestrationMemoryManager - Main orchestration class
 *
 * Coordinates all memory operations including:
 * - Task output extraction and storage
 * - Context injection before task execution
 * - Quality feedback generation
 * - Workflow state persistence
 * - Delegation detection and routing
 */
/**
 * Feedback queue entry for retry logic
 */
interface IFeedbackQueueEntry {
    trajectoryId: string;
    quality: number;
    outcome: 'positive' | 'negative' | 'neutral';
    metadata: any;
    attempts: number;
    lastAttempt: number;
    createdAt: number;
}
export declare class OrchestrationMemoryManager {
    private config;
    private interactionStore;
    private reasoningBank;
    private metrics;
    private extractorService;
    private contextInjector;
    private feedbackGenerator;
    private feedbackQueue;
    private retryIntervalId?;
    /**
     * Initialize the manager with dependencies
     *
     * @param config - Configuration options
     * @param interactionStore - InteractionStore instance
     * @param reasoningBank - ReasoningBank instance
     * @throws Error if dependencies are invalid
     */
    constructor(config: IOrchestrationMemoryConfig, interactionStore: InteractionStore, reasoningBank: ReasoningBank);
    /**
     * Wrap Task() execution with automatic memory operations
     *
     * @param taskFn - Original Task() function
     * @param prompt - Task prompt
     * @param agentType - Agent type (optional, will be auto-selected if missing)
     * @param options - Task options including skipMemory flag
     * @returns Task output with memory operations applied
     *
     * @throws Error if Task() execution fails
     */
    wrapTask(taskFn: (prompt: string, agent: string) => Promise<string>, prompt: string, agentType?: string, options?: ITaskOptions): Promise<string>;
    /**
     * Store task output to InteractionStore
     *
     * @param output - Task output string
     * @param metadata - Task metadata
     * @returns Storage result with entry ID and details
     *
     * @throws Error if storage fails
     */
    storeTaskOutput(output: string, metadata: ITaskMetadata): Promise<IStorageResult>;
    /**
     * Assign category based on agent type
     */
    private assignCategory;
    /**
     * Generate tags from findings
     */
    private generateTags;
    /**
     * Inject context into task prompt
     *
     * @param prompt - Original prompt
     * @param workflowDomain - Domain to query
     * @param tags - Tags for filtering
     * @returns Context injection result with enhanced prompt
     *
     * @throws Error if context injection fails
     */
    injectContext(prompt: string, workflowDomain: string, tags: string[]): Promise<IContextInjection>;
    /**
     * Generate and submit feedback to ReasoningBank
     *
     * @param output - Task output
     * @param metadata - Task metadata
     * @returns Quality estimate
     *
     * @throws Error if feedback submission fails (queues for retry)
     */
    submitFeedback(output: string, metadata: IFeedbackMetadata): Promise<IQualityEstimate>;
    /**
     * Process feedback retry queue
     */
    private processFeedbackQueue;
    /**
     * Prune feedback queue (max 100 entries, max 24h age)
     */
    private pruneFeedbackQueue;
    /**
     * Save feedback queue to disk
     */
    private saveFeedbackQueue;
    /**
     * Load feedback queue from disk
     */
    private loadFeedbackQueue;
    /**
     * Log feedback failure
     */
    private logFeedbackFailure;
    /**
     * Get feedback queue for testing
     */
    getFeedbackQueue(): IFeedbackQueueEntry[];
    /**
     * Persist workflow state to disk
     *
     * @param workflowId - Workflow identifier
     * @param state - Workflow state to persist
     * @throws Error if write fails
     */
    persistWorkflowState(workflowId: string, state: IWorkflowState): Promise<void>;
    /**
     * Restore workflow state from disk
     *
     * @param workflowId - Workflow identifier
     * @returns Restored workflow state or null if not found
     * @throws Error if file is corrupted
     */
    restoreWorkflowState(workflowId: string): Promise<IWorkflowState | null>;
    /**
     * Get orchestration metrics
     *
     * @returns Current session metrics
     */
    getMetrics(): IOrchestrationMetrics;
    /**
     * Reset session metrics
     */
    resetMetrics(): void;
    /**
     * Initialize manager (load state, start background threads)
     */
    initialize(): Promise<void>;
    /**
     * Shutdown manager (save state, stop threads)
     */
    shutdown(): Promise<void>;
}
export {};
//# sourceMappingURL=orchestration-memory-manager.d.ts.map