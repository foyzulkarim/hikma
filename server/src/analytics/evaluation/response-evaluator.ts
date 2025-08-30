import { logger } from '@/core/utils/logger';

export interface ResponseEvaluationInput {
  query: string;
  response: string;
  context: string[];
  expectedAnswer?: string;
  userFeedback?: {
    rating: number; // 1-5 scale
    helpful: boolean;
    accurate: boolean;
    complete: boolean;
    comments?: string;
  };
}

export interface ResponseEvaluationResult {
  queryId: string;
  scores: {
    relevance: number; // 0-1 scale
    accuracy: number; // 0-1 scale
    completeness: number; // 0-1 scale
    clarity: number; // 0-1 scale
    helpfulness: number; // 0-1 scale
    overall: number; // 0-1 scale
  };
  metrics: {
    responseLength: number;
    contextUtilization: number;
    confidenceScore: number;
    processingTime?: number;
  };
  feedback?: {
    strengths: string[];
    improvements: string[];
    suggestions: string[];
  };
  timestamp: Date;
}

export class ResponseEvaluator {
  private initialized = false;
  private evaluationHistory: ResponseEvaluationResult[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Response Evaluator...');
      this.initialized = true;
      logger.info('Response Evaluator initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Response Evaluator');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Response Evaluator...');
      this.evaluationHistory = [];
      this.initialized = false;
      logger.info('Response Evaluator cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Response Evaluator');
    }
  }

  async evaluateResponse(input: ResponseEvaluationInput): Promise<ResponseEvaluationResult> {
    if (!this.initialized) {
      throw new Error('Response Evaluator not initialized');
    }

    try {
      const queryId = this.generateQueryId(input.query);
      
      // Calculate individual scores
      const relevance = this.calculateRelevanceScore(input.query, input.response, input.context);
      const accuracy = this.calculateAccuracyScore(input.response, input.expectedAnswer, input.userFeedback);
      const completeness = this.calculateCompletenessScore(input.query, input.response);
      const clarity = this.calculateClarityScore(input.response);
      const helpfulness = this.calculateHelpfulnessScore(input.response, input.userFeedback);
      
      // Calculate overall score (weighted average)
      const overall = this.calculateOverallScore({
        relevance,
        accuracy,
        completeness,
        clarity,
        helpfulness
      });

      // Calculate metrics
      const metrics = {
        responseLength: input.response.length,
        contextUtilization: this.calculateContextUtilization(input.response, input.context),
        confidenceScore: this.calculateConfidenceScore(input.response)
      };

      // Generate feedback
      const feedback = this.generateFeedback(input, {
        relevance,
        accuracy,
        completeness,
        clarity,
        helpfulness,
        overall
      });

      const result: ResponseEvaluationResult = {
        queryId,
        scores: {
          relevance,
          accuracy,
          completeness,
          clarity,
          helpfulness,
          overall
        },
        metrics,
        feedback,
        timestamp: new Date()
      };

      // Store evaluation result
      this.evaluationHistory.push(result);
      
      // Keep only last 500 evaluations
      if (this.evaluationHistory.length > 500) {
        this.evaluationHistory.shift();
      }

      logger.debug({ queryId, overallScore: overall }, 'Response evaluation completed');
      
      return result;

    } catch (error) {
      logger.error({ error, query: input.query }, 'Response evaluation failed');
      throw error;
    }
  }

  async getEvaluationStats(daysBack: number = 30): Promise<{
    totalEvaluations: number;
    averageScores: {
      relevance: number;
      accuracy: number;
      completeness: number;
      clarity: number;
      helpfulness: number;
      overall: number;
    };
    trends: {
      improving: boolean;
      changeRate: number;
    };
    distribution: {
      excellent: number; // 0.8-1.0
      good: number; // 0.6-0.8
      fair: number; // 0.4-0.6
      poor: number; // 0.0-0.4
    };
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const recentEvaluations = this.evaluationHistory.filter(
      evaluation => evaluation.timestamp >= cutoffDate
    );

    if (recentEvaluations.length === 0) {
      throw new Error('No evaluations found for the specified period');
    }

    // Calculate average scores
    const averageScores = {
      relevance: this.calculateAverage(recentEvaluations.map(e => e.scores.relevance)),
      accuracy: this.calculateAverage(recentEvaluations.map(e => e.scores.accuracy)),
      completeness: this.calculateAverage(recentEvaluations.map(e => e.scores.completeness)),
      clarity: this.calculateAverage(recentEvaluations.map(e => e.scores.clarity)),
      helpfulness: this.calculateAverage(recentEvaluations.map(e => e.scores.helpfulness)),
      overall: this.calculateAverage(recentEvaluations.map(e => e.scores.overall))
    };

    // Calculate trends
    const trends = this.calculateTrends(recentEvaluations);

    // Calculate distribution
    const distribution = this.calculateScoreDistribution(recentEvaluations);

    return {
      totalEvaluations: recentEvaluations.length,
      averageScores,
      trends,
      distribution
    };
  }

  private calculateRelevanceScore(query: string, response: string, context: string[]): number {
    // Simple keyword overlap scoring
    const queryWords = this.extractKeywords(query.toLowerCase());
    const responseWords = this.extractKeywords(response.toLowerCase());
    
    const overlap = queryWords.filter(word => responseWords.includes(word));
    const relevanceScore = queryWords.length > 0 ? overlap.length / queryWords.length : 0;
    
    // Boost score if response uses context effectively
    const contextRelevance = this.calculateContextRelevance(response, context);
    
    return Math.min(1, relevanceScore * 0.7 + contextRelevance * 0.3);
  }

  private calculateAccuracyScore(response: string, expectedAnswer?: string, userFeedback?: any): number {
    let score = 0.7; // Default score when no expected answer

    // If we have an expected answer, compare similarity
    if (expectedAnswer) {
      score = this.calculateTextSimilarity(response, expectedAnswer);
    }

    // Adjust based on user feedback
    if (userFeedback?.accurate !== undefined) {
      score = userFeedback.accurate ? Math.max(score, 0.8) : Math.min(score, 0.4);
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateCompletenessScore(query: string, response: string): number {
    // Check if response addresses different aspects of the query
    const queryAspects = this.identifyQueryAspects(query);
    const responseAspects = this.identifyResponseAspects(response);
    
    const addressedAspects = queryAspects.filter(aspect => 
      responseAspects.some(respAspect => 
        respAspect.toLowerCase().includes(aspect.toLowerCase())
      )
    );

    const completenessRatio = queryAspects.length > 0 ? 
      addressedAspects.length / queryAspects.length : 0.8;

    // Consider response length as a factor
    const lengthFactor = Math.min(1, response.length / 200); // Assume 200 chars is adequate
    
    return Math.min(1, completenessRatio * 0.8 + lengthFactor * 0.2);
  }

  private calculateClarityScore(response: string): number {
    let score = 0.7; // Base score

    // Penalize very short responses
    if (response.length < 50) {
      score -= 0.2;
    }

    // Penalize very long responses without structure
    if (response.length > 1000 && !this.hasGoodStructure(response)) {
      score -= 0.1;
    }

    // Reward good structure (bullet points, numbered lists, etc.)
    if (this.hasGoodStructure(response)) {
      score += 0.2;
    }

    // Penalize excessive technical jargon without explanation
    if (this.hasExcessiveJargon(response)) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateHelpfulnessScore(response: string, userFeedback?: any): number {
    let score = 0.7; // Base score

    // Use user feedback if available
    if (userFeedback?.helpful !== undefined) {
      score = userFeedback.helpful ? 0.9 : 0.3;
    }

    if (userFeedback?.rating) {
      score = userFeedback.rating / 5; // Convert 1-5 scale to 0-1
    }

    // Check for actionable content
    if (this.hasActionableContent(response)) {
      score += 0.1;
    }

    // Check for examples or code snippets
    if (this.hasExamples(response)) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateOverallScore(scores: {
    relevance: number;
    accuracy: number;
    completeness: number;
    clarity: number;
    helpfulness: number;
  }): number {
    // Weighted average with emphasis on relevance and accuracy
    const weights = {
      relevance: 0.25,
      accuracy: 0.25,
      completeness: 0.2,
      clarity: 0.15,
      helpfulness: 0.15
    };

    return Object.entries(scores).reduce((sum, [key, value]) => {
      return sum + (value * weights[key as keyof typeof weights]);
    }, 0);
  }

  private calculateContextUtilization(response: string, context: string[]): number {
    if (context.length === 0) return 0;

    const responseWords = this.extractKeywords(response.toLowerCase());
    let utilizedContexts = 0;

    context.forEach(contextItem => {
      const contextWords = this.extractKeywords(contextItem.toLowerCase());
      const overlap = contextWords.filter(word => responseWords.includes(word));
      
      if (overlap.length > 0) {
        utilizedContexts++;
      }
    });

    return context.length > 0 ? utilizedContexts / context.length : 0;
  }

  private calculateConfidenceScore(response: string): number {
    // Look for confidence indicators
    const uncertaintyPhrases = [
      'might be', 'could be', 'possibly', 'perhaps', 'maybe',
      'i think', 'i believe', 'not sure', 'uncertain'
    ];

    const confidencePhrases = [
      'definitely', 'certainly', 'clearly', 'obviously',
      'without doubt', 'confirmed', 'established'
    ];

    const lowerResponse = response.toLowerCase();
    
    let confidenceScore = 0.7; // Base confidence

    uncertaintyPhrases.forEach(phrase => {
      if (lowerResponse.includes(phrase)) {
        confidenceScore -= 0.1;
      }
    });

    confidencePhrases.forEach(phrase => {
      if (lowerResponse.includes(phrase)) {
        confidenceScore += 0.1;
      }
    });

    return Math.max(0, Math.min(1, confidenceScore));
  }

  private generateFeedback(input: ResponseEvaluationInput, scores: any): {
    strengths: string[];
    improvements: string[];
    suggestions: string[];
  } {
    const strengths: string[] = [];
    const improvements: string[] = [];
    const suggestions: string[] = [];

    // Analyze strengths
    if (scores.relevance > 0.8) {
      strengths.push('Response is highly relevant to the query');
    }
    if (scores.accuracy > 0.8) {
      strengths.push('Response appears to be accurate');
    }
    if (scores.clarity > 0.8) {
      strengths.push('Response is clear and well-structured');
    }

    // Identify improvements
    if (scores.relevance < 0.6) {
      improvements.push('Improve relevance by addressing the core query more directly');
    }
    if (scores.completeness < 0.6) {
      improvements.push('Provide more comprehensive coverage of the topic');
    }
    if (scores.clarity < 0.6) {
      improvements.push('Improve clarity with better structure and simpler language');
    }

    // Generate suggestions
    if (input.context.length > 0 && this.calculateContextUtilization(input.response, input.context) < 0.5) {
      suggestions.push('Better utilize the provided context information');
    }
    if (input.response.length < 100) {
      suggestions.push('Consider providing more detailed explanations');
    }
    if (!this.hasExamples(input.response)) {
      suggestions.push('Include examples or code snippets when applicable');
    }

    return { strengths, improvements, suggestions };
  }

  // Helper methods
  private extractKeywords(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word));
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return stopWords.includes(word.toLowerCase());
  }

  private calculateContextRelevance(response: string, context: string[]): number {
    if (context.length === 0) return 0.5;
    
    const responseWords = this.extractKeywords(response.toLowerCase());
    let totalRelevance = 0;

    context.forEach(contextItem => {
      const contextWords = this.extractKeywords(contextItem.toLowerCase());
      const overlap = contextWords.filter(word => responseWords.includes(word));
      totalRelevance += contextWords.length > 0 ? overlap.length / contextWords.length : 0;
    });

    return totalRelevance / context.length;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = this.extractKeywords(text1.toLowerCase());
    const words2 = this.extractKeywords(text2.toLowerCase());
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  private identifyQueryAspects(query: string): string[] {
    // Simple aspect identification based on question words and key phrases
    const aspects = [];
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('how')) aspects.push('method');
    if (lowerQuery.includes('what')) aspects.push('definition');
    if (lowerQuery.includes('why')) aspects.push('reason');
    if (lowerQuery.includes('when')) aspects.push('timing');
    if (lowerQuery.includes('where')) aspects.push('location');
    if (lowerQuery.includes('example')) aspects.push('examples');

    return aspects.length > 0 ? aspects : ['general'];
  }

  private identifyResponseAspects(response: string): string[] {
    const aspects = [];
    const lowerResponse = response.toLowerCase();

    if (lowerResponse.includes('example') || lowerResponse.includes('for instance')) {
      aspects.push('examples');
    }
    if (lowerResponse.includes('because') || lowerResponse.includes('reason')) {
      aspects.push('reason');
    }
    if (lowerResponse.includes('step') || lowerResponse.includes('process')) {
      aspects.push('method');
    }

    return aspects;
  }

  private hasGoodStructure(response: string): boolean {
    return /[-*•]\s/.test(response) || // Bullet points
           /\d+\.\s/.test(response) || // Numbered lists
           response.includes('\n\n'); // Paragraphs
  }

  private hasExcessiveJargon(response: string): boolean {
    // Simple heuristic: count technical terms vs total words
    const technicalTerms = response.match(/\b[A-Z]{2,}\b/g) || [];
    const totalWords = response.split(/\s+/).length;
    
    return technicalTerms.length / totalWords > 0.1; // More than 10% technical terms
  }

  private hasActionableContent(response: string): boolean {
    const actionWords = ['should', 'can', 'try', 'consider', 'recommend', 'suggest'];
    const lowerResponse = response.toLowerCase();
    
    return actionWords.some(word => lowerResponse.includes(word));
  }

  private hasExamples(response: string): boolean {
    return /example|for instance|such as|like this|```/.test(response.toLowerCase());
  }

  private generateQueryId(query: string): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateAverage(values: number[]): number {
    return values.length > 0 ? 
      Math.round((values.reduce((sum, val) => sum + val, 0) / values.length) * 100) / 100 : 0;
  }

  private calculateTrends(evaluations: ResponseEvaluationResult[]): {
    improving: boolean;
    changeRate: number;
  } {
    if (evaluations.length < 10) {
      return { improving: false, changeRate: 0 };
    }

    const sortedEvals = evaluations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const firstHalf = sortedEvals.slice(0, Math.floor(sortedEvals.length / 2));
    const secondHalf = sortedEvals.slice(Math.floor(sortedEvals.length / 2));

    const firstAvg = this.calculateAverage(firstHalf.map(e => e.scores.overall));
    const secondAvg = this.calculateAverage(secondHalf.map(e => e.scores.overall));

    const changeRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    return {
      improving: secondAvg > firstAvg,
      changeRate: Math.round(changeRate * 100) / 100
    };
  }

  private calculateScoreDistribution(evaluations: ResponseEvaluationResult[]): {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  } {
    const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };

    evaluations.forEach(evaluation => {
      const score = evaluation.scores.overall;
      if (score >= 0.8) distribution.excellent++;
      else if (score >= 0.6) distribution.good++;
      else if (score >= 0.4) distribution.fair++;
      else distribution.poor++;
    });

    const total = evaluations.length;
    return {
      excellent: Math.round((distribution.excellent / total) * 100),
      good: Math.round((distribution.good / total) * 100),
      fair: Math.round((distribution.fair / total) * 100),
      poor: Math.round((distribution.poor / total) * 100)
    };
  }
}

// Export singleton instance
export const responseEvaluator = new ResponseEvaluator();
