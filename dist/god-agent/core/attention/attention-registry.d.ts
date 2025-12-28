/**
 * Attention Mechanism Registry
 * TASK-ATT-001 - Attention Factory Auto-Selection
 *
 * Central registry of 39+ attention mechanisms with:
 * - Capability metadata
 * - Performance profiles
 * - Fallback chains
 * - Factory functions
 */
import { ComplexityClass, type IAttentionCapabilities, type IAttentionMechanismDescriptor, type IAttentionMechanism } from './attention-types.js';
/**
 * Central registry of all available attention mechanisms
 */
export declare class AttentionMechanismRegistry {
    private mechanisms;
    constructor();
    /**
     * Register all built-in mechanisms (39+ total)
     */
    private registerBuiltInMechanisms;
    /**
     * Register a new attention mechanism
     */
    register(descriptor: IAttentionMechanismDescriptor): void;
    /**
     * Get mechanism descriptor by name
     */
    get(name: string): IAttentionMechanismDescriptor | undefined;
    /**
     * Check if mechanism exists
     */
    has(name: string): boolean;
    /**
     * List all registered mechanism names
     */
    list(): string[];
    /**
     * Get all mechanism descriptors
     */
    getAll(): IAttentionMechanismDescriptor[];
    /**
     * Get count of registered mechanisms
     */
    get size(): number;
    /**
     * Find mechanisms by capability
     */
    findByCapability(capability: keyof IAttentionCapabilities): IAttentionMechanismDescriptor[];
    /**
     * Find mechanisms by complexity class
     */
    findByComplexity(complexity: ComplexityClass): IAttentionMechanismDescriptor[];
    /**
     * Find mechanisms that support long context
     */
    findLongContextMechanisms(): IAttentionMechanismDescriptor[];
    /**
     * Find mechanisms that support hierarchy
     */
    findHierarchyMechanisms(): IAttentionMechanismDescriptor[];
    /**
     * Find mechanisms that support graphs
     */
    findGraphMechanisms(): IAttentionMechanismDescriptor[];
    /**
     * Create mechanism instance by name
     */
    createMechanism(name: string, config?: Record<string, unknown>): IAttentionMechanism;
}
//# sourceMappingURL=attention-registry.d.ts.map