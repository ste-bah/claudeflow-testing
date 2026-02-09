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
import { spawn } from 'child_process';
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
export class ClaudeCodeStepExecutor {
    cwd;
    maxBufferBytes;
    claudeBinary;
    constructor(config) {
        this.cwd = config?.cwd ?? process.cwd();
        this.maxBufferBytes = (config?.maxBufferMb ?? 10) * 1024 * 1024;
        this.claudeBinary = config?.claudeBinary ?? 'claude';
    }
    /**
     * Execute an agent step using Claude Code CLI.
     *
     * @param agentKey - Agent identifier (e.g., 'task-analyzer', 'coder')
     * @param prompt - Fully-contextualized prompt (RLM + LEANN already injected)
     * @param timeoutMs - Maximum execution time in milliseconds
     * @returns Execution result with output, quality score, and duration
     */
    async execute(agentKey, prompt, timeoutMs) {
        const startTime = Date.now();
        try {
            const output = await this.runClaude(prompt, timeoutMs);
            const duration = Date.now() - startTime;
            const quality = this.assessQuality(output, agentKey);
            return { output, quality, duration };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const err = error;
            if (err.timedOut) {
                return {
                    output: `Agent ${agentKey} timed out after ${timeoutMs}ms. ` +
                        `Partial output: ${err.partialOutput?.slice(0, 500) || 'none'}`,
                    quality: 0.1,
                    duration,
                };
            }
            return {
                output: `Error executing agent ${agentKey}: ${err.message}`,
                quality: 0.2,
                duration,
            };
        }
    }
    /**
     * Run claude CLI with prompt piped via stdin.
     * Uses stdin to avoid shell argument length limits on long prompts.
     */
    runClaude(prompt, timeoutMs) {
        return new Promise((resolve, reject) => {
            const stdoutChunks = [];
            const stderrChunks = [];
            let totalBytes = 0;
            let killed = false;
            const child = spawn(this.claudeBinary, ['-p', '--output-format', 'text'], {
                cwd: this.cwd,
                env: process.env,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            // Pipe prompt via stdin (handles arbitrarily long prompts)
            child.stdin.write(prompt);
            child.stdin.end();
            child.stdout.on('data', (chunk) => {
                totalBytes += chunk.length;
                if (totalBytes <= this.maxBufferBytes) {
                    stdoutChunks.push(chunk);
                }
            });
            child.stderr.on('data', (chunk) => {
                stderrChunks.push(chunk);
            });
            // Timeout guard
            const timer = setTimeout(() => {
                killed = true;
                child.kill('SIGTERM');
                // Give 5s for graceful shutdown, then force kill
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGKILL');
                    }
                }, 5000);
            }, timeoutMs);
            child.on('error', (err) => {
                clearTimeout(timer);
                if (err.code === 'ENOENT') {
                    reject(new Error(`Claude Code CLI not found at "${this.claudeBinary}". ` +
                        `Ensure Claude Code is installed and "claude" is on your PATH.`));
                }
                else {
                    reject(err);
                }
            });
            child.on('close', (code) => {
                clearTimeout(timer);
                const stdout = Buffer.concat(stdoutChunks).toString('utf-8').trim();
                if (killed) {
                    const err = new Error(`Timed out after ${timeoutMs}ms`);
                    err.timedOut = true;
                    err.partialOutput = stdout;
                    reject(err);
                    return;
                }
                if (code !== 0 && !stdout) {
                    const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
                    reject(new Error(`Claude CLI exited with code ${code}. ` +
                        `stderr: ${stderr.slice(0, 500)}`));
                    return;
                }
                resolve(stdout);
            });
        });
    }
    /**
     * Assess output quality using heuristics.
     *
     * This is a baseline heuristic — the orchestrator's Sherlock quality gates
     * provide the authoritative quality assessment at phase boundaries.
     */
    assessQuality(output, _agentKey) {
        if (!output || output.length < 10)
            return 0.1;
        // Check for error indicators (but not false positives like "error handling")
        const errorPattern = /\b(fatal error|unhandled exception|stack trace|ENOENT|EPERM|cannot find module)\b/i;
        if (errorPattern.test(output))
            return 0.3;
        // Substantive output is generally higher quality
        if (output.length > 2000)
            return 0.8;
        if (output.length > 500)
            return 0.7;
        if (output.length > 100)
            return 0.6;
        return 0.5;
    }
}
//# sourceMappingURL=claude-code-step-executor.js.map