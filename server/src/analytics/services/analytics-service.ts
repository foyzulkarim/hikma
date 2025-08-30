import { logger } from '@/core/utils/logger';
import { storyPointPredictor } from '../predictive/story-point-predictor';
import { effortEstimator } from '../predictive/effort-estimator';
import { mlModels } from '../predictive/ml-models';
import { velocityAnalyzer } from '../insights/velocity-analyzer';
import { bottleneckDetector } from '../insights/bottleneck-detector';
import { trendAnalyzer } from '../insights/trend-analyzer';
import { responseEvaluator } from '../evaluation/response-evaluator';

export interface AnalyticsConfig {
  enablePredictive: boolean;
  enableInsights: boolean;
  enableEvaluation: boolean;
  autoInitialize: boolean;
}

export interface AnalyticsStatus {
  initialized: boolean;
  components: {
    storyPointPredictor: boolean;
    effortEstimator: boolean;
    mlModels: boolean;
    velocityAnalyzer: boolean;
    bottleneckDetector: boolean;
    trendAnalyzer: boolean;
    responseEvaluator: boolean;
  };
  errors: string[];
}

export class AnalyticsService {
  private initialized = false;
  private config: AnalyticsConfig = {
    enablePredictive: true,
    enableInsights: true,
    enableEvaluation: true,
    autoInitialize: true
  };

  constructor(config?: Partial<AnalyticsConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Analytics Service...');
      
      const initPromises: Promise<void>[] = [];

      // Initialize predictive analytics components
      if (this.config.enablePredictive) {
        initPromises.push(
          storyPointPredictor.initialize(),
          effortEstimator.initialize(),
          mlModels.initialize()
        );
      }

      // Initialize insights analytics components
      if (this.config.enableInsights) {
        initPromises.push(
          velocityAnalyzer.initialize(),
          bottleneckDetector.initialize(),
          trendAnalyzer.initialize()
        );
      }

      // Initialize evaluation components
      if (this.config.enableEvaluation) {
        initPromises.push(
          responseEvaluator.initialize()
        );
      }

      // Wait for all components to initialize
      await Promise.all(initPromises);

      this.initialized = true;
      logger.info('Analytics Service initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Analytics Service');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Analytics Service...');
      
      const cleanupPromises: Promise<void>[] = [];

      // Cleanup all components
      if (this.config.enablePredictive) {
        cleanupPromises.push(
          storyPointPredictor.cleanup(),
          effortEstimator.cleanup(),
          mlModels.cleanup()
        );
      }

      if (this.config.enableInsights) {
        cleanupPromises.push(
          velocityAnalyzer.cleanup(),
          bottleneckDetector.cleanup(),
          trendAnalyzer.cleanup()
        );
      }

      if (this.config.enableEvaluation) {
        cleanupPromises.push(
          responseEvaluator.cleanup()
        );
      }

      // Wait for all components to cleanup
      await Promise.all(cleanupPromises);

      this.initialized = false;
      logger.info('Analytics Service cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Analytics Service');
    }
  }

  async getStatus(): Promise<AnalyticsStatus> {
    const errors: string[] = [];
    
    // Test each component
    const components = {
      storyPointPredictor: await this.testComponent('storyPointPredictor', async () => 
        storyPointPredictor.getModelStats()
      ),
      effortEstimator: await this.testComponent('effortEstimator', async () => 
        effortEstimator.getEstimatorStats()
      ),
      mlModels: await this.testComponent('mlModels', async () => 
        mlModels.listModels()
      ),
      velocityAnalyzer: await this.testComponent('velocityAnalyzer', () => 
        Promise.resolve(true)
      ),
      bottleneckDetector: await this.testComponent('bottleneckDetector', () => 
        Promise.resolve(true)
      ),
      trendAnalyzer: await this.testComponent('trendAnalyzer', () => 
        Promise.resolve(true)
      ),
      responseEvaluator: await this.testComponent('responseEvaluator', () => 
        Promise.resolve(true)
      )
    };

    return {
      initialized: this.initialized,
      components,
      errors
    };
  }

  // Predictive Analytics Methods
  async predictStoryPoints(input: any) {
    this.ensureInitialized();
    return storyPointPredictor.predictStoryPoints(input);
  }

  async estimateEffort(input: any) {
    this.ensureInitialized();
    return effortEstimator.estimateEffort(input);
  }

  async trainModel(modelName: string, data: any[]) {
    this.ensureInitialized();
    await mlModels.addTrainingData(modelName, data);
    return mlModels.trainModel(modelName);
  }

  async makePrediction(modelName: string, features: any) {
    this.ensureInitialized();
    return mlModels.predict(modelName, features);
  }

  // Insights Analytics Methods
  async analyzeVelocity(teamId: string, sprintCount?: number) {
    this.ensureInitialized();
    return velocityAnalyzer.analyzeVelocity(teamId, sprintCount);
  }

  async detectBottlenecks(teamId: string, daysBack?: number) {
    this.ensureInitialized();
    return bottleneckDetector.detectBottlenecks(teamId, daysBack);
  }

  async analyzeTrend(metric: string, daysBack?: number) {
    this.ensureInitialized();
    return trendAnalyzer.analyzeTrend(metric, daysBack);
  }

  async compareMetrics(metrics: string[], daysBack?: number) {
    this.ensureInitialized();
    return trendAnalyzer.compareMetrics(metrics, daysBack);
  }

  // Evaluation Methods
  async evaluateResponse(input: any) {
    this.ensureInitialized();
    return responseEvaluator.evaluateResponse(input);
  }

  async getEvaluationStats(daysBack?: number) {
    this.ensureInitialized();
    return responseEvaluator.getEvaluationStats(daysBack);
  }

  // Data Management Methods
  async addVelocityData(teamId: string, data: any) {
    this.ensureInitialized();
    return velocityAnalyzer.addVelocityData(data);
  }

  async addWorkflowData(teamId: string, data: any[]) {
    this.ensureInitialized();
    return bottleneckDetector.addWorkflowData(teamId, data);
  }

  async addTrendData(metric: string, dataPoints: any[]) {
    this.ensureInitialized();
    return trendAnalyzer.addDataPoints(metric, dataPoints);
  }

  async addHistoricalStory(story: any) {
    this.ensureInitialized();
    return storyPointPredictor.addHistoricalData(story);
  }

  // Comprehensive Analytics Dashboard Data
  async getDashboardData(teamId: string, daysBack: number = 30): Promise<{
    velocity: any;
    bottlenecks: any;
    evaluation: any;
    predictions: {
      averageStoryPoints: number;
      averageEffort: number;
    };
    trends: any[];
  }> {
    this.ensureInitialized();

    try {
      // Gather data from all analytics components
      const [
        velocityAnalysis,
        bottleneckAnalysis,
        evaluationStats
      ] = await Promise.allSettled([
        this.analyzeVelocity(teamId, Math.floor(daysBack / 14)), // Convert days to sprints
        this.detectBottlenecks(teamId, daysBack),
        this.getEvaluationStats(daysBack)
      ]);

      // Get trend data for key metrics
      const trendMetrics = ['velocity', 'cycle_time', 'quality_score'];
      const trends = await Promise.allSettled(
        trendMetrics.map(metric => this.analyzeTrend(metric, daysBack))
      );

      // Calculate prediction averages (mock data for now)
      const predictions = {
        averageStoryPoints: 5,
        averageEffort: 24
      };

      return {
        velocity: velocityAnalysis.status === 'fulfilled' ? velocityAnalysis.value : null,
        bottlenecks: bottleneckAnalysis.status === 'fulfilled' ? bottleneckAnalysis.value : null,
        evaluation: evaluationStats.status === 'fulfilled' ? evaluationStats.value : null,
        predictions,
        trends: trends
          .filter(result => result.status === 'fulfilled')
          .map((result: any) => result.value)
      };

    } catch (error) {
      logger.error({ error, teamId }, 'Failed to generate dashboard data');
      throw error;
    }
  }

  // Configuration Methods
  updateConfig(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, 'Analytics configuration updated');
  }

  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Analytics Service not initialized. Call initialize() first.');
    }
  }

  private async testComponent(name: string, testFn: () => Promise<any>): Promise<boolean> {
    try {
      await testFn();
      return true;
    } catch (error) {
      logger.warn({ component: name, error }, 'Analytics component test failed');
      return false;
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
