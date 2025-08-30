import { eventBus } from '@/shared/events/event-bus';
import { ErrorOccurredEvent } from '@/shared/events/event-types';
import { logger } from '@/core/utils/logger';
import { healthMonitor } from '../health/health-monitor';
import { metricsCollector } from '../metrics/metrics-collector';

export interface Alert {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  source: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  duration: number; // in seconds
  enabled: boolean;
  cooldown: number; // in seconds
  lastTriggered?: number;
}

export interface AlertChannel {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'log';
  config: Record<string, any>;
  enabled: boolean;
}

export class AlertManager {
  private initialized = false;
  private activeAlerts = new Map<string, Alert>();
  private alertRules = new Map<string, AlertRule>();
  private alertChannels = new Map<string, AlertChannel>();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupEventListeners();
    this.initializeDefaultRules();
  }

  private setupEventListeners(): void {
    // Listen for errors to potentially trigger alerts
    eventBus.on<ErrorOccurredEvent>('error-occurred', this.handleErrorOccurred.bind(this));
  }

  private initializeDefaultRules(): void {
    // High error rate alert
    this.alertRules.set('high_error_rate', {
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: 'error_rate > threshold',
      severity: 'high',
      threshold: 10, // 10% error rate
      duration: 300, // 5 minutes
      enabled: true,
      cooldown: 900 // 15 minutes
    });

    // High memory usage alert
    this.alertRules.set('high_memory_usage', {
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      condition: 'memory_usage_percent > threshold',
      severity: 'medium',
      threshold: 85, // 85% memory usage
      duration: 600, // 10 minutes
      enabled: true,
      cooldown: 1800 // 30 minutes
    });

    // Service unhealthy alert
    this.alertRules.set('service_unhealthy', {
      id: 'service_unhealthy',
      name: 'Service Unhealthy',
      condition: 'service_status == unhealthy',
      severity: 'critical',
      threshold: 1,
      duration: 60, // 1 minute
      enabled: true,
      cooldown: 300 // 5 minutes
    });

    // Slow query response time alert
    this.alertRules.set('slow_queries', {
      id: 'slow_queries',
      name: 'Slow Query Response Time',
      condition: 'avg_response_time > threshold',
      severity: 'medium',
      threshold: 5000, // 5 seconds
      duration: 300, // 5 minutes
      enabled: true,
      cooldown: 600 // 10 minutes
    });

    // Default log channel
    this.alertChannels.set('default_log', {
      id: 'default_log',
      type: 'log',
      config: { level: 'warn' },
      enabled: true
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Alert Manager...');

      // Start periodic alert checking
      this.startAlertChecking();

      this.initialized = true;
      logger.info('Alert Manager initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Alert Manager');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Alert Manager...');

      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }

      this.activeAlerts.clear();

      this.initialized = false;
      logger.info('Alert Manager cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Alert Manager');
    }
  }

  // Create a new alert
  async createAlert(
    name: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    source: string,
    metadata?: Record<string, any>
  ): Promise<Alert> {
    const alert: Alert = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      severity,
      message,
      timestamp: new Date().toISOString(),
      source,
      resolved: false,
      metadata
    };

    this.activeAlerts.set(alert.id, alert);

    logger.warn({ 
      alertId: alert.id,
      name: alert.name,
      severity: alert.severity,
      source: alert.source 
    }, `Alert created: ${alert.message}`);

    // Send alert through configured channels
    await this.sendAlert(alert);

    return alert;
  }

  // Resolve an alert
  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();

    logger.info({ 
      alertId: alert.id,
      name: alert.name,
      duration: Date.now() - new Date(alert.timestamp).getTime()
    }, 'Alert resolved');

    return true;
  }

  // Get all active alerts
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  // Get alert history
  getAlertHistory(limit: number = 100): Alert[] {
    return Array.from(this.activeAlerts.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Add alert rule
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info({ ruleId: rule.id, name: rule.name }, 'Alert rule added');
  }

  // Remove alert rule
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      logger.info({ ruleId }, 'Alert rule removed');
    }
    return removed;
  }

  // Add alert channel
  addAlertChannel(channel: AlertChannel): void {
    this.alertChannels.set(channel.id, channel);
    logger.info({ channelId: channel.id, type: channel.type }, 'Alert channel added');
  }

  // Remove alert channel
  removeAlertChannel(channelId: string): boolean {
    const removed = this.alertChannels.delete(channelId);
    if (removed) {
      logger.info({ channelId }, 'Alert channel removed');
    }
    return removed;
  }

  private startAlertChecking(): void {
    // Check alert rules every 30 seconds
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkAlertRules();
      } catch (error) {
        logger.error({ error }, 'Alert rule checking failed');
      }
    }, 30000);
  }

  private async checkAlertRules(): Promise<void> {
    const healthStatus = await healthMonitor.getHealthStatus();
    const metrics = metricsCollector.getMetricsSummary();
    const now = Date.now();

    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && (now - rule.lastTriggered) < (rule.cooldown * 1000)) {
        continue;
      }

      let shouldTrigger = false;
      let alertMessage = '';

      switch (rule.id) {
        case 'high_error_rate':
          if (metrics.system.errorRate > rule.threshold) {
            shouldTrigger = true;
            alertMessage = `Error rate is ${metrics.system.errorRate.toFixed(2)}%, exceeding threshold of ${rule.threshold}%`;
          }
          break;

        case 'high_memory_usage':
          const memoryPercent = (metrics.system.memoryUsage / (1024 * 1024 * 1024)) * 100; // Convert to GB percentage
          if (memoryPercent > rule.threshold) {
            shouldTrigger = true;
            alertMessage = `Memory usage is ${memoryPercent.toFixed(2)}%, exceeding threshold of ${rule.threshold}%`;
          }
          break;

        case 'service_unhealthy':
          if (healthStatus.status === 'unhealthy') {
            shouldTrigger = true;
            alertMessage = `System status is ${healthStatus.status}`;
          }
          break;

        case 'slow_queries':
          if (metrics.queries.averageResponseTime > rule.threshold) {
            shouldTrigger = true;
            alertMessage = `Average query response time is ${metrics.queries.averageResponseTime.toFixed(0)}ms, exceeding threshold of ${rule.threshold}ms`;
          }
          break;
      }

      if (shouldTrigger) {
        await this.createAlert(
          rule.name,
          rule.severity,
          alertMessage,
          'alert-manager',
          { ruleId: rule.id, threshold: rule.threshold }
        );

        // Update last triggered time
        rule.lastTriggered = now;
      }
    }
  }

  private async sendAlert(alert: Alert): Promise<void> {
    for (const channel of this.alertChannels.values()) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'log':
            this.sendLogAlert(alert, channel);
            break;
          case 'email':
            await this.sendEmailAlert(alert, channel);
            break;
          case 'slack':
            await this.sendSlackAlert(alert, channel);
            break;
          case 'webhook':
            await this.sendWebhookAlert(alert, channel);
            break;
        }
      } catch (error) {
        logger.error({ 
          error, 
          alertId: alert.id, 
          channelId: channel.id 
        }, 'Failed to send alert through channel');
      }
    }
  }

  private sendLogAlert(alert: Alert, channel: AlertChannel): void {
    const logLevel = channel.config.level || 'warn';
    const logMessage = `[ALERT] ${alert.name}: ${alert.message}`;
    
    switch (logLevel) {
      case 'error':
        logger.error({ alert }, logMessage);
        break;
      case 'warn':
        logger.warn({ alert }, logMessage);
        break;
      case 'info':
        logger.info({ alert }, logMessage);
        break;
      default:
        logger.warn({ alert }, logMessage);
    }
  }

  private async sendEmailAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    // Email implementation would go here
    logger.debug({ alertId: alert.id, channelId: channel.id }, 'Email alert sent (placeholder)');
  }

  private async sendSlackAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    // Slack implementation would go here
    logger.debug({ alertId: alert.id, channelId: channel.id }, 'Slack alert sent (placeholder)');
  }

  private async sendWebhookAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    // Webhook implementation would go here
    logger.debug({ alertId: alert.id, channelId: channel.id }, 'Webhook alert sent (placeholder)');
  }

  private async handleErrorOccurred(event: ErrorOccurredEvent): Promise<void> {
    // Create alert for critical errors
    if (event.severity === 'high' || event.severity === 'critical') {
      await this.createAlert(
        'Critical Error Occurred',
        event.severity as 'high',
        `Error in ${event.context?.component || 'unknown'}: ${event.error.message}`,
        'error-handler',
        { 
          component: event.context?.component,
          errorType: event.error.name,
          context: event.context
        }
      );
    }
  }

  // Get alert statistics
  getAlertStats(): {
    total: number;
    active: number;
    resolved: number;
    bySeverity: Record<string, number>;
  } {
    const alerts = Array.from(this.activeAlerts.values());
    const active = alerts.filter(a => !a.resolved);
    const resolved = alerts.filter(a => a.resolved);

    const bySeverity = alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: alerts.length,
      active: active.length,
      resolved: resolved.length,
      bySeverity
    };
  }
}

// Export singleton instance
export const alertManager = new AlertManager();
