/**
 * Hook Runner
 * TASK-EXE-001 - Execute pre and post hooks as bash commands
 *
 * Runs agent hooks (pre/post) defined in YAML frontmatter.
 * Hooks are non-fatal - failures are logged but don't stop execution.
 */
import type { IHookResult, HookPhase } from './executor-types.js';
/**
 * HookRunner
 *
 * Executes pre and post hooks as bash commands.
 * Provides environment variables and timeout handling.
 */
export declare class HookRunner {
    private workingDirectory;
    private timeout;
    private verbose;
    constructor(options?: {
        workingDirectory?: string;
        timeout?: number;
        verbose?: boolean;
    });
    /**
     * Run a hook script
     *
     * @param script - Bash script to execute
     * @param phase - 'pre' or 'post'
     * @param agentName - Name of the agent (for logging and env vars)
     * @param env - Additional environment variables
     * @returns Hook execution result
     */
    runHook(script: string | undefined, phase: HookPhase, agentName: string, env?: Record<string, string>): Promise<IHookResult>;
    /**
     * Run pre-hook for an agent
     */
    runPreHook(script: string | undefined, agentName: string, env?: Record<string, string>): Promise<IHookResult>;
    /**
     * Run post-hook for an agent
     */
    runPostHook(script: string | undefined, agentName: string, env?: Record<string, string>): Promise<IHookResult>;
    /**
     * Validate hook script (basic syntax check)
     */
    validateHookScript(script: string): {
        valid: boolean;
        warnings: string[];
    };
    /**
     * Update configuration
     */
    setConfig(options: {
        workingDirectory?: string;
        timeout?: number;
        verbose?: boolean;
    }): void;
    /**
     * Get current configuration
     */
    getConfig(): {
        workingDirectory: string;
        timeout: number;
        verbose: boolean;
    };
}
/**
 * Create a hook runner with default configuration
 */
export declare function createHookRunner(options?: {
    workingDirectory?: string;
    timeout?: number;
    verbose?: boolean;
}): HookRunner;
//# sourceMappingURL=hook-runner.d.ts.map