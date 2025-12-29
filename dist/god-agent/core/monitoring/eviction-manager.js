/**
 * Eviction Manager
 * TASK-MON-002
 *
 * Wires MemoryMonitor alerts to cache eviction actions.
 * Implements automatic memory management per Constitution.
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-037: Keep episode cache under 1000
 * - RULE-040: Keep total overhead under 200MB
 */
import { getMemoryMonitor } from './memory-monitor.js';
import { createComponentLogger } from '../observability/logger.js';
const logger = createComponentLogger('EvictionManager');
const DEFAULT_CONFIG = {
    warningEvictPercent: 0.20,
    errorEvictPercent: 0.40
};
export class EvictionManager {
    config;
    monitor = getMemoryMonitor();
    initialized = false;
    /** Service providers (late binding) */
    descServiceProvider = null;
    trajectoryTrackerProvider = null;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /** Set DESC service provider */
    setDescServiceProvider(provider) {
        this.descServiceProvider = provider;
    }
    /** Set trajectory tracker provider */
    setTrajectoryTrackerProvider(provider) {
        this.trajectoryTrackerProvider = provider;
    }
    /** Initialize eviction manager - wire to monitor alerts */
    initialize() {
        if (this.initialized) {
            logger.warn('EvictionManager already initialized');
            return;
        }
        this.monitor.onAlert((alert) => {
            this.handleAlert(alert).catch(err => {
                logger.error('Eviction handler failed', err, {
                    component: alert.component
                });
            });
        });
        this.initialized = true;
        logger.info('EvictionManager initialized', {
            warningEvictPercent: this.config.warningEvictPercent,
            errorEvictPercent: this.config.errorEvictPercent
        });
    }
    /** Handle memory alert by triggering eviction */
    async handleAlert(alert) {
        const evictPercent = alert.level === 'error'
            ? this.config.errorEvictPercent
            : this.config.warningEvictPercent;
        logger.info('Eviction triggered', {
            level: alert.level,
            component: alert.component,
            current: alert.current,
            limit: alert.limit,
            evictPercent
        });
        const results = [];
        switch (alert.component) {
            case 'episodeCache':
                results.push(await this.evictEpisodes(evictPercent));
                break;
            case 'embeddingCache':
                results.push(await this.evictEmbeddings(evictPercent));
                break;
            case 'trajectoryCache':
                results.push(await this.evictTrajectories(evictPercent));
                break;
            case 'totalOverhead':
                // Evict from all caches
                const episodeResult = await this.evictEpisodes(evictPercent);
                const embeddingResult = await this.evictEmbeddings(evictPercent);
                const trajectoryResult = await this.evictTrajectories(evictPercent);
                results.push(episodeResult, embeddingResult, trajectoryResult);
                break;
        }
        return results;
    }
    /** Evict episodes from cache */
    async evictEpisodes(percent) {
        const startTime = Date.now();
        try {
            const descService = this.descServiceProvider?.();
            if (!descService) {
                return {
                    component: 'episodeCache',
                    requested: 0,
                    evicted: 0,
                    success: false,
                    error: 'DESC service not available',
                    durationMs: Date.now() - startTime
                };
            }
            const cacheSize = descService.getCacheSize();
            const evictCount = Math.ceil(cacheSize * percent);
            const evicted = await descService.evictLRU(evictCount);
            logger.info('Episodes evicted', {
                requested: evictCount,
                evicted,
                newSize: descService.getCacheSize()
            });
            return {
                component: 'episodeCache',
                requested: evictCount,
                evicted,
                success: true,
                durationMs: Date.now() - startTime
            };
        }
        catch (err) {
            return {
                component: 'episodeCache',
                requested: 0,
                evicted: 0,
                success: false,
                error: err instanceof Error ? err.message : String(err),
                durationMs: Date.now() - startTime
            };
        }
    }
    /** Evict embeddings from cache */
    async evictEmbeddings(percent) {
        const startTime = Date.now();
        try {
            const descService = this.descServiceProvider?.();
            if (!descService?.evictEmbeddingCache) {
                return {
                    component: 'embeddingCache',
                    requested: 0,
                    evicted: 0,
                    success: false,
                    error: 'Embedding cache eviction not available',
                    durationMs: Date.now() - startTime
                };
            }
            const evicted = await descService.evictEmbeddingCache(percent);
            logger.info('Embeddings evicted', { percent, evicted });
            return {
                component: 'embeddingCache',
                requested: Math.round(percent * 100),
                evicted,
                success: true,
                durationMs: Date.now() - startTime
            };
        }
        catch (err) {
            return {
                component: 'embeddingCache',
                requested: 0,
                evicted: 0,
                success: false,
                error: err instanceof Error ? err.message : String(err),
                durationMs: Date.now() - startTime
            };
        }
    }
    /** Evict trajectories */
    async evictTrajectories(percent) {
        const startTime = Date.now();
        try {
            const tracker = this.trajectoryTrackerProvider?.();
            if (!tracker) {
                return {
                    component: 'trajectoryCache',
                    requested: 0,
                    evicted: 0,
                    success: false,
                    error: 'Trajectory tracker not available',
                    durationMs: Date.now() - startTime
                };
            }
            // First, flush completed trajectories to disk
            let flushed = 0;
            if (tracker.flushCompleted) {
                flushed = await tracker.flushCompleted();
                logger.debug('Flushed completed trajectories', { flushed });
            }
            // Then evict oldest active
            const activeCount = tracker.getActiveCount();
            const evictCount = Math.ceil(activeCount * percent);
            const evicted = await tracker.evictOldest(evictCount);
            logger.info('Trajectories evicted', {
                flushed,
                requested: evictCount,
                evicted,
                newActiveCount: tracker.getActiveCount()
            });
            return {
                component: 'trajectoryCache',
                requested: evictCount,
                evicted: flushed + evicted,
                success: true,
                durationMs: Date.now() - startTime
            };
        }
        catch (err) {
            return {
                component: 'trajectoryCache',
                requested: 0,
                evicted: 0,
                success: false,
                error: err instanceof Error ? err.message : String(err),
                durationMs: Date.now() - startTime
            };
        }
    }
    /** Get eviction config */
    getConfig() {
        return { ...this.config };
    }
    /** Check if initialized */
    isInitialized() {
        return this.initialized;
    }
}
// Singleton
let instance = null;
export function getEvictionManager() {
    if (!instance) {
        instance = new EvictionManager();
    }
    return instance;
}
export function _resetEvictionManagerForTesting() {
    instance = null;
}
//# sourceMappingURL=eviction-manager.js.map