#!/usr/bin/env npx tsx
/**
 * Backfill Trajectory Quality Script
 *
 * Reads output files from PhD pipeline, calculates quality scores using
 * PhDQualityCalculator, and updates orphaned trajectories in SQLite.
 *
 * This replaces the previous simple 0.75 backfill with discriminating
 * quality scoring based on actual content analysis.
 *
 * Usage: npx tsx scripts/backfill-trajectory-quality.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import {
  createQualityContext,
  assessPhDQuality,
  type IQualityAssessment,
} from '../dist/god-agent/cli/phd-quality-calculator.js';

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_DIR = '/Users/stevenbahia/Documents/projects/claudeflow-testing/docs/research/creating-a-local-world-model-for-ai-agents-using-r';
const DB_PATH = '/Users/stevenbahia/Documents/projects/claudeflow-testing/.god-agent/learning.db';

// ============================================================================
// Trajectory Mappings (from Agent 1 analysis)
// ============================================================================

interface TrajectoryMapping {
  id: string;
  file: string;
  phase: number;
  agentKey: string;
}

const trajectoryMappings: TrajectoryMapping[] = [
  // Phase 1: Foundation & Planning (trajectories 1-5)
  { id: 'phd-8c1fe1f1-1-self-ask-decomposer', file: '01-self-ask-decomposer.md', phase: 1, agentKey: 'self-ask-decomposer' },
  { id: 'phd-8c1fe1f1-2-ambiguity-clarifier', file: '02-ambiguity-clarifier.md', phase: 1, agentKey: 'ambiguity-clarifier' },
  { id: 'phd-8c1fe1f1-3-research-planner', file: '03-research-planner.md', phase: 1, agentKey: 'research-planner' },
  { id: 'phd-8c1fe1f1-4-construct-definer', file: '04-construct-definer.md', phase: 1, agentKey: 'construct-definer' },
  { id: 'phd-8c1fe1f1-5-dissertation-architect', file: '05-dissertation-architect.md', phase: 1, agentKey: 'dissertation-architect' },

  // Phase 2: Literature Review (trajectories 6-11)
  { id: 'phd-8c1fe1f1-6-chapter-synthesizer', file: '06-chapter-synthesizer.md', phase: 2, agentKey: 'chapter-synthesizer' },
  { id: 'phd-8c1fe1f1-7-literature-mapper', file: '07-literature-mapper.md', phase: 2, agentKey: 'literature-mapper' },
  { id: 'phd-8c1fe1f1-8-source-tier-classifier', file: '08-source-tier-classifier.md', phase: 2, agentKey: 'source-tier-classifier' },
  { id: 'phd-8c1fe1f1-9-citation-extractor', file: '09-citation-extractor.md', phase: 2, agentKey: 'citation-extractor' },
  { id: 'phd-8c1fe1f1-10-context-tier-manager', file: '10-context-tier-manager.md', phase: 2, agentKey: 'context-tier-manager' },
  { id: 'phd-8c1fe1f1-11-theoretical-framework-analyst', file: '11-theoretical-framework-analyst.md', phase: 2, agentKey: 'theoretical-framework-analyst' },

  // Phase 3: Critical Analysis (trajectory 12)
  { id: 'phd-8c1fe1f1-12-contradiction-analyzer', file: '12-contradiction-analyzer.md', phase: 3, agentKey: 'contradiction-analyzer' },

  // Phase 6: Writing (trajectory 38)
  { id: 'phd-8c1fe1f1-38-abstract-writer', file: '34-abstract-writer.md', phase: 6, agentKey: 'abstract-writer' },

  // Phase 7: Validation & Quality (trajectories 41-47)
  { id: 'phd-8c1fe1f1-41-confidence-quantifier', file: '38-confidence-quantifier.md', phase: 7, agentKey: 'confidence-quantifier' },
  { id: 'phd-8c1fe1f1-42-citation-validator', file: '39-citation-validator.md', phase: 7, agentKey: 'citation-validator' },
  { id: 'phd-8c1fe1f1-43-reproducibility-checker', file: '40-reproducibility-checker.md', phase: 7, agentKey: 'reproducibility-checker' },
  { id: 'phd-8c1fe1f1-44-apa-citation-specialist', file: '41-apa-citation-specialist.md', phase: 7, agentKey: 'apa-citation-specialist' },
  { id: 'phd-8c1fe1f1-45-consistency-validator', file: '42-consistency-validator.md', phase: 7, agentKey: 'consistency-validator' },
  { id: 'phd-8c1fe1f1-46-quality-assessor', file: '43-quality-assessor.md', phase: 7, agentKey: 'quality-assessor' },
  { id: 'phd-8c1fe1f1-47-bias-detector', file: '44-bias-detector.md', phase: 7, agentKey: 'bias-detector' },
];

// ============================================================================
// Helper Functions
// ============================================================================

interface BackfillResult {
  trajectoryId: string;
  file: string;
  quality: number;
  tier: string;
  wordCount: number;
  updated: boolean;
  error?: string;
}

function countWords(text: string): number {
  const cleanText = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_~`]/g, '')
    .trim();
  return cleanText ? cleanText.split(/\s+/).filter(w => w.length > 0).length : 0;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : ' '.repeat(len - str.length) + str;
}

// ============================================================================
// Main Script
// ============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(80));
  console.log('PhD Trajectory Quality Backfill Script (Discriminating)');
  console.log('='.repeat(80));
  console.log(`Output Directory: ${OUTPUT_DIR}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Trajectories to process: ${trajectoryMappings.length}`);
  console.log('='.repeat(80));
  console.log('');

  // Validate paths
  if (!existsSync(OUTPUT_DIR)) {
    console.error(`ERROR: Output directory not found: ${OUTPUT_DIR}`);
    process.exit(1);
  }
  if (!existsSync(DB_PATH)) {
    console.error(`ERROR: Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  // Open database
  const db = new Database(DB_PATH);

  // Prepare statements
  const updateStmt = db.prepare(`
    UPDATE trajectory_metadata
    SET quality_score = ?, status = 'completed', completed_at = ?
    WHERE id = ?
  `);

  const checkStmt = db.prepare(
    'SELECT id, quality_score, status FROM trajectory_metadata WHERE id = ?'
  );

  const results: BackfillResult[] = [];
  const now = Date.now();

  console.log('Processing trajectories...\n');

  // Header
  const header = `${padRight('Trajectory ID', 50)} | ${padLeft('Quality', 7)} | ${padRight('Tier', 10)} | ${padLeft('Words', 6)} | Status`;
  console.log(header);
  console.log('-'.repeat(100));

  for (const mapping of trajectoryMappings) {
    const filePath = join(OUTPUT_DIR, mapping.file);
    const result: BackfillResult = {
      trajectoryId: mapping.id,
      file: mapping.file,
      quality: 0,
      tier: 'unknown',
      wordCount: 0,
      updated: false,
    };

    try {
      // Check if file exists
      if (!existsSync(filePath)) {
        result.error = 'File not found';
        results.push(result);
        const line = `${padRight(mapping.id.slice(0, 50), 50)} | ${padLeft('N/A', 7)} | ${padRight('N/A', 10)} | ${padLeft('N/A', 6)} | ERROR: ${result.error}`;
        console.log(line);
        continue;
      }

      // Read file content
      const content = readFileSync(filePath, 'utf-8');
      result.wordCount = countWords(content);

      // Calculate quality using PhDQualityCalculator
      const context = createQualityContext(mapping.agentKey, mapping.phase);
      const assessment: IQualityAssessment = assessPhDQuality(content, context);

      result.quality = assessment.score;
      result.tier = assessment.tier;

      // Check if trajectory exists in database
      const existing = checkStmt.get(mapping.id) as {
        id: string;
        quality_score: number | null;
        status: string;
      } | undefined;

      if (!existing) {
        result.error = 'Trajectory not found in database';
        results.push(result);
        const line = `${padRight(mapping.id.slice(0, 50), 50)} | ${padLeft(result.quality.toFixed(3), 7)} | ${padRight(result.tier, 10)} | ${padLeft(String(result.wordCount), 6)} | SKIP: ${result.error}`;
        console.log(line);
        continue;
      }

      if (existing.quality_score !== null) {
        result.error = `Already has quality: ${existing.quality_score.toFixed(3)}`;
        results.push(result);
        const line = `${padRight(mapping.id.slice(0, 50), 50)} | ${padLeft(result.quality.toFixed(3), 7)} | ${padRight(result.tier, 10)} | ${padLeft(String(result.wordCount), 6)} | SKIP: ${result.error}`;
        console.log(line);
        continue;
      }

      // Update database
      const updateResult = updateStmt.run(result.quality, now, mapping.id);
      result.updated = updateResult.changes > 0;

      results.push(result);
      const line = `${padRight(mapping.id.slice(0, 50), 50)} | ${padLeft(result.quality.toFixed(3), 7)} | ${padRight(result.tier, 10)} | ${padLeft(String(result.wordCount), 6)} | ${result.updated ? 'UPDATED' : 'NO CHANGE'}`;
      console.log(line);

    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      results.push(result);
      const line = `${padRight(mapping.id.slice(0, 50), 50)} | ${padLeft('ERR', 7)} | ${padRight('ERR', 10)} | ${padLeft('ERR', 6)} | ERROR: ${result.error}`;
      console.log(line);
    }
  }

  // Close database
  db.close();

  // Summary
  console.log('');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  const updated = results.filter(r => r.updated);
  const skipped = results.filter(r => !r.updated && !r.error);
  const errors = results.filter(r => r.error);

  console.log(`Total processed:  ${results.length}`);
  console.log(`Updated:          ${updated.length}`);
  console.log(`Skipped:          ${skipped.length}`);
  console.log(`Errors:           ${errors.length}`);
  console.log('');

  if (updated.length > 0) {
    const qualities = updated.map(r => r.quality);
    const minQ = Math.min(...qualities);
    const maxQ = Math.max(...qualities);
    const avgQ = qualities.reduce((a, b) => a + b, 0) / qualities.length;

    console.log('Quality Score Statistics:');
    console.log(`  Min:     ${minQ.toFixed(3)}`);
    console.log(`  Max:     ${maxQ.toFixed(3)}`);
    console.log(`  Average: ${avgQ.toFixed(3)}`);
    console.log(`  Range:   ${(maxQ - minQ).toFixed(3)}`);
    console.log('');

    // Tier distribution
    const tierCounts: Record<string, number> = {};
    for (const r of updated) {
      tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1;
    }
    console.log('Tier Distribution:');
    for (const [tier, count] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${tier}: ${count} (${((count / updated.length) * 100).toFixed(1)}%)`);
    }
  }

  if (errors.length > 0) {
    console.log('');
    console.log('Errors:');
    for (const r of errors) {
      console.log(`  ${r.trajectoryId}: ${r.error}`);
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('Backfill complete.');
  console.log('='.repeat(80));
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
