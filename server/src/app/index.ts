// Export main application server
export * from './server';

// Export application orchestrator
export { interfaceOrchestrator as appOrchestrator, InterfaceOrchestrator as AppOrchestrator } from './services/interface-orchestrator';
export type { 
  InterfaceRequest as AppRequest, 
  InterfaceResponse as AppResponse, 
  WebSocketMessage 
} from './services/interface-orchestrator';

// Export services
export * from './services';

// Export middleware
export * from './middleware';

// Export WebSocket handler
export * from './websocket';

// Export API routes
export * from './routes/health';
export * from './routes/query';
export * from './routes/monitoring';
