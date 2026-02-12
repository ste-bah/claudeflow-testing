/**
 * Coding Pipeline CLI - Sequential Execution (PhD-style interface)
 *
 * Implements init/next/complete <key> loop matching phd-cli.ts exactly.
 * Each command returns a SINGLE agent (not a batch array).
 * Forces enableParallelExecution: false so every batch has exactly 1 agent.
 *
 * Features:
 *   - Dynamic quality scoring via CodingQualityCalculator (not hardcoded 0.8)
 *   - XP rewards per PRD Section 7.3
 *   - LEANN semantic code context injection (codebase-aware agents)
 *   - Reflexion past failure trajectory injection (self-correction)
 *   - DESC injection with pre-vetting via InjectionFilter
 *   - SONA pattern injection from SonaEngine
 *   - Post-execution DESC episode storage for future retrieval
 *   - RLM Context Store (namespace-based phase context, PRD Section 6)
 *   - Agent MD file loading (50 specialized instruction files)
 *   - PatternMatcher integration (task-type filtered reusable patterns)
 *   - Trajectory creation + feedback loop (SONA trajectories for Reflexion)
 *   - Algorithm-specific behavior (LATS, ReAct, ToT, Self-Debug, Reflexion, PoT)
 *   - ObservabilityBus integration
 *   - Checkpoint/rollback system
 *   - Per-phase quality gate thresholds
 *   - PipelineProgressStore tracking
 *   - Sherlock forensic automation for phase reviewers
 *   - Anti-heredoc preamble (settings file corruption prevention)
 *
 * Commands:
 *   init "<task>"                                          - Initialize session, return first agent
 *   next <sessionId>                                       - Get next agent with full augmentation
 *   complete <sessionId> <key> [--file <path>]             - Mark agent done with dynamic quality
 *   complete-and-next <sessionId> <key> [--file <path>]    - Complete + next in one cold start
 *   status <sessionId>                                     - Show progress + XP summary
 *   resume <sessionId>                                     - Get current agent without advancing
 */
import { UniversalAgent } from '../universal/universal-agent.js';
/** Create orchestrator with parallel execution DISABLED (sequential batches of 1) */
declare function createSequentialOrchestrator(): Promise<{
    godAgent: UniversalAgent;
    orchestrator: import("../core/pipeline/coding-pipeline-orchestrator.js").CodingPipelineOrchestrator;
    agentRegistry: import("../core/agents/agent-registry.js").AgentRegistry;
    patternMatcher: import("../core/reasoning/pattern-matcher.js").PatternMatcher | undefined;
}>;
/** Shared orchestrator bundle for combined commands (avoids duplicate cold starts) */
type OrchestratorBundle = Awaited<ReturnType<typeof createSequentialOrchestrator>>;
/**
 * Initialize a new coding pipeline session.
 * Returns the first agent as a single object (not an array).
 */
export declare function init(task: string, _bundle?: OrchestratorBundle): Promise<Record<string, unknown>>;
/**
 * Get the next agent to execute with full learning augmentation.
 * Injects learning sources + RLM context + agent MD + algorithm instructions.
 * Returns a single agent object or status: "complete".
 */
export declare function next(sessionId: string, _bundle?: OrchestratorBundle): Promise<Record<string, unknown>>;
/**
 * Mark a single agent as complete with dynamic quality scoring and XP rewards.
 * Accepts --file <path> to read actual agent output for quality assessment.
 */
export declare function complete(sessionId: string, agentKey: string, options?: {
    file?: string;
}, _bundle?: OrchestratorBundle): Promise<Record<string, unknown>>;
/**
 * Combined complete-and-next: marks current agent done, then gets the next agent.
 * Reuses a single warm orchestrator instance, eliminating one cold start per cycle.
 * Returns { completed: {...}, next: {...} } as a single JSON response.
 */
export declare function completeAndNext(sessionId: string, agentKey: string, options?: {
    file?: string;
}): Promise<void>;
/**
 * Resume an interrupted session — returns current agent WITHOUT advancing.
 */
export declare function resume(sessionId: string, _bundle?: OrchestratorBundle): Promise<Record<string, unknown>>;
/**
 * Show session status with XP summary (fast — reads disk directly, no agent init).
 */
export declare function status(sessionId: string): Promise<void>;
export {};
//# sourceMappingURL=coding-pipeline-cli.d.ts.map