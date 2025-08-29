import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { RouteConfig, RouteGroup, RouteRegistryOptions } from './types';
import { logger } from '@/core/utils/logger';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

export class RouteRegistry {
  private routes: Map<string, RouteConfig> = new Map();
  private groups: Map<string, RouteGroup> = new Map();
  private options: RouteRegistryOptions;

  constructor(options: RouteRegistryOptions = {}) {
    this.options = {
      autoDiscovery: true,
      routeDirectories: [
        'src/app/routes',
        'src/domains/*/api'
      ],
      publicRoutes: [
        'health',
        'monitoring', 
        'auth'
      ],
      privateRoutes: [
        'query',
        'projects'
      ],
      ...options
    };
  }

  /**
   * Register a route manually
   */
  registerRoute(config: RouteConfig): void {
    if (this.routes.has(config.name)) {
      logger.warn(`Route ${config.name} already registered, overwriting`);
    }

    this.routes.set(config.name, config);
    logger.debug(`Registered route: ${config.name} at ${config.prefix}`);
  }

  /**
   * Register a route group
   */
  registerGroup(group: RouteGroup): void {
    if (this.groups.has(group.name)) {
      logger.warn(`Route group ${group.name} already registered, overwriting`);
    }

    this.groups.set(group.name, group);
    
    // Register individual routes from the group
    group.routes.forEach(route => {
      this.registerRoute(route);
    });

    logger.debug(`Registered route group: ${group.name} with ${group.routes.length} routes`);
  }

  /**
   * Auto-discover routes from configured directories
   */
  async discoverRoutes(): Promise<void> {
    if (!this.options.autoDiscovery) return;

    logger.info('Starting route auto-discovery...');
    let discoveredCount = 0;

    // Manually specify known route files with explicit configurations
    const knownRoutes = [
      {
        name: 'auth',
        path: 'src/domains/users/api/user.routes.ts',
        prefix: '/api/v1/auth',
        requiresAuth: false,
        exportName: 'userRoutes'
      },
      {
        name: 'health',
        path: 'src/app/routes/health.ts',
        prefix: '/api/v1/health',
        requiresAuth: false,
        exportName: 'healthRoutes'
      },
      {
        name: 'monitoring',
        path: 'src/app/routes/monitoring.ts',
        prefix: '/api/v1/monitoring',
        requiresAuth: false,
        exportName: 'monitoringRoutes'
      },
      {
        name: 'query',
        path: 'src/app/routes/query.ts',
        prefix: '/api/v1/query',
        requiresAuth: true,
        exportName: 'queryRoutes'
      },
      {
        name: 'projects',
        path: 'src/domains/projects/api/project.routes.ts',
        prefix: '/api/v1/projects',
        requiresAuth: true,
        exportName: 'projectRoutes'
      }      
    ];

    for (const routeInfo of knownRoutes) {
      try {
        if (fs.existsSync(routeInfo.path)) {
          await this.loadRouteFileWithConfig(routeInfo);
          discoveredCount++;
        }
      } catch (error) {
        logger.error({ route: routeInfo.name, error }, 'Failed to load route file');
      }
    }

    logger.info(`Auto-discovery completed: ${discoveredCount} route files discovered`);
  }

  /**
   * Load a single route file with explicit configuration
   */
  private async loadRouteFileWithConfig(routeInfo: any): Promise<void> {
    const fileUrl = pathToFileURL(path.resolve(routeInfo.path)).href;
    const module = await import(fileUrl);
    
    // Try to get the route plugin by export name
    let routePlugin: FastifyPluginAsync;
    
    if (module[routeInfo.exportName] && typeof module[routeInfo.exportName] === 'function') {
      routePlugin = module[routeInfo.exportName];
    } else if (module.default && typeof module.default === 'function') {
      routePlugin = module.default;
    } else {
      // Try to find any exported function
      const exportedFunction = Object.values(module).find(
        (exp): exp is FastifyPluginAsync => typeof exp === 'function'
      );
      
      if (!exportedFunction) {
        throw new Error(`No valid route function found in module: ${routeInfo.path}`);
      }
      
      routePlugin = exportedFunction;
    }

    const config: RouteConfig = {
      name: routeInfo.name,
      path: routeInfo.path,
      prefix: routeInfo.prefix,
      requiresAuth: routeInfo.requiresAuth,
      tags: [routeInfo.name],
      plugin: routePlugin
    };

    this.registerRoute(config);
  }

  /**
   * Load a single route file (legacy method)
   */
  private async loadRouteFile(filePath: string): Promise<void> {
    const fileUrl = pathToFileURL(path.resolve(filePath)).href;
    const module = await import(fileUrl);
    
    // Handle different export patterns
    let routePlugin: FastifyPluginAsync;
    let routeConfig: Partial<RouteConfig> = {};

    if (module.default && typeof module.default === 'function') {
      routePlugin = module.default;
    } else if (module.routes && typeof module.routes === 'function') {
      routePlugin = module.routes;
    } else {
      // Try to find any exported function
      const exportedFunction = Object.values(module).find(
        (exp): exp is FastifyPluginAsync => typeof exp === 'function'
      );
      
      if (!exportedFunction) {
        throw new Error('No valid route function found in module');
      }
      
      routePlugin = exportedFunction;
    }

    // Extract route name from file path
    const fileName = path.basename(filePath, path.extname(filePath));
    const routeName = fileName.replace('.routes', '');
    
    // Determine if route should be public or private
    const isPublic = this.options.publicRoutes?.includes(routeName) || false;
    const isPrivate = this.options.privateRoutes?.includes(routeName) || false;
    
    // Extract prefix from file path or use route name
    let prefix = `/${routeName}`;
    
    // Handle domain-specific routes (e.g., src/domains/projects/api/project.routes.ts)
    const pathParts = filePath.split(path.sep);
    const domainsIndex = pathParts.findIndex(part => part === 'domains');
    if (domainsIndex !== -1 && pathParts[domainsIndex + 1]) {
      const domainName = pathParts[domainsIndex + 1];
      prefix = `/${domainName}`;
    }

    const config: RouteConfig = {
      name: routeName,
      path: filePath,
      prefix: `/api/v1${prefix}`,
      requiresAuth: isPrivate || (!isPublic && !routeName.includes('health') && !routeName.includes('monitoring')),
      tags: [routeName],
      plugin: routePlugin,
      ...routeConfig
    };

    this.registerRoute(config);
  }

  /**
   * Get all registered routes
   */
  getRoutes(): RouteConfig[] {
    return Array.from(this.routes.values());
  }

  /**
   * Get routes by group (public/private)
   */
  getPublicRoutes(): RouteConfig[] {
    return this.getRoutes().filter(route => !route.requiresAuth);
  }

  getPrivateRoutes(): RouteConfig[] {
    return this.getRoutes().filter(route => route.requiresAuth);
  }

  /**
   * Get route by name
   */
  getRoute(name: string): RouteConfig | undefined {
    return this.routes.get(name);
  }

  /**
   * Register all routes with Fastify instance
   */
  async registerWithFastify(fastify: FastifyInstance): Promise<void> {
    logger.info('Registering routes with Fastify...');
    
    const publicRoutes = this.getPublicRoutes();
    const privateRoutes = this.getPrivateRoutes();

    logger.info(`Registering ${publicRoutes.length} public routes`);
    for (const route of publicRoutes) {
      await this.registerSingleRoute(fastify, route, false);
    }

    logger.info(`Registering ${privateRoutes.length} private routes`);
    for (const route of privateRoutes) {
      await this.registerSingleRoute(fastify, route, true);
    }

    logger.info('All routes registered successfully');
  }

  /**
   * Register a single route with authentication if required
   */
  private async registerSingleRoute(
    fastify: FastifyInstance, 
    route: RouteConfig, 
    requiresAuth: boolean
  ): Promise<void> {
    try {
      const options = {
        prefix: route.prefix
      };

      if (requiresAuth) {
        // Create a wrapper plugin that adds authentication
        const authenticatedPlugin: FastifyPluginAsync = async (instance) => {
          // Add authentication hook for all routes in this plugin
          instance.addHook('preHandler', instance.authenticate);
          
          // Register the actual route plugin
          await instance.register(route.plugin);
        };

        await fastify.register(authenticatedPlugin, options);
      } else {
        await fastify.register(route.plugin, options);
      }

      logger.debug(`Registered ${requiresAuth ? 'private' : 'public'} route: ${route.name} at ${route.prefix}`);
    } catch (error) {
      logger.error({ route: route.name, error }, 'Failed to register route');
      throw error;
    }
  }

  /**
   * Get route summary for debugging
   */
  getSummary(): any {
    const routes = this.getRoutes();
    const publicCount = this.getPublicRoutes().length;
    const privateCount = this.getPrivateRoutes().length;

    return {
      total: routes.length,
      public: publicCount,
      private: privateCount,
      routes: routes.map(route => ({
        name: route.name,
        prefix: route.prefix,
        requiresAuth: route.requiresAuth,
        tags: route.tags
      }))
    };
  }
}
