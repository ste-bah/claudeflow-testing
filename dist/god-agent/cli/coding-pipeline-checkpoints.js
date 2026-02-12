/**
 * Pipeline Checkpoint System (PRD Section 3.5)
 *
 * Creates checkpoints after each agent completion, supports rollback on failure.
 * Each checkpoint snapshots the RLM context and records pipeline state.
 */
export class PipelineCheckpointManager {
    checkpoints = [];
    async createCheckpoint(sessionId, phase, agentKey, quality) {
        const checkpointId = `cp-${phase}-${agentKey}-${Date.now()}`;
        const { promises: fs, existsSync, copyFileSync } = await import('fs');
        const rlmPath = `.god-agent/rlm-context/${sessionId}.json`;
        const snapshotPath = `.god-agent/checkpoints/${checkpointId}-rlm.json`;
        await fs.mkdir('.god-agent/checkpoints', { recursive: true });
        if (existsSync(rlmPath)) {
            copyFileSync(rlmPath, snapshotPath);
        }
        // Read session to get completed agents list
        let completedAgents = [];
        try {
            const sessionData = JSON.parse(await fs.readFile(`.god-agent/coding-sessions/${sessionId}.json`, 'utf-8'));
            completedAgents = (sessionData.completedAgents || []).map((a) => (typeof a === 'string' ? a : a.agentKey || ''));
        }
        catch { /* session read failed — proceed with empty list */ }
        const checkpoint = {
            checkpointId,
            timestamp: new Date().toISOString(),
            phase,
            agentKey,
            sessionId,
            rlmContextSnapshot: snapshotPath,
            completedAgents,
            quality,
            state: 'valid',
        };
        this.checkpoints.push(checkpoint);
        await fs.writeFile(`.god-agent/checkpoints/${sessionId}-index.json`, JSON.stringify(this.checkpoints, null, 2));
        return checkpointId;
    }
    async loadCheckpoints(sessionId) {
        try {
            const { promises: fs } = await import('fs');
            const raw = await fs.readFile(`.god-agent/checkpoints/${sessionId}-index.json`, 'utf-8');
            this.checkpoints = JSON.parse(raw);
        }
        catch { /* no checkpoints yet */ }
    }
    getLatestCheckpoint() {
        return this.checkpoints[this.checkpoints.length - 1];
    }
    async rollbackToCheckpoint(checkpointId) {
        const checkpoint = this.checkpoints.find(c => c.checkpointId === checkpointId);
        if (!checkpoint || checkpoint.state === 'corrupted')
            return false;
        const { existsSync, copyFileSync } = await import('fs');
        const rlmPath = `.god-agent/rlm-context/${checkpoint.sessionId}.json`;
        if (existsSync(checkpoint.rlmContextSnapshot)) {
            copyFileSync(checkpoint.rlmContextSnapshot, rlmPath);
        }
        return true;
    }
}
//# sourceMappingURL=coding-pipeline-checkpoints.js.map