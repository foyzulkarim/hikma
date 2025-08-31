import { FastifyRequest, FastifyReply } from 'fastify';
import { ProjectSyncService } from '../../services/project-sync.service';
import { SyncProjectUseCase } from '../../use-cases/sync-project.use-case';
import { UserContext } from '../../../users/auth/types';
import { logger } from '@/core/utils/logger';
import {
  syncResultSchema,
  syncErrorResponseSchema
} from '../schemas';

interface AuthenticatedRequest extends FastifyRequest {
  user?: UserContext;
}

export class ProjectSyncHandlers {
  constructor(
    private readonly service: ProjectSyncService,
    private readonly syncProjectUseCase: SyncProjectUseCase
  ) {}

  async syncProject(request: AuthenticatedRequest, reply: FastifyReply) {
    const { projectId } = request.params as { projectId: string };
    const correlationId = request.headers['x-correlation-id'] || `sync-handler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('ProjectSyncHandlers.syncProject started', {
      projectId,
      correlationId,
      userId: request.user?.id,
      method: request.method,
      url: request.url
    });
    
    try {
      // Validate authentication
      const userId = request.user?.id;
      if (!userId) {
        logger.warn('Project sync authentication failed', {
          projectId,
          correlationId,
          reason: 'No user ID found in request'
        });
        return reply.status(401).send({ error: 'Authentication required' });
      }

      // Validate parameters
      if (!projectId || typeof projectId !== 'string') {
        logger.warn('Project sync parameter validation failed', {
          projectId,
          correlationId,
          userId,
          reason: 'Invalid or missing projectId parameter'
        });
        return reply.status(400).send({ error: 'Invalid project ID' });
      }

      logger.info('Executing project sync use case', {
        projectId,
        correlationId,
        userId
      });
      
      const result = await this.syncProjectUseCase.execute({
        projectId,
        userId
      });

      const duration = Date.now() - startTime;

      if (result.status === 'error') {
        logger.warn('Project sync use case returned error', {
          projectId,
          correlationId,
          userId,
          status: result.status,
          message: result.message,
          duration
        });
        return reply.status(400).send({
          error: 'Sync Failed',
          message: result.message
        });
      }

      logger.info('ProjectSyncHandlers.syncProject completed successfully', {
        projectId,
        correlationId,
        userId,
        status: result.status,
        syncId: result.syncId,
        duration
      });

      return reply.send({
        status: result.status,
        message: result.message,
        syncId: result.syncId,
        project: result.project
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync project';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('ProjectSyncHandlers.syncProject failed with exception', {
        projectId,
        correlationId,
        userId: request.user?.id,
        error: errorMessage,
        stack: errorStack,
        duration
      });
      
      return reply.status(500).send({ 
        error: 'Sync Error',
        message: errorMessage
      });
    }
  }
}