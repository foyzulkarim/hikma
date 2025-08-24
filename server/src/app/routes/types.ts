import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export interface RouteModule {
  default: FastifyPluginAsync;
  prefix?: string;
  requiresAuth?: boolean;
  tags?: string[];
}

export interface RouteConfig {
  name: string;
  path: string;
  prefix: string;
  requiresAuth: boolean;
  tags: string[];
  plugin: FastifyPluginAsync;
}

export interface RouteGroup {
  name: string;
  prefix: string;
  requiresAuth: boolean;
  routes: RouteConfig[];
}

export interface RouteRegistryOptions {
  autoDiscovery?: boolean;
  routeDirectories?: string[];
  publicRoutes?: string[];
  privateRoutes?: string[];
}
