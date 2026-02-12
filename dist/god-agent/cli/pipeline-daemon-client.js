/**
 * Pipeline Daemon Client
 *
 * JSON-RPC 2.0 client for the pipeline daemon with auto-start capability.
 * Follows CoreDaemonClient pattern: RULE-106 (spawn not exec), RULE-108 (env allowlist).
 */
import * as net from 'net';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const SOCKET_PATH = '/tmp/godagent-pipeline.sock';
const DEFAULT_TIMEOUT = 60000; // 60s (pipeline operations can be slow)
const DAEMON_START_TIMEOUT = 30000; // 30s (first start includes UniversalAgent init)
/**
 * Pipeline Daemon Client with auto-start
 */
export class PipelineDaemonClient {
    socketPath;
    timeout;
    autoStart;
    requestId = 0;
    autoStartAttempted = false;
    constructor(socketPath = SOCKET_PATH, timeout = DEFAULT_TIMEOUT, autoStart = true) {
        this.socketPath = socketPath;
        this.timeout = timeout;
        this.autoStart = autoStart;
    }
    /** Check if daemon socket exists */
    socketExists() {
        try {
            return fs.existsSync(this.socketPath);
        }
        catch {
            return false;
        }
    }
    /**
     * Auto-start daemon if not running.
     * Uses spawn (RULE-106) with env allowlist (RULE-108).
     */
    async startDaemon() {
        if (this.autoStartAttempted)
            return false;
        this.autoStartAttempted = true;
        try {
            const currentFile = fileURLToPath(import.meta.url);
            const currentDir = dirname(currentFile);
            const daemonPath = join(currentDir, 'pipeline-daemon.ts');
            console.error('[PipelineClient] Auto-starting pipeline daemon...');
            const allowedEnv = {
                PATH: process.env.PATH || '',
                HOME: process.env.HOME || '',
                NODE_ENV: process.env.NODE_ENV || 'production',
                EMBEDDING_HEALTH_TIMEOUT: '2000',
            };
            const child = spawn('npx', ['tsx', daemonPath, 'start'], {
                detached: true,
                stdio: ['ignore', 'ignore', 'ignore'],
                env: allowedEnv,
            });
            child.unref();
            // Wait for socket to appear
            const startTime = Date.now();
            while (Date.now() - startTime < DAEMON_START_TIMEOUT) {
                await new Promise(r => setTimeout(r, 500));
                if (this.socketExists()) {
                    console.error('[PipelineClient] Daemon started successfully');
                    return true;
                }
            }
            console.error('[PipelineClient] Daemon did not start within timeout');
            return false;
        }
        catch (error) {
            console.error(`[PipelineClient] Failed to start daemon: ${error instanceof Error ? error.message : error}`);
            return false;
        }
    }
    /** Ensure daemon is running */
    async ensureRunning() {
        if (this.socketExists())
            return true;
        if (!this.autoStart)
            return false;
        return this.startDaemon();
    }
    /** Low-level JSON-RPC 2.0 call over Unix socket */
    async call(method, params) {
        await this.ensureRunning();
        return new Promise((resolve, reject) => {
            const socket = net.connect(this.socketPath);
            const request = {
                jsonrpc: '2.0',
                method,
                params,
                id: ++this.requestId,
            };
            let responseBuffer = '';
            const timer = setTimeout(() => {
                socket.destroy();
                reject(new Error(`Pipeline daemon timeout calling ${method}`));
            }, this.timeout);
            socket.on('connect', () => {
                socket.write(JSON.stringify(request) + '\n');
            });
            socket.on('data', (data) => {
                responseBuffer += data.toString();
                try {
                    const response = JSON.parse(responseBuffer);
                    clearTimeout(timer);
                    socket.end();
                    if (response.error) {
                        reject(new Error(`Pipeline RPC Error [${response.error.code}]: ${response.error.message}`));
                    }
                    else {
                        resolve(response.result);
                    }
                }
                catch {
                    // Incomplete JSON — wait for more data
                }
            });
            socket.on('error', (err) => {
                clearTimeout(timer);
                reject(new Error(`Pipeline daemon connection error: ${err.message}`));
            });
        });
    }
    // ── Public API ───────────────────────────────────────────────────────
    async isHealthy() {
        try {
            await this.call('health.ping', {});
            return true;
        }
        catch {
            return false;
        }
    }
    async init(task) {
        return this.call('pipeline.init', { task });
    }
    async next(sessionId) {
        return this.call('pipeline.next', { sessionId });
    }
    async complete(sessionId, agentKey, file) {
        return this.call('pipeline.complete', { sessionId, agentKey, file });
    }
    async completeAndNext(sessionId, agentKey, file) {
        return this.call('pipeline.completeAndNext', { sessionId, agentKey, file });
    }
    async status(sessionId) {
        return this.call('pipeline.status', { sessionId });
    }
    async resume(sessionId) {
        return this.call('pipeline.resume', { sessionId });
    }
    async health() {
        return this.call('pipeline.health', {});
    }
    async restart() {
        return this.call('pipeline.restart', {});
    }
}
// Singleton
let defaultClient = null;
export function getPipelineDaemonClient() {
    if (!defaultClient) {
        defaultClient = new PipelineDaemonClient();
    }
    return defaultClient;
}
export function resetPipelineDaemonClient() {
    defaultClient = null;
}
//# sourceMappingURL=pipeline-daemon-client.js.map