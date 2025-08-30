import { logger } from '@/core/utils/logger';

export interface MLModelConfig {
  name: string;
  type: 'regression' | 'classification' | 'clustering';
  version: string;
  features: string[];
  targetVariable: string;
  hyperparameters: Record<string, any>;
}

export interface TrainingData {
  features: Record<string, number | string>;
  target: number | string;
  metadata?: Record<string, any>;
}

export interface PredictionResult {
  prediction: number | string;
  confidence: number;
  featureImportance?: Record<string, number>;
  explanation?: string[];
}

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  rmse?: number;
  mae?: number;
  r2Score?: number;
}

export class MLModels {
  private initialized = false;
  private models = new Map<string, MLModelConfig>();
  private trainingData = new Map<string, TrainingData[]>();
  private modelMetrics = new Map<string, ModelMetrics>();

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing ML Models service...');
      
      // Initialize default models
      await this.initializeDefaultModels();
      
      this.initialized = true;
      logger.info('ML Models service initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize ML Models service');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up ML Models service...');
      this.models.clear();
      this.trainingData.clear();
      this.modelMetrics.clear();
      this.initialized = false;
      logger.info('ML Models service cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup ML Models service');
    }
  }

  async registerModel(config: MLModelConfig): Promise<void> {
    this.models.set(config.name, config);
    this.trainingData.set(config.name, []);
    
    logger.info({ modelName: config.name, type: config.type }, 'ML model registered');
  }

  async addTrainingData(modelName: string, data: TrainingData[]): Promise<void> {
    const existingData = this.trainingData.get(modelName) || [];
    existingData.push(...data);
    this.trainingData.set(modelName, existingData);
    
    logger.debug({ 
      modelName, 
      newSamples: data.length, 
      totalSamples: existingData.length 
    }, 'Training data added');
  }

  async trainModel(modelName: string): Promise<ModelMetrics> {
    const model = this.models.get(modelName);
    const data = this.trainingData.get(modelName);

    if (!model || !data || data.length === 0) {
      throw new Error(`Cannot train model ${modelName}: missing model config or training data`);
    }

    try {
      logger.info({ modelName, samples: data.length }, 'Starting model training');

      // Simulate model training (in real implementation, this would use actual ML libraries)
      const metrics = await this.simulateTraining(model, data);
      
      this.modelMetrics.set(modelName, metrics);
      
      logger.info({ modelName, metrics }, 'Model training completed');
      
      return metrics;
    } catch (error) {
      logger.error({ error, modelName }, 'Model training failed');
      throw error;
    }
  }

  async predict(modelName: string, features: Record<string, number | string>): Promise<PredictionResult> {
    const model = this.models.get(modelName);
    const metrics = this.modelMetrics.get(modelName);

    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }

    if (!metrics) {
      throw new Error(`Model ${modelName} not trained yet`);
    }

    try {
      // Validate features
      this.validateFeatures(model, features);

      // Simulate prediction (in real implementation, this would use trained model)
      const result = await this.simulatePrediction(model, features, metrics);
      
      logger.debug({ modelName, features, prediction: result.prediction }, 'Prediction made');
      
      return result;
    } catch (error) {
      logger.error({ error, modelName, features }, 'Prediction failed');
      throw error;
    }
  }

  async evaluateModel(modelName: string, testData: TrainingData[]): Promise<ModelMetrics> {
    const model = this.models.get(modelName);

    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }

    try {
      // Simulate model evaluation
      const metrics = await this.simulateEvaluation(model, testData);
      
      logger.info({ modelName, testSamples: testData.length, metrics }, 'Model evaluation completed');
      
      return metrics;
    } catch (error) {
      logger.error({ error, modelName }, 'Model evaluation failed');
      throw error;
    }
  }

  getModelInfo(modelName: string): MLModelConfig | undefined {
    return this.models.get(modelName);
  }

  getModelMetrics(modelName: string): ModelMetrics | undefined {
    return this.modelMetrics.get(modelName);
  }

  listModels(): string[] {
    return Array.from(this.models.keys());
  }

  private async initializeDefaultModels(): Promise<void> {
    // Story Point Prediction Model
    await this.registerModel({
      name: 'story_point_predictor',
      type: 'regression',
      version: '1.0.0',
      features: [
        'title_length',
        'description_length',
        'type_encoded',
        'complexity_encoded',
        'priority_encoded',
        'label_count'
      ],
      targetVariable: 'story_points',
      hyperparameters: {
        learningRate: 0.01,
        maxDepth: 6,
        nEstimators: 100
      }
    });

    // Effort Estimation Model
    await this.registerModel({
      name: 'effort_estimator',
      type: 'regression',
      version: '1.0.0',
      features: [
        'story_points',
        'team_size',
        'team_velocity',
        'complexity_encoded',
        'risk_factor_count',
        'dependency_count',
        'assignee_experience_encoded'
      ],
      targetVariable: 'actual_hours',
      hyperparameters: {
        learningRate: 0.01,
        maxDepth: 8,
        nEstimators: 150
      }
    });

    // Bug Severity Classifier
    await this.registerModel({
      name: 'bug_severity_classifier',
      type: 'classification',
      version: '1.0.0',
      features: [
        'title_length',
        'description_length',
        'affected_users_count',
        'system_component_encoded',
        'reporter_role_encoded'
      ],
      targetVariable: 'severity',
      hyperparameters: {
        learningRate: 0.01,
        maxDepth: 5,
        nEstimators: 100
      }
    });
  }

  private validateFeatures(model: MLModelConfig, features: Record<string, number | string>): void {
    const missingFeatures = model.features.filter(feature => !(feature in features));
    
    if (missingFeatures.length > 0) {
      throw new Error(`Missing required features: ${missingFeatures.join(', ')}`);
    }
  }

  private async simulateTraining(model: MLModelConfig, data: TrainingData[]): Promise<ModelMetrics> {
    // Simulate training time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate realistic metrics based on model type and data size
    const dataQuality = Math.min(1, data.length / 100); // Better metrics with more data
    
    if (model.type === 'regression') {
      return {
        rmse: 2.5 * (1 - dataQuality * 0.3),
        mae: 1.8 * (1 - dataQuality * 0.3),
        r2Score: 0.6 + (dataQuality * 0.3)
      };
    } else if (model.type === 'classification') {
      return {
        accuracy: 0.7 + (dataQuality * 0.2),
        precision: 0.68 + (dataQuality * 0.22),
        recall: 0.72 + (dataQuality * 0.18),
        f1Score: 0.7 + (dataQuality * 0.2)
      };
    }

    return {};
  }

  private async simulatePrediction(
    model: MLModelConfig, 
    features: Record<string, number | string>,
    metrics: ModelMetrics
  ): Promise<PredictionResult> {
    // Simulate prediction time
    await new Promise(resolve => setTimeout(resolve, 10));

    let prediction: number | string;
    let confidence: number;

    if (model.name === 'story_point_predictor') {
      // Simulate story point prediction
      const titleLength = Number(features.title_length) || 0;
      const descLength = Number(features.description_length) || 0;
      const complexity = Number(features.complexity_encoded) || 0;
      
      const baseScore = (titleLength / 50) + (descLength / 200) + complexity;
      const storyPoints = [1, 2, 3, 5, 8, 13, 21];
      const index = Math.min(Math.floor(baseScore * storyPoints.length), storyPoints.length - 1);
      
      prediction = storyPoints[index];
      confidence = 0.7 + (Math.random() * 0.2); // 70-90% confidence
      
    } else if (model.name === 'effort_estimator') {
      // Simulate effort estimation
      const storyPoints = Number(features.story_points) || 1;
      const teamSize = Number(features.team_size) || 1;
      const complexity = Number(features.complexity_encoded) || 0;
      
      prediction = Math.round(storyPoints * 6 * (1 + complexity * 0.5) * (teamSize > 5 ? 1.2 : 1));
      confidence = 0.6 + (Math.random() * 0.3); // 60-90% confidence
      
    } else if (model.name === 'bug_severity_classifier') {
      // Simulate bug severity classification
      const severities = ['low', 'medium', 'high', 'critical'];
      const affectedUsers = Number(features.affected_users_count) || 0;
      
      let severityIndex = 0;
      if (affectedUsers > 1000) severityIndex = 3;
      else if (affectedUsers > 100) severityIndex = 2;
      else if (affectedUsers > 10) severityIndex = 1;
      
      prediction = severities[severityIndex];
      confidence = 0.65 + (Math.random() * 0.25); // 65-90% confidence
      
    } else {
      // Default prediction
      prediction = Math.random() > 0.5 ? 'positive' : 'negative';
      confidence = 0.5 + (Math.random() * 0.3);
    }

    // Generate feature importance (simplified)
    const featureImportance: Record<string, number> = {};
    model.features.forEach((feature, index) => {
      featureImportance[feature] = Math.random() * (1 / model.features.length) * 2;
    });

    // Normalize feature importance
    const total = Object.values(featureImportance).reduce((sum, val) => sum + val, 0);
    Object.keys(featureImportance).forEach(key => {
      featureImportance[key] = featureImportance[key] / total;
    });

    return {
      prediction,
      confidence,
      featureImportance,
      explanation: this.generateExplanation(model, features, prediction)
    };
  }

  private async simulateEvaluation(model: MLModelConfig, testData: TrainingData[]): Promise<ModelMetrics> {
    // Simulate evaluation time
    await new Promise(resolve => setTimeout(resolve, 50));

    const dataQuality = Math.min(1, testData.length / 50);
    
    if (model.type === 'regression') {
      return {
        rmse: 3.0 * (1 - dataQuality * 0.25),
        mae: 2.2 * (1 - dataQuality * 0.25),
        r2Score: 0.55 + (dataQuality * 0.25)
      };
    } else if (model.type === 'classification') {
      return {
        accuracy: 0.65 + (dataQuality * 0.25),
        precision: 0.63 + (dataQuality * 0.27),
        recall: 0.67 + (dataQuality * 0.23),
        f1Score: 0.65 + (dataQuality * 0.25)
      };
    }

    return {};
  }

  private generateExplanation(
    model: MLModelConfig, 
    features: Record<string, number | string>, 
    prediction: number | string
  ): string[] {
    const explanations: string[] = [];

    if (model.name === 'story_point_predictor') {
      explanations.push(`Predicted ${prediction} story points based on task complexity and description`);
      if (Number(features.title_length) > 50) {
        explanations.push('Long title suggests complex requirements');
      }
      if (Number(features.description_length) > 200) {
        explanations.push('Detailed description indicates thorough planning needed');
      }
    } else if (model.name === 'effort_estimator') {
      explanations.push(`Estimated ${prediction} hours based on story points and team factors`);
      if (Number(features.team_size) > 5) {
        explanations.push('Large team size may require additional coordination time');
      }
    } else if (model.name === 'bug_severity_classifier') {
      explanations.push(`Classified as ${prediction} severity based on impact analysis`);
      if (Number(features.affected_users_count) > 100) {
        explanations.push('High user impact increases severity classification');
      }
    }

    return explanations;
  }
}

// Export singleton instance
export const mlModels = new MLModels();
