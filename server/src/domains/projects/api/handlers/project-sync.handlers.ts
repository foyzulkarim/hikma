import { FastifyRequest, FastifyReply } from 'fastify';
import { ProjectSyncService } from '../../services/project-sync.service';
import { SyncProjectUseCase } from '../../use-cases/sync-project.use-case';
import { UserContext } from '../../../users/auth/types';
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
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { projectId } = request.params as { projectId: string };
      
      const result = await this.syncProjectUseCase.execute({
        projectId,
        userId
      });

      if (result.status === 'error') {
        return reply.status(400).send({
          error: 'Sync Failed',
          message: result.message
        });
      }

      return reply.send({
        status: result.status,
        message: result.message,
        syncId: result.syncId,
        project: result.project
      });
    } catch (error) {
      return reply.status(500).send({ 
        error: 'Sync Error',
        message: error instanceof Error ? error.message : 'Failed to sync project'
      });
    }
  }
}