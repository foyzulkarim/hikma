import { eventBus } from '@/shared/events/event-bus';
import { 
  QueryProcessedEvent, 
  ErrorOccurredEvent,
  UserSessionStartedEvent,
  UserSessionEndedEvent,
  DocumentIngestedEvent,
  SyncJobCompletedEvent
} from '@/shared/events/event-types';
import { logger } from '@/core/utils/logger';

export interface Metric {
  name: string;
  value: number;
  timestamp: string;
  labels?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface MetricsSummary {
  queries: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    byIntent: Record<string, number>;
  };
  users: {
    activeSessions: number;
    totalSessions: number;
    averageSessionDuration: number;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    errorRate: number;
  };
  ingestion: {
    documentsProcessed: number;
    syncJobsCompleted: number;
    averageProcessingTime: number;
  };
}

export class MetricsCollector {
  private initialized = false;
  private metrics = new Map<string, Metric[]>();
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private activeSessions = new Set<string>();
  private sessionStartTimes = new Map<string, number>();

  constructor() {
    this.setupEventListeners();
    this.initializeMetrics();
  }

  private setupEventListeners(): void {
    // Listen for various events to collect metrics
    eventBus.on<QueryProcessedEvent>('query-processed', this.handleQueryProcessed.bind(this));
    eventBus.on<ErrorOccurredEvent>('error-occurred', this.handleErrorOccurred.bind(this));
    eventBus.on<UserSessionStartedEvent>('user-session-started', this.handleSessionStarted.bind(this));
    eventBus.on<UserSessionEndedEvent>('user-session-ended', this.handleSessionEnded.bind(this));
    eventBus.on<DocumentIngestedEvent>('document-ingested', this.handleDocumentIngested.bind(this));
    eventBus.on<SyncJobCompletedEvent>('sync-job-completed', this.handleSyncJobCompleted.bind(this));
  }

  private initializeMetrics(): void {
    // Initialize base counters
    this.counters.set('queries_total', 0);
    this.counters.set('queries_successful', 0);
    this.counters.set('queries_failed', 0);
    this.counters.set('errors_total', 0);
    this.counters.set('sessions_total', 0);
    this.counters.set('documents_ingested', 0);
    this.counters.set('sync_jobs_completed', 0);

    // Initialize gauges
    this.gauges.set('active_sessions', 0);
    this.gauges.set('memory_usage_bytes', 0);
    this.gauges.set('cpu_usage_percent', 0);

    // Initialize histograms
    this.histograms.set('query_response_time_ms', []);
    this.histograms.set('session_duration_ms', []);
    this.histograms.set('document_processing_time_ms', []);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Metrics Collector...');

      // Start periodic system metrics collection
      this.startSystemMetricsCollection();

      this.initialized = true;
      logger.info('Metrics Collector initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Metrics Collector');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Metrics Collector...');

      // Clear all metrics
      this.metrics.clear();
      this.counters.clear();
      this.gauges.clear();
      this.histograms.clear();
      this.activeSessions.clear();
      this.sessionStartTimes.clear();

      this.initialized = false;
      logger.info('Metrics Collector cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Metrics Collector');
    }
  }

  // Increment a counter metric
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const currentValue = this.counters.get(name) || 0;
    this.counters.set(name, currentValue + value);

    this.recordMetric({
      name,
      value: currentValue + value,
      timestamp: new Date().toISOString(),
      labels,
      type: 'counter'
    });
  }

  // Set a gauge metric
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.gauges.set(name, value);

    this.recordMetric({
      name,
      value,
      timestamp: new Date().toISOString(),
      labels,
      type: 'gauge'
    });
  }

  // Record a histogram value
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    
    // Keep only last 1000 values to prevent memory issues
    if (values.length > 1000) {
      values.shift();
    }
    
    this.histograms.set(name, values);

    this.recordMetric({
      name,
      value,
      timestamp: new Date().toISOString(),
      labels,
      type: 'histogram'
    });
  }

  private recordMetric(metric: Metric): void {
    const metrics = this.metrics.get(metric.name) || [];
    metrics.push(metric);

    // Keep only last 100 metrics per name to prevent memory issues
    if (metrics.length > 100) {
      metrics.shift();
    }

    this.metrics.set(metric.name, metrics);
  }

  // Get current metrics summary
  getMetricsSummary(): MetricsSummary {
    const queryResponseTimes = this.histograms.get('query_response_time_ms') || [];
    const sessionDurations = this.histograms.get('session_duration_ms') || [];
    const processingTimes = this.histograms.get('document_processing_time_ms') || [];

    return {
      queries: {
        total: this.counters.get('queries_total') || 0,
        successful: this.counters.get('queries_successful') || 0,
        failed: this.counters.get('queries_failed') || 0,
        averageResponseTime: this.calculateAverage(queryResponseTimes),
        byIntent: this.getIntentMetrics()
      },
      users: {
        activeSessions: this.activeSessions.size,
        totalSessions: this.counters.get('sessions_total') || 0,
        averageSessionDuration: this.calculateAverage(sessionDurations)
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: this.gauges.get('memory_usage_bytes') || 0,
        cpuUsage: this.gauges.get('cpu_usage_percent') || 0,
        errorRate: this.calculateErrorRate()
      },
      ingestion: {
        documentsProcessed: this.counters.get('documents_ingested') || 0,
        syncJobsCompleted: this.counters.get('sync_jobs_completed') || 0,
        averageProcessingTime: this.calculateAverage(processingTimes)
      }
    };
  }

  // Get all metrics in Prometheus format
  getPrometheusMetrics(): string {
    let output = '';

    // Counters
    this.counters.forEach((value, name) => {
      output += `# TYPE ${name} counter\n`;
      output += `${name} ${value}\n`;
    });

    // Gauges
    this.gauges.forEach((value, name) => {
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${value}\n`;
    });

    // Histograms (simplified)
    this.histograms.forEach((values, name) => {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const count = values.length;
        output += `# TYPE ${name} histogram\n`;
        output += `${name}_sum ${sum}\n`;
        output += `${name}_count ${count}\n`;
      }
    });

    return output;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateErrorRate(): number {
    const total = this.counters.get('queries_total') || 0;
    const failed = this.counters.get('queries_failed') || 0;
    return total > 0 ? (failed / total) * 100 : 0;
  }

  private getIntentMetrics(): Record<string, number> {
    // This would be populated by query processing events
    // For now, return empty object
    return {};
  }

  private startSystemMetricsCollection(): void {
    // Collect system metrics every 10 seconds
    setInterval(() => {
      try {
        const memoryUsage = process.memoryUsage();
        this.setGauge('memory_usage_bytes', memoryUsage.heapUsed);

        const cpuUsage = process.cpuUsage();
        const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to ms
        this.setGauge('cpu_usage_percent', cpuPercent);

        this.setGauge('active_sessions', this.activeSessions.size);
      } catch (error) {
        logger.warn({ error }, 'Failed to collect system metrics');
      }
    }, 10000);
  }

  // Event handlers
  private async handleQueryProcessed(event: QueryProcessedEvent): Promise<void> {
    this.incrementCounter('queries_total');
    this.incrementCounter('queries_successful');
    
    if (event.metadata.processingTime) {
      this.recordHistogram('query_response_time_ms', event.metadata.processingTime);
    }

    if (event.metadata.intent) {
      this.incrementCounter(`queries_by_intent_${event.metadata.intent}`);
    }

    logger.debug({ queryId: event.queryId }, 'Query metrics recorded');
  }

  private async handleErrorOccurred(event: ErrorOccurredEvent): Promise<void> {
    this.incrementCounter('errors_total');
    this.incrementCounter('queries_failed');
    this.incrementCounter(`errors_by_severity_${event.severity}`);

    if (event.context?.component) {
      this.incrementCounter(`errors_by_component_${event.context.component}`);
    }

    logger.debug({ 
      error: event.error.message,
      severity: event.severity 
    }, 'Error metrics recorded');
  }

  private async handleSessionStarted(event: UserSessionStartedEvent): Promise<void> {
    this.activeSessions.add(event.sessionId);
    this.sessionStartTimes.set(event.sessionId, Date.now());
    this.incrementCounter('sessions_total');

    logger.debug({ sessionId: event.sessionId }, 'Session start metrics recorded');
  }

  private async handleSessionEnded(event: UserSessionEndedEvent): Promise<void> {
    this.activeSessions.delete(event.sessionId);
    
    const startTime = this.sessionStartTimes.get(event.sessionId);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.recordHistogram('session_duration_ms', duration);
      this.sessionStartTimes.delete(event.sessionId);
    }

    logger.debug({ sessionId: event.sessionId }, 'Session end metrics recorded');
  }

  private async handleDocumentIngested(event: DocumentIngestedEvent): Promise<void> {
    this.incrementCounter('documents_ingested');
    this.incrementCounter(`documents_by_type_${event.type}`);

    logger.debug({ 
      documentId: event.documentId,
      type: event.type 
    }, 'Document ingestion metrics recorded');
  }

  private async handleSyncJobCompleted(event: SyncJobCompletedEvent): Promise<void> {
    this.incrementCounter('sync_jobs_completed');
    this.incrementCounter(`sync_jobs_${event.status}`);
    this.incrementCounter('documents_processed', event.documentsProcessed);

    logger.debug({ 
      jobId: event.jobId,
      status: event.status,
      documentsProcessed: event.documentsProcessed 
    }, 'Sync job metrics recorded');
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();
