import { logger } from '@/core/utils/logger';
import { eventBus } from '@/shared/events/event-bus';
import { QueryProcessedEvent } from '@/shared/events/event-types';

export interface EvaluationMetric {
  name: string;
  value: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface EvaluationResult {
  queryId: string;
  metrics: EvaluationMetric[];
  overallScore: number;
  timestamp: string;
}

export class EvaluationService {
  private initialized = false;
  private evaluationResults = new Map<string, EvaluationResult>();
  private maxResults = 1000; // Keep last 1000 evaluations

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for query processing events to evaluate responses
    eventBus.on<QueryProcessedEvent>('query-processed', this.handleQueryProcessed.bind(this));
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Evaluation Service...');
      this.initialized = true;
      logger.info('Evaluation Service initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Evaluation Service');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Evaluation Service...');
      this.evaluationResults.clear();
      this.initialized = false;
      logger.info('Evaluation Service cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Evaluation Service');
    }
  }

  // Evaluate a query response
  async evaluateQuery(
    queryId: string,
    query: string,
    response: string,
    metadata?: Record<string, any>
  ): Promise<EvaluationResult> {
    try {
      const metrics: EvaluationMetric[] = [];

      // Response length metric
      metrics.push({
        name: 'response_length',
        value: response.length,
        timestamp: new Date().toISOString(),
        metadata: { unit: 'characters' }
      });

      // Response completeness (basic heuristic)
      const completenessScore = this.evaluateCompleteness(response);
      metrics.push({
        name: 'completeness',
        value: completenessScore,
        timestamp: new Date().toISOString(),
        metadata: { scale: '0-1' }
      });

      // Response relevance (basic heuristic)
      const relevanceScore = this.evaluateRelevance(query, response);
      metrics.push({
        name: 'relevance',
        value: relevanceScore,
        timestamp: new Date().toISOString(),
        metadata: { scale: '0-1' }
      });

      // Processing time (if available)
      if (metadata?.processingTime) {
        metrics.push({
          name: 'processing_time',
          value: metadata.processingTime,
          timestamp: new Date().toISOString(),
          metadata: { unit: 'milliseconds' }
        });
      }

      // Calculate overall score
      const overallScore = this.calculateOverallScore(metrics);

      const result: EvaluationResult = {
        queryId,
        metrics,
        overallScore,
        timestamp: new Date().toISOString()
      };

      // Store result
      this.evaluationResults.set(queryId, result);

      // Cleanup old results
      if (this.evaluationResults.size > this.maxResults) {
        const oldestQueryId = this.evaluationResults.keys().next().value;
        if (oldestQueryId) {
          this.evaluationResults.delete(oldestQueryId);
        }
      }

      logger.debug({ 
        queryId, 
        overallScore,
        metricsCount: metrics.length 
      }, 'Query evaluation completed');

      return result;

    } catch (error) {
      logger.error({ error, queryId }, 'Query evaluation failed');
      throw error;
    }
  }

  // Get evaluation result by query ID
  getEvaluationResult(queryId: string): EvaluationResult | undefined {
    return this.evaluationResults.get(queryId);
  }

  // Get all evaluation results
  getAllEvaluationResults(): EvaluationResult[] {
    return Array.from(this.evaluationResults.values());
  }

  // Get evaluation statistics
  getEvaluationStats(): {
    totalEvaluations: number;
    averageScore: number;
    scoreDistribution: Record<string, number>;
    metricAverages: Record<string, number>;
  } {
    const results = Array.from(this.evaluationResults.values());
    
    if (results.length === 0) {
      return {
        totalEvaluations: 0,
        averageScore: 0,
        scoreDistribution: {},
        metricAverages: {}
      };
    }

    // Calculate average score
    const totalScore = results.reduce((sum, result) => sum + result.overallScore, 0);
    const averageScore = totalScore / results.length;

    // Calculate score distribution
    const scoreDistribution: Record<string, number> = {
      'excellent (0.8-1.0)': 0,
      'good (0.6-0.8)': 0,
      'fair (0.4-0.6)': 0,
      'poor (0.0-0.4)': 0
    };

    results.forEach(result => {
      if (result.overallScore >= 0.8) {
        scoreDistribution['excellent (0.8-1.0)']++;
      } else if (result.overallScore >= 0.6) {
        scoreDistribution['good (0.6-0.8)']++;
      } else if (result.overallScore >= 0.4) {
        scoreDistribution['fair (0.4-0.6)']++;
      } else {
        scoreDistribution['poor (0.0-0.4)']++;
      }
    });

    // Calculate metric averages
    const metricAverages: Record<string, number> = {};
    const metricCounts: Record<string, number> = {};

    results.forEach(result => {
      result.metrics.forEach(metric => {
        if (!metricAverages[metric.name]) {
          metricAverages[metric.name] = 0;
          metricCounts[metric.name] = 0;
        }
        metricAverages[metric.name] += metric.value;
        metricCounts[metric.name]++;
      });
    });

    Object.keys(metricAverages).forEach(metricName => {
      metricAverages[metricName] = metricAverages[metricName] / metricCounts[metricName];
    });

    return {
      totalEvaluations: results.length,
      averageScore,
      scoreDistribution,
      metricAverages
    };
  }

  private evaluateCompleteness(response: string): number {
    // Basic heuristic: longer responses are generally more complete
    // This is a simplified approach - in practice, you'd use more sophisticated methods
    const minLength = 50;
    const maxLength = 1000;
    
    if (response.length < minLength) {
      return response.length / minLength;
    } else if (response.length > maxLength) {
      return 1.0;
    } else {
      return 0.5 + (response.length - minLength) / (maxLength - minLength) * 0.5;
    }
  }

  private evaluateRelevance(query: string, response: string): number {
    // Basic heuristic: check for keyword overlap
    // This is a simplified approach - in practice, you'd use semantic similarity
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    const responseWords = response.toLowerCase().split(/\s+/);
    
    if (queryWords.length === 0) {
      return 0.5; // Default score if no meaningful query words
    }

    const matchingWords = queryWords.filter(word => 
      responseWords.some(respWord => respWord.includes(word) || word.includes(respWord))
    );

    return Math.min(matchingWords.length / queryWords.length, 1.0);
  }

  private calculateOverallScore(metrics: EvaluationMetric[]): number {
    // Weight different metrics
    const weights: Record<string, number> = {
      completeness: 0.4,
      relevance: 0.4,
      processing_time: 0.2
    };

    let weightedSum = 0;
    let totalWeight = 0;

    metrics.forEach(metric => {
      const weight = weights[metric.name] || 0.1;
      let normalizedValue = metric.value;

      // Normalize different metrics to 0-1 scale
      switch (metric.name) {
        case 'processing_time':
          // Lower processing time is better (inverse relationship)
          normalizedValue = Math.max(0, 1 - (metric.value / 10000)); // 10 seconds max
          break;
        case 'response_length':
          // Normalize based on reasonable response length
          normalizedValue = Math.min(metric.value / 500, 1); // 500 chars as good length
          break;
        default:
          // Assume already normalized (0-1)
          normalizedValue = Math.min(Math.max(metric.value, 0), 1);
      }

      weightedSum += normalizedValue * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private async handleQueryProcessed(event: QueryProcessedEvent): Promise<void> {
    try {
      // Extract query and response from event
      const query = event.metadata.query || '';
      const response = event.result?.response || '';

      if (query && response) {
        await this.evaluateQuery(event.queryId, query, response, event.metadata);
      }
    } catch (error) {
      logger.error({ 
        error, 
        queryId: event.queryId 
      }, 'Failed to evaluate query from event');
    }
  }
}

// Export singleton instance
export const evaluationService = new EvaluationService();
