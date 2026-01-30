#!/usr/bin/env npx tsx
/**
 * LEANN Queue Processor
 * Reads queued files and indexes them into LEANN via the MCP server
 *
 * Usage: npx tsx scripts/hooks/leann-process-queue.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const ROOT = process.cwd();
const QUEUE_FILE = path.join(ROOT, '.claude/runtime/leann-index-queue.json');

interface QueueData {
  files: string[];
  lastUpdated: string;
}

async function main() {
  console.log('[LEANN Queue Processor] Starting...');

  // Read queue
  let queue: QueueData = { files: [], lastUpdated: '' };
  try {
    const data = await fs.readFile(QUEUE_FILE, 'utf-8');
    queue = JSON.parse(data);
  } catch {
    console.log('[LEANN] No queue file found');
    return;
  }

  if (queue.files.length === 0) {
    console.log('[LEANN] Queue is empty');
    return;
  }

  console.log(`[LEANN] Processing ${queue.files.length} files...`);

  // Import LEANN tools dynamically
  const { indexCode } = await import('../../src/mcp-servers/leann-search/tools/index-repository.ts');
  const { DualCodeEmbeddingProvider } = await import('../../src/god-agent/core/search/dual-code-embedding.ts');
  const { LEANNBackend } = await import('../../src/god-agent/core/vector-db/leann-backend.ts');

  // Initialize LEANN context
  const backend = new LEANNBackend({ persistPath: './vector_db_leann' });
  const embeddingProvider = new DualCodeEmbeddingProvider({ apiUrl: 'http://localhost:8000' });
  const metadataStore = new Map();
  const codeStore = new Map();

  const context = { backend, embeddingProvider, metadataStore, codeStore };

  let indexed = 0;
  let failed = 0;

  for (const filePath of queue.files) {
    try {
      // Check file exists
      await fs.access(filePath);

      // Read file
      const code = await fs.readFile(filePath, 'utf-8');

      // Skip empty or huge files
      if (!code.trim() || code.length > 100000) {
        continue;
      }

      // Get repo name
      const repoName = path.basename(ROOT);

      // Index
      const result = await indexCode({
        code,
        filePath,
        repository: repoName,
        replaceExisting: true,
      }, context);

      if (result.success) {
        indexed++;
        console.log(`[LEANN] Indexed: ${filePath}`);
      } else {
        failed++;
        console.log(`[LEANN] Failed: ${filePath} - ${result.message}`);
      }
    } catch (err) {
      failed++;
      console.log(`[LEANN] Error: ${filePath} - ${err}`);
    }
  }

  // Persist backend
  backend.persist();

  // Clear queue
  await fs.writeFile(QUEUE_FILE, JSON.stringify({ files: [], lastUpdated: new Date().toISOString() }));

  console.log(`[LEANN] Complete: ${indexed} indexed, ${failed} failed`);
}

main().catch(console.error);
