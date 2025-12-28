/**
 * Context Composition Engine
 * TASK-UCM-CTX-004
 *
 * Main orchestrator for composing full context from multiple tiers.
 * RULE-015: Four-tier context structure
 * 1. Pinned (always included, max 2000 tokens)
 * 2. DESC Prior Solutions (max 2)
 * 3. Active Window (phase-aware size)
 * 4. Archived (reference only)
 *
 * Integrates RollingWindow, DependencyTracker, and PinningManager
 */
import type { IRetrievalResult } from '../types.js';
import { RollingWindow } from './rolling-window.js';
import { DependencyTracker } from './dependency-tracker.js';
import { PinningManager, PinReason } from './pinning-manager.js';
/**
 * Composed context tier
 */
export interface IContextTier {
    tier: 'pinned' | 'desc-prior' | 'active' | 'archived';
    agents: IContextAgent[];
    tokenCount: number;
    metadata?: Record<string, unknown>;
}
/**
 * Agent in composed context
 */
export interface IContextAgent {
    agentId: string;
    content: string;
    tokenCount: number;
    tier: string;
    priority: number;
    metadata?: Record<string, unknown>;
}
/**
 * Context composition options
 */
export interface ICompositionOptions {
    targetAgent?: string;
    contextWindow: number;
    phase: string;
    includeDependencies?: boolean;
    maxDescPrior?: number;
    priorityWeights?: {
        pinned: number;
        descPrior: number;
        active: number;
        dependency: number;
    };
}
/**
 * Composed context result
 */
export interface IComposedContext {
    tiers: IContextTier[];
    totalTokens: number;
    contextWindow: number;
    utilization: number;
    agents: IContextAgent[];
    metadata: {
        phase: string;
        targetAgent?: string;
        pinnedCount: number;
        descPriorCount: number;
        activeCount: number;
        archivedCount: number;
        budgetRemaining: number;
    };
}
/**
 * Context Composition Engine
 * Orchestrates multi-tier context assembly with budget management
 */
export declare class ContextCompositionEngine {
    private rollingWindow;
    private dependencyTracker;
    private pinningManager;
    private descPriorCache;
    private archivedAgents;
    constructor(initialPhase?: string, maxPinnedTokens?: number);
    /**
     * Compose full context for target agent or general query
     * RULE-015: Four-tier composition
     *
     * @param options - Composition options
     * @returns Composed context with all tiers
     */
    compose(options: ICompositionOptions): IComposedContext;
    /**
     * Get context for specific agent
     * Includes dependencies and DESC prior solutions
     *
     * @param agentId - Target agent
     * @param contextWindow - Available token budget
     * @param phase - Current research phase
     * @returns Composed context
     */
    getContextForAgent(agentId: string, contextWindow: number, phase: string): IComposedContext;
    /**
     * Compose Tier 1: Pinned agents
     * @returns Pinned tier
     */
    private composePinnedTier;
    /**
     * Compose Tier 2: DESC Prior Solutions
     * RULE-019: Max 2 prior solutions
     *
     * @param targetAgent - Target agent for DESC lookup
     * @param maxPrior - Maximum prior solutions
     * @param budget - Remaining token budget
     * @returns DESC prior tier
     */
    private composeDescPriorTier;
    /**
     * Compose Tier 3: Active Window
     * Phase-aware window with dependency ordering
     *
     * @param targetAgent - Target agent
     * @param includeDependencies - Include dependency chain
     * @param budget - Remaining token budget
     * @param weights - Priority weights
     * @returns Active tier
     */
    private composeActiveTier;
    /**
     * Compose Tier 4: Archived
     * Reference only, no token consumption
     *
     * @returns Archived tier
     */
    private composeArchivedTier;
    /**
     * Get dependency-ordered agents including target's dependencies
     * @param targetAgent - Target agent
     * @param availableAgents - Available agent IDs
     * @returns Ordered agent IDs
     */
    private getOrderedWithDependencies;
    /**
     * Add agent to rolling window
     * @param agentId - Agent ID
     * @param content - Agent content
     * @param tokenCount - Token count
     */
    addToWindow(agentId: string, content: string, tokenCount: number): void;
    /**
     * Add dependency relationship
     * @param dependent - Dependent agent
     * @param dependency - Dependency agent
     */
    addDependency(dependent: string, dependency: string): void;
    /**
     * Pin agent to context
     * @param agentId - Agent to pin
     * @param content - Agent content
     * @param tokenCount - Token count
     * @param reason - Pin reason
     */
    pin(agentId: string, content: string, tokenCount: number, reason?: PinReason): void;
    /**
     * Unpin agent
     * @param agentId - Agent to unpin
     */
    unpin(agentId: string): void;
    /**
     * Set DESC prior solutions for agent
     * @param agentId - Target agent
     * @param results - Prior solution results
     */
    setDescPrior(agentId: string, results: IRetrievalResult[]): void;
    /**
     * Update research phase
     * Resizes rolling window automatically
     *
     * @param phase - New phase
     */
    setPhase(phase: string): void;
    /**
     * Get composition statistics
     * @returns Engine metrics
     */
    getStats(): {
        rollingWindow: {
            size: number;
            capacity: number;
            utilization: number;
            totalTokens: number;
            phase: string;
            agents: {
                agentId: string;
                tokenCount: number;
                age: number;
            }[];
        };
        dependencies: {
            nodeCount: number;
            edgeCount: number;
            maxDepth: number;
            avgDependencies: number;
            hasCycle: boolean;
            rootNodes: string[];
            leafNodes: string[];
        };
        pinning: {
            pinnedCount: number;
            totalTokens: number;
            availableTokens: number;
            utilization: number;
            maxTokens: number;
            byReason: Record<string, number>;
            avgTokensPerPin: number;
            crossRefThreshold: number;
            autoPinCandidates: {
                agentId: string;
                crossRefs: number;
            }[];
        };
        archived: {
            count: number;
            totalTokens: number;
        };
        descPrior: {
            agentsWithPrior: number;
            totalResults: number;
        };
    };
    /**
     * Clear all context
     */
    clear(): void;
    /**
     * Estimate tokens for content (simple heuristic)
     * @param content - Content to estimate
     * @returns Estimated token count
     */
    private estimateTokens;
    /**
     * Get rolling window instance
     * @returns Rolling window
     */
    getRollingWindow(): RollingWindow;
    /**
     * Get dependency tracker instance
     * @returns Dependency tracker
     */
    getDependencyTracker(): DependencyTracker;
    /**
     * Get pinning manager instance
     * @returns Pinning manager
     */
    getPinningManager(): PinningManager;
}
//# sourceMappingURL=context-composition-engine.d.ts.map