#!/usr/bin/env npx tsx
/**
 * Pipeline Daemon - Persistent process for coding pipeline operations
 *
 * Eliminates cold-start overhead by keeping UniversalAgent, orchestrator,
 * and embedding provider warm in memory. Follows the DaemonServer pattern
 * from daemon-cli.ts.
 *
 * Socket: /tmp/godagent-pipeline.sock
 * PID: /tmp/godagent-pipeline.pid
 *
 * Usage:
 *   npx tsx src/god-agent/cli/pipeline-daemon.ts start
 *   npx tsx src/god-agent/cli/pipeline-daemon.ts stop
 *   npx tsx src/god-agent/cli/pipeline-daemon.ts status
 */
export {};
//# sourceMappingURL=pipeline-daemon.d.ts.map