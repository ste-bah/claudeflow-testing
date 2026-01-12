#!/usr/bin/env npx ts-node
/**
 * Batch Trajectory-to-Pattern Conversion Script
 *
 * Runs the two-step process:
 * 1. Sync quality scores from events.db to trajectory_metadata
 * 2. Convert high-quality trajectories (>= 0.8) to patterns
 */

import { createProductionSonaEngine } from '../dist/god-agent/core/learning/sona-engine.js';

async function main() {
  console.log('========================================');
  console.log('Batch Trajectory-to-Pattern Conversion');
  console.log('========================================\n');

  // Initialize SonaEngine with persistence enabled
  const sonaEngine = createProductionSonaEngine();

  // Wait for initialization
  console.log('[1/4] Initializing SonaEngine...');
  await sonaEngine.initialize();

  // Get baseline stats
  const statsBefore = sonaEngine.getStats();
  console.log(`[INFO] Baseline: ${statsBefore.trajectoryCount} trajectories, ${statsBefore.totalPatterns} patterns\n`);

  // Step 1: Sync quality scores from events.db
  console.log('[2/4] Syncing quality scores from events.db...');
  const syncResult = await sonaEngine.syncQualityFromEvents();
  console.log(`[RESULT] Synced ${syncResult.synced} quality scores`);
  if (syncResult.errors.length > 0) {
    console.log(`[WARN] Sync errors: ${syncResult.errors.length}`);
    syncResult.errors.forEach(e => console.log(`  - ${e}`));
  }
  console.log();

  // Step 2: Preview conversion (dry run first)
  console.log('[3/4] Running dry-run preview...');
  const previewResult = await sonaEngine.convertHighQualityTrajectoriesToPatterns({
    dryRun: true
  });
  console.log(`[PREVIEW] Total: ${previewResult.totalTrajectories}, Eligible: ${previewResult.eligibleTrajectories}`);
  console.log();

  // Step 3: Execute actual conversion
  console.log('[4/4] Converting high-quality trajectories to patterns...');
  const convertResult = await sonaEngine.convertHighQualityTrajectoriesToPatterns({
    dryRun: false
  });
  console.log(`[RESULT] Created ${convertResult.patternsCreated} patterns from ${convertResult.eligibleTrajectories} eligible trajectories`);
  if (convertResult.errors.length > 0) {
    console.log(`[WARN] Conversion errors: ${convertResult.errors.length}`);
    convertResult.errors.forEach(e => console.log(`  - ${e}`));
  }
  console.log();

  // Final stats
  const statsAfter = sonaEngine.getStats();
  console.log('========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log(`Quality scores synced: ${syncResult.synced}`);
  console.log(`Patterns before: ${statsBefore.totalPatterns}`);
  console.log(`Patterns after: ${statsAfter.totalPatterns}`);
  console.log(`New patterns created: ${statsAfter.totalPatterns - statsBefore.totalPatterns}`);
  console.log('========================================');

  // Done - let process exit naturally
  console.log('\nDone!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
