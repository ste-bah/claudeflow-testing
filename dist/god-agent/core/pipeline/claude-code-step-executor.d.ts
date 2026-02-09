/**
 * Claude Code Step Executor
 *
 * Implements IStepExecutor using the `claude` CLI in print mode (-p).
 * Uses the user's existing Claude Code subscription — no ANTHROPIC_API_KEY needed.
 *
 * Each agent step is executed as a separate `claude -p` invocation with the
 * fully-contextualized prompt (RLM + LEANN context already baked in by the
 * orchestrator before this executor is called).
 *
 * @module src/god-agent/core/pipeline/claude-code-step-executor
 * @see coding-phase-executor.ts - IStepExecutor interface
 * @see coding-agent-executor.ts - executeAgent() which calls this
 */
import type { IStepExecutor } from './coding-pipeline-types.js';
/**
 * Configuration for ClaudeCodeStepExecutor
 */
export interface IClaudeCodeExecutorConfig {
    /** Working directory for claude process (default: process.cwd()) */
    cwd?: string;
    /** Maximum output buffer in MB (default: 10) */
    maxBufferMb?: number;
    /** Path to claude CLI binary (default: 'claude') */
    claudeBinary?: string;
}
/**
 * Step executor that uses Claude Code CLI (`claude -p`) for agent execution.
 *
 * Prompts are piped via stdin to handle arbitrarily long context
 * (LEANN snippets + RLM handoffs can exceed shell argument limits).
 *
 * The orchestrator handles all context injection (RLM, LEANN, agent markdown,
 * workflow position) BEFORE calling this executor. This executor just runs
 * the fully-built prompt and returns the output.
 */
export declare class ClaudeCodeStepExecutor implements IStepExecutor {
    private readonly cwd;
    private readonly maxBufferBytes;
    private readonly claudeBinary;
    constructor(config?: IClaudeCodeExecutorConfig);
    /**
     * Execute an agent step using Claude Code CLI.
     *
     * @param agentKey - Agent identifier (e.g., 'task-analyzer', 'coder')
     * @param prompt - Fully-contextualized prompt (RLM + LEANN already injected)
     * @param timeoutMs - Maximum execution time in milliseconds
     * @returns Execution result with output, quality score, and duration
     */
    execute(agentKey: string, prompt: string, timeoutMs: number): Promise<{
        output: unknown;
        quality: number;
        duration: number;
    }>;
    /**
     * Run claude CLI with prompt piped via stdin.
     * Uses stdin to avoid shell argument length limits on long prompts.
     */
    private runClaude;
    /**
     * Assess output quality using heuristics.
     *
     * This is a baseline heuristic — the orchestrator's Sherlock quality gates
     * provide the authoritative quality assessment at phase boundaries.
     */
    private assessQuality;
}
//# sourceMappingURL=claude-code-step-executor.d.ts.map