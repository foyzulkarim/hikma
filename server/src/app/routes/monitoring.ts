import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { monitoringOrchestrator } from '@/infrastructure/monitoring/services/monitoring-orchestrator';
import { logger } from '@/core/utils/logger';

// Monitoring routes
export async function monitoringRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check endpoint
  fastify.get('/health', {
    schema: {
      description: 'Get comprehensive health status of all services',
      tags: ['Monitoring'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            timestamp: { type: 'string' },
            services: { type: 'object' }
          }
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const healthStatus = await monitoringOrchestrator.getHealthStatus();
      
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;
      
      return reply.status(statusCode).send(healthStatus);
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      return reply.status(503).send({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Quick health check (cached)
  fastify.get('/health/quick', {
    schema: {
      description: 'Get cached health status for quick response',
      tags: ['Monitoring'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            timestamp: { type: 'string' }
          }
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const healthStatus = monitoringOrchestrator.getLastHealthStatus();
      
      if (!healthStatus) {
        return reply.status(503).send({
          status: 'unknown',
          error: 'No health data available',
          timestamp: new Date().toISOString()
        });
      }

      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;
      
      return reply.status(statusCode).send(healthStatus);
    } catch (error) {
      logger.error({ error }, 'Quick health check failed');
      return reply.status(503).send({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Metrics endpoint
  fastify.get('/metrics', {
    schema: {
      description: 'Get application metrics summary',
      tags: ['Monitoring'],
      response: {
        200: {
          type: 'object',
          description: 'Application metrics data'
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = monitoringOrchestrator.getMetricsSummary();
      return reply.send(metrics);
    } catch (error) {
      logger.error({ error }, 'Metrics retrieval failed');
      return reply.status(500).send({
        error: 'Failed to retrieve metrics',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Prometheus metrics endpoint
  fastify.get('/metrics/prometheus', {
    schema: {
      description: 'Get metrics in Prometheus format',
      tags: ['Monitoring'],
      response: {
        200: {
          type: 'string',
          description: 'Prometheus metrics in text format'
        },
        500: {
          type: 'string',
          description: 'Error message'
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const prometheusMetrics = monitoringOrchestrator.getPrometheusMetrics();
      return reply
        .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
        .send(prometheusMetrics);
    } catch (error) {
      logger.error({ error }, 'Prometheus metrics retrieval failed');
      return reply.status(500).send('# Failed to retrieve metrics\n');
    }
  });

  // Comprehensive monitoring status
  fastify.get('/status', {
    schema: {
      description: 'Get comprehensive monitoring status',
      tags: ['Monitoring'],
      response: {
        200: {
          type: 'object',
          description: 'Monitoring status data'
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const monitoringStatus = await monitoringOrchestrator.getMonitoringStatus();
      return reply.send(monitoringStatus);
    } catch (error) {
      logger.error({ error }, 'Monitoring status retrieval failed');
      return reply.status(500).send({
        error: 'Failed to retrieve monitoring status',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Active alerts endpoint
  fastify.get('/alerts', {
    schema: {
      description: 'Get all active alerts',
      tags: ['Monitoring'],
      response: {
        200: {
          type: 'object',
          properties: {
            alerts: { type: 'array', items: { type: 'object' } },
            count: { type: 'number' },
            timestamp: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const alerts = monitoringOrchestrator.getActiveAlerts();
      return reply.send({
        alerts,
        count: alerts.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error({ error }, 'Alerts retrieval failed');
      return reply.status(500).send({
        error: 'Failed to retrieve alerts',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Create manual alert endpoint
  fastify.post('/alerts', {
    schema: {
      description: 'Create a new manual alert',
      tags: ['Monitoring'],
      body: {
        type: 'object',
        required: ['name', 'severity', 'message'],
        properties: {
          name: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          message: { type: 'string' },
          source: { type: 'string' },
          metadata: { type: 'object' }
        }
      },
      response: {
        201: {
          type: 'object',
          description: 'Created alert object'
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        },
        503: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Body: {
      name: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      source?: string;
      metadata?: Record<string, any>;
    }
  }>, reply: FastifyReply) => {
    try {
      const { name, severity, message, source, metadata } = request.body;
      
      const alert = await monitoringOrchestrator.createAlert(
        name,
        severity,
        message,
        source || 'api',
        metadata
      );

      if (!alert) {
        return reply.status(503).send({
          error: 'Alerting is disabled',
          timestamp: new Date().toISOString()
        });
      }

      return reply.status(201).send(alert);
    } catch (error) {
      logger.error({ error }, 'Alert creation failed');
      return reply.status(500).send({
        error: 'Failed to create alert',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Resolve alert endpoint
  fastify.patch('/alerts/:alertId/resolve', {
    schema: {
      description: 'Resolve an active alert',
      tags: ['Monitoring'],
      params: {
        type: 'object',
        properties: {
          alertId: { type: 'string' }
        },
        required: ['alertId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            alertId: { type: 'string' },
            resolvedAt: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Params: { alertId: string }
  }>, reply: FastifyReply) => {
    try {
      const { alertId } = request.params;
      
      const resolved = await monitoringOrchestrator.resolveAlert(alertId);
      
      if (!resolved) {
        return reply.status(404).send({
          error: 'Alert not found',
          timestamp: new Date().toISOString()
        });
      }

      return reply.send({
        success: true,
        alertId,
        resolvedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error({ error }, 'Alert resolution failed');
      return reply.status(500).send({
        error: 'Failed to resolve alert',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Uptime endpoint
  fastify.get('/uptime', {
    schema: {
      description: 'Get application uptime information',
      tags: ['Monitoring'],
      response: {
        200: {
          type: 'object',
          properties: {
            uptime: { type: 'number' },
            uptimeFormatted: { type: 'string' },
            timestamp: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const uptime = monitoringOrchestrator.getUptime();
      return reply.send({
        uptime,
        uptimeFormatted: formatUptime(uptime),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error({ error }, 'Uptime retrieval failed');
      return reply.status(500).send({
        error: 'Failed to retrieve uptime',
        timestamp: new Date().toISOString()
      });
    }
  });
}

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}
