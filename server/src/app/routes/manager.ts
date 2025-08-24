import { FastifyInstance } from 'fastify';
import { RouteRegistry } from './registry';
import { publicRoutesPlugin } from './groups/public';
import { privateRoutesPlugin } from './groups/private';
import { logger } from '@/core/utils/logger';

/**
 * Central route manager that coordinates all route registration
 * Provides a clean interface for the server to manage routes
 */
export class RouteManager {
  private registry: RouteRegistry;
  private initialized = false;

  constructor() {
    this.registry = new RouteRegistry({
      autoDiscovery: true,
      routeDirectories: [
        'src/app/routes',
        'src/domains/*/api'
      ],
      publicRoutes: [
        'health',
        'monitoring',
        'user' // auth endpoints
      ],
      privateRoutes: [
        'query',
        'projects'
      ]
    });
  }

  /**
   * Initialize the route manager
   * This should be called once during application startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('RouteManager already initialized');
      return;
    }

    logger.info('Initializing RouteManager...');

    try {
      // Discover routes automatically
      await this.registry.discoverRoutes();

      this.initialized = true;
      logger.info('RouteManager initialized successfully');
      
      // Log route summary
      const summary = this.registry.getSummary();
      logger.info(summary, 'Route discovery summary');
      
    } catch (error) {
      logger.error({ error }, 'Failed to initialize RouteManager');
      throw error;
    }
  }

  /**
   * Register all routes with the Fastify instance
   */
  async registerRoutes(fastify: FastifyInstance): Promise<void> {
    if (!this.initialized) {
      throw new Error('RouteManager not initialized. Call initialize() first.');
    }

    logger.info('Starting route registration...');

    try {
      // Register root-level public routes first (no prefix)
      await fastify.register(publicRoutesPlugin);
      
      // Register root-level private routes (no prefix, but with auth)
      await fastify.register(privateRoutesPlugin);

      // Register discovered routes through registry
      await this.registry.registerWithFastify(fastify);

      // Register not found handler
      fastify.setNotFoundHandler(async (request, reply) => {
        reply.status(404).send({
          error: 'Not Found',
          message: `Route ${request.method} ${request.url} not found`,
          statusCode: 404,
          correlationId: request.id,
        });
      });

      logger.info('All routes registered successfully');
      
    } catch (error) {
      logger.error({ error }, 'Failed to register routes');
      throw error;
    }
  }

  /**
   * Get route registry for inspection
   */
  getRegistry(): RouteRegistry {
    return this.registry;
  }

  /**
   * Get route summary for debugging
   */
  getRouteSummary(): any {
    if (!this.initialized) {
      return { error: 'RouteManager not initialized' };
    }

    return this.registry.getSummary();
  }

  /**
   * Manually register additional routes
   */
  async registerAdditionalRoute(
    fastify: FastifyInstance,
    routeName: string,
    routePlugin: any,
    options: {
      prefix?: string;
      requiresAuth?: boolean;
      tags?: string[];
    } = {}
  ): Promise<void> {
    const {
      prefix = `/api/v1/${routeName}`,
      requiresAuth = false,
      tags = [routeName]
    } = options;

    try {
      if (requiresAuth) {
        // Create authenticated wrapper
        const authenticatedPlugin = async (instance: FastifyInstance) => {
          instance.addHook('preHandler', instance.authenticate);
          await instance.register(routePlugin);
        };

        await fastify.register(authenticatedPlugin, { prefix });
      } else {
        await fastify.register(routePlugin, { prefix });
      }

      logger.info(`Manually registered route: ${routeName} at ${prefix}`);
    } catch (error) {
      logger.error({ routeName, error }, 'Failed to register additional route');
      throw error;
    }
  }
}

// Singleton instance
export const routeManager = new RouteManager();
