/**
 * Memory Health Monitor
 * MEM-001 - Health checking and diagnostics for memory server
 *
 * Provides:
 * - Periodic health checks
 * - Server discovery
 * - Connectivity verification
 * - Diagnostic reporting
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import * as net from 'net';
import * as http from 'http';
import { createRequest, serializeMessage, parseMessage, isResponse } from './memory-protocol.js';
// ==================== Constants ====================
const PID_FILE_NAME = 'memory-server.pid';
const DEFAULT_AGENTDB_PATH = '.agentdb';
// ==================== Health Monitor ====================
export class MemoryHealthMonitor {
    config;
    agentDbPath;
    checkTimer = null;
    consecutiveFailures = 0;
    lastResult = null;
    listeners = new Set();
    constructor(agentDbPath = DEFAULT_AGENTDB_PATH, config = {}) {
        this.agentDbPath = agentDbPath;
        this.config = {
            intervalMs: config.intervalMs ?? 10000,
            timeoutMs: config.timeoutMs ?? 5000,
            failureThreshold: config.failureThreshold ?? 3,
        };
    }
    // ==================== Lifecycle ====================
    /**
     * Start periodic health monitoring
     */
    start() {
        if (this.checkTimer)
            return;
        this.checkTimer = setInterval(() => {
            this.check().catch((error) => {
                console.warn('[MemoryHealthMonitor] Check failed:', error);
            });
        }, this.config.intervalMs);
        // Run initial check
        this.check().catch(() => { });
    }
    /**
     * Stop health monitoring
     */
    stop() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }
    /**
     * Subscribe to health check results
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /**
     * Get last health check result
     */
    getLastResult() {
        return this.lastResult;
    }
    // ==================== Health Check ====================
    /**
     * Perform a single health check
     */
    async check() {
        const startTime = Date.now();
        const result = {
            healthy: false,
            serverReachable: false,
            storageAccessible: false,
            responseTimeMs: 0,
            lastCheckAt: startTime,
        };
        try {
            // Check if server is running
            const serverAddress = await this.discoverServer();
            if (!serverAddress) {
                result.error = 'Server not running (no PID file)';
                this.handleResult(result);
                return result;
            }
            // Ping the server
            const pingResult = await this.pingServer(serverAddress);
            result.serverReachable = true;
            result.responseTimeMs = Date.now() - startTime;
            // Check storage by attempting a status request
            result.storageAccessible = pingResult !== null;
            result.healthy = result.serverReachable && result.storageAccessible;
            this.handleResult(result);
            return result;
        }
        catch (error) {
            result.error = error instanceof Error ? error.message : String(error);
            result.responseTimeMs = Date.now() - startTime;
            this.handleResult(result);
            return result;
        }
    }
    handleResult(result) {
        if (result.healthy) {
            this.consecutiveFailures = 0;
        }
        else {
            this.consecutiveFailures++;
        }
        this.lastResult = result;
        // Notify listeners
        for (const listener of this.listeners) {
            try {
                listener(result);
            }
            catch {
                // Ignore listener errors
            }
        }
    }
    // ==================== Server Discovery ====================
    /**
     * Discover the memory server address from PID file
     */
    async discoverServer() {
        const pidPath = path.join(this.agentDbPath, PID_FILE_NAME);
        try {
            const content = await fs.readFile(pidPath, 'utf-8');
            const pidFile = JSON.parse(content);
            // Verify process is still running
            try {
                process.kill(pidFile.pid, 0);
                return pidFile.address;
            }
            catch {
                // Process not running
                return null;
            }
        }
        catch {
            return null;
        }
    }
    /**
     * Check if server is healthy at the given address
     */
    async isServerHealthy(address) {
        const serverAddress = address ?? (await this.discoverServer());
        if (!serverAddress)
            return false;
        try {
            const result = await this.pingServer(serverAddress);
            return result !== null;
        }
        catch {
            return false;
        }
    }
    // ==================== Server Communication ====================
    async pingServer(address) {
        if (address.startsWith('unix:')) {
            return this.pingUnixSocket(address.slice(5));
        }
        else if (address.startsWith('http://')) {
            return this.pingHttp(address);
        }
        return null;
    }
    async pingUnixSocket(socketPath) {
        return new Promise((resolve) => {
            const socket = net.createConnection({ path: socketPath }, () => {
                const request = createRequest('ping', {});
                socket.write(serializeMessage(request));
            });
            let data = '';
            const timeout = setTimeout(() => {
                socket.destroy();
                resolve(null);
            }, this.config.timeoutMs);
            socket.on('data', (chunk) => {
                data += chunk.toString();
                if (data.includes('\n')) {
                    clearTimeout(timeout);
                    try {
                        const message = parseMessage(data);
                        if (isResponse(message) && message.success) {
                            resolve(message.result);
                        }
                        else {
                            resolve(null);
                        }
                    }
                    catch {
                        resolve(null);
                    }
                    socket.destroy();
                }
            });
            socket.on('error', () => {
                clearTimeout(timeout);
                resolve(null);
            });
        });
    }
    async pingHttp(baseUrl) {
        return new Promise((resolve) => {
            const request = createRequest('ping', {});
            const postData = JSON.stringify(request);
            const url = new URL(baseUrl);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
                timeout: this.config.timeoutMs,
            };
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.success) {
                            resolve(response.result);
                        }
                        else {
                            resolve(null);
                        }
                    }
                    catch {
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });
            req.write(postData);
            req.end();
        });
    }
    // ==================== Diagnostics ====================
    /**
     * Get comprehensive diagnostic information
     */
    async getDiagnostics() {
        const report = {
            timestamp: new Date().toISOString(),
            agentDbPath: this.agentDbPath,
            pidFileExists: false,
            pidFileContent: null,
            serverProcessRunning: false,
            serverReachable: false,
            lastHealthCheck: this.lastResult,
            consecutiveFailures: this.consecutiveFailures,
            storageStatus: null,
        };
        // Check PID file
        const pidPath = path.join(this.agentDbPath, PID_FILE_NAME);
        try {
            const content = await fs.readFile(pidPath, 'utf-8');
            report.pidFileExists = true;
            report.pidFileContent = JSON.parse(content);
            // Check if process is running
            try {
                process.kill(report.pidFileContent.pid, 0);
                report.serverProcessRunning = true;
            }
            catch {
                report.serverProcessRunning = false;
            }
        }
        catch {
            report.pidFileExists = false;
        }
        // Check server reachability
        if (report.pidFileContent) {
            const pingResult = await this.pingServer(report.pidFileContent.address);
            report.serverReachable = pingResult !== null;
        }
        // Check storage directory
        try {
            const stats = await fs.stat(this.agentDbPath);
            report.storageStatus = {
                exists: true,
                isDirectory: stats.isDirectory(),
                permissions: stats.mode.toString(8),
            };
        }
        catch {
            report.storageStatus = { exists: false };
        }
        return report;
    }
}
// ==================== Singleton Access ====================
let healthMonitorInstance = null;
/**
 * Get or create the singleton health monitor
 */
export function getHealthMonitor(agentDbPath, config) {
    if (!healthMonitorInstance) {
        healthMonitorInstance = new MemoryHealthMonitor(agentDbPath, config);
    }
    return healthMonitorInstance;
}
/**
 * Quick check if server is healthy
 */
export async function isMemoryServerHealthy(agentDbPath) {
    const monitor = getHealthMonitor(agentDbPath);
    return monitor.isServerHealthy();
}
/**
 * Discover memory server address
 */
export async function discoverMemoryServer(agentDbPath) {
    const monitor = getHealthMonitor(agentDbPath);
    return monitor.discoverServer();
}
//# sourceMappingURL=memory-health.js.map