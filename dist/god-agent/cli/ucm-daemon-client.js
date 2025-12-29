/**
 * UCM Daemon Client for phd-cli
 * Provides JSON-RPC 2.0 communication with the UCM daemon
 *
 * Used to integrate DESC episode injection and storage
 * directly into the PhD pipeline CLI commands.
 *
 * Features auto-start: if daemon is not running, automatically starts it.
 */
import * as net from 'net';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createComponentLogger, ConsoleLogHandler, LogLevel } from '../core/observability/index.js';
const logger = createComponentLogger('UCMDaemonClient', {
    minLevel: LogLevel.INFO,
    handlers: [new ConsoleLogHandler({ useStderr: true })]
});
const DEFAULT_SOCKET_PATH = '/tmp/godagent-ucm.sock';
const DEFAULT_TIMEOUT = 30000; // 30 seconds for DESC operations (embedding can be slow)
const DAEMON_START_TIMEOUT = 5000; // 5 seconds to wait for daemon to start
export class UCMDaemonClient {
    socketPath;
    timeout;
    requestId = 0;
    autoStartAttempted = false;
    constructor(options) {
        this.socketPath = options?.socketPath || DEFAULT_SOCKET_PATH;
        this.timeout = options?.timeout || DEFAULT_TIMEOUT;
    }
    /**
     * Check if daemon socket exists
     */
    socketExists() {
        try {
            return fs.existsSync(this.socketPath);
        }
        catch {
            // INTENTIONAL: Socket existence check failure means socket is not accessible - return false
            return false;
        }
    }
    /**
     * Start the UCM daemon in background
     * Returns true if daemon started successfully
     */
    async startDaemon() {
        if (this.autoStartAttempted) {
            return false; // Only try once per client instance
        }
        this.autoStartAttempted = true;
        try {
            // Find the daemon-server.ts path relative to this file
            const currentFile = fileURLToPath(import.meta.url);
            const currentDir = dirname(currentFile);
            // ucm-daemon-client.ts is in src/god-agent/cli/
            // daemon-server.ts is in src/god-agent/core/ucm/daemon/
            const daemonPath = join(currentDir, '..', 'core', 'ucm', 'daemon', 'daemon-server.ts');
            logger.info('Auto-starting daemon');
            // Spawn daemon in background, detached
            const child = spawn('npx', ['tsx', daemonPath], {
                detached: true,
                stdio: ['ignore', 'ignore', 'ignore'],
                env: { ...process.env },
            });
            // Unref so parent can exit independently
            child.unref();
            // Wait for socket to appear
            const startTime = Date.now();
            while (Date.now() - startTime < DAEMON_START_TIMEOUT) {
                await new Promise((r) => setTimeout(r, 200));
                if (this.socketExists()) {
                    logger.info('Daemon started successfully');
                    return true;
                }
            }
            logger.warn('Daemon did not start within timeout');
            return false;
        }
        catch (error) {
            logger.error('Failed to start daemon', error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
    /**
     * Ensure daemon is running, start if needed
     */
    async ensureDaemonRunning() {
        if (this.socketExists()) {
            return true;
        }
        return this.startDaemon();
    }
    /**
     * Call UCM daemon via JSON-RPC over Unix socket
     * Auto-starts daemon if not running
     */
    async call(method, params) {
        // Ensure daemon is running before attempting connection
        await this.ensureDaemonRunning();
        return new Promise((resolve, reject) => {
            const socket = net.connect(this.socketPath);
            const request = {
                jsonrpc: '2.0',
                method,
                params,
                id: ++this.requestId,
            };
            let responseBuffer = '';
            const timeout = setTimeout(() => {
                socket.destroy();
                reject(new Error(`UCM daemon timeout calling ${method}`));
            }, this.timeout);
            socket.on('connect', () => {
                socket.write(JSON.stringify(request) + '\n');
            });
            socket.on('data', (data) => {
                responseBuffer += data.toString();
                // Check if we have a complete JSON response
                try {
                    const response = JSON.parse(responseBuffer);
                    clearTimeout(timeout);
                    socket.end();
                    if (response.error) {
                        reject(new Error(`UCM RPC Error [${response.error.code}]: ${response.error.message}`));
                    }
                    else {
                        resolve(response.result);
                    }
                }
                catch {
                    // INTENTIONAL: Incomplete JSON, wait for more data - streaming RPC response pattern
                }
            });
            socket.on('error', (err) => {
                clearTimeout(timeout);
                reject(new Error(`UCM daemon connection error: ${err.message}`));
            });
            socket.on('timeout', () => {
                clearTimeout(timeout);
                socket.destroy();
                reject(new Error(`UCM socket timeout calling ${method}`));
            });
        });
    }
    /**
     * Check if UCM daemon is healthy
     */
    async isHealthy() {
        try {
            const result = await this.call('health.check', {});
            return result?.status === 'healthy' || result?.status === 'degraded';
        }
        catch {
            // INTENTIONAL: Health check failure means daemon is unavailable - false is correct response
            return false;
        }
    }
    /**
     * Get detailed health status
     */
    async healthCheck() {
        try {
            return await this.call('health.check', {});
        }
        catch {
            // INTENTIONAL: Health check call failure means daemon unavailable - null is correct response
            return null;
        }
    }
    /**
     * Inject similar prior solutions into a prompt
     * Returns the augmented prompt or original if no matches/error
     */
    async injectSolutions(prompt, options) {
        try {
            const result = await this.call('desc.inject', {
                prompt,
                threshold: options?.threshold ?? 0.75,
                maxEpisodes: options?.maxEpisodes ?? 3,
                agentType: options?.agentType,
                metadata: options?.metadata,
            });
            return {
                augmentedPrompt: result.augmentedPrompt,
                episodesUsed: result.episodesUsed,
                episodeIds: result.episodeIds,
            };
        }
        catch (error) {
            // On error, return original prompt unchanged
            logger.error('DESC injection failed', error instanceof Error ? error : new Error(String(error)));
            return {
                augmentedPrompt: prompt,
                episodesUsed: 0,
                episodeIds: [],
            };
        }
    }
    /**
     * Store a completed episode (agent result) for future retrieval
     */
    async storeEpisode(queryText, answerText, metadata) {
        try {
            const result = await this.call('desc.store', {
                queryText,
                answerText,
                metadata,
            });
            return {
                episodeId: result.episodeId,
                success: true,
            };
        }
        catch (error) {
            logger.error('DESC store failed', error instanceof Error ? error : new Error(String(error)));
            return {
                episodeId: '',
                success: false,
            };
        }
    }
    /**
     * Retrieve similar episodes for a query
     */
    async retrieveSimilar(searchText, options) {
        try {
            return await this.call('desc.retrieve', {
                searchText,
                threshold: options?.threshold ?? 0.75,
                maxResults: options?.maxResults ?? 5,
            });
        }
        catch (error) {
            logger.error('DESC retrieve failed', error instanceof Error ? error : new Error(String(error)));
            return [];
        }
    }
}
// Singleton instance for convenience
let defaultClient = null;
export function getUCMClient() {
    if (!defaultClient) {
        defaultClient = new UCMDaemonClient();
    }
    return defaultClient;
}
export function resetUCMClient() {
    defaultClient = null;
}
//# sourceMappingURL=ucm-daemon-client.js.map