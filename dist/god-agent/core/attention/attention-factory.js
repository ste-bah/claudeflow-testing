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
import { DEFAULT_ATTENTION_CONFIG, AttentionError, } from './attention-types.js';
import { AttentionMechanismRegistry } from './attention-registry.js';
import { AttentionSelector } from './attention-selector.js';
import { DualSpaceAttention } from './dual-space-attention.js';
// ==================== Factory Class ====================
/**
 * Main attention factory - public API
 */
export class AttentionFactory {
    registry;
    selector;
    config;
    constructor(config = {}) {
        this.config = {
            ...DEFAULT_ATTENTION_CONFIG,
            ...config,
            thresholds: {
                ...DEFAULT_ATTENTION_CONFIG.thresholds,
                ...(config.thresholds ?? {}),
            },
        };
        this.registry = new AttentionMechanismRegistry();
        this.selector = new AttentionSelector(this.registry, this.config.thresholds, { verbose: this.config.verbose });
        // Register DualSpace attention mechanism
        this.registerDualSpace();
    }
    /**
     * Register DualSpace attention in the registry
     */
    registerDualSpace() {
        const mixingWeight = this.config.dualSpaceMixingWeight;
        this.registry.register({
            name: 'dual-space',
            displayName: 'DualSpace Attention',
            description: 'Combines hyperbolic + graph attention for mixed workloads',
            capabilities: {
                supportsLongContext: false,
                supportsHierarchy: true,
                supportsGraphs: true,
                supportsSparsity: false,
                requiresPrecomputation: true,
            },
            performance: {
                complexity: 'O(N²)',
                avgLatencyMs: 8.0,
                memoryUsageMB: 150,
                parallelizable: true,
            },
            fallbacks: ['hyperbolic', 'graph-rope', 'standard'],
            factory: (config) => new DualSpaceAttention({
                ...config,
                mixingWeight: config?.mixingWeight ?? mixingWeight,
            }),
        });
    }
    // ==================== Auto-Selection API ====================
    /**
     * Auto-select and create attention mechanism from data profile
     */
    createFromProfile(profile, config) {
        const selection = this.selector.select(profile);
        if (this.config.verbose) {
            console.log(`[Factory] Selected: ${selection.mechanismName} (${selection.rationale})`);
        }
        return this.selector.createWithFallback(selection, config);
    }
    /**
     * Get selection result without creating mechanism
     */
    analyzeProfile(profile) {
        return this.selector.select(profile);
    }
    // ==================== Manual Selection API ====================
    /**
     * Create specific mechanism by name (manual selection)
     */
    create(name, config) {
        const descriptor = this.registry.get(name);
        if (!descriptor) {
            throw new AttentionError(`Unknown attention mechanism: ${name}`, 'UNKNOWN_MECHANISM');
        }
        return descriptor.factory(config);
    }
    /**
     * Check if mechanism exists
     */
    hasMechanism(name) {
        return this.registry.has(name);
    }
    // ==================== Registry Inspection ====================
    /**
     * List all available mechanism names
     */
    listMechanisms() {
        return this.registry.list();
    }
    /**
     * Get mechanism count
     */
    getMechanismCount() {
        return this.registry.size;
    }
    /**
     * Get registry for advanced inspection
     */
    getRegistry() {
        return this.registry;
    }
    /**
     * Get selector for testing/customization
     */
    getSelector() {
        return this.selector;
    }
    // ==================== Configuration ====================
    /**
     * Get current selection thresholds
     */
    getThresholds() {
        return this.selector.getThresholds();
    }
    /**
     * Update selection thresholds
     */
    setThresholds(thresholds) {
        this.selector.setThresholds(thresholds);
    }
    /**
     * Set metrics callback for observability
     */
    setMetricsCallback(callback) {
        this.selector.setMetricsCallback(callback);
    }
    // ==================== Convenience Methods ====================
    /**
     * Find mechanisms that support long context
     */
    findLongContextMechanisms() {
        return this.registry.findLongContextMechanisms().map(m => m.name);
    }
    /**
     * Find mechanisms that support hierarchy
     */
    findHierarchyMechanisms() {
        return this.registry.findHierarchyMechanisms().map(m => m.name);
    }
    /**
     * Find mechanisms that support graphs
     */
    findGraphMechanisms() {
        return this.registry.findGraphMechanisms().map(m => m.name);
    }
    /**
     * Create DualSpace attention with specific mixing weight
     */
    createDualSpace(mixingWeight, config) {
        return new DualSpaceAttention({
            ...config,
            mixingWeight: mixingWeight ?? this.config.dualSpaceMixingWeight,
        });
    }
}
//# sourceMappingURL=attention-factory.js.map