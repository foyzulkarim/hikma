import { eventBus } from '@/shared/events/event-bus';
import { logger } from '@/core/utils/logger';
import { healthMonitor } from '../health/health-monitor';
import { metricsCollector } from '../metrics/metrics-collector';
import { alertManager } from '../alerting/alert-manager';
import type { HealthStatus } from '../health/health-monitor';
import type { MetricsSummary } from '../metrics/metrics-collector';
import type { Alert } from '../alerting/alert-manager';

export interface MonitoringStatus {
  health: HealthStatus;
  metrics: MetricsSummary;
  alerts: {
    active: Alert[];
    stats: {
      total: number;
      active: number;
      resolved: number;
      bySeverity: Record<string, number>;
    };
  };
  monitoring: {
    healthMonitor: boolean;
    metricsCollector: boolean;
    alertManager: boolean;
  };
}

export interface MonitoringConfig {
  healthCheck: {
    enabled: boolean;
    interval: number; // seconds
  };
  metrics: {
    enabled: boolean;
    retention: number; // hours
  };
  alerts: {
    enabled: boolean;
    defaultChannels: string[];
  };
}

export class MonitoringOrchestrator {
  private initialized = false;
  private config: MonitoringConfig;
  private statusCheckInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      healthCheck: {
        enabled: true,
        interval: 30
      },
      metrics: {
        enabled: true,
        retention: 24
      },
      alerts: {
        enabled: true,
        defaultChannels: ['default_log']
      },
      ...config
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Monitoring Orchestrator...');

      // Initialize monitoring services in order
      if (this.config.healthCheck.enabled) {
        await healthMonitor.initialize();
        logger.info('Health Monitor initialized');
      }

      if (this.config.metrics.enabled) {
        await metricsCollector.initialize();
        logger.info('Metrics Collector initialized');
      }

      if (this.config.alerts.enabled) {
        await alertManager.initialize();
        logger.info('Alert Manager initialized');
      }

      // Start periodic status monitoring
      this.startStatusMonitoring();

      this.initialized = true;
      logger.info('Monitoring Orchestrator initialized successfully');

      // Emit initialization complete event
      eventBus.emit('monitoring-initialized', {
        timestamp: new Date().toISOString(),
        services: {
          healthMonitor: this.config.healthCheck.enabled,
          metricsCollector: this.config.metrics.enabled,
          alertManager: this.config.alerts.enabled
        }
      });

    } catch (error) {
      logger.error({ error }, 'Failed to initialize Monitoring Orchestrator');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Monitoring Orchestrator...');

      // Stop status monitoring
      if (this.statusCheckInterval) {
        clearInterval(this.statusCheckInterval);
        this.statusCheckInterval = null;
      }

      // Cleanup services in reverse order
      if (this.config.alerts.enabled) {
        await alertManager.cleanup();
      }

      if (this.config.metrics.enabled) {
        await metricsCollector.cleanup();
      }

      if (this.config.healthCheck.enabled) {
        await healthMonitor.cleanup();
      }

      this.initialized = false;
      logger.info('Monitoring Orchestrator cleaned up successfully');

    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Monitoring Orchestrator');
    }
  }

  // Get comprehensive monitoring status
  async getMonitoringStatus(): Promise<MonitoringStatus> {
    try {
      const [health, metrics, alertStats] = await Promise.all([
        this.config.healthCheck.enabled ? healthMonitor.getHealthStatus() : this.getDefaultHealth(),
        this.config.metrics.enabled ? metricsCollector.getMetricsSummary() : this.getDefaultMetrics(),
        this.config.alerts.enabled ? alertManager.getAlertStats() : this.getDefaultAlertStats()
      ]);

      const activeAlerts = this.config.alerts.enabled ? alertManager.getActiveAlerts() : [];

      return {
        health,
        metrics,
        alerts: {
          active: activeAlerts,
          stats: alertStats
        },
        monitoring: {
          healthMonitor: this.config.healthCheck.enabled && healthMonitor.isHealthy(),
          metricsCollector: this.config.metrics.enabled,
          alertManager: this.config.alerts.enabled
        }
      };

    } catch (error) {
      logger.error({ error }, 'Failed to get monitoring status');
      throw error;
    }
  }

  // Get health status only (faster)
  async getHealthStatus(): Promise<HealthStatus> {
    if (!this.config.healthCheck.enabled) {
      return this.getDefaultHealth();
    }

    return healthMonitor.getHealthStatus();
  }

  // Get cached health status (fastest)
  getLastHealthStatus(): HealthStatus | null {
    if (!this.config.healthCheck.enabled) {
      return null;
    }

    return healthMonitor.getLastHealthStatus();
  }

  // Get metrics summary
  getMetricsSummary(): MetricsSummary {
    if (!this.config.metrics.enabled) {
      return this.getDefaultMetrics();
    }

    return metricsCollector.getMetricsSummary();
  }

  // Get Prometheus metrics
  getPrometheusMetrics(): string {
    if (!this.config.metrics.enabled) {
      return '';
    }

    return metricsCollector.getPrometheusMetrics();
  }

  // Get active alerts
  getActiveAlerts(): Alert[] {
    if (!this.config.alerts.enabled) {
      return [];
    }

    return alertManager.getActiveAlerts();
  }

  // Create manual alert
  async createAlert(
    name: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    source: string = 'manual',
    metadata?: Record<string, any>
  ): Promise<Alert | null> {
    if (!this.config.alerts.enabled) {
      logger.warn('Alerts are disabled, cannot create alert');
      return null;
    }

    return alertManager.createAlert(name, severity, message, source, metadata);
  }

  // Resolve alert
  async resolveAlert(alertId: string): Promise<boolean> {
    if (!this.config.alerts.enabled) {
      return false;
    }

    return alertManager.resolveAlert(alertId);
  }

  // Update configuration
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info({ config: this.config }, 'Monitoring configuration updated');
  }

  // Check if monitoring is healthy
  isMonitoringHealthy(): boolean {
    if (!this.initialized) {
      return false;
    }

    const healthStatus = healthMonitor.getLastHealthStatus();
    return healthStatus?.status === 'healthy';
  }

  // Get uptime
  getUptime(): number {
    return healthMonitor.getUptime();
  }

  private startStatusMonitoring(): void {
    // Periodic status check every 5 minutes
    this.statusCheckInterval = setInterval(async () => {
      try {
        const status = await this.getMonitoringStatus();
        
        // Log summary status
        logger.debug({
          healthStatus: status.health.status,
          activeAlerts: status.alerts.active.length,
          totalQueries: status.metrics.queries.total,
          activeSessions: status.metrics.users.activeSessions
        }, 'Monitoring status check');

        // Emit status event for other services
        eventBus.emit('monitoring-status-check', {
          timestamp: new Date().toISOString(),
          status: status.health.status,
          activeAlerts: status.alerts.active.length,
          metrics: {
            queries: status.metrics.queries.total,
            sessions: status.metrics.users.activeSessions,
            errors: status.metrics.system.errorRate
          }
        });

      } catch (error) {
        logger.error({ error }, 'Monitoring status check failed');
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  private getDefaultHealth(): HealthStatus {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime() * 1000,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {},
      system: {
        memory: { used: 0, total: 0, percentage: 0 },
        cpu: { usage: 0 },
        disk: { used: 0, total: 0, percentage: 0 }
      },
      dependencies: {
        database: { status: 'healthy', lastCheck: new Date().toISOString() },
        redis: { status: 'healthy', lastCheck: new Date().toISOString() },
        vectorStore: { status: 'healthy', lastCheck: new Date().toISOString() },
        graphDatabase: { status: 'healthy', lastCheck: new Date().toISOString() },
        llmService: { status: 'healthy', lastCheck: new Date().toISOString() }
      }
    };
  }

  private getDefaultMetrics(): MetricsSummary {
    return {
      queries: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        byIntent: {}
      },
      users: {
        activeSessions: 0,
        totalSessions: 0,
        averageSessionDuration: 0
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: 0,
        errorRate: 0
      },
      ingestion: {
        documentsProcessed: 0,
        syncJobsCompleted: 0,
        averageProcessingTime: 0
      }
    };
  }

  private getDefaultAlertStats(): {
    total: number;
    active: number;
    resolved: number;
    bySeverity: Record<string, number>;
  } {
    return {
      total: 0,
      active: 0,
      resolved: 0,
      bySeverity: {}
    };
  }
}

// Export singleton instance
export const monitoringOrchestrator = new MonitoringOrchestrator();
