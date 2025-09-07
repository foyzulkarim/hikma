import { CodeChunk as ProjectCodeChunk } from '../services/project-sync.service';
import { CodeChunk as EmbeddingCodeChunk } from '@/core/types/embeddings';
import { Neo4jChunkNode } from '@/knowledge/services/neo4j-chunk.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * ChunkTransformer Utility Class
 * 
 * Handles all data transformations between different chunk formats used across
 * the application. Centralizes transformation logic for better maintainability
 * and reusability.
 */
export class ChunkTransformer {
  /**
   * Convert ProjectSyncService CodeChunk[] to EmbeddingCodeChunk[] for embedding service
   * 
   * @param chunks - Array of CodeChunk objects from ProjectSyncService
   * @returns Array of EmbeddingCodeChunk objects for the embedding service
   */
  static toEmbeddingFormat(chunks: ProjectCodeChunk[]): EmbeddingCodeChunk[] {
    return chunks.map(chunk => ({
      id: chunk.id,
      fileId: uuidv4(), // Generate file ID since not provided in original chunk
      parentChunkId: undefined, // Not available in original format
      
      // Position information from metadata
      startLine: chunk.metadata.startLine,
      endLine: chunk.metadata.endLine,
      startColumn: undefined, // Not available in original format
      endColumn: undefined, // Not available in original format
      
      // Content
      codeContent: chunk.content,
      cleanedContent: chunk.content, // Use same content for now
      
      // Tree-sitter extracted metadata
      nodeType: chunk.metadata.nodeType,
      nodeName: chunk.metadata.nodeName,
      signature: chunk.metadata.signature,
      
      // Classification metadata - set defaults
      purposeCategory: undefined,
      complexityScore: undefined,
      cognitiveComplexity: undefined,
      
      // Rich flags - set defaults based on content analysis
      hasDocstring: chunk.content.includes('/**') || chunk.content.includes('"""') || chunk.content.includes("'''"),
      hasErrorHandling: chunk.content.includes('try') || chunk.content.includes('catch') || chunk.content.includes('except') || chunk.content.includes('Error'),
      hasTests: chunk.content.includes('test') || chunk.content.includes('describe') || chunk.content.includes('it(') || chunk.content.includes('assert'),
      isExported: chunk.content.includes('export') || chunk.content.includes('module.exports') || chunk.content.includes('public'),
      isAsync: chunk.content.includes('async') || chunk.content.includes('await') || chunk.content.includes('Promise'),
      isGenerator: chunk.content.includes('function*') || chunk.content.includes('yield'),
      isStatic: chunk.content.includes('static'),
      
      // Indexing
      embeddingVersion: undefined,
      embeddedAt: undefined,
      qdrantPointId: undefined,
      vectorId: undefined,
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Convert ProjectSyncService CodeChunk[] to Neo4jChunkNode[] for Neo4j service
   * 
   * @param chunks - Array of CodeChunk objects from ProjectSyncService
   * @param projectId - Project ID to associate with the nodes
   * @returns Array of Neo4jChunkNode objects for Neo4j persistence
   */
  static toNeo4jFormat(chunks: ProjectCodeChunk[], projectId: string): Neo4jChunkNode[] {
    return chunks.map(chunk => ({
      id: chunk.id,
      chunkId: chunk.id,
      documentId: chunk.filePath, // Use file path as document ID
      projectId: projectId,
      content: chunk.content,
      filePath: chunk.filePath,
      language: chunk.language,
      
      // AST metadata mapping
      astNodeType: chunk.metadata.nodeType as any, // Map to ASTNodeType enum
      functionName: chunk.metadata.nodeName && chunk.metadata.nodeType === 'function' ? chunk.metadata.nodeName : undefined,
      className: chunk.metadata.nodeName && chunk.metadata.nodeType === 'class' ? chunk.metadata.nodeName : undefined,
      methodName: chunk.metadata.nodeName && chunk.metadata.nodeType === 'method' ? chunk.metadata.nodeName : undefined,
      
      // Extract parameters from signature if available
      parameters: chunk.metadata.signature ? this.extractParametersFromSignature(chunk.metadata.signature) : undefined,
      returnType: chunk.metadata.signature ? this.extractReturnTypeFromSignature(chunk.metadata.signature) : undefined,
      
      // Analyze visibility from content
      visibility: this.determineVisibility(chunk.content),
      
      // Boolean flags based on content analysis
      isStatic: chunk.content.includes('static'),
      isAsync: chunk.content.includes('async') || chunk.content.includes('await'),
      
      // Position information
      startLine: chunk.metadata.startLine,
      endLine: chunk.metadata.endLine,
      
      // Complexity analysis (basic heuristic)
      complexity: this.calculateBasicComplexity(chunk.content),
      
      // Dependencies analysis (basic - look for imports/requires)
      dependencies: this.extractDependencies(chunk.content),
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Convert ProjectSyncService CodeChunk[] to PostgreSQL format
   * This method is prepared for future use when needed
   * 
   * @param chunks - Array of CodeChunk objects from ProjectSyncService
   * @returns Array of PostgreSQL-compatible chunk data
   */
  static toPostgresFormat(chunks: ProjectCodeChunk[]): any[] {
    // This is a placeholder for future implementation
    // Currently, PostgreSQL persistence is handled directly in saveChunksToPostgres
    return chunks.map(chunk => ({
      id: chunk.id,
      filePath: chunk.filePath,
      content: chunk.content,
      language: chunk.language,
      nodeType: chunk.metadata.nodeType,
      nodeName: chunk.metadata.nodeName,
      startLine: chunk.metadata.startLine,
      endLine: chunk.metadata.endLine,
      signature: chunk.metadata.signature,
      projectId: chunk.projectId,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  // Private helper methods for data analysis

  /**
   * Extract parameters from function signature
   * Basic implementation - can be enhanced with proper AST parsing
   */
  private static extractParametersFromSignature(signature: string): string[] | undefined {
    const paramMatch = signature.match(/\((.*?)\)/);
    if (!paramMatch || !paramMatch[1]) return undefined;
    
    return paramMatch[1]
      .split(',')
      .map(param => param.trim())
      .filter(param => param.length > 0);
  }

  /**
   * Extract return type from function signature
   * Basic implementation - can be enhanced with proper AST parsing
   */
  private static extractReturnTypeFromSignature(signature: string): string | undefined {
    const returnTypeMatch = signature.match(/:\s*([^{]+?)\s*[{=]/);
    return returnTypeMatch ? returnTypeMatch[1].trim() : undefined;
  }

  /**
   * Determine visibility based on code content
   * Basic heuristic - can be enhanced with proper AST parsing
   */
  private static determineVisibility(content: string): 'public' | 'private' | 'protected' | undefined {
    if (content.includes('private ')) return 'private';
    if (content.includes('protected ')) return 'protected';
    if (content.includes('public ')) return 'public';
    
    // Default heuristics
    if (content.includes('export')) return 'public';
    if (content.startsWith('_') || content.includes('function _')) return 'private';
    
    return 'public'; // Default assumption
  }

  /**
   * Calculate basic complexity score based on content
   * Simple heuristic - can be enhanced with proper complexity analysis
   */
  private static calculateBasicComplexity(content: string): number {
    let complexity = 1; // Base complexity
    
    // Count control flow statements
    const controlFlowPatterns = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /while\s*\(/g,
      /for\s*\(/g,
      /switch\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /\?\s*[^:]*:/g, // Ternary operators
    ];
    
    for (const pattern of controlFlowPatterns) {
      const matches = content.match(pattern);
      if (matches) complexity += matches.length;
    }
    
    return complexity;
  }

  /**
   * Extract dependencies from code content
   * Basic implementation - looks for common import patterns
   */
  private static extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // ES6 imports
    const es6ImportMatches = content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
    if (es6ImportMatches) {
      es6ImportMatches.forEach(match => {
        const moduleMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/);
        if (moduleMatch) dependencies.push(moduleMatch[1]);
      });
    }
    
    // CommonJS requires
    const requireMatches = content.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
    if (requireMatches) {
      requireMatches.forEach(match => {
        const moduleMatch = match.match(/['"`]([^'"`]+)['"`]/);
        if (moduleMatch) dependencies.push(moduleMatch[1]);
      });
    }
    
    return Array.from(new Set(dependencies)); // Remove duplicates
  }
}