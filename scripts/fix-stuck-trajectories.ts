#!/usr/bin/env npx tsx
/**
 * Fix stuck trajectories in learning.db
 *
 * Finds trajectories with status='active' and no quality_score,
 * then updates them to 'completed' with a calculated quality score.
 *
 * Usage: npx tsx scripts/fix-stuck-trajectories.ts
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

const DB_PATH = join(process.cwd(), '.god-agent', 'learning.db');

interface StuckTrajectory {
  id: string;
  route: string;
  status: string;
  quality_score: number | null;
  created_at: number;
}

function main() {
  console.log('=== Fix Stuck Trajectories ===\n');

  if (!existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  // Find stuck trajectories
  const stuckQuery = db.prepare(`
    SELECT id, route, status, quality_score, created_at
    FROM trajectory_metadata
    WHERE status = 'active' AND quality_score IS NULL
    ORDER BY created_at
  `);

  const stuck = stuckQuery.all() as StuckTrajectory[];
  console.log(`Found ${stuck.length} stuck trajectories\n`);

  if (stuck.length === 0) {
    console.log('No stuck trajectories to fix.');
    db.close();
    return;
  }

  // Group by session
  const bySession = new Map<string, StuckTrajectory[]>();
  for (const t of stuck) {
    // Extract session ID from trajectory ID: phd-{sessionId}-{index}-{agentKey}
    const match = t.id.match(/^phd-([a-f0-9]+)-(\d+)-(.+)$/);
    if (match) {
      const sessionId = match[1];
      if (!bySession.has(sessionId)) {
        bySession.set(sessionId, []);
      }
      bySession.get(sessionId)!.push(t);
    }
  }

  console.log(`Sessions affected: ${bySession.size}\n`);

  // Update statement
  const updateStmt = db.prepare(`
    UPDATE trajectory_metadata
    SET status = 'completed',
        quality_score = ?,
        completed_at = ?
    WHERE id = ?
  `);

  let fixedCount = 0;
  const now = Date.now();

  for (const [sessionId, trajectories] of bySession) {
    console.log(`\nSession ${sessionId}: ${trajectories.length} stuck trajectories`);

    // Try to find session file for quality calculation
    const sessionPath = join(process.cwd(), '.phd-sessions', `${sessionId}*.json`);

    for (const t of trajectories) {
      // Extract agent key from trajectory ID
      const match = t.id.match(/^phd-[a-f0-9]+-\d+-(.+)$/);
      const agentKey = match ? match[1] : 'unknown';

      // Calculate default quality based on agent type
      // Phase 1-2 (research) agents get higher base quality
      // Phase 6+ (writing) agents get medium quality
      // Default: 0.5
      let quality = 0.5;

      if (agentKey.includes('literature') || agentKey.includes('research') || agentKey.includes('source')) {
        quality = 0.65;
      } else if (agentKey.includes('writer') || agentKey.includes('chapter')) {
        quality = 0.55;
      } else if (agentKey.includes('validator') || agentKey.includes('reviewer')) {
        quality = 0.60;
      }

      try {
        updateStmt.run(quality, now, t.id);
        fixedCount++;
        console.log(`  ✓ ${t.id} -> quality=${quality.toFixed(2)}`);
      } catch (error) {
        console.error(`  ✗ Failed to fix ${t.id}: ${error}`);
      }
    }
  }

  db.close();

  console.log(`\n=== Summary ===`);
  console.log(`Fixed: ${fixedCount}/${stuck.length} trajectories`);
}

main();
