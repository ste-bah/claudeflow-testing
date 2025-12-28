/**
 * Workflow State Manager Service
 *
 * Implements: TASK-ORC-012 (TECH-ORC-001 lines 557-585, 1288-1293)
 *
 * Persists and restores workflow state to/from disk with atomic writes,
 * corruption handling, and archival for completed workflows.
 *
 * @module orchestration/services/workflow-state-manager
 */
import type { IWorkflowState } from '../types.js';
/**
 * Workflow state manager configuration
 */
export interface IWorkflowStateConfig {
    /** Storage directory for workflow state files */
    storageDir: string;
    /** Enable verbose logging */
    verbose?: boolean;
}
/**
 * Service that manages workflow state persistence
 */
export declare class WorkflowStateManager {
    private storageDir;
    private verbose;
    /**
     * Initialize workflow state manager
     *
     * @param config - Configuration options
     */
    constructor(config: IWorkflowStateConfig);
    /**
     * Persist workflow state to disk
     *
     * From TECH-ORC-001 lines 557-569, 1288-1292
     *
     * @param workflowId - Workflow identifier
     * @param state - Workflow state to persist
     * @throws Error if write fails
     */
    persistWorkflowState(workflowId: string, state: IWorkflowState): Promise<void>;
    /**
     * Restore workflow state from disk
     *
     * From TECH-ORC-001 lines 571-585
     *
     * @param workflowId - Workflow identifier
     * @returns Restored workflow state or null if not found
     */
    restoreWorkflowState(workflowId: string): Promise<IWorkflowState | null>;
    /**
     * Validate workflow state structure
     *
     * @param state - State to validate
     * @throws Error if validation fails
     * @private
     */
    private validateState;
    /**
     * Ensure required directories exist
     *
     * @private
     */
    private ensureDirectories;
    /**
     * Archive corrupted workflow file
     *
     * From TECH-ORC-001 line 1291
     *
     * @param workflowId - Workflow identifier
     * @private
     */
    private archiveCorruptedFile;
    /**
     * List all active workflows
     *
     * @returns Array of workflow IDs
     */
    listActiveWorkflows(): Promise<string[]>;
    /**
     * List all archived workflows
     *
     * @returns Array of workflow IDs
     */
    listArchivedWorkflows(): Promise<string[]>;
    /**
     * Delete workflow state (for cleanup)
     *
     * @param workflowId - Workflow identifier
     */
    deleteWorkflowState(workflowId: string): Promise<void>;
}
//# sourceMappingURL=workflow-state-manager.d.ts.map