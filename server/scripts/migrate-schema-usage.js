#!/usr/bin/env node

/**
 * Schema Migration Script
 * Automatically updates code to use new schema field names and structures
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Field mappings from old to new names
const FIELD_MAPPINGS = {
  // Prisma model names
  'DocumentChunk': 'CodeChunk',
  'ChunkMetadata': 'CodeChunkMetadata',
  'documentChunk': 'codeChunk',
  
  // Field name mappings
  'documentId': 'fileId',
  'projectId': 'repositoryId', // In some contexts
  'chunkIndex': 'chunk_id',
  'totalChunks': 'line_count',
  'path': 'file_path',
  'documentType': 'node_type',
  'sourceType': 'node_type',
  'sourceId': 'chunk_id',
  'createdAt': 'indexed_at',
  'updatedAt': 'file_modified_at',
  'content': 'codeContent',
  'isStatic': 'isStatic',
  'isAsync': 'isAsync',
  'hasDocstring': 'hasDocstring',
  'hasErrorHandling': 'hasErrorHandling',
  'hasTests': 'hasTests',
  'isExported': 'isExported',
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
  'scripts/migrate-schema-usage.js', // This file
];

function shouldSkipFile(filePath) {
  return EXCLUDED_FILES.some(excluded => filePath.includes(excluded));
}

function migrateFileContent(content, filePath) {
  let updated = content;
  let hasChanges = false;

  // Apply property pattern replacements
  for (const pattern of PROPERTY_PATTERNS) {
    if (pattern.from.test(updated)) {
      updated = updated.replace(pattern.from, pattern.to);
      hasChanges = true;
      console.log(`  ✓ Applied pattern: ${pattern.from} -> ${pattern.to}`);
    }
  }

  // Apply simple field mappings
  for (const [oldField, newField] of Object.entries(FIELD_MAPPINGS)) {
    const oldPattern = new RegExp(`\\b${oldField}\\b`, 'g');
    if (oldPattern.test(updated)) {
      // Be careful about replacements - only replace in appropriate contexts
      const contextualReplacements = [
        // Import statements
        { from: new RegExp(`import.*${oldField}`, 'g'), to: (match) => match.replace(oldField, newField) },
        // Type annotations
        { from: new RegExp(`: ${oldField}`, 'g'), to: `: ${newField}` },
        { from: new RegExp(`<${oldField}>`, 'g'), to: `<${newField}>` },
        // Object properties in safe contexts
        { from: new RegExp(`${oldField}:`, 'g'), to: `${newField}:` },
      ];

      for (const replacement of contextualReplacements) {
        if (replacement.from.test(updated)) {
          if (typeof replacement.to === 'function') {
            updated = updated.replace(replacement.from, replacement.to);
          } else {
            updated = updated.replace(replacement.from, replacement.to);
          }
          hasChanges = true;
        }
      }
    }
  }

  // Special case: Update VectorRecord structure usage
  if (updated.includes('values: number[]') && updated.includes('metadata: VectorMetadata')) {
    updated = updated.replace(
      /{\s*id:\s*string;\s*values:\s*number\[\];\s*metadata:\s*VectorMetadata;\s*}/g,
      '{ id: string; vectors: { code?: number[]; documentation?: number[]; }; payload: QdrantPayload; }'
    );
    hasChanges = true;
    console.log('  ✓ Updated VectorRecord structure');
  }

  return { content: updated, hasChanges };
}

async function migrateFile(filePath) {
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
    console.error(`❌ Error migrating ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting schema migration...\n');

  // Find all TypeScript files
  const allFiles = [];
  for (const pattern of FILE_PATTERNS) {
    const files = glob.sync(pattern);
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
      errorCount++;
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

if (require.main === module) {
  main().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { migrateFileContent, FIELD_MAPPINGS, PROPERTY_PATTERNS };