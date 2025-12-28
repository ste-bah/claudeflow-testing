/**
 * RoutingHistory - Routing Decision Tracking
 *
 * Tracks routing decisions with explanations and pattern matches,
 * using a circular buffer with FIFO eviction.
 *
 * @module observability/routing-history
 * @see TASK-OBS-005-ROUTING-HISTORY.md
 * @see SPEC-OBS-001-CORE.md
 */
import { ActivityStream } from './activity-stream.js';
/**
 * Agent candidate during routing
 */
export interface IAgentCandidate {
    /** Agent type identifier */
    agentType: string;
    /** Candidate score */
    score: number;
    /** Capabilities that matched */
    matchedCapabilities: string[];
    /** Confidence in this candidate */
    confidence: number;
}
/**
 * Pattern match information
 */
export interface IPatternMatch {
    /** Pattern identifier */
    patternId: string;
    /** Similarity score 0-1 */
    similarity: number;
    /** Source of the pattern */
    source: 'reasoning-bank' | 'cold-start';
}
/**
 * Routing decision input
 */
export interface IRoutingDecision {
    /** Original task description */
    taskDescription: string;
    /** Task type classification */
    taskType: string;
    /** Selected agent type */
    selectedAgent: string;
    /** Confidence score 0-1 */
    confidence: number;
    /** Alternative candidates considered */
    candidates: IAgentCandidate[];
    /** Reasoning steps taken */
    reasoningSteps: string[];
    /** Pattern matches (optional) */
    patternMatches?: IPatternMatch[];
    /** Whether cold start was used */
    coldStartUsed: boolean;
}
/**
 * Complete routing explanation with metadata
 */
export interface IRoutingExplanation {
    /** Unique routing ID (format: route_{timestamp}_{random}) */
    id: string;
    /** Decision timestamp (Unix epoch ms) */
    timestamp: number;
    /** Original task description */
    taskDescription: string;
    /** Task type classification */
    taskType: string;
    /** Selected agent type */
    selectedAgent: string;
    /** Confidence score 0-1 */
    confidence: number;
    /** Explanation details */
    explanation: {
        /** Human-readable summary */
        summary: string;
        /** Alternative candidates */
        candidates: IAgentCandidate[];
        /** Reasoning steps */
        reasoningSteps: string[];
        /** Pattern matches */
        patternMatches: IPatternMatch[];
        /** Cold start flag */
        coldStartUsed: boolean;
    };
}
/**
 * RoutingHistory interface
 * Implements [REQ-OBS-08]: Routing decision tracking
 * Implements [REQ-OBS-09]: Routing explanation details
 */
export interface IRoutingHistory {
    /**
     * Record a routing decision
     * @param decision Routing decision to record
     * @returns Unique routing ID
     */
    record(decision: IRoutingDecision): string;
    /**
     * Get routing explanation by ID
     * @param routingId Routing decision ID
     * @returns Routing explanation or null if not found
     */
    getById(routingId: string): IRoutingExplanation | null;
    /**
     * Get recent routing decisions
     * @param limit Maximum number to return (default: 10)
     * @returns Recent routing explanations
     */
    getRecent(limit?: number): IRoutingExplanation[];
    /**
     * Filter routing decisions by task type
     * @param taskType Task type to filter by
     * @returns Matching routing explanations
     */
    filterByTaskType(taskType: string): IRoutingExplanation[];
    /**
     * Filter routing decisions by selected agent
     * @param agentType Agent type to filter by
     * @returns Matching routing explanations
     */
    filterByAgent(agentType: string): IRoutingExplanation[];
    /**
     * Clear all routing history
     */
    clear(): void;
}
/**
 * RoutingHistory circular buffer implementation
 *
 * Implements:
 * - [REQ-OBS-08]: Routing decision tracking
 * - [REQ-OBS-09]: Routing explanation with confidence, factors, alternatives
 * - [RULE-OBS-004]: Maximum 100 routing decisions with FIFO eviction
 */
export declare class RoutingHistory implements IRoutingHistory {
    private buffer;
    private head;
    private tail;
    private count;
    private readonly maxSize;
    private activityStream?;
    /**
     * Create a new RoutingHistory
     * @param activityStream Optional activity stream for event emission
     * @param maxSize Maximum buffer size (default: 100 per RULE-OBS-004)
     */
    constructor(activityStream?: ActivityStream, maxSize?: number);
    /**
     * Record a routing decision
     * Implements [REQ-OBS-08]: Record routing decisions
     * Implements [REQ-OBS-09]: Generate human-readable explanations
     */
    record(decision: IRoutingDecision): string;
    /**
     * Get routing explanation by ID
     */
    getById(routingId: string): IRoutingExplanation | null;
    /**
     * Get recent routing decisions
     * @param limit Maximum number to return (default: 10)
     */
    getRecent(limit?: number): IRoutingExplanation[];
    /**
     * Filter routing decisions by task type
     */
    filterByTaskType(taskType: string): IRoutingExplanation[];
    /**
     * Filter routing decisions by selected agent
     */
    filterByAgent(agentType: string): IRoutingExplanation[];
    /**
     * Clear all routing history
     */
    clear(): void;
    /**
     * Get current count of routing decisions
     */
    size(): number;
    /**
     * Check if buffer is full
     */
    isFull(): boolean;
    /**
     * Generate unique routing ID
     * Format: route_{timestamp}_{random}
     */
    private generateRoutingId;
    /**
     * Get all routing explanations in chronological order
     */
    private getAllExplanations;
    /**
     * Emit routing decision event to activity stream
     */
    private emitRoutingEvent;
}
export default RoutingHistory;
//# sourceMappingURL=routing-history.d.ts.map