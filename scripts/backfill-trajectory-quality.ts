#!/usr/bin/env npx ts-node
/**
 * Backfill Trajectory Quality Script
 *
 * Assigns quality scores to trajectories that were never given feedback.
 * This is a one-time fix for the bug where empty-pattern trajectories
 * didn't persist quality to SQLite.
 *
 * Strategy:
 * - All trajectories with status='active' and NULL quality get 0.75
 * - This marks them as successful (above 0.5 threshold)
 * - They won't auto-create patterns (requires >= 0.8)
 * - User can manually upgrade high-value trajectories to 0.8+ if desired
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), '.god-agent', 'learning.db');

async function main() {
  console.log('========================================');
  console.log('Trajectory Quality Backfill');
  console.log('========================================\n');

  // Open database
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Check current state
  const beforeStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN quality_score IS NULL THEN 1 ELSE 0 END) as null_quality,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
    FROM trajectory_metadata
  `).get() as { total: number; null_quality: number; active_count: number };

  console.log('[BEFORE]');
  console.log(`  Total trajectories: ${beforeStats.total}`);
  console.log(`  NULL quality: ${beforeStats.null_quality}`);
  console.log(`  Active status: ${beforeStats.active_count}\n`);

  if (beforeStats.null_quality === 0) {
    console.log('[INFO] No trajectories need backfilling. All have quality scores.');
    db.close();
    return;
  }

  // Backfill quality for active trajectories with NULL quality
  const DEFAULT_QUALITY = 0.75;
  const now = Date.now();

  const updateStmt = db.prepare(`
    UPDATE trajectory_metadata
    SET quality_score = ?, status = 'completed', completed_at = ?
    WHERE quality_score IS NULL AND status = 'active'
  `);

  const result = updateStmt.run(DEFAULT_QUALITY, now);
  console.log(`[UPDATE] Backfilled ${result.changes} trajectories with quality=${DEFAULT_QUALITY}\n`);

  // Also insert feedback records for tracking
  const trajectories = db.prepare(`
    SELECT id, route FROM trajectory_metadata
    WHERE quality_score = ? AND completed_at = ?
  `).all(DEFAULT_QUALITY, now) as Array<{ id: string; route: string }>;

  const insertFeedback = db.prepare(`
    INSERT OR IGNORE INTO learning_feedback
    (id, trajectory_id, quality, outcome, task_type, agent_id, result_length, has_code_blocks, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let feedbackCount = 0;
  for (const traj of trajectories) {
    const feedbackId = `fb-backfill-${traj.id}-${now}`;
    try {
      insertFeedback.run(
        feedbackId,
        traj.id,
        DEFAULT_QUALITY,
        'neutral', // 0.75 is neutral-positive
        traj.route,
        'backfill-script',
        0, // result_length unknown
        0, // has_code_blocks unknown
        now
      );
      feedbackCount++;
    } catch (error) {
      // Ignore duplicate errors
    }
  }
  console.log(`[FEEDBACK] Created ${feedbackCount} feedback records\n`);

  // Verify final state
  const afterStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN quality_score IS NULL THEN 1 ELSE 0 END) as null_quality,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
      AVG(quality_score) as avg_quality
    FROM trajectory_metadata
  `).get() as { total: number; null_quality: number; completed_count: number; avg_quality: number };

  console.log('[AFTER]');
  console.log(`  Total trajectories: ${afterStats.total}`);
  console.log(`  NULL quality: ${afterStats.null_quality}`);
  console.log(`  Completed status: ${afterStats.completed_count}`);
  console.log(`  Average quality: ${afterStats.avg_quality?.toFixed(3) ?? 'N/A'}\n`);

  console.log('========================================');
  console.log('Backfill complete!');
  console.log('========================================');
  console.log(`\nNote: All trajectories now have quality=${DEFAULT_QUALITY}`);
  console.log('To convert to patterns, run: npx ts-node scripts/run-batch-conversion.ts');
  console.log('Or manually upgrade high-value trajectories to quality >= 0.8');

  db.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
