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
import { BUFFER_LIMITS } from './types.js';
// =============================================================================
// Implementation
// =============================================================================
/**
 * RoutingHistory circular buffer implementation
 *
 * Implements:
 * - [REQ-OBS-08]: Routing decision tracking
 * - [REQ-OBS-09]: Routing explanation with confidence, factors, alternatives
 * - [RULE-OBS-004]: Maximum 100 routing decisions with FIFO eviction
 */
export class RoutingHistory {
    // Circular buffer storage
    buffer;
    head = 0; // Points to oldest element
    tail = 0; // Points to next write position
    count = 0;
    maxSize;
    // Activity stream for event emission
    activityStream;
    /**
     * Create a new RoutingHistory
     * @param activityStream Optional activity stream for event emission
     * @param maxSize Maximum buffer size (default: 100 per RULE-OBS-004)
     */
    constructor(activityStream, maxSize = BUFFER_LIMITS.ROUTING_HISTORY) {
        this.maxSize = maxSize;
        this.activityStream = activityStream;
        // Pre-allocate buffer for memory efficiency
        this.buffer = new Array(maxSize).fill(null);
    }
    /**
     * Record a routing decision
     * Implements [REQ-OBS-08]: Record routing decisions
     * Implements [REQ-OBS-09]: Generate human-readable explanations
     */
    record(decision) {
        const routingId = this.generateRoutingId();
        const timestamp = Date.now();
        // Generate human-readable summary
        const confidencePercent = Math.round(decision.confidence * 100);
        const summary = `Selected ${decision.selectedAgent} with ${confidencePercent}% confidence for ${decision.taskType} task`;
        const explanation = {
            id: routingId,
            timestamp,
            taskDescription: decision.taskDescription,
            taskType: decision.taskType,
            selectedAgent: decision.selectedAgent,
            confidence: decision.confidence,
            explanation: {
                summary,
                candidates: decision.candidates,
                reasoningSteps: decision.reasoningSteps,
                patternMatches: decision.patternMatches || [],
                coldStartUsed: decision.coldStartUsed,
            },
        };
        // Store in circular buffer
        this.buffer[this.tail] = explanation;
        this.tail = (this.tail + 1) % this.maxSize;
        if (this.count < this.maxSize) {
            this.count++;
        }
        else {
            // Buffer full - evict oldest (FIFO)
            this.head = (this.head + 1) % this.maxSize;
        }
        // Emit event to activity stream
        this.emitRoutingEvent(explanation);
        return routingId;
    }
    /**
     * Get routing explanation by ID
     */
    getById(routingId) {
        const all = this.getAllExplanations();
        return all.find(exp => exp.id === routingId) || null;
    }
    /**
     * Get recent routing decisions
     * @param limit Maximum number to return (default: 10)
     */
    getRecent(limit = 10) {
        const all = this.getAllExplanations();
        // Return most recent (already in chronological order, oldest first)
        // We want newest, so take from the end
        return all.slice(-limit);
    }
    /**
     * Filter routing decisions by task type
     */
    filterByTaskType(taskType) {
        const all = this.getAllExplanations();
        return all.filter(exp => exp.taskType === taskType);
    }
    /**
     * Filter routing decisions by selected agent
     */
    filterByAgent(agentType) {
        const all = this.getAllExplanations();
        return all.filter(exp => exp.selectedAgent === agentType);
    }
    /**
     * Clear all routing history
     */
    clear() {
        this.buffer = new Array(this.maxSize).fill(null);
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }
    /**
     * Get current count of routing decisions
     */
    size() {
        return this.count;
    }
    /**
     * Check if buffer is full
     */
    isFull() {
        return this.count >= this.maxSize;
    }
    // ===========================================================================
    // Private Methods
    // ===========================================================================
    /**
     * Generate unique routing ID
     * Format: route_{timestamp}_{random}
     */
    generateRoutingId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `route_${timestamp}_${random}`;
    }
    /**
     * Get all routing explanations in chronological order
     */
    getAllExplanations() {
        if (this.count === 0) {
            return [];
        }
        const result = [];
        // Start from head (oldest) and collect all valid entries
        let idx = this.head;
        for (let i = 0; i < this.count; i++) {
            const exp = this.buffer[idx];
            if (exp) {
                result.push(exp);
            }
            idx = (idx + 1) % this.maxSize;
        }
        return result;
    }
    /**
     * Emit routing decision event to activity stream
     */
    emitRoutingEvent(explanation) {
        if (!this.activityStream) {
            return;
        }
        const event = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            timestamp: explanation.timestamp,
            component: 'routing',
            operation: 'routing_decision',
            status: 'success',
            metadata: {
                routingId: explanation.id,
                selectedAgent: explanation.selectedAgent,
                taskType: explanation.taskType,
                confidence: explanation.confidence,
                coldStartUsed: explanation.explanation.coldStartUsed,
            },
        };
        this.activityStream.push(event);
    }
}
// =============================================================================
// Default Export
// =============================================================================
export default RoutingHistory;
//# sourceMappingURL=routing-history.js.map