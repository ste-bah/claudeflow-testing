#!/usr/bin/env npx tsx
/**
 * Pipeline Thin CLI
 *
 * Lightweight entry point that delegates to the pipeline daemon.
 * Replaces direct invocation of coding-pipeline-cli.ts in god-code.md.
 *
 * Usage (same interface as coding-pipeline-cli.ts):
 *   npx tsx src/god-agent/cli/pipeline-thin-cli.ts init "<task>"
 *   npx tsx src/god-agent/cli/pipeline-thin-cli.ts next <sessionId>
 *   npx tsx src/god-agent/cli/pipeline-thin-cli.ts complete <sessionId> <agentKey> [--file <path>]
 *   npx tsx src/god-agent/cli/pipeline-thin-cli.ts complete-and-next <sessionId> <agentKey> [--file <path>]
 *   npx tsx src/god-agent/cli/pipeline-thin-cli.ts status <sessionId>
 *   npx tsx src/god-agent/cli/pipeline-thin-cli.ts resume <sessionId>
 */
export {};
//# sourceMappingURL=pipeline-thin-cli.d.ts.map