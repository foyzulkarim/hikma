import { logger } from '@/core/utils/logger';

export interface StoryPointPredictionInput {
  title: string;
  description: string;
  type: 'feature' | 'bug' | 'task' | 'epic';
  complexity?: 'low' | 'medium' | 'high';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  labels?: string[];
  assignee?: string;
  projectId?: string;
}

export interface StoryPointPrediction {
  predictedPoints: number;
  confidence: number; // 0-1 scale
  reasoning: string[];
  factors: {
    titleComplexity: number;
    descriptionLength: number;
    typeWeight: number;
    complexityWeight: number;
    priorityWeight: number;
    historicalSimilarity: number;
  };
  similarStories?: Array<{
    title: string;
    points: number;
    similarity: number;
  }>;
}

export interface HistoricalStory {
  id: string;
  title: string;
  description: string;
  type: string;
  actualPoints: number;
  completionTime: number; // in hours
  projectId: string;
  labels: string[];
}

export class StoryPointPredictor {
  private initialized = false;
  private historicalData: HistoricalStory[] = [];
  private modelWeights = {
    titleComplexity: 0.25,
    descriptionLength: 0.20,
    typeWeight: 0.15,
    complexityWeight: 0.20,
    priorityWeight: 0.10,
    historicalSimilarity: 0.10
  };

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Story Point Predictor...');
      
      // Load historical data (would come from database)
      await this.loadHistoricalData();
      
      // Train or load model weights
      await this.calibrateModel();

      this.initialized = true;
      logger.info('Story Point Predictor initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Story Point Predictor');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Story Point Predictor...');
      this.historicalData = [];
      this.initialized = false;
      logger.info('Story Point Predictor cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Story Point Predictor');
    }
  }

  async predictStoryPoints(input: StoryPointPredictionInput): Promise<StoryPointPrediction> {
    if (!this.initialized) {
      throw new Error('Story Point Predictor not initialized');
    }

    try {
      // Calculate various factors
      const factors = {
        titleComplexity: this.calculateTitleComplexity(input.title),
        descriptionLength: this.calculateDescriptionComplexity(input.description),
        typeWeight: this.getTypeWeight(input.type),
        complexityWeight: this.getComplexityWeight(input.complexity),
        priorityWeight: this.getPriorityWeight(input.priority),
        historicalSimilarity: await this.calculateHistoricalSimilarity(input)
      };

      // Calculate weighted score
      const weightedScore = Object.entries(factors).reduce((sum, [key, value]) => {
        const weight = this.modelWeights[key as keyof typeof this.modelWeights];
        return sum + (value * weight);
      }, 0);

      // Convert to story points (1, 2, 3, 5, 8, 13, 21)
      const predictedPoints = this.scoreToStoryPoints(weightedScore);
      
      // Calculate confidence based on historical data availability
      const confidence = this.calculateConfidence(input, factors);

      // Generate reasoning
      const reasoning = this.generateReasoning(factors, input);

      // Find similar stories
      const similarStories = await this.findSimilarStories(input, 3);

      return {
        predictedPoints,
        confidence,
        reasoning,
        factors,
        similarStories
      };

    } catch (error) {
      logger.error({ error, input }, 'Story point prediction failed');
      throw error;
    }
  }

  async addHistoricalData(story: HistoricalStory): Promise<void> {
    this.historicalData.push(story);
    
    // Recalibrate model if we have enough new data
    if (this.historicalData.length % 10 === 0) {
      await this.calibrateModel();
    }
  }

  private async loadHistoricalData(): Promise<void> {
    // In a real implementation, this would load from database
    // For now, use some sample data
    this.historicalData = [
      {
        id: '1',
        title: 'Add user authentication',
        description: 'Implement JWT-based authentication with login/logout functionality',
        type: 'feature',
        actualPoints: 5,
        completionTime: 16,
        projectId: 'proj1',
        labels: ['auth', 'security']
      },
      {
        id: '2',
        title: 'Fix login bug',
        description: 'Users cannot login with special characters in password',
        type: 'bug',
        actualPoints: 2,
        completionTime: 4,
        projectId: 'proj1',
        labels: ['bug', 'auth']
      },
      {
        id: '3',
        title: 'Implement dashboard',
        description: 'Create comprehensive dashboard with charts, metrics, and real-time updates',
        type: 'feature',
        actualPoints: 13,
        completionTime: 40,
        projectId: 'proj1',
        labels: ['ui', 'dashboard', 'charts']
      }
    ];
  }

  private async calibrateModel(): Promise<void> {
    // Simple calibration based on historical accuracy
    // In a real implementation, this would use ML algorithms
    if (this.historicalData.length < 5) {
      return; // Not enough data for calibration
    }

    logger.debug('Calibrating story point prediction model');
    
    // This is a simplified calibration - in practice, you'd use regression analysis
    // or machine learning to optimize weights based on prediction accuracy
  }

  private calculateTitleComplexity(title: string): number {
    // Simple heuristic based on title length and keywords
    const complexityKeywords = [
      'implement', 'create', 'build', 'develop', 'integrate',
      'refactor', 'optimize', 'migrate', 'redesign'
    ];
    
    const simpleKeywords = [
      'fix', 'update', 'change', 'add', 'remove', 'delete'
    ];

    let score = Math.min(title.length / 50, 1); // Length factor

    // Keyword analysis
    const lowerTitle = title.toLowerCase();
    complexityKeywords.forEach(keyword => {
      if (lowerTitle.includes(keyword)) score += 0.3;
    });
    
    simpleKeywords.forEach(keyword => {
      if (lowerTitle.includes(keyword)) score -= 0.2;
    });

    return Math.max(0, Math.min(1, score));
  }

  private calculateDescriptionComplexity(description: string): number {
    if (!description) return 0.2;

    // Factor in description length
    let score = Math.min(description.length / 500, 1);

    // Look for complexity indicators
    const complexityIndicators = [
      'integration', 'api', 'database', 'algorithm', 'performance',
      'security', 'authentication', 'authorization', 'migration'
    ];

    const lowerDesc = description.toLowerCase();
    complexityIndicators.forEach(indicator => {
      if (lowerDesc.includes(indicator)) score += 0.1;
    });

    return Math.min(1, score);
  }

  private getTypeWeight(type: string): number {
    const typeWeights = {
      'epic': 0.9,
      'feature': 0.7,
      'task': 0.4,
      'bug': 0.3
    };

    return typeWeights[type as keyof typeof typeWeights] || 0.5;
  }

  private getComplexityWeight(complexity?: string): number {
    if (!complexity) return 0.5;

    const complexityWeights = {
      'low': 0.3,
      'medium': 0.6,
      'high': 0.9
    };

    return complexityWeights[complexity as keyof typeof complexityWeights] || 0.5;
  }

  private getPriorityWeight(priority?: string): number {
    if (!priority) return 0.5;

    // Higher priority often correlates with complexity
    const priorityWeights = {
      'low': 0.3,
      'medium': 0.5,
      'high': 0.7,
      'critical': 0.9
    };

    return priorityWeights[priority as keyof typeof priorityWeights] || 0.5;
  }

  private async calculateHistoricalSimilarity(input: StoryPointPredictionInput): Promise<number> {
    if (this.historicalData.length === 0) return 0.5;

    // Find most similar historical story
    let maxSimilarity = 0;

    this.historicalData.forEach(story => {
      const similarity = this.calculateTextSimilarity(
        input.title + ' ' + input.description,
        story.title + ' ' + story.description
      );
      
      maxSimilarity = Math.max(maxSimilarity, similarity);
    });

    return maxSimilarity;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private scoreToStoryPoints(score: number): number {
    // Map 0-1 score to Fibonacci story points
    const storyPoints = [1, 2, 3, 5, 8, 13, 21];
    const index = Math.floor(score * (storyPoints.length - 1));
    return storyPoints[Math.min(index, storyPoints.length - 1)];
  }

  private calculateConfidence(input: StoryPointPredictionInput, factors: any): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence if we have similar historical data
    if (factors.historicalSimilarity > 0.7) confidence += 0.3;
    else if (factors.historicalSimilarity > 0.4) confidence += 0.1;

    // Increase confidence if complexity is specified
    if (input.complexity) confidence += 0.1;

    // Increase confidence if we have a good description
    if (input.description && input.description.length > 50) confidence += 0.1;

    return Math.min(1, confidence);
  }

  private generateReasoning(factors: any, input: StoryPointPredictionInput): string[] {
    const reasoning: string[] = [];

    if (factors.titleComplexity > 0.7) {
      reasoning.push('Title suggests high complexity work');
    } else if (factors.titleComplexity < 0.3) {
      reasoning.push('Title suggests simple task');
    }

    if (factors.descriptionLength > 0.7) {
      reasoning.push('Detailed description indicates complex requirements');
    }

    if (input.type === 'epic') {
      reasoning.push('Epic type typically requires more effort');
    } else if (input.type === 'bug') {
      reasoning.push('Bug fixes are typically smaller tasks');
    }

    if (factors.historicalSimilarity > 0.6) {
      reasoning.push('Similar historical stories provide good reference');
    }

    if (reasoning.length === 0) {
      reasoning.push('Prediction based on general patterns and heuristics');
    }

    return reasoning;
  }

  private async findSimilarStories(input: StoryPointPredictionInput, limit: number): Promise<Array<{
    title: string;
    points: number;
    similarity: number;
  }>> {
    const inputText = input.title + ' ' + input.description;
    
    return this.historicalData
      .map(story => ({
        title: story.title,
        points: story.actualPoints,
        similarity: this.calculateTextSimilarity(inputText, story.title + ' ' + story.description)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .filter(story => story.similarity > 0.2); // Only include reasonably similar stories
  }

  // Get prediction statistics
  getModelStats(): {
    historicalDataCount: number;
    modelWeights: {
      titleComplexity: number;
      descriptionLength: number;
      typeWeight: number;
      complexityWeight: number;
      priorityWeight: number;
      historicalSimilarity: number;
    };
    averageAccuracy?: number;
  } {
    return {
      historicalDataCount: this.historicalData.length,
      modelWeights: this.modelWeights,
      // averageAccuracy would be calculated from prediction vs actual comparisons
    };
  }
}

// Export singleton instance
export const storyPointPredictor = new StoryPointPredictor();
