#!/usr/bin/env node
/**
 * Claude-Flow Memory CLI Patch
 *
 * Patches the claude-flow CLI to support BOTH argument styles:
 *
 * Style 1 (positional - original):
 *   npx claude-flow@alpha memory store <key> <value> -n <namespace>
 *   npx claude-flow@alpha memory query <search> -n <namespace>
 *
 * Style 2 (flags - what PhD pipeline uses):
 *   npx claude-flow@alpha memory store --key <key> --value <value> --namespace <namespace>
 *   npx claude-flow@alpha memory query --key <key> --namespace <namespace>
 *
 * Run: node patches/patch-claude-flow-memory.js
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PATCH_MARKER = '// PATCHED: Support both positional and flag arguments';

async function findClaudeFlowPath() {
  try {
    // Get global npm root
    const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const claudeFlowPath = path.join(npmRoot, 'claude-flow');

    // Check if it exists
    await fs.access(claudeFlowPath);
    return claudeFlowPath;
  } catch (e) {
    // Try local node_modules
    const localPath = path.join(process.cwd(), 'node_modules', 'claude-flow');
    try {
      await fs.access(localPath);
      return localPath;
    } catch {
      throw new Error('claude-flow not found in global or local node_modules');
    }
  }
}

async function patchMemoryCommand(claudeFlowPath) {
  const memoryJsPath = path.join(claudeFlowPath, 'src', 'cli', 'simple-commands', 'memory.js');

  console.log(`📍 Patching: ${memoryJsPath}`);

  let content = await fs.readFile(memoryJsPath, 'utf8');

  // Check if already patched
  if (content.includes(PATCH_MARKER)) {
    console.log('✅ Already patched!');
    return false;
  }

  // Find the storeMemory function and patch it to support both styles
  const storeMemoryPatch = `
${PATCH_MARKER}
async function storeMemory(subArgs, loadMemory, saveMemory, namespace, enableRedaction = false) {
    // Support BOTH positional and flag arguments
    let key, value;

    // Check for flag-style arguments (--key, --value, -k, -v)
    const keyFlagIdx = subArgs.findIndex(a => a === '--key' || a === '-k');
    const valueFlagIdx = subArgs.findIndex(a => a === '--value' || a === '-v');
    const contentFlagIdx = subArgs.findIndex(a => a === '--content');

    if (keyFlagIdx !== -1 && keyFlagIdx + 1 < subArgs.length) {
        // Flag style: --key <key> --value <value>
        key = subArgs[keyFlagIdx + 1];
        if (valueFlagIdx !== -1 && valueFlagIdx + 1 < subArgs.length) {
            value = subArgs[valueFlagIdx + 1];
        } else if (contentFlagIdx !== -1 && contentFlagIdx + 1 < subArgs.length) {
            value = subArgs[contentFlagIdx + 1];
        } else {
            // Try to get value from remaining positional args
            const usedIndices = new Set([keyFlagIdx, keyFlagIdx + 1]);
            if (valueFlagIdx !== -1) usedIndices.add(valueFlagIdx);
            if (contentFlagIdx !== -1) usedIndices.add(contentFlagIdx);
            const remaining = subArgs.filter((_, i) => !usedIndices.has(i) && !subArgs[i].startsWith('-'));
            value = remaining.join(' ');
        }
    } else {
        // Positional style: store <key> <value>
        key = subArgs[1];
        value = subArgs.slice(2).filter(a => !a.startsWith('-')).join(' ');
    }

    // Ensure namespace defaults to 'default' not undefined
    namespace = namespace || 'default';
`;

  // Find and replace the storeMemory function
  const storeMemoryRegex = /async function storeMemory\(subArgs, loadMemory, saveMemory, namespace, enableRedaction = false\) \{[\s\S]*?const key = subArgs\[1\];[\s\S]*?let value = subArgs\.slice\(2\)\.join\(' '\);/;

  if (storeMemoryRegex.test(content)) {
    content = content.replace(storeMemoryRegex, storeMemoryPatch);
    console.log('✅ Patched storeMemory function');
  } else {
    console.log('⚠️  Could not find storeMemory pattern to patch');
  }

  // Patch queryMemory similarly
  const queryMemoryPatch = `
${PATCH_MARKER}
async function queryMemory(subArgs, loadMemory, namespace, enableRedaction = false) {
    // Support BOTH positional and flag arguments
    let search;

    // Check for flag-style arguments (--key, -k)
    const keyFlagIdx = subArgs.findIndex(a => a === '--key' || a === '-k');

    if (keyFlagIdx !== -1 && keyFlagIdx + 1 < subArgs.length) {
        // Flag style: --key <search>
        search = subArgs[keyFlagIdx + 1];
    } else {
        // Positional style: query <search>
        search = subArgs.slice(1).filter(a => !a.startsWith('-')).join(' ');
    }

    // Ensure namespace defaults to 'default' not undefined
    namespace = namespace || 'default';
`;

  const queryMemoryRegex = /async function queryMemory\(subArgs, loadMemory, namespace, enableRedaction = false\) \{[\s\S]*?const search = subArgs\.slice\(1\)\.join\(' '\);/;

  if (queryMemoryRegex.test(content)) {
    content = content.replace(queryMemoryRegex, queryMemoryPatch);
    console.log('✅ Patched queryMemory function');
  } else {
    console.log('⚠️  Could not find queryMemory pattern to patch');
  }

  // Patch getNamespaceFromArgs to also check for -n short form
  const namespacePatch = `
function getNamespaceFromArgs(subArgs) {
    // Check all namespace flag variants
    const flags = ['--namespace', '--ns', '-n'];
    for (const flag of flags) {
        const idx = subArgs.indexOf(flag);
        if (idx !== -1 && idx + 1 < subArgs.length) {
            return subArgs[idx + 1];
        }
    }
    return 'default'; // Always return 'default', never null/undefined
}`;

  const namespaceRegex = /function getNamespaceFromArgs\(subArgs\) \{[\s\S]*?return null;\s*\}/;

  if (namespaceRegex.test(content)) {
    content = content.replace(namespaceRegex, namespacePatch);
    console.log('✅ Patched getNamespaceFromArgs function');
  } else {
    console.log('⚠️  Could not find getNamespaceFromArgs pattern to patch');
  }

  // Write patched content
  await fs.writeFile(memoryJsPath, content, 'utf8');

  return true;
}

async function patchDistMemory(claudeFlowPath) {
  const distMemoryJsPath = path.join(claudeFlowPath, 'dist', 'src', 'cli', 'simple-commands', 'memory.js');

  console.log(`📍 Patching dist: ${distMemoryJsPath}`);

  let content;
  try {
    content = await fs.readFile(distMemoryJsPath, 'utf8');
  } catch {
    console.log('⚠️  dist/memory.js not found, skipping');
    return false;
  }

  // Check if already patched
  if (content.includes(PATCH_MARKER)) {
    console.log('✅ dist already patched!');
    return false;
  }

  // For dist, we need to patch the compiled JS
  // The key issue is namespace being undefined - let's fix that first

  // Fix namespace defaulting in storeMemory
  content = content.replace(
    /const key = subArgs\[1\];\s*let value = subArgs\.slice\(2\)\.join\(' '\);/g,
    `// ${PATCH_MARKER}
    // Support both positional and flag arguments
    let key, value;
    const keyFlagIdx = subArgs.findIndex(a => a === '--key' || a === '-k');
    const valueFlagIdx = subArgs.findIndex(a => a === '--value' || a === '-v');
    const contentFlagIdx = subArgs.findIndex(a => a === '--content');

    if (keyFlagIdx !== -1 && keyFlagIdx + 1 < subArgs.length) {
        key = subArgs[keyFlagIdx + 1];
        if (valueFlagIdx !== -1 && valueFlagIdx + 1 < subArgs.length) {
            value = subArgs[valueFlagIdx + 1];
        } else if (contentFlagIdx !== -1 && contentFlagIdx + 1 < subArgs.length) {
            value = subArgs[contentFlagIdx + 1];
        } else {
            value = subArgs.filter((a, i) => i > 0 && !a.startsWith('-') && i !== keyFlagIdx + 1).join(' ');
        }
    } else {
        key = subArgs[1];
        value = subArgs.slice(2).filter(a => !a.startsWith('-')).join(' ');
    }
    namespace = namespace || 'default';`
  );

  // Fix namespace defaulting in queryMemory
  content = content.replace(
    /const search = subArgs\.slice\(1\)\.join\(' '\);/g,
    `// ${PATCH_MARKER}
    let search;
    const keyFlagIdx = subArgs.findIndex(a => a === '--key' || a === '-k');
    if (keyFlagIdx !== -1 && keyFlagIdx + 1 < subArgs.length) {
        search = subArgs[keyFlagIdx + 1];
    } else {
        search = subArgs.slice(1).filter(a => !a.startsWith('-')).join(' ');
    }
    namespace = namespace || 'default';`
  );

  // Fix getNamespaceFromArgs to return 'default' instead of null
  content = content.replace(
    /return null;\s*\}\s*async function loadMemory/g,
    `return 'default';
}
async function loadMemory`
  );

  await fs.writeFile(distMemoryJsPath, content, 'utf8');
  console.log('✅ Patched dist/memory.js');

  return true;
}

async function main() {
  console.log('🔧 Claude-Flow Memory CLI Patch');
  console.log('================================\n');

  try {
    const claudeFlowPath = await findClaudeFlowPath();
    console.log(`📦 Found claude-flow at: ${claudeFlowPath}\n`);

    // Patch both src and dist
    const srcPatched = await patchMemoryCommand(claudeFlowPath);
    const distPatched = await patchDistMemory(claudeFlowPath);

    if (srcPatched || distPatched) {
      console.log('\n✅ Patch complete! Both argument styles now supported:');
      console.log('');
      console.log('  Style 1 (positional):');
      console.log('    npx claude-flow@alpha memory store "mykey" "myvalue" -n default');
      console.log('    npx claude-flow@alpha memory query "search" -n default');
      console.log('');
      console.log('  Style 2 (flags):');
      console.log('    npx claude-flow@alpha memory store --key "mykey" --value "myvalue" --namespace default');
      console.log('    npx claude-flow@alpha memory query --key "search" --namespace default');
    } else {
      console.log('\n✅ Already patched, no changes needed.');
    }

  } catch (error) {
    console.error('❌ Patch failed:', error.message);
    process.exit(1);
  }
}

main();
