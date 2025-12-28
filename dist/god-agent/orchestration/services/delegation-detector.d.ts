/**
 * Delegation Detector Service
 *
 * Implements: TASK-ORC-010 (TECH-ORC-001 lines 819-876, 1107-1128, 1231-1250)
 *
 * Detects when orchestrator should delegate work to agents based on
 * multi-step operation patterns (3+ sequential operations).
 *
 * @module orchestration/services/delegation-detector
 */
import type { InteractionStore } from '../../universal/interaction-store.js';
import type { IDelegationPattern } from '../types.js';
/**
 * Detection thresholds configuration
 */
export interface IDelegationThresholds {
    /** Minimum operation count to trigger detection (default: 3) */
    minOperationCount: number;
    /** Confidence threshold for suggestions (default: 0.7) */
    confidenceThreshold: number;
}
/**
 * Service that detects multi-step workflow patterns and suggests delegation
 */
export declare class DelegationDetector {
    private interactionStore;
    private thresholds;
    /**
     * Initialize delegation detector
     *
     * @param interactionStore - InteractionStore for pattern storage
     * @param thresholds - Detection thresholds (optional)
     */
    constructor(interactionStore: InteractionStore, thresholds?: Partial<IDelegationThresholds>);
    /**
     * Detect if orchestrator should delegate to an agent
     *
     * From TECH-ORC-001 lines 840-851
     *
     * @param operationSequence - Sequence of operations performed
     * @returns Delegation pattern with suggestion
     */
    detectDelegationNeed(operationSequence: string[]): IDelegationPattern;
    /**
     * Store delegation pattern to InteractionStore for learning
     *
     * From TECH-ORC-001 lines 857-862
     *
     * @param pattern - Delegation pattern to store
     */
    storePattern(pattern: IDelegationPattern): Promise<void>;
    /**
     * Analyze operation types and suggest appropriate agent
     *
     * From TECH-ORC-001 lines 1122-1126, 1231-1250
     *
     * @param operations - Operation sequence
     * @returns Suggested agent and confidence score
     * @private
     */
    private analyzeOperations;
}
//# sourceMappingURL=delegation-detector.d.ts.map