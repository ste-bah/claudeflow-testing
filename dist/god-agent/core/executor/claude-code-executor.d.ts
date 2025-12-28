import type { IClaudeCodeExecutor, IExecutorConfig, ICodeExecutionRequest, ICodeExecutionResult } from './executor-types.js';
/**
 * Claude Code CLI Executor
 *
 * Implements RULE-CLI-001-001: CLI as sole backend
 * Implements RULE-CLI-001-002: No silent degradation
 * Implements RULE-CLI-001-005: Comprehensive logging
 */
export declare class ClaudeCodeExecutor implements IClaudeCodeExecutor {
    private readonly config;
    private cachedVersion;
    constructor(config?: Partial<IExecutorConfig>);
    /**
     * Check if Claude Code CLI is available
     */
    isAvailable(): Promise<boolean>;
    /**
     * Get Claude Code CLI version
     */
    getVersion(): Promise<string>;
    /**
     * Execute code generation via Claude Code CLI
     *
     * Implements RULE-CLI-001-002: Fail fast, no fallbacks
     * Implements RULE-CLI-001-006: No hardcoded values
     */
    execute(request: ICodeExecutionRequest): Promise<ICodeExecutionResult>;
    /**
     * Estimate quality score based on code characteristics
     * Heuristic-based scoring for generated code
     */
    private estimateQualityScore;
    /**
     * Extract code from markdown code blocks
     */
    private extractCodeBlocks;
    /**
     * Log with consistent format
     * Implements RULE-CLI-001-005
     */
    private log;
}
//# sourceMappingURL=claude-code-executor.d.ts.map