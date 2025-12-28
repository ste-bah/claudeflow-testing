/**
 * Hook Runner
 * TASK-EXE-001 - Execute pre and post hooks as bash commands
 *
 * Runs agent hooks (pre/post) defined in YAML frontmatter.
 * Hooks are non-fatal - failures are logged but don't stop execution.
 */
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
// ==================== Hook Runner ====================
/**
 * HookRunner
 *
 * Executes pre and post hooks as bash commands.
 * Provides environment variables and timeout handling.
 */
export class HookRunner {
    workingDirectory;
    timeout;
    verbose;
    constructor(options = {}) {
        this.workingDirectory = options.workingDirectory ?? process.cwd();
        this.timeout = options.timeout ?? 10000; // 10 seconds default
        this.verbose = options.verbose ?? false;
    }
    /**
     * Run a hook script
     *
     * @param script - Bash script to execute
     * @param phase - 'pre' or 'post'
     * @param agentName - Name of the agent (for logging and env vars)
     * @param env - Additional environment variables
     * @returns Hook execution result
     */
    async runHook(script, phase, agentName, env) {
        const startTime = Date.now();
        // Return success for empty/undefined scripts
        if (!script?.trim()) {
            return {
                success: true,
                stdout: '',
                stderr: '',
                duration: 0,
            };
        }
        try {
            // Build environment
            const hookEnv = {
                ...process.env,
                AGENT_NAME: agentName,
                TASK: agentName,
                HOOK_PHASE: phase,
                ...env,
            };
            if (this.verbose) {
                console.log(`[HookRunner] Running ${phase}-hook for ${agentName}`);
            }
            // Execute script
            const { stdout, stderr } = await execAsync(script, {
                cwd: this.workingDirectory,
                timeout: this.timeout,
                env: hookEnv,
                shell: '/bin/bash',
                maxBuffer: 10 * 1024 * 1024, // 10MB
            });
            const duration = Date.now() - startTime;
            if (this.verbose) {
                console.log(`[HookRunner] ${phase}-hook completed in ${duration}ms`);
                if (stdout)
                    console.log(`[HookRunner] stdout: ${stdout.slice(0, 200)}...`);
            }
            return {
                success: true,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                duration,
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Check for timeout
            const isTimeout = errorMessage.includes('ETIMEDOUT') ||
                errorMessage.includes('killed') ||
                duration >= this.timeout;
            if (this.verbose || isTimeout) {
                console.warn(`[HookRunner] ${phase}-hook ${isTimeout ? 'timed out' : 'failed'} for ${agentName}: ${errorMessage}`);
            }
            return {
                success: false,
                stdout: '',
                stderr: errorMessage,
                duration,
                error: isTimeout ? `Hook timed out after ${this.timeout}ms` : errorMessage,
            };
        }
    }
    /**
     * Run pre-hook for an agent
     */
    async runPreHook(script, agentName, env) {
        return this.runHook(script, 'pre', agentName, env);
    }
    /**
     * Run post-hook for an agent
     */
    async runPostHook(script, agentName, env) {
        return this.runHook(script, 'post', agentName, env);
    }
    /**
     * Validate hook script (basic syntax check)
     */
    validateHookScript(script) {
        const warnings = [];
        // Check for common issues
        if (script.includes('rm -rf /')) {
            warnings.push('Dangerous command detected: rm -rf /');
        }
        if (script.includes('sudo ')) {
            warnings.push('Hook uses sudo - may require elevated privileges');
        }
        if (!script.includes('claude-flow') && !script.includes('echo')) {
            warnings.push('Hook may be missing claude-flow memory commands');
        }
        return {
            valid: warnings.filter(w => w.includes('Dangerous')).length === 0,
            warnings,
        };
    }
    /**
     * Update configuration
     */
    setConfig(options) {
        if (options.workingDirectory !== undefined) {
            this.workingDirectory = options.workingDirectory;
        }
        if (options.timeout !== undefined) {
            this.timeout = options.timeout;
        }
        if (options.verbose !== undefined) {
            this.verbose = options.verbose;
        }
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return {
            workingDirectory: this.workingDirectory,
            timeout: this.timeout,
            verbose: this.verbose,
        };
    }
}
// ==================== Factory ====================
/**
 * Create a hook runner with default configuration
 */
export function createHookRunner(options) {
    return new HookRunner(options);
}
//# sourceMappingURL=hook-runner.js.map