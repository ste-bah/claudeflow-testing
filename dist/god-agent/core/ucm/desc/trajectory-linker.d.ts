/**
 * IDESC-001: Intelligent DESC v2 - Trajectory Linker
 * TASK-IDESC-RB-002: Implement Trajectory Linker Service
 * Sprint 5: ReasoningBank Integration
 *
 * Links episodes to ReasoningBank trajectories for enhanced context injection.
 * Implements: REQ-IDESC-007 (trajectory linking)
 * Constitution: GUARD-IDESC-005 (graceful degradation)
 */
import type { IDatabaseConnection } from './outcome-tracker.js';
import type { ITrajectoryLink } from '../types.js';
/**
 * Interface for trajectory linking operations
 */
export interface ITrajectoryLinker {
    /**
     * Link an episode to a ReasoningBank trajectory
     * @param episodeId - Episode to link
     * @param trajectoryId - ReasoningBank trajectory ID
     * @param reasoningTrace - Summarized reasoning trace for context
     * @throws TrajectoryLinkError if linking fails
     * @throws EpisodeNotFoundError if episode doesn't exist
     */
    linkEpisodeToTrajectory(episodeId: string, trajectoryId: string, reasoningTrace?: string): Promise<void>;
    /**
     * Get trajectory ID for an episode
     * @param episodeId - Episode to query
     * @returns Trajectory ID or null if not linked
     */
    getTrajectoryForEpisode(episodeId: string): Promise<string | null>;
    /**
     * Get all episodes linked to a trajectory
     * @param trajectoryId - Trajectory to query
     * @returns Array of episode IDs
     */
    getEpisodesForTrajectory(trajectoryId: string): Promise<string[]>;
    /**
     * Remove trajectory link from episode
     * @param episodeId - Episode to unlink
     * @throws EpisodeNotFoundError if episode doesn't exist
     */
    unlinkEpisode(episodeId: string): Promise<void>;
    /**
     * Get full trajectory link information
     * @param episodeId - Episode to query
     * @returns Trajectory link or null if not linked
     */
    getTrajectoryLink(episodeId: string): Promise<ITrajectoryLink | null>;
    /**
     * Update reasoning trace for an existing link
     * @param episodeId - Episode to update
     * @param reasoningTrace - New reasoning trace
     * @throws TrajectoryNotFoundError if episode is not linked
     */
    updateReasoningTrace(episodeId: string, reasoningTrace: string): Promise<void>;
}
/**
 * TrajectoryLinker - Links episodes to ReasoningBank trajectories
 *
 * Provides:
 * - Episode-to-trajectory linking (REQ-IDESC-007)
 * - Bidirectional queries (episode→trajectory, trajectory→episodes)
 * - Reasoning trace storage for context injection
 * - Graceful degradation (GUARD-IDESC-005)
 */
export declare class TrajectoryLinker implements ITrajectoryLinker {
    private readonly db;
    constructor(db: IDatabaseConnection);
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
    linkEpisodeToTrajectory(episodeId: string, trajectoryId: string, reasoningTrace?: string): Promise<void>;
    /**
     * Get trajectory ID for an episode
     *
     * @param episodeId - Episode to query
     * @returns Trajectory ID or null if not linked
     */
    getTrajectoryForEpisode(episodeId: string): Promise<string | null>;
    /**
     * Get all episodes linked to a trajectory
     *
     * @param trajectoryId - Trajectory to query
     * @returns Array of episode IDs
     */
    getEpisodesForTrajectory(trajectoryId: string): Promise<string[]>;
    /**
     * Remove trajectory link from episode
     *
     * @param episodeId - Episode to unlink
     * @throws EpisodeNotFoundError if episode doesn't exist
     */
    unlinkEpisode(episodeId: string): Promise<void>;
    /**
     * Get full trajectory link information
     *
     * @param episodeId - Episode to query
     * @returns Trajectory link or null if not linked
     */
    getTrajectoryLink(episodeId: string): Promise<ITrajectoryLink | null>;
    /**
     * Update reasoning trace for an existing link
     *
     * @param episodeId - Episode to update
     * @param reasoningTrace - New reasoning trace
     * @throws TrajectoryNotFoundError if episode is not linked
     */
    updateReasoningTrace(episodeId: string, reasoningTrace: string): Promise<void>;
}
/**
 * Factory function to create TrajectoryLinker
 * @param db - Database connection (compatible with better-sqlite3 and daemon IPC)
 * @returns TrajectoryLinker instance
 */
export declare function createTrajectoryLinker(db: IDatabaseConnection): TrajectoryLinker;
//# sourceMappingURL=trajectory-linker.d.ts.map