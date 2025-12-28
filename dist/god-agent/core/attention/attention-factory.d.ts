/**
 * Attention Factory
 * TASK-ATT-001 - Attention Factory Auto-Selection
 *
 * Main public API for automatic attention mechanism selection:
 * - Auto-select based on IDataProfile
 * - Manual creation by name
 * - Registry inspection
 * - Performance tracking
 *
 * Target: <1ms selection overhead, 95%+ correct selection
 */
import { type IDataProfile, type IAttentionMechanism, type ISelectionResult, type ISelectionThresholds, type IAttentionConfig, type ISelectionMetrics } from './attention-types.js';
import { AttentionMechanismRegistry } from './attention-registry.js';
import { AttentionSelector } from './attention-selector.js';
import { DualSpaceAttention } from './dual-space-attention.js';
/**
 * Main attention factory - public API
 */
export declare class AttentionFactory {
    private registry;
    private selector;
    private config;
    constructor(config?: IAttentionConfig);
    /**
     * Register DualSpace attention in the registry
     */
    private registerDualSpace;
    /**
     * Auto-select and create attention mechanism from data profile
     */
    createFromProfile(profile: IDataProfile, config?: Record<string, unknown>): IAttentionMechanism;
    /**
     * Get selection result without creating mechanism
     */
    analyzeProfile(profile: IDataProfile): ISelectionResult;
    /**
     * Create specific mechanism by name (manual selection)
     */
    create(name: string, config?: Record<string, unknown>): IAttentionMechanism;
    /**
     * Check if mechanism exists
     */
    hasMechanism(name: string): boolean;
    /**
     * List all available mechanism names
     */
    listMechanisms(): string[];
    /**
     * Get mechanism count
     */
    getMechanismCount(): number;
    /**
     * Get registry for advanced inspection
     */
    getRegistry(): AttentionMechanismRegistry;
    /**
     * Get selector for testing/customization
     */
    getSelector(): AttentionSelector;
    /**
     * Get current selection thresholds
     */
    getThresholds(): ISelectionThresholds;
    /**
     * Update selection thresholds
     */
    setThresholds(thresholds: Partial<ISelectionThresholds>): void;
    /**
     * Set metrics callback for observability
     */
    setMetricsCallback(callback: (metrics: ISelectionMetrics) => void): void;
    /**
     * Find mechanisms that support long context
     */
    findLongContextMechanisms(): string[];
    /**
     * Find mechanisms that support hierarchy
     */
    findHierarchyMechanisms(): string[];
    /**
     * Find mechanisms that support graphs
     */
    findGraphMechanisms(): string[];
    /**
     * Create DualSpace attention with specific mixing weight
     */
    createDualSpace(mixingWeight?: number, config?: Record<string, unknown>): DualSpaceAttention;
}
//# sourceMappingURL=attention-factory.d.ts.map