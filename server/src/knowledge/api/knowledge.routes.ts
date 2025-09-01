import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { SearchHandler } from '../handlers/search.handler';
import { EmbeddingService } from '../services/embedding.service';
import { ChunkSyncService } from '../services/chunk-sync.service';
import { VectorService } from '../../config/vector-db';
import { PrismaClient } from '@prisma/client';

export const knowledgeRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Initialize dependencies
  const prisma = new PrismaClient();
  const embeddingService = new EmbeddingService();
  const chunkSyncService = new ChunkSyncService(prisma);
  const vectorService = new VectorService();
  
  // Initialize handler
  const searchHandler = new SearchHandler();

  // Search endpoint
  fastify.post('/search', {
    schema: {
      description: 'Perform semantic search on document chunks',
      tags: ['Knowledge'],
      body: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1, maxLength: 1000 },
          project_id: { type: 'string' },
          document_id: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 }
        },
        required: ['query']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      chunk_id: { type: 'string' },
                      content: { type: 'string' },
                      document_id: { type: 'string' },
                      project_id: { type: 'string' },
                      chunk_index: { type: 'number' },
                      metadata: { type: 'object' },
                      score: { type: 'number' }
                    }
                  }
                },
                total: { type: 'number' },
                query: { type: 'string' },
                processing_time_ms: { type: 'number' }
              }
            }
          }
        },
        400: { 
          type: 'object', 
          properties: { 
            success: { type: 'boolean' },
            error: { type: 'string' } 
          } 
        },
        500: { 
          type: 'object', 
          properties: { 
            success: { type: 'boolean' },
            error: { type: 'string' } 
          } 
        }
      }
    }
  }, searchHandler.handleSearch.bind(searchHandler));

  // Search statistics endpoint
  fastify.get('/search/stats', {
    schema: {
      description: 'Get search and sync statistics',
      tags: ['Knowledge'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                sync_stats: {
                  type: 'object',
                  properties: {
                    total_chunks: { type: 'number' },
                    synced_chunks: { type: 'number' },
                    pending_chunks: { type: 'number' },
                    last_sync: { type: ['string', 'null'] }
                  }
                },
                vector_stats: {
                  type: 'object',
                  properties: {
                    total_vectors: { type: 'number' },
                    collection_size: { type: 'number' }
                  }
                }
              }
            }
          }
        },
        500: { 
          type: 'object', 
          properties: { 
            success: { type: 'boolean' },
            error: { type: 'string' } 
          } 
        }
      }
    }
  }, searchHandler.handleSearchStats.bind(searchHandler));
};