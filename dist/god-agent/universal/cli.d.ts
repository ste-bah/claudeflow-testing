#!/usr/bin/env node
/**
 * Universal Self-Learning God Agent CLI
 *
 * Usage:
 *   npx tsx src/god-agent/universal/cli.ts ask "How do I..."
 *   npx tsx src/god-agent/universal/cli.ts code "Implement a..."
 *   npx tsx src/god-agent/universal/cli.ts research "What is..."
 *   npx tsx src/god-agent/universal/cli.ts write "Essay about..."
 *   npx tsx src/god-agent/universal/cli.ts learn "Knowledge" --domain "patterns" --category "fact"
 *   npx tsx src/god-agent/universal/cli.ts learn --file ./learnings.md --domain "docs"
 *   npx tsx src/god-agent/universal/cli.ts feedback <id> <rating> --notes "Success"
 *   npx tsx src/god-agent/universal/cli.ts query --domain "project/api" --tags "schema"
 *   npx tsx src/god-agent/universal/cli.ts status
 */
/**
 * JSON output format for CLI commands.
 * Used when --json flag is provided.
 *
 * @example
 * ```typescript
 * npx tsx src/god-agent/universal/cli.ts ask "How do I..." --json
 * // Outputs:
 * // {
 * //   "command": "ask",
 * //   "selectedAgent": "assistant",
 * //   "prompt": "How do I...",
 * //   "isPipeline": false,
 * //   "result": { ... },
 * //   "success": true
 * // }
 * ```
 */
export interface ICLIJsonOutput {
    /** Command that was executed */
    command: string;
    /** Agent that was selected for execution (DAI-001 integration) */
    selectedAgent: string;
    /** Prompt/input that was provided */
    prompt: string;
    /** Whether this is a multi-agent pipeline task */
    isPipeline: boolean;
    /** Command-specific result data */
    result: unknown;
    /** Whether command succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Trajectory ID for feedback (if applicable) */
    trajectoryId?: string;
}
//# sourceMappingURL=cli.d.ts.map