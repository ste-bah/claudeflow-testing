/**
 * Attention Mechanism Selector
 * TASK-ATT-001 - Attention Factory Auto-Selection
 *
 * Rule-based selection engine for optimal attention mechanism:
 * - Decision tree based on data profile
 * - <1ms selection overhead (p95)
 * - Fallback chain for reliability
 * - Confidence scoring
 */
import { type IDataProfile, type ISelectionResult, type ISelectionThresholds, type ISelectionMetrics, type IAttentionMechanism } from './attention-types.js';
import { AttentionMechanismRegistry } from './attention-registry.js';
/**
 * Rule-based attention mechanism selector
 */
export declare class AttentionSelector {
    private registry;
    private thresholds;
    private verbose;
    private metricsCallback?;
    constructor(registry: AttentionMechanismRegistry, thresholds?: Partial<ISelectionThresholds>, options?: {
        verbose?: boolean;
        metricsCallback?: (metrics: ISelectionMetrics) => void;
    });
    /**
     * Select optimal attention mechanism for given data profile
     */
    select(profile: IDataProfile): ISelectionResult;
    /**
     * Attempt to create mechanism with fallback handling
     */
    createWithFallback(selection: ISelectionResult, config?: Record<string, unknown>): IAttentionMechanism;
    /**
     * Emit metrics for observability
     */
    private emitMetrics;
    /**
     * Get current selection thresholds
     */
    getThresholds(): ISelectionThresholds;
    /**
     * Update selection thresholds
     */
    setThresholds(thresholds: Partial<ISelectionThresholds>): void;
    /**
     * Set metrics callback
     */
    setMetricsCallback(callback: (metrics: ISelectionMetrics) => void): void;
}
//# sourceMappingURL=attention-selector.d.ts.map