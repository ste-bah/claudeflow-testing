#!/usr/bin/env npx tsx
/**
 * LEANN Queue Processor with Semantic Chunking
 *
 * Processes queued files for LEANN indexing, chunking large files
 * into semantic segments before embedding.
 */

import { parseCodeIntoChunks, detectLanguage, type CodeChunk } from
  '../../src/mcp-servers/leann-search/tools/index-repository.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const QUEUE_FILE = '.claude/runtime/leann-index-queue.json';
const EMBEDDER_URL = 'http://localhost:8000';
const MAX_CHUNK_SIZE = 4000;
const BATCH_SIZE = 3;
const PAUSE_BETWEEN_BATCHES_MS = 10000;
const PAUSE_BETWEEN_FILES_MS = 3000;
const MAX_FILE_SIZE = 512 * 1024; // 512KB

interface QueueData {
  files: string[];
  lastUpdated: string;
}

interface ChunkMetadata {
  filePath: string;
  startLine: number;
  endLine: number;
  symbolType: string;
  symbolName?: string;
  chunkIndex: number;
  totalChunks: number;
  language: string;
  contentHash: string;
  repository: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkEmbedderHealth(): Promise<boolean> {
  try {
    const response = await fetch(EMBEDDER_URL, {
      signal: AbortSignal.timeout(30000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function indexChunk(content: string, metadata: ChunkMetadata): Promise<boolean> {
  try {
    const response = await fetch(`${EMBEDDER_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: [content],
        metadata: [metadata]
      }),
      signal: AbortSignal.timeout(90000)
    });

    if (!response.ok) {
      console.error(`[LEANN] Embed failed: ${response.status}`);
      return false;
    }

    const result = await response.json();
    return result.message !== undefined;
  } catch (err) {
    console.error(`[LEANN] Embed error:`, err);
    return false;
  }
}

async function processFile(filePath: string, repoName: string): Promise<{ indexed: number; failed: number }> {
  let indexed = 0;
  let failed = 0;

  try {
    // Check file size
    const stats = await fs.stat(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      console.log(`[LEANN] Skip (>${MAX_FILE_SIZE / 1024}KB): ${filePath}`);
      return { indexed: 0, failed: 0 };
    }

    const content = await fs.readFile(filePath, 'utf8');
    const language = detectLanguage(filePath);

    // Chunk the file using MCP's semantic chunking
    const chunks = parseCodeIntoChunks(content, language, MAX_CHUNK_SIZE);

    console.log(`[LEANN] ${path.basename(filePath)}: ${chunks.length} chunks`);

    // Index each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const metadata: ChunkMetadata = {
        filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        symbolType: chunk.symbolType,
        symbolName: chunk.symbolName,
        chunkIndex: i,
        totalChunks: chunks.length,
        language,
        contentHash: crypto.createHash('sha256')
          .update(chunk.content)
          .digest('hex')
          .slice(0, 16),
        repository: repoName,
      };

      const success = await indexChunk(chunk.content, metadata);
      if (success) {
        indexed++;
      } else {
        failed++;
      }

      // Small pause between chunks to avoid overwhelming embedder
      if (i < chunks.length - 1) {
        await sleep(500);
      }
    }
  } catch (err) {
    console.error(`[LEANN] Error processing ${filePath}:`, err);
    failed++;
  }

  return { indexed, failed };
}

async function processQueue(): Promise<void> {
  // Find repo root
  const cwd = process.cwd();
  const repoName = path.basename(cwd);
  const queuePath = path.join(cwd, QUEUE_FILE);

  // Read queue
  let queue: QueueData;
  try {
    const content = await fs.readFile(queuePath, 'utf8');
    queue = JSON.parse(content);
  } catch (err) {
    console.log('[LEANN] No queue file or empty queue');
    return;
  }

  if (!queue.files || queue.files.length === 0) {
    console.log('[LEANN] Queue is empty');
    return;
  }

  console.log(`[LEANN] Processing ${queue.files.length} files in batches of ${BATCH_SIZE}`);

  let totalIndexed = 0;
  let totalFailed = 0;
  let processedFiles = 0;

  for (let i = 0; i < queue.files.length; i++) {
    const filePath = queue.files[i];

    // Health check at start of each batch
    if (i % BATCH_SIZE === 0) {
      console.log('[LEANN] Health check...');
      if (!await checkEmbedderHealth()) {
        console.log('[LEANN] Embedder not responding, waiting 30s...');
        await sleep(30000);
        if (!await checkEmbedderHealth()) {
          console.log('[LEANN] Embedder still down, stopping');
          break;
        }
      }
    }

    // Check file exists
    try {
      await fs.access(filePath);
    } catch {
      console.log(`[LEANN] Skip (not found): ${filePath}`);
      continue;
    }

    // Process file
    const result = await processFile(filePath, repoName);
    totalIndexed += result.indexed;
    totalFailed += result.failed;
    processedFiles++;

    console.log(`[LEANN] [${processedFiles}/${queue.files.length}] ${result.indexed > 0 ? 'OK' : 'SKIP'}: ${path.basename(filePath)}`);

    // Pause between files
    await sleep(PAUSE_BETWEEN_FILES_MS);

    // Longer pause between batches
    if ((i + 1) % BATCH_SIZE === 0 && i < queue.files.length - 1) {
      console.log(`[LEANN] Batch done, pausing ${PAUSE_BETWEEN_BATCHES_MS / 1000}s...`);
      await sleep(PAUSE_BETWEEN_BATCHES_MS);
    }
  }

  console.log(`[LEANN] Complete: ${totalIndexed} chunks indexed, ${totalFailed} failed from ${processedFiles} files`);

  // Clear queue on success
  if (totalFailed === 0) {
    await fs.writeFile(queuePath, JSON.stringify({
      files: [],
      lastUpdated: new Date().toISOString()
    }, null, 2));
    console.log('[LEANN] Queue cleared');
  }
}

// Run
processQueue().catch(err => {
  console.error('[LEANN] Fatal error:', err);
  process.exit(1);
});
