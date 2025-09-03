/**
 * AST Processing Test Script - Direct testing of AST parsing functionality
 * 
 * This script tests the AST processing components in isolation
 * without requiring a full project sync or database setup.
 * 
 * Usage:
 *   npx tsx tests/debug/test-ast.ts                              # Test with sample TypeScript code
 *   npx tsx tests/debug/test-ast.ts /path/to/code/file.ts        # Test with specific file
 *   npx tsx tests/debug/test-ast.ts /path/to/project/directory   # Test with directory
 */

import { astParserService } from '../../src/knowledge/services/ast-parser.service';
import { ASTProcessingHandler } from '../../src/knowledge/handlers/ast-processing.handler';
import { logger } from '../../src/core/utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

// Sample TypeScript code for testing
const SAMPLE_TYPESCRIPT_CODE = `
import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  private users: User[] = [];

  constructor(private apiUrl: string) {}

  async fetchUsers(): Promise<User[]> {
    try {
      const response = await fetch(this.apiUrl + '/users');
      const users = await response.json();
      this.users = users;
      return users;
    } catch (error) {
      console.error('Failed to fetch users:', error);
      throw error;
    }
  }

  getUserById(id: string): User | undefined {
    return this.users.find(user => user.id === id);
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email);
  }
}

export const UserComponent: React.FC<{ userId: string }> = ({ userId }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userService = new UserService('/api/v1');
    
    userService.fetchUsers()
      .then(() => {
        const foundUser = userService.getUserById(userId);
        setUser(foundUser || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h2>{user.name}</h2>
      <p>Email: {user.email}</p>
    </div>
  );
};
`;

async function testASTParser() {
  console.log('🔬 Testing AST Parser Service...');
  
  try {
    // Test with sample TypeScript code
    console.log('📝 Parsing sample TypeScript code...');
    const parseResult = await astParserService.parseCode(SAMPLE_TYPESCRIPT_CODE, 'typescript');
    
    console.log(`✅ Parse completed! Found ${parseResult.chunks.length} chunks`);
    
    if (parseResult.errors.length > 0) {
      console.log('⚠️  Parse errors:');
      parseResult.errors.forEach(error => console.log(`   - ${error}`));
    }

    console.log('🧩 Parsed chunks:');
    parseResult.chunks.forEach((chunk, index) => {
      console.log(`  ${index + 1}. ${chunk.type.toUpperCase()}: ${chunk.name || 'unnamed'}`);
      console.log(`     Lines: ${chunk.startLine}-${chunk.endLine}`);
      console.log(`     Language: ${chunk.language}`);
      console.log(`     Content preview: ${chunk.content.substring(0, 100).replace(/\\n/g, ' ')}...`);
      
      if (chunk.metadata.parameters && chunk.metadata.parameters.length > 0) {
        console.log(`     Parameters: [${chunk.metadata.parameters.join(', ')}]`);
      }
      
      if (chunk.metadata.complexity) {
        console.log(`     Complexity: ${chunk.metadata.complexity}`);
      }
      
      console.log('');
    });

    return parseResult;
    
  } catch (error) {
    console.error('❌ AST parsing failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

async function testASTProcessingHandler() {
  console.log('🔧 Testing AST Processing Handler...');
  
  try {
    const astHandler = new ASTProcessingHandler();
    
    // Test AST processing event
    const testEvent = {
      projectId: 'test-ast-project',
      filePath: 'test/sample.ts',
      content: SAMPLE_TYPESCRIPT_CODE,
      language: 'typescript',
      sourceId: 'test-ast-source',
      sourceType: 'manual' as const
    };

    console.log('📤 Processing AST event...');
    const result = await astHandler.handleASTProcessing(testEvent);
    
    console.log('✅ AST processing completed!');
    console.log(`📊 Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`📚 Chunks processed: ${result.chunksProcessed}`);
    console.log(`🌳 AST nodes found: ${result.astNodesFound}`);
    
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    }

    return result;
    
  } catch (error) {
    console.error('❌ AST processing handler failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

async function testFileOrDirectory(inputPath: string) {
  console.log(`📂 Testing with path: ${inputPath}`);
  
  try {
    const stat = await fs.stat(inputPath);
    
    if (stat.isFile()) {
      // Test single file
      const content = await fs.readFile(inputPath, 'utf-8');
      const language = getLanguageFromPath(inputPath);
      
      console.log(`📄 Processing file: ${path.basename(inputPath)}`);
      console.log(`🔤 Detected language: ${language}`);
      
      const parseResult = await astParserService.parseCode(content, language);
      
      console.log(`✅ Found ${parseResult.chunks.length} chunks in file`);
      parseResult.chunks.forEach((chunk, index) => {
        console.log(`  ${index + 1}. ${chunk.type}: ${chunk.name || 'unnamed'} (lines ${chunk.startLine}-${chunk.endLine})`);
      });
      
    } else if (stat.isDirectory()) {
      // Test directory - find code files
      console.log(`📁 Scanning directory for code files...`);
      const codeFiles = await getCodeFiles(inputPath);
      
      console.log(`🔍 Found ${codeFiles.length} code files`);
      
      for (const filePath of codeFiles.slice(0, 5)) { // Limit to first 5 files
        const relativePath = path.relative(inputPath, filePath);
        console.log(`\n📄 Processing: ${relativePath}`);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const language = getLanguageFromPath(filePath);
          const parseResult = await astParserService.parseCode(content, language);
          
          console.log(`  ✅ ${parseResult.chunks.length} chunks found`);
          
        } catch (fileError) {
          console.log(`  ❌ Failed to process: ${fileError instanceof Error ? fileError.message : fileError}`);
        }
      }
      
      if (codeFiles.length > 5) {
        console.log(`\n... and ${codeFiles.length - 5} more files`);
      }
    }
    
  } catch (error) {
    console.error('❌ Path testing failed:', error instanceof Error ? error.message : error);
  }
}

async function getCodeFiles(dirPath: string): Promise<string[]> {
  const codeFiles: string[] = [];
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs'];
  
  async function traverse(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory() && !shouldSkipDirectory(entry.name)) {
        await traverse(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          codeFiles.push(fullPath);
        }
      }
    }
  }
  
  await traverse(dirPath);
  return codeFiles;
}

function shouldSkipDirectory(dirName: string): boolean {
  const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__'];
  return skipDirs.includes(dirName) || dirName.startsWith('.');
}

function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript',
    '.py': 'python', '.java': 'java', '.go': 'go',
    '.rs': 'rust', '.cpp': 'cpp', '.c': 'c', '.cs': 'csharp'
  };
  return languageMap[ext] || 'unknown';
}

async function main() {
  const inputPath = process.argv[2];
  
  console.log('🧪 AST Processing Test Suite');
  console.log('=============================\n');
  
  try {
    // Always test the parser with sample code
    await testASTParser();
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test processing handler (requires database)
    try {
      await testASTProcessingHandler();
    } catch (error) {
      console.log('⚠️  AST Processing Handler test skipped (database required)');
      console.log(`   Error: ${error instanceof Error ? error.message : error}`);
    }
    
    // Test with provided file/directory if given
    if (inputPath) {
      console.log('\n' + '='.repeat(50) + '\n');
      await testFileOrDirectory(inputPath);
    }
    
    console.log('\n🎉 AST testing completed!');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testASTParser, testASTProcessingHandler };