#!/usr/bin/env npx tsx
/**
 * Quick script to regenerate the final paper PDF using Pandoc+LaTeX
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { generatePdf } from '../src/pdf-generator/index.js';
import { detectCapabilities, getRecommendedGeneratorType } from '../src/pdf-generator/factory.js';

const FINAL_PAPER_DIR = 'docs/research/we-need-to-write-a-technical-white-paper-on-how-to/final';

async function main() {
  console.log('=== PDF Regeneration with Pandoc+LaTeX ===\n');

  // 1. Check capabilities
  console.log('Checking PDF generator capabilities...');
  const caps = await detectCapabilities();
  console.log('  pandocLatex:', caps.pandocLatex);
  console.log('  pandocHtml:', caps.pandocHtml);
  console.log('  pdfkit:', caps.pdfkit);

  const recommended = await getRecommendedGeneratorType();
  console.log('  Recommended generator:', recommended);

  if (!caps.pandocLatex) {
    console.error('\n❌ ERROR: pandoc-latex not available. Cannot proceed.');
    process.exit(1);
  }

  console.log('\n✓ Using pandoc-latex for high-quality PDF generation\n');

  // 2. Read the final paper markdown
  const markdownPath = join(process.cwd(), FINAL_PAPER_DIR, 'final-paper.md');
  console.log('Reading markdown from:', markdownPath);

  const markdown = await readFile(markdownPath, 'utf-8');
  console.log('  Markdown length:', markdown.length, 'characters');

  // 3. Read metadata
  const metadataPath = join(process.cwd(), FINAL_PAPER_DIR, 'metadata.json');
  const metadataJson = await readFile(metadataPath, 'utf-8');
  const metadata = JSON.parse(metadataJson);

  console.log('  Total words:', metadata.document.totalWords);
  console.log('  Total citations:', metadata.document.totalCitations);
  console.log('  Chapters:', metadata.document.chapters.length);

  // 4. Generate PDF
  const outputPath = join(process.cwd(), FINAL_PAPER_DIR, 'final-paper.pdf');
  console.log('\nGenerating PDF to:', outputPath);
  console.log('This may take a minute for LaTeX processing...\n');

  const startTime = Date.now();

  const result = await generatePdf({
    paper: {
      title: 'AWS Security Architecture Technical White Paper',
      authors: [
        {
          name: 'Research Team',
          affiliationIds: [1],
        },
      ],
      affiliations: [
        {
          id: 1,
          name: 'Claude Flow Research',
        },
      ],
      body: markdown,
      keywords: ['AWS', 'security', 'cloud architecture', 'Security Hub', 'container security'],
    },
    outputPath,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (result.success) {
    console.log(`✓ PDF generated successfully in ${elapsed}s`);
    console.log('  Output:', result.outputPath);
    console.log('  Generator used:', result.generatorType);

    // Get file size
    const { stat } = await import('fs/promises');
    const stats = await stat(result.outputPath!);
    console.log('  File size:', (stats.size / 1024).toFixed(1), 'KB');
  } else {
    console.error('❌ PDF generation failed:', result.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
