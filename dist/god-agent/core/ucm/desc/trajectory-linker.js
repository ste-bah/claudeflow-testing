/**
 * IDESC-001: Intelligent DESC v2 - Trajectory Linker
 * TASK-IDESC-RB-002: Implement Trajectory Linker Service
 * Sprint 5: ReasoningBank Integration
 *
 * Links episodes to ReasoningBank trajectories for enhanced context injection.
 * Implements: REQ-IDESC-007 (trajectory linking)
 * Constitution: GUARD-IDESC-005 (graceful degradation)
 */
import { TrajectoryLinkError, TrajectoryNotFoundError, EpisodeNotFoundError } from './errors.js';
/**
 * TrajectoryLinker - Links episodes to ReasoningBank trajectories
 *
 * Provides:
 * - Episode-to-trajectory linking (REQ-IDESC-007)
 * - Bidirectional queries (episode→trajectory, trajectory→episodes)
 * - Reasoning trace storage for context injection
 * - Graceful degradation (GUARD-IDESC-005)
 */
export class TrajectoryLinker {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Link an episode to a ReasoningBank trajectory
     * Implements: REQ-IDESC-007
     *
     * @param episodeId - Episode to link
     * @param trajectoryId - ReasoningBank trajectory ID
     * @param reasoningTrace - Optional summarized reasoning trace
     * @throws TrajectoryLinkError if linking fails
     * @throws EpisodeNotFoundError if episode doesn't exist
     */
    async linkEpisodeToTrajectory(episodeId, trajectoryId, reasoningTrace) {
        try {
            // Verify episode exists
            const episodeExists = await this.db.get('SELECT episode_id FROM episodes WHERE episode_id = ?', [episodeId]);
            if (!episodeExists) {
                throw new EpisodeNotFoundError(episodeId);
            }
            // Link trajectory to episode
            const linkedAt = new Date().toISOString();
            await this.db.run(`UPDATE episodes
         SET trajectory_id = ?,
             reasoning_trace = ?,
             trajectory_linked_at = ?
         WHERE episode_id = ?`, [trajectoryId, reasoningTrace || null, linkedAt, episodeId]);
        }
        catch (error) {
            if (error instanceof EpisodeNotFoundError) {
                throw error;
            }
            throw new TrajectoryLinkError(trajectoryId, `Failed to link trajectory: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Get trajectory ID for an episode
     *
     * @param episodeId - Episode to query
     * @returns Trajectory ID or null if not linked
     */
    async getTrajectoryForEpisode(episodeId) {
        const row = await this.db.get('SELECT trajectory_id FROM episodes WHERE episode_id = ?', [episodeId]);
        return row?.trajectory_id ?? null;
    }
    /**
     * Get all episodes linked to a trajectory
     *
     * @param trajectoryId - Trajectory to query
     * @returns Array of episode IDs
     */
    async getEpisodesForTrajectory(trajectoryId) {
        const rows = await this.db.all('SELECT episode_id FROM episodes WHERE trajectory_id = ? ORDER BY trajectory_linked_at DESC', [trajectoryId]);
        return rows.map(row => row.episode_id);
    }
    /**
     * Remove trajectory link from episode
     *
     * @param episodeId - Episode to unlink
     * @throws EpisodeNotFoundError if episode doesn't exist
     */
    async unlinkEpisode(episodeId) {
        try {
            // Verify episode exists
            const episodeExists = await this.db.get('SELECT episode_id FROM episodes WHERE episode_id = ?', [episodeId]);
            if (!episodeExists) {
                throw new EpisodeNotFoundError(episodeId);
            }
            // Remove trajectory link
            await this.db.run(`UPDATE episodes
         SET trajectory_id = NULL,
             reasoning_trace = NULL,
             trajectory_linked_at = NULL
         WHERE episode_id = ?`, [episodeId]);
        }
        catch (error) {
            if (error instanceof EpisodeNotFoundError) {
                throw error;
            }
            throw new TrajectoryLinkError('unknown', `Failed to unlink episode: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Get full trajectory link information
     *
     * @param episodeId - Episode to query
     * @returns Trajectory link or null if not linked
     */
    async getTrajectoryLink(episodeId) {
        const row = await this.db.get(`SELECT episode_id, trajectory_id, reasoning_trace, trajectory_linked_at
       FROM episodes
       WHERE episode_id = ?`, [episodeId]);
        if (!row || !row.trajectory_id) {
            return null;
        }
        return {
            episodeId: row.episode_id,
            trajectoryId: row.trajectory_id,
            reasoningTrace: row.reasoning_trace || '',
            linkedAt: row.trajectory_linked_at ? new Date(row.trajectory_linked_at) : new Date()
        };
    }
    /**
     * Update reasoning trace for an existing link
     *
     * @param episodeId - Episode to update
     * @param reasoningTrace - New reasoning trace
     * @throws TrajectoryNotFoundError if episode is not linked
     */
    async updateReasoningTrace(episodeId, reasoningTrace) {
        try {
            // Check if episode has a trajectory link
            const trajectoryId = await this.getTrajectoryForEpisode(episodeId);
            if (!trajectoryId) {
                throw new TrajectoryNotFoundError(`Episode ${episodeId} is not linked to any trajectory`);
            }
            // Update reasoning trace
            await this.db.run('UPDATE episodes SET reasoning_trace = ? WHERE episode_id = ?', [reasoningTrace, episodeId]);
        }
        catch (error) {
            if (error instanceof TrajectoryNotFoundError) {
                throw error;
            }
            throw new TrajectoryLinkError('unknown', `Failed to update reasoning trace: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
        }
    }
}
/**
 * Factory function to create TrajectoryLinker
 * @param db - Database connection (compatible with better-sqlite3 and daemon IPC)
 * @returns TrajectoryLinker instance
 */
export function createTrajectoryLinker(db) {
    return new TrajectoryLinker(db);
}
//# sourceMappingURL=trajectory-linker.js.map