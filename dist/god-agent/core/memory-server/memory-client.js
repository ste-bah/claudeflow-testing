/**
 * Memory Client
 * MEM-001 - Client for UniversalAgent and subagents to access memory server
 *
 * Features:
 * - Auto-discovery of server address
 * - Automatic reconnection on disconnect
 * - Request/response correlation
 * - Timeout handling
 */
import * as net from 'net';
import * as http from 'http';
import { DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_RECONNECT_DELAY_MS, DEFAULT_MAX_RECONNECT_ATTEMPTS, } from '../types/memory-types.js';
import { ServerNotRunningError, ServerDisconnectedError, TimeoutError, errorFromInfo, } from './memory-errors.js';
import { createRequest, serializeMessage, isResponse, MessageBuffer, } from './memory-protocol.js';
import { discoverMemoryServer } from './memory-health.js';
import { ensureDaemonRunning } from './daemon-launcher.js';
// ==================== Memory Client ====================
export class MemoryClient {
    config;
    agentDbPath;
    state = 'disconnected';
    socket = null;
    serverAddress = null;
    connectedAt = null;
    reconnectAttempts = 0;
    lastError = null;
    messageBuffer = new MessageBuffer();
    pendingRequests = new Map();
    reconnectTimer = null;
    intentionalDisconnect = false;
    constructor(agentDbPath = '.agentdb', config = {}) {
        this.agentDbPath = agentDbPath;
        this.config = {
            serverAddress: config.serverAddress ?? undefined,
            connectTimeoutMs: config.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
            requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
            autoReconnect: config.autoReconnect ?? true,
            maxReconnectAttempts: config.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
            reconnectDelayMs: config.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS,
            verbose: config.verbose ?? false,
            autoStart: config.autoStart ?? true,
        };
    }
    // ==================== Lifecycle ====================
    /**
     * Connect to the memory server
     */
    async connect() {
        if (this.state === 'connected')
            return;
        if (this.state === 'connecting') {
            // Wait for existing connection attempt
            await this.waitForConnection();
            return;
        }
        this.state = 'connecting';
        this.log('debug', 'Connecting to memory server...');
        // Discover server address if not provided
        let address = this.config.serverAddress ?? (await discoverMemoryServer(this.agentDbPath));
        // Auto-start daemon if enabled and server not running
        if (!address && this.config.autoStart) {
            this.log('info', 'Server not running, launching daemon...');
            const result = await ensureDaemonRunning(this.agentDbPath, { verbose: this.config.verbose });
            if (result.success && result.address) {
                address = result.address;
                this.log('info', `Daemon started at ${address} (PID: ${result.pid})`);
            }
            else {
                this.state = 'disconnected';
                throw new ServerNotRunningError(result.error || 'Failed to start daemon');
            }
        }
        if (!address) {
            this.state = 'disconnected';
            throw new ServerNotRunningError();
        }
        this.serverAddress = address;
        if (address.startsWith('unix:')) {
            await this.connectUnixSocket(address.slice(5));
        }
        else if (address.startsWith('http://')) {
            // HTTP mode doesn't need persistent connection
            this.state = 'connected';
            this.connectedAt = Date.now();
            this.reconnectAttempts = 0;
            this.intentionalDisconnect = false;
            this.log('info', `Connected to memory server at ${address}`);
        }
        else {
            this.state = 'disconnected';
            throw new Error(`Unknown address format: ${address}`);
        }
    }
    /**
     * Disconnect from the memory server
     */
    async disconnect() {
        // Mark as intentional to prevent auto-reconnect
        this.intentionalDisconnect = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        // Reject all pending requests
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new ServerDisconnectedError('Client disconnecting'));
        }
        this.pendingRequests.clear();
        this.state = 'disconnected';
        this.serverAddress = null;
        this.connectedAt = null;
        this.log('info', 'Disconnected from memory server');
    }
    /**
     * Get current connection info
     */
    getConnectionInfo() {
        return {
            state: this.state,
            serverAddress: this.serverAddress,
            connectedAt: this.connectedAt,
            reconnectAttempts: this.reconnectAttempts,
            lastError: this.lastError,
        };
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.state === 'connected';
    }
    // ==================== Connection Helpers ====================
    async connectUnixSocket(socketPath) {
        return new Promise((resolve, reject) => {
            const socket = net.createConnection({ path: socketPath });
            const connectTimeout = setTimeout(() => {
                socket.destroy();
                this.state = 'disconnected';
                reject(new TimeoutError('connect', this.config.connectTimeoutMs));
            }, this.config.connectTimeoutMs);
            socket.on('connect', () => {
                clearTimeout(connectTimeout);
                this.socket = socket;
                this.state = 'connected';
                this.connectedAt = Date.now();
                this.reconnectAttempts = 0;
                this.intentionalDisconnect = false;
                this.setupSocketHandlers(socket);
                this.log('info', `Connected to memory server at unix:${socketPath}`);
                resolve();
            });
            socket.on('error', (error) => {
                clearTimeout(connectTimeout);
                this.state = 'disconnected';
                this.lastError = error.message;
                reject(new ServerNotRunningError(`unix:${socketPath}`));
            });
        });
    }
    setupSocketHandlers(socket) {
        socket.on('data', (data) => {
            this.handleData(data.toString());
        });
        socket.on('close', () => {
            this.handleDisconnect();
        });
        socket.on('error', (error) => {
            this.lastError = error.message;
            this.log('warn', 'Socket error', { error: error.message });
        });
    }
    handleData(data) {
        try {
            const messages = this.messageBuffer.push(data);
            for (const message of messages) {
                if (isResponse(message)) {
                    const pending = this.pendingRequests.get(message.id);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        this.pendingRequests.delete(message.id);
                        pending.resolve(message);
                    }
                }
            }
        }
        catch (error) {
            this.log('warn', 'Failed to parse message', { error });
        }
    }
    handleDisconnect() {
        this.socket = null;
        this.state = 'disconnected';
        this.connectedAt = null;
        // Reject all pending requests
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new ServerDisconnectedError());
        }
        this.pendingRequests.clear();
        // Attempt reconnect if enabled AND not intentionally disconnected
        if (this.config.autoReconnect &&
            !this.intentionalDisconnect &&
            this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.state = 'reconnecting';
        this.reconnectAttempts++;
        const delay = this.config.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);
        this.log('info', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            try {
                await this.connect();
            }
            catch (error) {
                if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
                else {
                    this.log('error', 'Max reconnect attempts reached');
                }
            }
        }, delay);
    }
    async waitForConnection() {
        const maxWait = this.config.connectTimeoutMs;
        const start = Date.now();
        while (this.state === 'connecting' && Date.now() - start < maxWait) {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (this.state !== 'connected') {
            throw new ServerNotRunningError();
        }
    }
    // ==================== Request Handling ====================
    async sendRequest(request) {
        if (this.state !== 'connected') {
            await this.connect();
        }
        if (this.serverAddress?.startsWith('http://')) {
            return this.sendHttpRequest(request);
        }
        return this.sendSocketRequest(request);
    }
    async sendSocketRequest(request) {
        if (!this.socket) {
            throw new ServerNotRunningError();
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(request.id);
                reject(new TimeoutError(request.method, this.config.requestTimeoutMs));
            }, this.config.requestTimeoutMs);
            this.pendingRequests.set(request.id, {
                resolve: (response) => {
                    if (response.success) {
                        resolve(response.result);
                    }
                    else if (response.error) {
                        reject(errorFromInfo(response.error));
                    }
                    else {
                        reject(new Error('Unknown error'));
                    }
                },
                reject,
                timeout,
            });
            this.socket.write(serializeMessage(request));
        });
    }
    async sendHttpRequest(request) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.serverAddress);
            const postData = JSON.stringify(request);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
                timeout: this.config.requestTimeoutMs,
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
                        else if (response.error) {
                            reject(errorFromInfo(response.error));
                        }
                        else {
                            reject(new Error('Unknown error'));
                        }
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
            req.on('error', (error) => {
                reject(new ServerDisconnectedError(error.message));
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new TimeoutError(request.method, this.config.requestTimeoutMs));
            });
            req.write(postData);
            req.end();
        });
    }
    // ==================== High-Level Methods (TASK-MEM-008) ====================
    /**
     * Store knowledge entry
     */
    async storeKnowledge(params) {
        const request = createRequest('storeKnowledge', params);
        return this.sendRequest(request);
    }
    /**
     * Get knowledge entries by domain
     */
    async getKnowledgeByDomain(domain, limit) {
        const params = { domain, limit };
        const request = createRequest('getKnowledgeByDomain', params);
        return this.sendRequest(request);
    }
    /**
     * Get knowledge entries by tags
     */
    async getKnowledgeByTags(tags, limit) {
        const params = { tags, limit };
        const request = createRequest('getKnowledgeByTags', params);
        return this.sendRequest(request);
    }
    /**
     * Delete knowledge entry
     */
    async deleteKnowledge(id) {
        const params = { id };
        const request = createRequest('deleteKnowledge', params);
        return this.sendRequest(request);
    }
    /**
     * Provide feedback for a trajectory
     */
    async provideFeedback(params) {
        const request = createRequest('provideFeedback', params);
        return this.sendRequest(request);
    }
    /**
     * Query patterns
     */
    async queryPatterns(params) {
        const request = createRequest('queryPatterns', params);
        return this.sendRequest(request);
    }
    /**
     * Get server status
     */
    async getStatus() {
        const request = createRequest('getStatus', {});
        return this.sendRequest(request);
    }
    /**
     * Ping the server
     */
    async ping() {
        const request = createRequest('ping', {});
        return this.sendRequest(request);
    }
    // ==================== Logging ====================
    log(level, message, context) {
        if (level === 'debug' && !this.config.verbose)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            component: 'MemoryClient',
            message,
            ...context,
        };
        if (level === 'error') {
            console.error(JSON.stringify(entry));
        }
        else if (level === 'warn') {
            console.warn(JSON.stringify(entry));
        }
        else {
            console.log(JSON.stringify(entry));
        }
    }
}
// ==================== Factory Functions ====================
let clientInstance = null;
/**
 * Get or create the singleton client instance
 */
export function getMemoryClient(agentDbPath, config) {
    if (!clientInstance) {
        clientInstance = new MemoryClient(agentDbPath, config);
    }
    return clientInstance;
}
/**
 * Create a new client instance (non-singleton)
 */
export function createMemoryClient(agentDbPath, config) {
    return new MemoryClient(agentDbPath, config);
}
//# sourceMappingURL=memory-client.js.map