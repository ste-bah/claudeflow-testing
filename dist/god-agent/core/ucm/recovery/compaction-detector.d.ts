/**
 * UCM Compaction Detector
 * RULE-059: Detect Claude Code compaction events
 *
 * Detects when Claude Code has compacted the conversation context,
 * triggering recovery mechanisms to reconstruct lost state.
 */
import type { ICompactionDetector } from '../types.js';
/**
 * Compaction detection state
 */
interface ICompactionState {
    detected: boolean;
    timestamp: number;
    marker: string | null;
    confidence: number;
    recoveryMode: boolean;
}
/**
 * CompactionDetector Implementation
 *
 * Monitors system messages and user inputs for compaction indicators.
 * Maintains detection state and triggers recovery workflows.
 */
export declare class CompactionDetector implements ICompactionDetector {
    private state;
    private detectionHistory;
    /**
     * Detect compaction in a message
     *
     * @param message - Message to analyze
     * @returns True if compaction detected
     */
    detectCompaction(message: string): boolean;
    /**
     * Get timestamp of last compaction detection
     *
     * @returns Timestamp in milliseconds, or 0 if never detected
     */
    getCompactionTimestamp(): number | null;
    /**
     * Check if currently in recovery mode
     *
     * @returns True if in recovery mode
     */
    isInRecoveryMode(): boolean;
    /**
     * Set recovery mode state
     *
     * @param enabled - Enable or disable recovery mode
     */
    setRecoveryMode(enabled: boolean): void;
    /**
     * Get current detection state
     *
     * @returns Current compaction state
     */
    getState(): Readonly<ICompactionState>;
    /**
     * Get detection history
     *
     * @returns Array of past detections
     */
    getHistory(): ReadonlyArray<Readonly<typeof this.detectionHistory[0]>>;
    /**
     * Reset detection state
     */
    reset(): void;
    /**
     * Record a compaction detection
     */
    private recordDetection;
    /**
     * Detect partial matches with confidence scoring
     */
    private detectPartialMatches;
    /**
     * Check if detection is recent (within threshold)
     *
     * @param thresholdMs - Threshold in milliseconds (default: 5 minutes)
     * @returns True if detection is recent
     */
    isRecentDetection(thresholdMs?: number): boolean;
    /**
     * Get detection confidence
     *
     * @returns Confidence score (0-1)
     */
    getConfidence(): number;
}
/**
 * Create a new CompactionDetector instance
 */
export declare function createCompactionDetector(): ICompactionDetector;
export {};
//# sourceMappingURL=compaction-detector.d.ts.map