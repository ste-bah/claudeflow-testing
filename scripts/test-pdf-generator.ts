#!/usr/bin/env npx tsx
/**
 * Test script for APA 7th Edition PDF Generator
 *
 * Tests the new PDF generator with the research paper from:
 * docs/research/we-need-to-write-a-technical-white-paper-on-how-to/final/
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Import the PDF generator
import {
  generatePdf,
  configure,
  detectCapabilities,
  type GeneratePdfOptions,
} from '../src/pdf-generator/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const RESEARCH_DIR = join(
  PROJECT_ROOT,
  'docs/research/we-need-to-write-a-technical-white-paper-on-how-to/final'
);

async function extractPaperContent(markdownPath: string) {
  const content = await readFile(markdownPath, 'utf-8');
  const lines = content.split('\n');

  // Extract title (first H1)
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1] : 'Untitled Paper';

  // Extract executive summary as abstract (section 1.1)
  const execSummaryStart = content.indexOf('## 1.1 Executive Summary');
  const execSummaryEnd = content.indexOf('## 1.2');
  let abstract = '';
  if (execSummaryStart !== -1 && execSummaryEnd !== -1) {
    abstract = content
      .slice(execSummaryStart, execSummaryEnd)
      .replace(/^## 1\.1 Executive Summary\s*\n+/, '')
      .trim()
      .split('\n\n')
      .slice(0, 3) // First 3 paragraphs for abstract
      .join('\n\n');
  }

  // Extract all references
  const referenceMatches = content.matchAll(/## References\n([\s\S]*?)(?=\n---|\n# Chapter|\n## \d|\Z)/g);
  const allReferences: string[] = [];
  for (const match of referenceMatches) {
    const refs = match[1]
      .split('\n\n')
      .filter(r => r.trim().length > 0 && r.includes('('))
      .map(r => r.trim());
    allReferences.push(...refs);
  }

  // Deduplicate references
  const uniqueRefs = [...new Set(allReferences)];

  // Get main content (everything after TOC, excluding references)
  const tocEnd = content.indexOf('---\n\n# Chapter 1');
  const mainContent = tocEnd !== -1
    ? content.slice(tocEnd + 4)
    : content;

  return {
    title,
    abstract,
    content: mainContent,
    references: uniqueRefs,
  };
}

async function main() {
  console.log('🔍 APA 7th Edition PDF Generator Test\n');
  console.log('=' .repeat(60));

  // Check capabilities first
  console.log('\n📊 Detecting system capabilities...');
  const capabilities = await detectCapabilities();
  console.log(`   Pandoc available: ${capabilities.pandocAvailable}`);
  console.log(`   Pandoc version: ${capabilities.pandocVersion || 'N/A'}`);
  console.log(`   LaTeX available: ${capabilities.latexAvailable}`);
  console.log(`   PDFKit available: ${capabilities.pdfkitAvailable}`);
  console.log(`   Recommended generator: ${capabilities.recommendedGenerator}`);

  // Configure the generator
  configure({
    preferredGenerator: 'auto',
    debug: true,
    logLevel: 'info',
    cleanupTempFiles: false, // Keep temp files for inspection
  });

  // Read the source paper
  const paperPath = join(RESEARCH_DIR, 'final-paper.md');
  console.log(`\n📄 Reading source paper: ${paperPath}`);

  if (!existsSync(paperPath)) {
    console.error('❌ Source paper not found!');
    process.exit(1);
  }

  const extracted = await extractPaperContent(paperPath);
  console.log(`   Title: ${extracted.title.slice(0, 60)}...`);
  console.log(`   Abstract length: ${extracted.abstract.length} chars`);
  console.log(`   Content length: ${extracted.content.length} chars`);
  console.log(`   References: ${extracted.references.length} unique`);

  // Create output directory
  const outputDir = join(PROJECT_ROOT, 'output/pdf-test');
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Prepare PDF generation options
  const options: GeneratePdfOptions = {
    paper: {
      title: extracted.title,
      authors: [
        {
          name: 'Cloud Security Research Team',
          affiliationIds: ['1'],
        },
      ],
      affiliations: [
        {
          id: '1',
          name: 'Enterprise Cloud Security Division',
        },
      ],
      abstract: extracted.abstract,
      keywords: [
        'AWS',
        'cloud security',
        'Security Hub',
        'CSPM',
        'multi-account governance',
        'compliance',
        'threat detection',
      ],
      body: extracted.content,
      references: extracted.references,
    },
    runningHead: 'AWS SECURITY POSTURE MANAGEMENT',
    outputPath: join(outputDir, 'apa-formatted-paper.pdf'),
    generatorType: 'auto',
  };

  console.log(`\n🚀 Generating APA-formatted PDF...`);
  console.log(`   Output: ${options.outputPath}`);

  const startTime = Date.now();

  try {
    const result = await generatePdf(options);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '=' .repeat(60));
    if (result.success) {
      console.log('✅ PDF Generation Successful!');
      console.log(`   Output: ${result.outputPath}`);
      console.log(`   Generator used: ${result.generatorUsed}`);
      console.log(`   Duration: ${duration}s`);

      if (result.warnings.length > 0) {
        console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
        result.warnings.forEach(w => console.log(`   - ${w}`));
      }
    } else {
      console.log('❌ PDF Generation Failed!');
      console.log(`   Error: ${result.error}`);
      console.log(`   Generator attempted: ${result.generatorUsed}`);

      if (result.warnings.length > 0) {
        console.log(`\n⚠️  Warnings:`);
        result.warnings.forEach(w => console.log(`   - ${w}`));
      }
    }

    // Save result metadata
    const metadataPath = join(outputDir, 'generation-result.json');
    await writeFile(metadataPath, JSON.stringify({
      ...result,
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      source: paperPath,
    }, null, 2));
    console.log(`\n📝 Result metadata saved to: ${metadataPath}`);

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
