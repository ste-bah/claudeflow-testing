/**
 * Episode Service - PLACEHOLDER for future Episode Memory implementation
 * TASK-DAEMON-003: Service Registry & Integration
 *
 * Will be implemented in TASK-EPISODE-001
 */

import { createServiceHandler, type ServiceHandler } from '../service-registry.js';

/**
 * Create episode service handler (PLACEHOLDER)
 *
 * @returns Service handler with stub methods
 */
export function createEpisodeService(): ServiceHandler {
  const warn = (method: string) => {
    console.warn(`[EpisodeService] ${method} called but not yet implemented (placeholder)`);
  };

  return createServiceHandler({
    /**
     * Create episode (stub)
     */
    create: async (_params: unknown) => {
      warn('create');
      return {
        episodeId: 'placeholder',
        warning: 'Episode service not yet implemented',
      };
    },

    /**
     * Query episodes (stub)
     */
    query: async (_params: unknown) => {
      warn('query');
      return {
        episodes: [],
        warning: 'Episode service not yet implemented',
      };
    },

    /**
     * Link episodes (stub)
     */
    link: async (_params: unknown) => {
      warn('link');
      return {
        success: false,
        warning: 'Episode service not yet implemented',
      };
    },

    /**
     * Get episode statistics (stub)
     */
    stats: async () => {
      return {
        count: 0,
        linkedCount: 0,
        warning: 'Episode service not yet implemented',
      };
    },
  });
}
