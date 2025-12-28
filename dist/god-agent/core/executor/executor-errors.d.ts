/**
 * Base error class for Claude Code executor errors
 */
export declare abstract class ClaudeCodeError extends Error {
    abstract readonly code: string;
    abstract readonly remediation: string[];
    context?: Record<string, unknown>;
    constructor(message: string);
    /**
     * Get formatted error for logging
     */
    toJSON(): Record<string, unknown>;
}
/**
 * Thrown when Claude Code CLI is not found
 */
export declare class ClaudeCodeUnavailableError extends ClaudeCodeError {
    readonly code = "CLI_UNAVAILABLE";
    readonly remediation: string[];
    constructor(message?: string);
}
/**
 * Thrown when CLI execution times out
 */
export declare class ClaudeCodeTimeoutError extends ClaudeCodeError {
    readonly timeoutMs: number;
    readonly partialOutput?: string | undefined;
    readonly code = "CLI_TIMEOUT";
    readonly remediation: string[];
    constructor(timeoutMs: number, partialOutput?: string | undefined);
}
/**
 * Thrown when CLI returns non-zero exit code
 */
export declare class ClaudeCodeExecutionError extends ClaudeCodeError {
    readonly exitCode: number;
    readonly stderr: string;
    readonly stdout?: string | undefined;
    readonly code = "CLI_EXECUTION_FAILED";
    readonly remediation: string[];
    constructor(exitCode: number, stderr: string, stdout?: string | undefined);
}
/**
 * Thrown when CLI output cannot be parsed
 */
export declare class ClaudeCodeParseError extends ClaudeCodeError {
    readonly rawOutput: string;
    readonly code = "CLI_PARSE_FAILED";
    readonly remediation: string[];
    constructor(message: string, rawOutput: string);
}
//# sourceMappingURL=executor-errors.d.ts.map