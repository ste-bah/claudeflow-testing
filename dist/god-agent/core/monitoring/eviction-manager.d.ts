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
import { IMemoryAlert, IMemoryBudgets } from './types.js';
/** Eviction configuration */
export interface IEvictionConfig {
    /** Percent to evict on warning (default 0.20 = 20%) */
    warningEvictPercent: number;
    /** Percent to evict on error (default 0.40 = 40%) */
    errorEvictPercent: number;
}
/** Eviction result */
export interface IEvictionResult {
    component: keyof IMemoryBudgets;
    requested: number;
    evicted: number;
    success: boolean;
    error?: string;
    durationMs: number;
}
/** Service interface for DESC cache eviction */
export interface IDescServiceEvictable {
    getCacheSize(): number;
    evictLRU(count: number): number | Promise<number>;
    evictEmbeddingCache?(percent: number): number | Promise<number>;
}
/** Service interface for trajectory eviction */
export interface ITrajectoryTrackerEvictable {
    getActiveCount(): number;
    flushCompleted?(): number | Promise<number>;
    evictOldest(count: number): number | Promise<number>;
}
export declare class EvictionManager {
    private readonly config;
    private readonly monitor;
    private initialized;
    /** Service providers (late binding) */
    private descServiceProvider;
    private trajectoryTrackerProvider;
    constructor(config?: Partial<IEvictionConfig>);
    /** Set DESC service provider */
    setDescServiceProvider(provider: () => IDescServiceEvictable | null): void;
    /** Set trajectory tracker provider */
    setTrajectoryTrackerProvider(provider: () => ITrajectoryTrackerEvictable | null): void;
    /** Initialize eviction manager - wire to monitor alerts */
    initialize(): void;
    /** Handle memory alert by triggering eviction */
    handleAlert(alert: IMemoryAlert): Promise<IEvictionResult[]>;
    /** Evict episodes from cache */
    private evictEpisodes;
    /** Evict embeddings from cache */
    private evictEmbeddings;
    /** Evict trajectories */
    private evictTrajectories;
    /** Get eviction config */
    getConfig(): IEvictionConfig;
    /** Check if initialized */
    isInitialized(): boolean;
}
export declare function getEvictionManager(): EvictionManager;
export declare function _resetEvictionManagerForTesting(): void;
//# sourceMappingURL=eviction-manager.d.ts.map