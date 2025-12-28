/**
 * Base error class for Claude Code executor errors
 */
export class ClaudeCodeError extends Error {
    context;
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
    /**
     * Get formatted error for logging
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            remediation: this.remediation,
            context: this.context
        };
    }
}
/**
 * Thrown when Claude Code CLI is not found
 */
export class ClaudeCodeUnavailableError extends ClaudeCodeError {
    code = 'CLI_UNAVAILABLE';
    remediation = [
        'Install Claude Code CLI: npm install -g @anthropic/claude-code',
        'Verify installation: claude --version',
        'Ensure claude is in your PATH'
    ];
    constructor(message = 'Claude Code CLI not found in PATH') {
        super(message);
    }
}
/**
 * Thrown when CLI execution times out
 */
export class ClaudeCodeTimeoutError extends ClaudeCodeError {
    timeoutMs;
    partialOutput;
    code = 'CLI_TIMEOUT';
    remediation = [
        'Increase timeout via config.timeoutMs',
        'Simplify the task description',
        'Check network connectivity',
        'Check Claude Code CLI status: claude doctor'
    ];
    constructor(timeoutMs, partialOutput) {
        super(`Claude Code CLI execution timed out after ${timeoutMs}ms`);
        this.timeoutMs = timeoutMs;
        this.partialOutput = partialOutput;
        this.context = { timeoutMs, partialOutput };
    }
}
/**
 * Thrown when CLI returns non-zero exit code
 */
export class ClaudeCodeExecutionError extends ClaudeCodeError {
    exitCode;
    stderr;
    stdout;
    code = 'CLI_EXECUTION_FAILED';
    remediation = [
        'Check stderr output for details',
        'Verify Claude Code is authenticated: claude auth status',
        'Check API rate limits',
        'Try running the command manually for debugging'
    ];
    constructor(exitCode, stderr, stdout) {
        super(`Claude Code CLI failed with exit code ${exitCode}`);
        this.exitCode = exitCode;
        this.stderr = stderr;
        this.stdout = stdout;
        this.context = { exitCode, stderr, stdout };
    }
}
/**
 * Thrown when CLI output cannot be parsed
 */
export class ClaudeCodeParseError extends ClaudeCodeError {
    rawOutput;
    code = 'CLI_PARSE_FAILED';
    remediation = [
        'Check CLI output format: claude --output-format json ...',
        'Report this as a bug if the format changed'
    ];
    constructor(message, rawOutput) {
        super(message);
        this.rawOutput = rawOutput;
        this.context = { rawOutput };
    }
}
//# sourceMappingURL=executor-errors.js.map