#!/usr/bin/env node
/**
 * UCM Session Start Hook (HOOK-004)
 * SessionStart hook
 *
 * Ensures UCM daemon is running and initializes session state
 * in the context engine.
 */

import * as net from 'net';
import * as readline from 'readline';
import { spawn } from 'child_process';
import * as fs from 'fs';

interface SessionStartInput {
  session_id: string;
  project_path?: string;
  agent_config?: any;
}

interface SessionStartOutput {
  success: boolean;
  daemon_running: boolean;
  session_initialized: boolean;
  metrics?: {
    daemon_start_time_ms?: number;
    session_init_time_ms?: number;
  };
}

interface RPCRequest {
  jsonrpc: '2.0';
  method: string;
  params: any;
  id: number;
}

interface RPCResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

const SOCKET_PATH = '/tmp/godagent-db.sock';
const RPC_TIMEOUT = 3000; // 3 seconds
const DAEMON_START_TIMEOUT = 10000; // 10 seconds
const HEALTH_CHECK_RETRIES = 5;
const HEALTH_CHECK_INTERVAL = 500; // ms

/**
 * Call UCM daemon via JSON-RPC over Unix socket
 */
async function callDaemon(method: string, params: any, timeout = RPC_TIMEOUT): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(SOCKET_PATH);
    const request: RPCRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    };

    let responseBuffer = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timeout calling ${method}`));
    }, timeout);

    socket.on('connect', () => {
      socket.write(JSON.stringify(request) + '\n');
    });

    socket.on('data', (data) => {
      responseBuffer += data.toString();

      try {
        const response: RPCResponse = JSON.parse(responseBuffer);
        clearTimeout(timer);
        socket.end();

        if (response.error) {
          reject(new Error(`RPC Error: ${response.error.message}`));
        } else {
          resolve(response.result);
        }
      } catch (e) {
        // Incomplete JSON, wait for more data
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Check if daemon is running and healthy
 */
async function isDaemonHealthy(): Promise<boolean> {
  try {
    const result = await callDaemon('health.check', {});
    return result?.healthy || false;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for daemon to become healthy
 */
async function waitForDaemonHealthy(maxRetries = HEALTH_CHECK_RETRIES): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (await isDaemonHealthy()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
  }
  return false;
}

/**
 * Start UCM daemon
 */
async function startDaemon(): Promise<number> {
  const startTime = Date.now();

  console.error('[UCM-Session-Start] Starting UCM daemon...');

  // Start daemon process
  const daemonProcess = spawn('npx', ['tsx', 'src/god-agent/core/daemon/daemon.ts'], {
    detached: true,
    stdio: 'ignore',
  });

  daemonProcess.unref();

  // Wait for daemon to become healthy
  const healthy = await waitForDaemonHealthy();

  if (!healthy) {
    throw new Error('Daemon failed to become healthy within timeout');
  }

  const startupTime = Date.now() - startTime;
  console.error(`[UCM-Session-Start] Daemon started successfully in ${startupTime}ms`);

  return startupTime;
}

/**
 * Initialize session in context engine
 */
async function initializeSession(sessionId: string, projectPath?: string): Promise<void> {
  try {
    await callDaemon('context.initSession', {
      sessionId,
      projectPath,
      timestamp: Date.now(),
      config: {
        rollingWindowSize: 50000, // 50KB
        maxEpisodes: 1000,
        autoCompaction: true,
      },
    });

    console.error(`[UCM-Session-Start] Session ${sessionId} initialized`);
  } catch (error) {
    console.error('[UCM-Session-Start] Error initializing session:', error);
    throw error;
  }
}

/**
 * Main hook logic
 */
async function processSessionStart(input: SessionStartInput): Promise<SessionStartOutput> {
  const { session_id, project_path } = input;
  let daemonStartTime: number | undefined;
  let sessionInitTime: number | undefined;

  try {
    // Check if daemon is already running
    let daemonRunning = await isDaemonHealthy();

    if (!daemonRunning) {
      // Start daemon if not running
      daemonStartTime = await startDaemon();
      daemonRunning = true;
    } else {
      console.error('[UCM-Session-Start] UCM daemon already running');
    }

    // Initialize session
    const initStart = Date.now();
    await initializeSession(session_id, project_path);
    sessionInitTime = Date.now() - initStart;

    return {
      success: true,
      daemon_running: daemonRunning,
      session_initialized: true,
      metrics: {
        daemon_start_time_ms: daemonStartTime,
        session_init_time_ms: sessionInitTime,
      },
    };
  } catch (error) {
    console.error('[UCM-Session-Start] Error during session start:', error);
    return {
      success: false,
      daemon_running: false,
      session_initialized: false,
    };
  }
}

/**
 * Main entry point
 */
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    try {
      const input: SessionStartInput = JSON.parse(line);
      const output = await processSessionStart(input);
      console.log(JSON.stringify(output));
    } catch (error) {
      console.error('[UCM-Session-Start] Error processing hook:', error);
      console.log(
        JSON.stringify({
          success: false,
          daemon_running: false,
          session_initialized: false,
        })
      );
    }
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[UCM-Session-Start] Fatal error:', error);
  process.exit(1);
});
