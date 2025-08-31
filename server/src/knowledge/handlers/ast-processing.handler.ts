import { astParserService } from '../services/ast-parser.service';
import { ASTNodeType, ASTChunkMetadata, ChunkMetadata } from '../../core/types/embeddings';
import { PrismaClient } from '@prisma/client';
import { embeddingService } from '../services/embedding-service';
import { logger } from '../../core/utils/logger';

export interface ASTProcessingEvent {
  projectId: string;
  filePath: string;
  content: string;
  language?: string;
  sourceId: string;
  sourceType: 'git' | 'upload' | 'manual';
}

export interface ASTProcessingResult {
  success: boolean;
  chunksProcessed: number;
  astNodesFound: number;
  error?: string;
}

export class ASTProcessingHandler {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async handleASTProcessing(event: ASTProcessingEvent): Promise<ASTProcessingResult> {
    logger.info(`Processing AST for file: ${event.filePath}`);

    try {
      // Check if file is a code file that should be processed with AST
      if (!this.isCodeFile(event.filePath, event.language)) {
        logger.debug(`Skipping non-code file: ${event.filePath}`);
        return {
          success: true,
          chunksProcessed: 0,
          astNodesFound: 0,
        };
      }

      // Parse the code with AST
      const parseResult = await astParserService.parseCode(
        event.content,
        this.getLanguageFromPath(event.filePath, event.language)
      );

      if (!parseResult.chunks || parseResult.chunks.length === 0) {
        const errorMsg = parseResult.errors.length > 0 ? parseResult.errors.join(', ') : 'No chunks found';
        logger.warn(`AST parsing failed for ${event.filePath}: ${errorMsg}`);
        return {
          success: false,
          chunksProcessed: 0,
          astNodesFound: 0,
          error: errorMsg,
        };
      }

      // Process chunks (simplified for now)
      const processedChunks = await this.processASTChunks(
        parseResult.chunks,
        event
      );

      logger.info(
        `Successfully processed ${processedChunks} chunks with ${parseResult.chunks.length} AST nodes for ${event.filePath}`
      );

      return {
        success: true,
        chunksProcessed: processedChunks,
        astNodesFound: parseResult.chunks.length,
      };
    } catch (error) {
        logger.error(`Error processing AST for ${event.filePath}:`, error);
        return {
          success: false,
          chunksProcessed: 0,
          astNodesFound: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
  }

  // Create document record in database
  private async createDocumentRecord(event: ASTProcessingEvent): Promise<string> {
    try {
      // Find or create knowledge base for the project
      let knowledgeBase = await this.prisma.knowledgeBase.findFirst({
        where: { projectId: event.projectId }
      });

      if (!knowledgeBase) {
        knowledgeBase = await this.prisma.knowledgeBase.create({
          data: {
            projectId: event.projectId,
            name: 'Default Knowledge Base',
            description: 'Auto-generated knowledge base for AST processing'
          }
        });
      }

      // Create document record
      const document = await this.prisma.document.create({
        data: {
          knowledgeBaseId: knowledgeBase.id,
          dataSourceId: event.sourceId,
          externalId: event.filePath,
          title: this.getFileNameFromPath(event.filePath),
          content: event.content,
          type: 'CODE_FILE',
          status: 'PROCESSING',
          hash: this.generateContentHash(event.content),
          size: event.content.length,
          metadata: {
            language: event.language,
            path: event.filePath,
            sourceType: event.sourceType
          }
        }
      });

      return document.id;
    } catch (error) {
      logger.error(`Error creating document record for ${event.filePath}:`, error);
      throw error;
    }
  }

  private async processASTChunks(
    chunks: any[],
    event: ASTProcessingEvent
  ): Promise<number> {
    let processedCount = 0;
    
    // Create document record first
    const documentId = await this.createDocumentRecord(event);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Generate embedding for the chunk
        const embedding = await embeddingService.generateEmbedding(chunk.content);
        
        // Create document chunk with AST metadata
        const documentChunk = await this.prisma.documentChunk.create({
          data: {
            documentId,
            chunkIndex: i,
            content: chunk.content,
            embedding,
            metadata: {
              language: event.language,
              filePath: event.filePath,
              chunkType: 'ast'
            }
          }
        });

        // Create AST-specific metadata
         await this.prisma.aSTChunkMetadata.create({
          data: {
            chunkId: documentChunk.id,
            astNodeType: this.mapToASTNodeType(chunk.type).toString(),
            functionName: chunk.functionName,
            className: chunk.className,
            methodName: chunk.methodName,
            parameters: chunk.parameters || [],
            returnType: chunk.returnType,
            visibility: chunk.visibility,
            isStatic: chunk.isStatic || false,
            isAsync: chunk.isAsync || false,
            complexity: chunk.complexity,
            dependencies: chunk.dependencies || [],
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            syntaxTree: chunk.syntaxTree
          }
        });
        
        logger.debug(`Processed AST chunk ${i + 1}/${chunks.length}`, {
          filePath: event.filePath,
          astNodeType: this.mapToASTNodeType(chunk.type),
          functionName: chunk.functionName,
          className: chunk.className,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          contentLength: chunk.content.length,
          embeddingDimensions: embedding.length
        });

        processedCount++;
      } catch (error) {
        logger.error(`Error processing chunk ${i} for ${event.filePath}:`, error);
      }
    }

    // Update document status to indexed
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'INDEXED' }
    });

    return processedCount;
  }

  private buildASTChunkMetadata(chunk: any, event: ASTProcessingEvent): ASTChunkMetadata {
    return {
      // Required ChunkMetadata properties
      documentType: 'CODE',
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      projectId: event.projectId,
      title: this.getFileNameFromPath(event.filePath),
      path: event.filePath,
      language: this.getLanguageFromPath(event.filePath, event.language),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // AST-specific properties
      astNodeType: this.mapToASTNodeType(chunk.type),
      functionName: chunk.functionName,
      className: chunk.className,
      methodName: chunk.methodName,
      parameters: chunk.parameters,
      returnType: chunk.returnType,
      visibility: chunk.visibility,
      isStatic: chunk.isStatic,
      isAsync: chunk.isAsync,
      complexity: chunk.complexity,
      dependencies: chunk.dependencies,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      syntaxTree: chunk.syntaxTree,
    };
  }

  private mapToASTNodeType(type: string): ASTNodeType {
    const typeMap: Record<string, ASTNodeType> = {
      'class_declaration': ASTNodeType.CLASS,
      'function_declaration': ASTNodeType.FUNCTION,
      'method_definition': ASTNodeType.METHOD,
      'interface_declaration': ASTNodeType.INTERFACE,
      'type_alias_declaration': ASTNodeType.TYPE,
      'variable_declaration': ASTNodeType.VARIABLE,
      'const_declaration': ASTNodeType.CONSTANT,
      'import_declaration': ASTNodeType.IMPORT,
      'export_declaration': ASTNodeType.EXPORT,
      'comment': ASTNodeType.COMMENT,
      'function': ASTNodeType.FUNCTION,
      'class': ASTNodeType.CLASS,
      'method': ASTNodeType.METHOD,
      'interface': ASTNodeType.INTERFACE,
      'type': ASTNodeType.TYPE,
      'variable': ASTNodeType.VARIABLE,
      'import': ASTNodeType.IMPORT,
      'other': ASTNodeType.OTHER,
    };

    return typeMap[type] || ASTNodeType.OTHER;
  }

  private isCodeFile(filePath: string, language?: string): boolean {
    if (language) {
      return ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp', 'c', 'csharp'].includes(language);
    }

    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.py', '.pyx',
      '.java',
      '.go',
      '.rs',
      '.cpp', '.cc', '.cxx', '.c++',
      '.c', '.h',
      '.cs'
    ];

    return codeExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
  }

  private getLanguageFromPath(filePath: string, providedLanguage?: string): string {
    if (providedLanguage) {
      return providedLanguage;
    }

    const ext = filePath.toLowerCase().split('.').pop();
    if (!ext) return 'unknown';
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'pyx': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'c++': 'cpp',
      'c': 'c',
      'h': 'c',
      'cs': 'csharp',
    };

    return languageMap[ext] || 'unknown';
  }

  private getFileNameFromPath(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  private generateContentHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private estimateTokens(content: string): number {
    // Simple token estimation: roughly 4 characters per token
    return Math.ceil(content.length / 4);
  }
}