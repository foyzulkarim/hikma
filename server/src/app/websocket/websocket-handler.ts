import { FastifyInstance } from 'fastify';
import { interfaceOrchestrator } from '../services/interface-orchestrator';
import type { InterfaceRequest, WebSocketMessage } from '../services/interface-orchestrator';
import { logger } from '@/core/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface WebSocketConnection {
  id: string;
  socket: any; // WebSocket connection
  userId?: string;
  sessionId: string;
  lastActivity: Date;
  isAlive: boolean;
}

export class WebSocketHandler {
  private connections = new Map<string, WebSocketConnection>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  async registerRoutes(fastify: FastifyInstance): Promise<void> {
    // Register WebSocket route
    await fastify.register(require('@fastify/websocket'));

    const self = this;
    fastify.register(async function (fastify) {
      (fastify as any).get('/ws', { websocket: true }, (connection: any, req: any) => {
        self.handleConnection(connection, req);
      });
    });
  }

  private handleConnection(connection: any, request: any): void {
    const connectionId = uuidv4();
    const sessionId = request.headers['x-session-id'] || uuidv4();
    const userId = request.headers['x-user-id'];

    const wsConnection: WebSocketConnection = {
      id: connectionId,
      socket: connection,
      userId,
      sessionId,
      lastActivity: new Date(),
      isAlive: true
    };

    this.connections.set(connectionId, wsConnection);
    interfaceOrchestrator.addConnection(connectionId, wsConnection);

    logger.info({ 
      connectionId, 
      sessionId, 
      userId,
      totalConnections: this.connections.size 
    }, 'WebSocket connection established');

    // Send welcome message
    this.sendMessage(connectionId, {
      id: uuidv4(),
      type: 'status',
      payload: {
        status: 'connected',
        connectionId,
        sessionId
      },
      timestamp: new Date().toISOString()
    });

    // Handle incoming messages
    connection.socket.on('message', (data: Buffer) => {
      this.handleMessage(connectionId, data);
    });

    // Handle connection close
    connection.socket.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    // Handle connection error
    connection.socket.on('error', (error: Error) => {
      logger.error({ error, connectionId }, 'WebSocket connection error');
      this.handleDisconnection(connectionId);
    });

    // Handle pong responses for heartbeat
    connection.socket.on('pong', () => {
      const conn = this.connections.get(connectionId);
      if (conn) {
        conn.isAlive = true;
        conn.lastActivity = new Date();
      }
    });
  }

  private async handleMessage(connectionId: string, data: Buffer): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn({ connectionId }, 'Message received for unknown connection');
      return;
    }

    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      connection.lastActivity = new Date();

      logger.debug({ 
        connectionId, 
        messageType: message.type,
        messageId: message.id 
      }, 'WebSocket message received');

      // Create interface request
      const interfaceRequest: InterfaceRequest = {
        id: message.id,
        type: 'websocket',
        endpoint: '/ws',
        body: message,
        user: connection.userId ? { id: connection.userId } : undefined,
        session: { id: connection.sessionId, startTime: new Date().toISOString() }
      };

      // Process with interface orchestrator
      const response = await interfaceOrchestrator.processRequest(interfaceRequest);

      // Send response back to client
      this.sendMessage(connectionId, {
        id: message.id,
        type: 'response',
        payload: response.body,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({ error, connectionId }, 'Failed to process WebSocket message');
      
      this.sendMessage(connectionId, {
        id: uuidv4(),
        type: 'error',
        payload: {
          error: 'Failed to process message',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      logger.info({ 
        connectionId, 
        sessionId: connection.sessionId,
        userId: connection.userId,
        totalConnections: this.connections.size - 1 
      }, 'WebSocket connection closed');

      interfaceOrchestrator.removeConnection(connectionId);
      this.connections.delete(connectionId);
    }
  }

  private sendMessage(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.socket.readyState === 1) { // OPEN
      try {
        connection.socket.send(JSON.stringify(message));
      } catch (error) {
        logger.error({ error, connectionId }, 'Failed to send WebSocket message');
        this.handleDisconnection(connectionId);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.connections.forEach((connection, connectionId) => {
        if (!connection.isAlive) {
          logger.debug({ connectionId }, 'WebSocket connection failed heartbeat');
          this.handleDisconnection(connectionId);
          return;
        }

        connection.isAlive = false;
        if (connection.socket.readyState === 1) { // OPEN
          connection.socket.ping();
        }
      });
    }, 30000); // 30 seconds
  }

  // Broadcast message to all connections
  broadcast(message: WebSocketMessage, filter?: (connection: WebSocketConnection) => boolean): void {
    this.connections.forEach((connection, connectionId) => {
      if (!filter || filter(connection)) {
        this.sendMessage(connectionId, message);
      }
    });
  }

  // Send message to specific user
  sendToUser(userId: string, message: WebSocketMessage): void {
    this.connections.forEach((connection, connectionId) => {
      if (connection.userId === userId) {
        this.sendMessage(connectionId, message);
      }
    });
  }

  // Send message to specific session
  sendToSession(sessionId: string, message: WebSocketMessage): void {
    this.connections.forEach((connection, connectionId) => {
      if (connection.sessionId === sessionId) {
        this.sendMessage(connectionId, message);
      }
    });
  }

  // Get connection statistics
  getStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    activeConnections: number;
  } {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    return {
      totalConnections: this.connections.size,
      authenticatedConnections: Array.from(this.connections.values())
        .filter(conn => conn.userId).length,
      activeConnections: Array.from(this.connections.values())
        .filter(conn => conn.lastActivity > fiveMinutesAgo).length
    };
  }

  // Cleanup method
  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections
    this.connections.forEach((connection, connectionId) => {
      try {
        connection.socket.close();
      } catch (error) {
        logger.warn({ error, connectionId }, 'Failed to close WebSocket connection');
      }
    });

    this.connections.clear();
  }
}

// Export singleton instance
export const webSocketHandler = new WebSocketHandler();
