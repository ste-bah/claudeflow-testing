/**
 * Sherlock Flow Handler
 *
 * Handles verdict-based flow control for pipeline progression.
 * Extracted from sherlock-phase-reviewer.ts for constitution compliance (< 500 lines).
 *
 * @module src/god-agent/core/pipeline/sherlock-flow-handler
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3.6
 */
import { Verdict, MAX_RETRY_COUNT, } from './sherlock-phase-reviewer-types.js';
// ═══════════════════════════════════════════════════════════════════════════
// FLOW HANDLER
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Handle phase review result per PRD 2.3.6 verdict-based flow control.
 *
 * Flow control rules:
 * - INNOCENT: Proceed to next phase
 * - GUILTY (retries remaining): Remediate and retry current phase
 * - GUILTY (max retries): Escalate to human intervention
 * - INSUFFICIENT_EVIDENCE: Gather more evidence for current phase
 *
 * @param result - Phase review result from Sherlock
 * @param callbacks - Callback handlers for each verdict type
 * @returns Promise that resolves when flow control action is complete
 */
export async function handlePhaseReviewResult(result, callbacks) {
    switch (result.verdict) {
        case Verdict.INNOCENT:
            // Proceed to next phase
            await callbacks.onInnocent(result.phase + 1);
            break;
        case Verdict.GUILTY:
            if (result.retryCount < MAX_RETRY_COUNT) {
                // Remediate and retry
                await callbacks.onGuilty(result.remediations, result.retryCount + 1);
            }
            else {
                // Max retries exceeded - escalate
                await callbacks.onEscalate(result);
            }
            break;
        case Verdict.INSUFFICIENT_EVIDENCE:
            // Gather more evidence
            await callbacks.onInsufficientEvidence(result.phase);
            break;
    }
}
//# sourceMappingURL=sherlock-flow-handler.js.map