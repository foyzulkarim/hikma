import {
  IDocumentProcessor,
  CodeChunk,
  ChunkingConfig,
  ChunkingResult,
  ChunkingStrategy,
  VectorRecord,
  VectorMetadata,
  EmbeddingModel,
  CodeChunkMetadata,
  QdrantPayload,
} from '@/core/types/embeddings';
import { embeddingService } from './embedding.service';
import { logger } from '@/core/utils/logger';
import { HashUtils, SecureRandomUtils } from '@/core/utils/crypto';
import { ValidationError } from '@/core/errors/app-error';
import { vectorService } from '@/config/vector-db'; // Import vectorService
import { astParserService } from './ast-parser.service';

// Text chunking utilities
class TextChunker {
  static chunkByFixedSize(
    text: string,
    chunkSize: number,
    overlap: number,
    separators: string[] = ['\n\n', '\n', '. ', ' ']
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);
      
      // Try to find a good breaking point
      if (end < text.length) {
        let bestBreak = end;
        
        for (const separator of separators) {
          const lastIndex = text.lastIndexOf(separator, end);
          if (lastIndex > start) {
            bestBreak = lastIndex + separator.length;
            break;
          }
        }
        
        end = bestBreak;
      }

      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      start = Math.max(start + 1, end - overlap);
    }

    return chunks;
  }

  static chunkByRecursive(
    text: string,
    chunkSize: number,
    overlap: number,
    separators: string[] = ['\n\n', '\n', '. ', '! ', '? ', ' ']
  ): string[] {
    const chunks: string[] = [];
    
    const splitText = (text: string, separatorIndex: number = 0): void => {
      if (text.length <= chunkSize) {
        if (text.trim().length > 0) {
          chunks.push(text.trim());
        }
        return;
      }

      if (separatorIndex >= separators.length) {
        // No more separators, force split
        const forcedChunks = TextChunker.chunkByFixedSize(text, chunkSize, overlap, []);
        chunks.push(...forcedChunks);
        return;
      }

      const separator = separators[separatorIndex];
      const parts = text.split(separator);

      if (parts.length === 1) {
        // Separator not found, try next separator
        splitText(text, separatorIndex + 1);
        return;
      }

      let currentChunk = '';
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i] + (i < parts.length - 1 ? separator : '');
        
        if ((currentChunk + part).length <= chunkSize) {
          currentChunk += part;
        } else {
          if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
          }
          
          if (part.length > chunkSize) {
            splitText(part, separatorIndex + 1);
          } else {
            currentChunk = part;
          }
        }
      }

      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
    };

    splitText(text);
    return chunks;
  }

  static chunkByMarkdown(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    const lines = text.split('\n');
    
    let currentChunk = '';
    let currentSize = 0;
    let inCodeBlock = false;
    let codeBlockLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for code block markers
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLanguage = line.trim().substring(3);
        } else {
          inCodeBlock = false;
          codeBlockLanguage = '';
        }
      }

      // Check if adding this line would exceed chunk size
      if (currentSize + line.length > chunkSize && !inCodeBlock) {
        // Try to find a good breaking point
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
        }
        
        // Start new chunk with overlap
        if (overlap > 0 && chunks.length > 0) {
          const overlapText = currentChunk.slice(-overlap);
          currentChunk = overlapText + '\n' + line;
          currentSize = overlapText.length + line.length + 1;
        } else {
          currentChunk = line;
          currentSize = line.length;
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
        currentSize += line.length + (currentChunk ? 1 : 0);
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  static async chunkByCode(text: string, chunkSize: number, overlap: number, language?: string): Promise<string[]> {
    // Try AST-based chunking first if language is supported
    if (language && astParserService.isLanguageSupported(language)) {
      try {
        const parseResult = await astParserService.parseCode(text, language);
        
        if (parseResult.errors.length === 0 && parseResult.chunks.length > 0) {
          // Convert AST chunks to text chunks, respecting size constraints
          const astChunks: string[] = [];
          let currentChunk = '';
          let currentSize = 0;
          
          for (const codeChunk of parseResult.chunks) {
            const chunkText = codeChunk.content;
            
            // If this chunk fits within size limits, add it as-is
            if (chunkText.length <= chunkSize) {
              // If adding this chunk would exceed size, finalize current chunk
              if (currentSize + chunkText.length > chunkSize && currentChunk.length > 0) {
                astChunks.push(currentChunk.trim());
                currentChunk = '';
                currentSize = 0;
                
                // Add overlap from previous chunk if specified
                if (overlap > 0 && astChunks.length > 0) {
                  const prevChunk = astChunks[astChunks.length - 1];
                  const overlapText = prevChunk.slice(-overlap);
                  currentChunk = overlapText;
                  currentSize = overlapText.length;
                }
              }
              
              currentChunk += (currentChunk.length > 0 ? '\n' : '') + chunkText;
              currentSize += chunkText.length + (currentChunk.length > chunkText.length ? 1 : 0);
            } else {
              // Chunk is too large, split it using recursive method
              const subChunks = TextChunker.chunkByRecursive(chunkText, chunkSize, overlap);
              for (const subChunk of subChunks) {
                if (currentSize + subChunk.length > chunkSize && currentChunk.length > 0) {
                  astChunks.push(currentChunk.trim());
                  currentChunk = '';
                  currentSize = 0;
                }
                currentChunk += (currentChunk.length > 0 ? '\n' : '') + subChunk;
                currentSize += subChunk.length + (currentChunk.length > subChunk.length ? 1 : 0);
              }
            }
          }
          
          // Add final chunk if it exists
          if (currentChunk.trim().length > 0) {
            astChunks.push(currentChunk.trim());
          }
          
          // Return AST-based chunks if we got meaningful results
          if (astChunks.length > 0) {
            logger.debug({
              language,
              astChunks: parseResult.chunks.length,
              textChunks: astChunks.length
            }, 'Successfully used AST-based chunking');
            return astChunks;
          }
        }
      } catch (error) {
        logger.warn({
          language,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'AST parsing failed, falling back to text-based chunking');
      }
    }
    
    // Fallback to original language-specific chunking strategies
    const languageStrategies: Record<string, string[]> = {
      javascript: ['\nclass ', '\nfunction ', '\nconst ', '\nlet ', '\nvar ', '\n\n', '\n'],
      typescript: ['\nclass ', '\ninterface ', '\ntype ', '\nfunction ', '\nconst ', '\nlet ', '\n\n', '\n'],
      python: ['\nclass ', '\ndef ', '\n\n', '\n'],
      java: ['\nclass ', '\ninterface ', '\npublic ', '\nprivate ', '\nprotected ', '\n\n', '\n'],
      cpp: ['\nclass ', '\nstruct ', '\nnamespace ', '\n\n', '\n'],
      go: ['\nfunc ', '\ntype ', '\nvar ', '\nconst ', '\n\n', '\n'],
      rust: ['\nfn ', '\nstruct ', '\nenum ', '\nimpl ', '\n\n', '\n'],
    };

    const separators = languageStrategies[language || ''] || ['\n\n', '\n'];
    return TextChunker.chunkByRecursive(text, chunkSize, overlap, separators);
  }

  static chunkBySemantic(text: string, chunkSize: number, overlap: number): string[] {
    // Simple semantic chunking based on sentence boundaries and topics
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    
    let currentChunk = '';
    let currentSize = 0;

    for (const sentence of sentences) {
      const sentenceWithPunctuation = sentence.trim() + '.';
      
      if (currentSize + sentenceWithPunctuation.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Add overlap
        if (overlap > 0) {
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.floor(overlap / 10)); // Rough word-based overlap
          currentChunk = overlapWords.join(' ') + ' ' + sentenceWithPunctuation;
          currentSize = currentChunk.length;
        } else {
          currentChunk = sentenceWithPunctuation;
          currentSize = sentenceWithPunctuation.length;
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunctuation;
        currentSize += sentenceWithPunctuation.length + (currentChunk ? 1 : 0);
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

// Document processor implementation
export class DocumentProcessor implements IDocumentProcessor {
  private readonly defaultChunkingConfig: ChunkingConfig = {
    strategy: ChunkingStrategy.RECURSIVE,
    chunkSize: 1000,
    chunkOverlap: 200,
    minChunkSize: 100,
    maxChunkSize: 2000,
    separators: ['\n\n', '\n', '. ', '! ', '? ', ' '],
    preserveStructure: true,
    respectBoundaries: true,
  };

  async chunkDocument(content: string, config?: ChunkingConfig): Promise<ChunkingResult> {
    const chunkConfig = { ...this.defaultChunkingConfig, ...config };
    
    try {
      logger.debug({
        contentLength: content.length,
        strategy: chunkConfig.strategy,
        chunkSize: chunkConfig.chunkSize,
      }, 'Starting document chunking');

      // Validate input
      if (!content || content.trim().length === 0) {
        throw new ValidationError('Content cannot be empty');
      }

      if (content.length < chunkConfig.minChunkSize) {
        // Content is too small to chunk, return as single chunk
        return {
          chunks: [],
          totalChunks: 1,
          totalTokens: embeddingService.estimateTokens(content),
          strategy: chunkConfig.strategy,
          metadata: {
            originalLength: content.length,
            averageChunkSize: content.length,
            minChunkSize: content.length,
            maxChunkSize: content.length,
          },
        };
      }

      // Perform chunking based on strategy
      let textChunks: string[] = [];
      
      switch (chunkConfig.strategy) {
        case ChunkingStrategy.FIXED_SIZE:
          textChunks = TextChunker.chunkByFixedSize(
            content,
            chunkConfig.chunkSize,
            chunkConfig.chunkOverlap,
            chunkConfig.separators
          );
          break;

        case ChunkingStrategy.RECURSIVE:
          textChunks = TextChunker.chunkByRecursive(
            content,
            chunkConfig.chunkSize,
            chunkConfig.chunkOverlap,
            chunkConfig.separators
          );
          break;

        case ChunkingStrategy.MARKDOWN:
          textChunks = TextChunker.chunkByMarkdown(
            content,
            chunkConfig.chunkSize,
            chunkConfig.chunkOverlap
          );
          break;

        case ChunkingStrategy.CODE:
          textChunks = await TextChunker.chunkByCode(
            content,
            chunkConfig.chunkSize,
            chunkConfig.chunkOverlap,
            chunkConfig.language
          );
          break;

        case ChunkingStrategy.SEMANTIC:
          textChunks = TextChunker.chunkBySemantic(
            content,
            chunkConfig.chunkSize,
            chunkConfig.chunkOverlap
          );
          break;

        default:
          throw new ValidationError(`Unsupported chunking strategy: ${chunkConfig.strategy}`);
      }

      // Filter chunks by size constraints
      const validChunks = textChunks.filter(chunk => 
        chunk.length >= chunkConfig.minChunkSize && 
        chunk.length <= chunkConfig.maxChunkSize
      );

      // Calculate statistics
      const chunkSizes = validChunks.map(chunk => chunk.length);
      const totalTokens = validChunks.reduce(
        (sum, chunk) => sum + embeddingService.estimateTokens(chunk),
        0
      );

      const result: ChunkingResult = {
        chunks: [], // Will be populated by caller with metadata
        totalChunks: validChunks.length,
        totalTokens,
        strategy: chunkConfig.strategy,
        metadata: {
          originalLength: content.length,
          averageChunkSize: chunkSizes.length > 0 ? chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length : 0,
          minChunkSize: chunkSizes.length > 0 ? Math.min(...chunkSizes) : 0,
          maxChunkSize: chunkSizes.length > 0 ? Math.max(...chunkSizes) : 0,
        },
      };

      // Store the text chunks for later use
      (result as any)._textChunks = validChunks;

      logger.debug({
        originalLength: content.length,
        totalChunks: validChunks.length,
        totalTokens,
        averageChunkSize: result.metadata.averageChunkSize,
      }, 'Document chunking completed');

      return result;

    } catch (error) {
      logger.error({
        contentLength: content.length,
        strategy: chunkConfig.strategy,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Document chunking failed');

      throw error;
    }
  }

  async chunkDocuments(
    documents: Array<{ id: string; content: string }>,
    config?: ChunkingConfig
  ): Promise<Map<string, ChunkingResult>> {
    const results = new Map<string, ChunkingResult>();

    for (const document of documents) {
      try {
        const result = await this.chunkDocument(document.content, config);
        results.set(document.id, result);
      } catch (error) {
        logger.error({
          documentId: document.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed to chunk document');
        
        // Continue with other documents
      }
    }

    return results;
  }

  async embedChunks(chunks: CodeChunk[]): Promise<VectorRecord[]> {
    try {
      logger.debug({
        chunkCount: chunks.length,
      }, 'Starting chunk embedding');

      if (chunks.length === 0) {
        return [];
      }

      // Extract text content from chunks
      const texts = chunks.map(chunk => chunk.codeContent);

      // Generate embeddings
      const embeddingResponse = await embeddingService.generateEmbeddings(texts);

      // Create vector records
      const vectors: VectorRecord[] = chunks.map((chunk, index) => {
        const payload: QdrantPayload = {
          chunk_id: chunk.id,
          file_id: chunk.fileId,
          repository_id: '',
          node_type: chunk.nodeType,
          node_name: chunk.nodeName || '',
          file_path: '',
          language: 'unknown',
          framework: undefined,
          purpose_category: chunk.purposeCategory || 'unknown',
          domain_tags: [],
          patterns: [],
          parent_chunk_id: chunk.parentChunkId,
          depth_level: 0,
          complexity_score: chunk.complexityScore || 0,
          line_count: chunk.endLine - chunk.startLine + 1,
          token_count: embeddingService.estimateTokens(chunk.codeContent),
          has_docstring: chunk.hasDocstring,
          has_error_handling: chunk.hasErrorHandling,
          has_tests: chunk.hasTests,
          is_exported: chunk.isExported,
          is_async: chunk.isAsync,
          num_callers: 0,
          num_callees: 0,
          num_imports: 0,
          signature: chunk.signature,
          docstring_summary: undefined,
          first_line_comment: undefined,
          indexed_at: new Date().toISOString(),
          file_modified_at: new Date().toISOString()
        };

        const embedding = embeddingResponse.embeddings[index];
        if (!embedding || embedding.length === 0) {
          throw new Error(`Invalid embedding for chunk ${chunk.id}: embedding is empty or undefined`);
        }

        return {
          id: chunk.id,
          vectors: {
            code: embedding
          },
          payload,
          values: embedding
        };
      });

      logger.debug({
        chunkCount: chunks.length,
        vectorCount: vectors.length,
        totalTokens: embeddingResponse.usage.total_tokens,
      }, 'Chunk embedding completed');

      return vectors;

    } catch (error) {
      logger.error({
        chunkCount: chunks.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Chunk embedding failed');

      throw error;
    }
  }

  async embedDocument(
    documentId: string,
    content: string,
    metadata: CodeChunkMetadata
  ): Promise<VectorRecord[]> {
    try {
      // First, chunk the document
      const chunkingResult = await this.chunkDocument(content);
      const textChunks = (chunkingResult as any)._textChunks as string[];

      // Create document chunks with metadata
      const chunks: CodeChunk[] = textChunks.map((text, index) => ({
        id: `${documentId}_chunk_${index}`,
        fileId: documentId,
        codeContent: text,
        nodeType: 'document',
        startLine: 0,
        endLine: text.split('\n').length,
        hash: HashUtils.sha256(text),
        tokens: embeddingService.estimateTokens(text),
        hasDocstring: false,
        hasErrorHandling: false,
        hasTests: false,
        isExported: false,
        isAsync: false,
        isGenerator: false,
        isStatic: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Generate embeddings for chunks
      return await this.embedChunks(chunks);

    } catch (error) {
      logger.error({
        documentId,
        contentLength: content.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Document embedding failed');

      throw error;
    }
  }

  async processDocument(
    documentId: string,
    content: string,
    metadata: CodeChunkMetadata
  ): Promise<{
    chunks: CodeChunk[];
    vectors: VectorRecord[];
    stats: {
      totalChunks: number;
      totalTokens: number;
      processingTime: number;
    };
  }> {
    const startTime = Date.now();

    try {
      logger.info({
        documentId,
        contentLength: content.length,
      }, 'Starting document processing');

      // Chunk the document
      const chunkingResult = await this.chunkDocument(content);
      const textChunks = (chunkingResult as any)._textChunks as string[];

      // Create document chunks with metadata
      const chunks: CodeChunk[] = textChunks.map((text, index) => ({
        id: `${documentId}_chunk_${index}`,
        fileId: documentId,
        codeContent: text,
        nodeType: 'document',
        startLine: 0,
        endLine: text.split('\n').length,
        hash: HashUtils.sha256(text),
        tokens: embeddingService.estimateTokens(text),
        hasDocstring: false,
        hasErrorHandling: false,
        hasTests: false,
        isExported: false,
        isAsync: false,
        isGenerator: false,
        isStatic: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Generate embeddings
      const vectors = await this.embedChunks(chunks);

      // Upsert vectors to the vector store
      try {
        // Transform VectorRecord to match upsert interface
        const upsertVectors = vectors.map(v => ({
          id: v.id,
          values: v.values!, // We've already validated this is not undefined
          metadata: v.payload
        }));
        
        await vectorService.upsert(upsertVectors);
      } catch (error) {
        logger.error({
          documentId,
          error,
        }, 'Failed to upsert vectors during document processing');
        // Depending on desired error handling, you might throw here or return partial success
        throw error;
      }

      const processingTime = Date.now() - startTime;

      const result = {
        chunks,
        vectors,
        stats: {
          totalChunks: chunkingResult.totalChunks,
          totalTokens: chunkingResult.totalTokens,
          processingTime,
        },
      };

      logger.info({
        documentId,
        totalChunks: result.stats.totalChunks,
        totalTokens: result.stats.totalTokens,
        processingTime: result.stats.processingTime,
      }, 'Document processing completed');

      return result;

    } catch (error) {
      logger.error({
        documentId,
        contentLength: content.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Document processing failed');

      throw error;
    }
  }

  // Batch processing method required by interface
  async processDocuments(documents: Array<{
    id: string;
    content: string;
    metadata: CodeChunkMetadata;
  }>): Promise<Map<string, VectorRecord[]>> {
    const results = new Map<string, VectorRecord[]>();
    
    for (const doc of documents) {
      try {
        const result = await this.processDocument(doc.id, doc.content, doc.metadata);
        results.set(doc.id, result.vectors);
      } catch (error) {
        logger.error({
          documentId: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed to process document in batch');
        // Continue processing other documents
        results.set(doc.id, []);
      }
    }
    
    return results;
  }
}


// Export singleton instance
export const documentProcessor = new DocumentProcessor();


