import { eventBus } from '@/shared/events/event-bus';
import { PROJECT_EVENTS, ProjectSyncStartedEvent, ProjectSyncCompletedEvent } from '../events/project.events';
import { logger } from '@/core/utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service responsible for handling project domain events
 * Provides comprehensive logging and processing for project lifecycle events
 */
export class ProjectEventHandlersService {
  private initialized = false;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Initialize the event handlers service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const correlationId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('Initializing ProjectEventHandlersService', {
        correlationId,
        timestamp: new Date().toISOString()
      });

      this.initialized = true;
      
      const duration = Date.now() - startTime;
      logger.info('ProjectEventHandlersService initialized successfully', {
        correlationId,
        duration,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('ProjectEventHandlersService initialization failed', {
        correlationId,
        error: errorMessage,
        stack: errorStack,
        duration,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Setup event listeners for project domain events
   */
  private setupEventListeners(): void {
    const correlationId = uuidv4();
    
    logger.info('Setting up project event listeners', {
      correlationId,
      events: [
        PROJECT_EVENTS.PROJECT_SYNC_STARTED,
        PROJECT_EVENTS.PROJECT_SYNC_COMPLETED
      ],
      timestamp: new Date().toISOString()
    });

    // Register event listeners
    eventBus.on(PROJECT_EVENTS.PROJECT_SYNC_STARTED, this.handleProjectSyncStarted.bind(this));
    eventBus.on(PROJECT_EVENTS.PROJECT_SYNC_COMPLETED, this.handleProjectSyncCompleted.bind(this));

    logger.info('Project event listeners registered successfully', {
      correlationId,
      listenersCount: 2,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle PROJECT_SYNC_STARTED event
   * Logs sync initiation details and performs any necessary setup
   */
  private async handleProjectSyncStarted(event: ProjectSyncStartedEvent): Promise<void> {
    const correlationId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('PROJECT_SYNC_STARTED event received', {
        correlationId,
        eventType: PROJECT_EVENTS.PROJECT_SYNC_STARTED,
        projectId: event.projectId,
        userId: event.userId,
        syncId: event.syncId,
        repositoryUrl: event.repositoryUrl,
        branch: event.branch,
        timestamp: event.timestamp,
        metadata: {
          force: event.metadata?.force,
          lastSyncAt: event.metadata?.lastSyncAt,
          tempPath: event.metadata?.tempPath,
          useTemporaryClone: event.metadata?.useTemporaryClone
        }
      });

      // Log sync context details
      logger.debug('Project sync context details', {
        correlationId,
        projectId: event.projectId,
        syncId: event.syncId,
        syncConfiguration: {
          repositoryUrl: event.repositoryUrl,
          branch: event.branch || 'default',
          useTemporaryClone: event.metadata?.useTemporaryClone || false,
          isForceSync: event.metadata?.force || false
        },
        timing: {
          eventTimestamp: event.timestamp,
          lastSyncAt: event.metadata?.lastSyncAt
        }
      });

      // Perform any sync started processing here
      // e.g., update project status, notify other services, etc.
      await this.processSyncStarted(event, correlationId);

      const duration = Date.now() - startTime;
      logger.info('PROJECT_SYNC_STARTED event processed successfully', {
        correlationId,
        projectId: event.projectId,
        syncId: event.syncId,
        duration,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to process PROJECT_SYNC_STARTED event', {
        correlationId,
        projectId: event.projectId,
        syncId: event.syncId,
        error: errorMessage,
        stack: errorStack,
        duration,
        eventData: {
          userId: event.userId,
          repositoryUrl: event.repositoryUrl,
          branch: event.branch,
          timestamp: event.timestamp
        }
      });
      
      // Don't throw error to prevent breaking other event handlers
      // Log and continue
    }
  }

  /**
   * Handle PROJECT_SYNC_COMPLETED event
   * Logs sync completion details and performs cleanup/notification tasks
   */
  private async handleProjectSyncCompleted(event: ProjectSyncCompletedEvent): Promise<void> {
    const correlationId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('PROJECT_SYNC_COMPLETED event received', {
        correlationId,
        eventType: PROJECT_EVENTS.PROJECT_SYNC_COMPLETED,
        projectId: event.projectId,
        userId: event.userId,
        syncId: event.syncId,
        status: event.status,
        documentsProcessed: event.documentsProcessed,
        documentsAdded: event.documentsAdded,
        documentsUpdated: event.documentsUpdated,
        documentsDeleted: event.documentsDeleted,
        duration: event.duration,
        timestamp: event.timestamp
      });

      // Log detailed sync results
      logger.info('Project sync completion details', {
        correlationId,
        projectId: event.projectId,
        syncId: event.syncId,
        results: {
          status: event.status,
          totalDocuments: event.documentsProcessed,
          changes: {
            added: event.documentsAdded,
            updated: event.documentsUpdated,
            deleted: event.documentsDeleted
          },
          performance: {
            duration: event.duration,
            documentsPerSecond: event.duration > 0 ? Math.round((event.documentsProcessed / event.duration) * 1000) : 0
          }
        },
        metadata: {
          errors: event.metadata?.errors,
          warnings: event.metadata?.warnings,
          repositoryInfo: event.metadata?.repositoryInfo
        }
      });

      // Log warnings if present
      if (event.metadata?.warnings && event.metadata.warnings.length > 0) {
        logger.warn('Project sync completed with warnings', {
          correlationId,
          projectId: event.projectId,
          syncId: event.syncId,
          warningsCount: event.metadata.warnings.length,
          warnings: event.metadata.warnings
        });
      }

      // Log errors if present
      if (event.metadata?.errors && event.metadata.errors.length > 0) {
        logger.error('Project sync completed with errors', {
          correlationId,
          projectId: event.projectId,
          syncId: event.syncId,
          errorsCount: event.metadata.errors.length,
          errors: event.metadata.errors,
          status: event.status
        });
      }

      // Perform any sync completed processing here
      // e.g., update project status, send notifications, cleanup resources, etc.
      await this.processSyncCompleted(event, correlationId);

      const duration = Date.now() - startTime;
      logger.info('PROJECT_SYNC_COMPLETED event processed successfully', {
        correlationId,
        projectId: event.projectId,
        syncId: event.syncId,
        duration,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to process PROJECT_SYNC_COMPLETED event', {
        correlationId,
        projectId: event.projectId,
        syncId: event.syncId,
        error: errorMessage,
        stack: errorStack,
        duration,
        eventData: {
          userId: event.userId,
          status: event.status,
          documentsProcessed: event.documentsProcessed,
          timestamp: event.timestamp
        }
      });
      
      // Don't throw error to prevent breaking other event handlers
      // Log and continue
    }
  }

  /**
   * Process sync started event - placeholder for business logic
   */
  private async processSyncStarted(event: ProjectSyncStartedEvent, correlationId: string): Promise<void> {
    logger.debug('Processing sync started event', {
      correlationId,
      projectId: event.projectId,
      syncId: event.syncId,
      action: 'sync_started_processing'
    });

    // TODO: Add business logic here
    // Examples:
    // - Update project status to 'syncing'
    // - Send notifications to project members
    // - Initialize monitoring/metrics collection
    // - Prepare resources for sync operation
  }

  /**
   * Process sync completed event - placeholder for business logic
   */
  private async processSyncCompleted(event: ProjectSyncCompletedEvent, correlationId: string): Promise<void> {
    logger.debug('Processing sync completed event', {
      correlationId,
      projectId: event.projectId,
      syncId: event.syncId,
      status: event.status,
      action: 'sync_completed_processing'
    });

    // TODO: Add business logic here
    // Examples:
    // - Update project status based on sync result
    // - Send completion notifications
    // - Update project metrics/statistics
    // - Cleanup temporary resources
    // - Trigger follow-up processes (indexing, analysis, etc.)
  }

  /**
   * Get service health status
   */
  getHealthStatus(): { initialized: boolean; listenersRegistered: boolean } {
    return {
      initialized: this.initialized,
      listenersRegistered: true // Always true after construction
    };
  }

  /**
   * Cleanup event listeners (for testing or shutdown)
   */
  cleanup(): void {
    const correlationId = uuidv4();
    
    logger.info('Cleaning up project event handlers', {
      correlationId,
      timestamp: new Date().toISOString()
    });

    // Note: EventBus doesn't currently support removing listeners
    // This would need to be implemented if cleanup is required
    
    this.initialized = false;
    
    logger.info('Project event handlers cleanup completed', {
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton instance
export const projectEventHandlers = new ProjectEventHandlersService();