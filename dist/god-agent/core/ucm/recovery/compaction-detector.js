/**
 * UCM Compaction Detector
 * RULE-059: Detect Claude Code compaction events
 *
 * Detects when Claude Code has compacted the conversation context,
 * triggering recovery mechanisms to reconstruct lost state.
 */
import { CompactionDetectionError } from '../errors.js';
/**
 * Detection markers that indicate compaction has occurred
 */
const COMPACTION_MARKERS = [
    'This session is being continued from a previous conversation',
    'conversation is summarized below',
    'ran out of context',
    'context window limit',
    'conversation has been compacted',
    'previous messages have been summarized',
    'continuing from a previous session',
    'context has been compressed',
    'earlier conversation history',
    'session continuation detected'
];
/**
 * CompactionDetector Implementation
 *
 * Monitors system messages and user inputs for compaction indicators.
 * Maintains detection state and triggers recovery workflows.
 */
export class CompactionDetector {
    state = {
        detected: false,
        timestamp: 0,
        marker: null,
        confidence: 0,
        recoveryMode: false
    };
    detectionHistory = [];
    /**
     * Detect compaction in a message
     *
     * @param message - Message to analyze
     * @returns True if compaction detected
     */
    detectCompaction(message) {
        try {
            const normalizedMessage = message.toLowerCase();
            // Check for exact marker matches
            for (const marker of COMPACTION_MARKERS) {
                if (normalizedMessage.includes(marker.toLowerCase())) {
                    this.recordDetection(marker, 1.0);
                    return true;
                }
            }
            // Check for partial matches with lower confidence
            const partialMatches = this.detectPartialMatches(normalizedMessage);
            if (partialMatches.confidence > 0.7) {
                this.recordDetection(partialMatches.marker, partialMatches.confidence);
                return true;
            }
            return false;
        }
        catch (error) {
            throw new CompactionDetectionError(error);
        }
    }
    /**
     * Get timestamp of last compaction detection
     *
     * @returns Timestamp in milliseconds, or 0 if never detected
     */
    getCompactionTimestamp() {
        return this.state.timestamp || null;
    }
    /**
     * Check if currently in recovery mode
     *
     * @returns True if in recovery mode
     */
    isInRecoveryMode() {
        return this.state.recoveryMode;
    }
    /**
     * Set recovery mode state
     *
     * @param enabled - Enable or disable recovery mode
     */
    setRecoveryMode(enabled) {
        this.state.recoveryMode = enabled;
    }
    /**
     * Get current detection state
     *
     * @returns Current compaction state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get detection history
     *
     * @returns Array of past detections
     */
    getHistory() {
        return [...this.detectionHistory];
    }
    /**
     * Reset detection state
     */
    reset() {
        this.state = {
            detected: false,
            timestamp: 0,
            marker: null,
            confidence: 0,
            recoveryMode: false
        };
    }
    /**
     * Record a compaction detection
     */
    recordDetection(marker, confidence) {
        const timestamp = Date.now();
        this.state = {
            detected: true,
            timestamp,
            marker,
            confidence,
            recoveryMode: true
        };
        this.detectionHistory.push({
            timestamp,
            marker,
            confidence
        });
        // Keep only last 10 detections
        if (this.detectionHistory.length > 10) {
            this.detectionHistory.shift();
        }
    }
    /**
     * Detect partial matches with confidence scoring
     */
    detectPartialMatches(message) {
        const keywords = [
            'session',
            'continued',
            'previous',
            'conversation',
            'summarized',
            'context',
            'compacted',
            'compressed'
        ];
        let matchCount = 0;
        for (const keyword of keywords) {
            if (message.includes(keyword)) {
                matchCount++;
            }
        }
        const confidence = matchCount / keywords.length;
        const marker = `Partial match: ${matchCount}/${keywords.length} keywords`;
        return { marker, confidence };
    }
    /**
     * Check if detection is recent (within threshold)
     *
     * @param thresholdMs - Threshold in milliseconds (default: 5 minutes)
     * @returns True if detection is recent
     */
    isRecentDetection(thresholdMs = 5 * 60 * 1000) {
        if (!this.state.detected) {
            return false;
        }
        const elapsed = Date.now() - this.state.timestamp;
        return elapsed <= thresholdMs;
    }
    /**
     * Get detection confidence
     *
     * @returns Confidence score (0-1)
     */
    getConfidence() {
        return this.state.confidence;
    }
}
/**
 * Create a new CompactionDetector instance
 */
export function createCompactionDetector() {
    return new CompactionDetector();
}
//# sourceMappingURL=compaction-detector.js.map