import { StyleAnalyzer } from '../src/god-agent/universal/style-analyzer.js';
import { StyleProfileManager } from '../src/god-agent/universal/style-profile.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function learnStyle() {
  const profileName = process.argv[2] || 'academic';
  const styleDir = process.argv[3] || 'style/';

  // Find PDFs
  const pdfFiles = fs.readdirSync(styleDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => path.join(styleDir, f));

  console.log(`Found ${pdfFiles.length} PDF(s) in ${styleDir}`);

  // Extract text from each PDF
  const textSamples: string[] = [];
  for (const pdf of pdfFiles) {
    console.log(`Extracting: ${path.basename(pdf)}`);
    try {
      const text = execSync(`pdftotext "${pdf}" -`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      if (text.length > 500) {
        textSamples.push(text);
        console.log(`  -> ${text.length} characters extracted`);
      }
    } catch (e: unknown) {
      const error = e as Error;
      console.log(`  -> Failed: ${error.message}`);
    }
  }

  if (textSamples.length === 0) {
    console.log('No valid text extracted from PDFs');
    return;
  }

  // Create profile manager
  const manager = new StyleProfileManager();

  // Create the profile
  console.log('\nAnalyzing style characteristics...');
  const profile = await manager.createProfile(profileName, textSamples, {
    description: `Academic writing style learned from ${pdfFiles.length} PDF(s)`,
    sourceType: 'pdf',
    tags: ['academic', 'thesis', 'formal']
  });

  // Set as active
  await manager.setActiveProfile(profile.metadata.id);

  // Output results
  console.log('\n=== Style Profile Created ===');
  console.log(`ID: ${profile.metadata.id}`);
  console.log(`Name: ${profile.metadata.name}`);
  console.log(`Sources: ${profile.metadata.sourceCount}`);
  console.log(`Active: YES`);

  console.log('\n=== Style Characteristics ===');
  const chars = profile.characteristics;

  console.log('\nSentence Structure:');
  console.log(`  Average length: ${chars.sentences.averageLength.toFixed(1)} words`);
  console.log(`  Short sentences: ${(chars.sentences.shortSentenceRatio * 100).toFixed(1)}%`);
  console.log(`  Medium sentences: ${(chars.sentences.mediumSentenceRatio * 100).toFixed(1)}%`);
  console.log(`  Long sentences: ${(chars.sentences.longSentenceRatio * 100).toFixed(1)}%`);
  console.log(`  Complex sentences: ${(chars.sentences.complexSentenceRatio * 100).toFixed(1)}%`);

  console.log('\nVocabulary:');
  console.log(`  Academic word ratio: ${(chars.vocabulary.academicWordRatio * 100).toFixed(2)}%`);
  console.log(`  Unique word ratio: ${(chars.vocabulary.uniqueWordRatio * 100).toFixed(1)}%`);
  console.log(`  Avg word length: ${chars.vocabulary.averageWordLength.toFixed(1)} chars`);
  console.log(`  Contractions: ${(chars.vocabulary.contractionUsage * 100).toFixed(2)}%`);

  console.log('\nTone:');
  console.log(`  Formality: ${(chars.tone.formalityScore * 100).toFixed(1)}%`);
  console.log(`  Objectivity: ${(chars.tone.objectivityScore * 100).toFixed(1)}%`);
  console.log(`  Hedging frequency: ${(chars.tone.hedgingFrequency * 100).toFixed(2)}%`);
  console.log(`  Assertiveness: ${(chars.tone.assertivenessScore * 100).toFixed(1)}%`);

  console.log('\nStructure:');
  console.log(`  Passive voice: ${(chars.structure.passiveVoiceRatio * 100).toFixed(1)}%`);
  console.log(`  First person: ${(chars.structure.firstPersonUsage * 100).toFixed(2)}%`);
  console.log(`  Question freq: ${(chars.structure.questionFrequency * 100).toFixed(2)}%`);

  console.log(`\nCitation style: ${chars.citationStyle}`);

  if (chars.commonTransitions.length > 0) {
    console.log(`\nCommon transitions: ${chars.commonTransitions.slice(0, 8).join(', ')}`);
  }

  if (chars.samplePhrases.length > 0) {
    console.log('\nCharacteristic phrases:');
    chars.samplePhrases.slice(0, 5).forEach(p => console.log(`  - "${p}"`));
  }

  console.log('\n✓ Profile saved and set as ACTIVE');
  console.log('  Use /god-write to generate content with this style');
}

learnStyle().catch(console.error);
