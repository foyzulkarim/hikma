#!/usr/bin/env tsx

/**
 * Schema Migration Script
 * Automatically updates code to use new schema field names and structures
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Field mappings from old to new names
const FIELD_MAPPINGS: Record<string, string> = {
  // Prisma model names
  'DocumentChunk': 'CodeChunk',
  'ChunkMetadata': 'CodeChunkMetadata',
  'documentChunk': 'codeChunk',
  
  // Field name mappings
  'documentId': 'fileId',
  'chunkIndex': 'chunk_id',
  'totalChunks': 'line_count',
  'path': 'file_path',
  'documentType': 'node_type',
  'sourceType': 'node_type',
  'sourceId': 'chunk_id',
  'createdAt': 'indexed_at',
  'updatedAt': 'file_modified_at',
  'content': 'codeContent',
};

// Property access patterns to update
const PROPERTY_PATTERNS = [
  // Vector metadata property access
  { from: /result\.metadata\.title/g, to: 'result.payload?.node_name || result.metadata?.title' },
  { from: /result\.metadata\.content/g, to: 'result.payload?.docstring_summary || result.metadata?.content' },
  { from: /result\.metadata\.path/g, to: 'result.payload?.file_path || result.metadata?.path' },
  { from: /result\.metadata\.documentType/g, to: 'result.payload?.node_type || result.metadata?.documentType' },
  { from: /result\.metadata\.sourceType/g, to: 'result.payload?.node_type' },
  { from: /result\.metadata\.sourceId/g, to: 'result.payload?.chunk_id' },
  { from: /result\.metadata\.chunkIndex/g, to: 'result.payload?.chunk_id' },
  
  // Filter property mappings
  { from: /filter\.projectId/g, to: 'filter.repository_id' },
  { from: /filter\.documentType/g, to: 'filter.node_type' },
  { from: /filter\.path/g, to: 'filter.file_path' },
  
  // Prisma client property access
  { from: /prisma\.documentChunk/g, to: 'prisma.codeChunk' },
  { from: /client\.documentChunk/g, to: 'client.codeChunk' },
];

// File patterns to process
const FILE_PATTERNS = [
  'src/**/*.ts',
  '!src/**/*.test.ts',
  '!src/**/*.spec.ts',
  '!node_modules/**',
  '!dist/**',
];

// Files to exclude from automatic migration (need manual review)
const EXCLUDED_FILES = [
  'src/core/types/embeddings.ts', // Already updated
  'src/core/types/graph.ts',     // Already updated
  'src/core/types/index.ts',     // Already updated
  'src/agents/tools/vector-search-tool.ts', // Already updated
  'scripts/migrate-schema-usage.ts', // This file
];

function shouldSkipFile(filePath: string): boolean {
  return EXCLUDED_FILES.some(excluded => filePath.includes(excluded));
}

function migrateFileContent(content: string, filePath: string): { content: string; hasChanges: boolean } {
  let updated = content;
  let hasChanges = false;

  // Apply property pattern replacements
  for (const pattern of PROPERTY_PATTERNS) {
    if (pattern.from.test(updated)) {
      updated = updated.replace(pattern.from, pattern.to);
      hasChanges = true;
      console.log(`  ✓ Applied pattern: ${pattern.from.toString()} -> ${pattern.to}`);
    }
  }

  // Apply simple field mappings in import statements
  for (const [oldField, newField] of Object.entries(FIELD_MAPPINGS)) {
    const importPattern = new RegExp(`import.*${oldField}.*from`, 'g');
    if (importPattern.test(updated)) {
      updated = updated.replace(new RegExp(`\\b${oldField}\\b`, 'g'), newField);
      hasChanges = true;
      console.log(`  ✓ Updated import: ${oldField} -> ${newField}`);
    }
  }

  // Fix specific Prisma usage patterns
  if (updated.includes('documentChunk')) {
    updated = updated.replace(/\.documentChunk\./g, '.codeChunk.');
    updated = updated.replace(/\.documentChunk\(/g, '.codeChunk(');
    hasChanges = true;
    console.log('  ✓ Updated Prisma documentChunk -> codeChunk');
  }

  // Fix VectorRecord structure usage
  if (updated.includes('values: number[]') && updated.includes('metadata: VectorMetadata')) {
    const vectorRecordPattern = /{\s*id:\s*string[;,]\s*values:\s*number\[\][;,]\s*metadata:\s*VectorMetadata[;,]?\s*}/g;
    if (vectorRecordPattern.test(updated)) {
      updated = updated.replace(
        vectorRecordPattern,
        '{ id: string; vectors: { code?: number[]; documentation?: number[]; }; payload: QdrantPayload; }'
      );
      hasChanges = true;
      console.log('  ✓ Updated VectorRecord structure');
    }
  }

  return { content: updated, hasChanges };
}

async function migrateFile(filePath: string): Promise<boolean> {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { content: updatedContent, hasChanges } = migrateFileContent(content, filePath);
    
    if (hasChanges) {
      // Create backup
      const backupPath = `${filePath}.backup`;
      fs.writeFileSync(backupPath, content);
      
      // Write updated content
      fs.writeFileSync(filePath, updatedContent);
      
      console.log(`✅ Migrated: ${filePath}`);
      console.log(`   Backup created: ${backupPath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error migrating ${filePath}:`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function main() {
  console.log('🚀 Starting schema migration...\n');

  // Find all TypeScript files
  const allFiles: string[] = [];
  for (const pattern of FILE_PATTERNS) {
    const files = await glob(pattern);
    allFiles.push(...files);
  }

  // Remove duplicates and excluded files
  const filesToProcess = [...new Set(allFiles)].filter(file => !shouldSkipFile(file));

  console.log(`Found ${filesToProcess.length} files to process:\n`);

  let migratedCount = 0;
  let errorCount = 0;

  for (const file of filesToProcess) {
    console.log(`Processing: ${file}`);
    
    const success = await migrateFile(file);
    if (success) {
      migratedCount++;
    } else {
      // Don't count unchanged files as errors
      if (fs.existsSync(file)) {
        console.log(`  No changes needed`);
      } else {
        errorCount++;
      }
    }
    
    console.log(''); // Empty line for readability
  }

  console.log('\n📊 Migration Summary:');
  console.log(`  Total files processed: ${filesToProcess.length}`);
  console.log(`  Files migrated: ${migratedCount}`);
  console.log(`  Files with errors: ${errorCount}`);
  console.log(`  Files unchanged: ${filesToProcess.length - migratedCount - errorCount}`);

  if (migratedCount > 0) {
    console.log('\n⚠️  Important Notes:');
    console.log('  1. Backup files (.backup) have been created for all modified files');
    console.log('  2. Please review the changes and test thoroughly');
    console.log('  3. Run `npm run typecheck` to verify TypeScript compilation');
    console.log('  4. Some files may still need manual adjustments');
    console.log('  5. Remove backup files after verification: find . -name "*.backup" -delete');
  }

  console.log('\n✨ Migration completed!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}