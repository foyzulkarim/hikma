// Export main analytics service
export { analyticsService, AnalyticsService } from './services/analytics-service';
export type { AnalyticsConfig, AnalyticsStatus } from './services/analytics-service';

// Export predictive analytics
export * from './predictive';

// Export insights analytics
export * from './insights';

// Export evaluation analytics
export { EvaluationService } from './evaluation/evaluation-service';
export { responseEvaluator, ResponseEvaluator } from './evaluation/response-evaluator';
export type { 
  ResponseEvaluationInput,
  ResponseEvaluationResult
} from './evaluation/response-evaluator';

// Re-export evaluation index
export * from './evaluation';
