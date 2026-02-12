/**
 * Pipeline Checkpoint System (PRD Section 3.5)
 *
 * Creates checkpoints after each agent completion, supports rollback on failure.
 * Each checkpoint snapshots the RLM context and records pipeline state.
 */
export interface IPipelineCheckpoint {
    checkpointId: string;
    timestamp: string;
    phase: number;
    agentKey: string;
    sessionId: string;
    rlmContextSnapshot: string;
    completedAgents: string[];
    quality: number;
    state: 'valid' | 'corrupted' | 'partial';
}
export declare class PipelineCheckpointManager {
    private checkpoints;
    createCheckpoint(sessionId: string, phase: number, agentKey: string, quality: number): Promise<string>;
    loadCheckpoints(sessionId: string): Promise<void>;
    getLatestCheckpoint(): IPipelineCheckpoint | undefined;
    rollbackToCheckpoint(checkpointId: string): Promise<boolean>;
}
//# sourceMappingURL=coding-pipeline-checkpoints.d.ts.map