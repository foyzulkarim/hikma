import { logger } from '@/core/utils/logger';

export interface TrendDataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface TrendAnalysis {
  metric: string;
  period: {
    startDate: Date;
    endDate: Date;
    dataPoints: number;
  };
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: 'weak' | 'moderate' | 'strong';
    confidence: number; // 0-1 scale
    changeRate: number; // percentage change per period
  };
  statistics: {
    mean: number;
    median: number;
    standardDeviation: number;
    min: number;
    max: number;
    range: number;
  };
  seasonality?: {
    detected: boolean;
    period?: number; // in days
    amplitude?: number;
  };
  anomalies: Array<{
    timestamp: Date;
    value: number;
    severity: 'low' | 'medium' | 'high';
    type: 'spike' | 'drop' | 'outlier';
  }>;
  forecast?: Array<{
    timestamp: Date;
    predicted: number;
    confidence: { lower: number; upper: number };
  }>;
  insights: string[];
}

export class TrendAnalyzer {
  private initialized = false;
  private trendData = new Map<string, TrendDataPoint[]>();

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Trend Analyzer...');
      this.initialized = true;
      logger.info('Trend Analyzer initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Trend Analyzer');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Trend Analyzer...');
      this.trendData.clear();
      this.initialized = false;
      logger.info('Trend Analyzer cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Trend Analyzer');
    }
  }

  async addDataPoints(metric: string, dataPoints: TrendDataPoint[]): Promise<void> {
    const existingData = this.trendData.get(metric) || [];
    existingData.push(...dataPoints);
    
    // Sort by timestamp
    existingData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Keep only last 1000 data points
    if (existingData.length > 1000) {
      existingData.splice(0, existingData.length - 1000);
    }
    
    this.trendData.set(metric, existingData);
    
    logger.debug({ metric, pointsAdded: dataPoints.length }, 'Trend data points added');
  }

  async analyzeTrend(metric: string, daysBack?: number): Promise<TrendAnalysis> {
    if (!this.initialized) {
      throw new Error('Trend Analyzer not initialized');
    }

    const data = this.trendData.get(metric);
    if (!data || data.length < 3) {
      throw new Error(`Insufficient data for trend analysis of metric: ${metric}`);
    }

    try {
      // Filter data by time period if specified
      let analysisData = data;
      if (daysBack) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        analysisData = data.filter(point => point.timestamp >= cutoffDate);
      }

      if (analysisData.length < 3) {
        throw new Error('Insufficient data points for the specified time period');
      }

      // Calculate basic statistics
      const statistics = this.calculateStatistics(analysisData);
      
      // Analyze trend direction and strength
      const trend = this.analyzeTrendDirection(analysisData);
      
      // Detect seasonality
      const seasonality = this.detectSeasonality(analysisData);
      
      // Detect anomalies
      const anomalies = this.detectAnomalies(analysisData, statistics);
      
      // Generate forecast
      const forecast = this.generateForecast(analysisData, trend, 7); // 7 days forecast
      
      // Generate insights
      const insights = this.generateTrendInsights(trend, statistics, seasonality, anomalies);

      const period = {
        startDate: analysisData[0].timestamp,
        endDate: analysisData[analysisData.length - 1].timestamp,
        dataPoints: analysisData.length
      };

      return {
        metric,
        period,
        trend,
        statistics,
        seasonality,
        anomalies,
        forecast,
        insights
      };

    } catch (error) {
      logger.error({ error, metric }, 'Trend analysis failed');
      throw error;
    }
  }

  async compareMetrics(metrics: string[], daysBack?: number): Promise<Array<{
    metric: string;
    trend: {
      direction: string;
      strength: string;
      changeRate: number;
    };
    correlation?: Array<{
      withMetric: string;
      coefficient: number;
      strength: 'weak' | 'moderate' | 'strong';
    }>;
  }>> {
    const comparisons: Array<{
      metric: string;
      trend: {
        direction: string;
        strength: string;
        changeRate: number;
      };
      correlation?: Array<{
        withMetric: string;
        coefficient: number;
        strength: 'weak' | 'moderate' | 'strong';
      }>;
    }> = [];

    for (const metric of metrics) {
      try {
        const analysis = await this.analyzeTrend(metric, daysBack);
        comparisons.push({
          metric,
          trend: {
            direction: analysis.trend.direction,
            strength: analysis.trend.strength,
            changeRate: analysis.trend.changeRate
          }
        });
      } catch (error) {
        logger.warn({ metric, error }, 'Could not analyze metric for comparison');
      }
    }

    // Calculate correlations between metrics
    for (let i = 0; i < comparisons.length; i++) {
      const correlations = [];
      
      for (let j = 0; j < comparisons.length; j++) {
        if (i !== j) {
          const correlation = this.calculateCorrelation(
            this.trendData.get(comparisons[i].metric) || [],
            this.trendData.get(comparisons[j].metric) || []
          );
          
          if (correlation !== null) {
            correlations.push({
              withMetric: comparisons[j].metric,
              coefficient: correlation,
              strength: this.getCorrelationStrength(Math.abs(correlation))
            });
          }
        }
      }
      
      if (correlations.length > 0) {
        comparisons[i].correlation = correlations;
      }
    }

    return comparisons;
  }

  private calculateStatistics(data: TrendDataPoint[]): {
    mean: number;
    median: number;
    standardDeviation: number;
    min: number;
    max: number;
    range: number;
  } {
    const values = data.map(point => point.value).sort((a, b) => a - b);
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const median = values[Math.floor(values.length / 2)];
    const min = values[0];
    const max = values[values.length - 1];
    const range = max - min;
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      min,
      max,
      range
    };
  }

  private analyzeTrendDirection(data: TrendDataPoint[]): {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: 'weak' | 'moderate' | 'strong';
    confidence: number;
    changeRate: number;
  } {
    // Simple linear regression to determine trend
    const n = data.length;
    const xValues = data.map((_, index) => index);
    const yValues = data.map(point => point.value);
    
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += Math.pow(xValues[i] - xMean, 2);
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0;
    
    // Calculate R-squared for confidence
    const yPredicted = xValues.map(x => yMean + slope * (x - xMean));
    const ssRes = yValues.reduce((sum, y, i) => sum + Math.pow(y - yPredicted[i], 2), 0);
    const ssTot = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const rSquared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;
    
    // Determine direction
    let direction: 'increasing' | 'decreasing' | 'stable';
    const slopeThreshold = Math.abs(yMean) * 0.01; // 1% of mean as threshold
    
    if (Math.abs(slope) < slopeThreshold) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }
    
    // Determine strength
    let strength: 'weak' | 'moderate' | 'strong';
    const absSlope = Math.abs(slope);
    const slopeStrengthThreshold = Math.abs(yMean) * 0.05; // 5% of mean
    
    if (absSlope < slopeStrengthThreshold) {
      strength = 'weak';
    } else if (absSlope < slopeStrengthThreshold * 2) {
      strength = 'moderate';
    } else {
      strength = 'strong';
    }
    
    // Calculate change rate as percentage
    const firstValue = yValues[0];
    const lastValue = yValues[yValues.length - 1];
    const changeRate = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    return {
      direction,
      strength,
      confidence: Math.max(0, Math.min(1, rSquared)),
      changeRate: Math.round(changeRate * 100) / 100
    };
  }

  private detectSeasonality(data: TrendDataPoint[]): {
    detected: boolean;
    period?: number;
    amplitude?: number;
  } {
    // Simple seasonality detection using autocorrelation
    if (data.length < 14) {
      return { detected: false };
    }

    const values = data.map(point => point.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Check for weekly seasonality (7 days)
    const weeklyCorrelation = this.calculateAutocorrelation(values, 7);
    
    if (weeklyCorrelation > 0.3) {
      const amplitude = this.calculateSeasonalAmplitude(values, 7);
      return {
        detected: true,
        period: 7,
        amplitude: Math.round(amplitude * 100) / 100
      };
    }

    return { detected: false };
  }

  private calculateAutocorrelation(values: number[], lag: number): number {
    if (lag >= values.length) return 0;

    const n = values.length - lag;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }
    
    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }
    
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private calculateSeasonalAmplitude(values: number[], period: number): number {
    const seasonalValues = [];
    
    for (let i = 0; i < period; i++) {
      const periodValues = [];
      for (let j = i; j < values.length; j += period) {
        periodValues.push(values[j]);
      }
      if (periodValues.length > 0) {
        const mean = periodValues.reduce((sum, val) => sum + val, 0) / periodValues.length;
        seasonalValues.push(mean);
      }
    }
    
    if (seasonalValues.length === 0) return 0;
    
    const min = Math.min(...seasonalValues);
    const max = Math.max(...seasonalValues);
    
    return max - min;
  }

  private detectAnomalies(data: TrendDataPoint[], statistics: any): Array<{
    timestamp: Date;
    value: number;
    severity: 'low' | 'medium' | 'high';
    type: 'spike' | 'drop' | 'outlier';
  }> {
    const anomalies = [];
    const threshold = statistics.standardDeviation * 2; // 2 sigma rule
    
    for (const point of data) {
      const deviation = Math.abs(point.value - statistics.mean);
      
      if (deviation > threshold) {
        let severity: 'low' | 'medium' | 'high' = 'low';
        let type: 'spike' | 'drop' | 'outlier' = 'outlier';
        
        if (deviation > threshold * 2) {
          severity = 'high';
        } else if (deviation > threshold * 1.5) {
          severity = 'medium';
        }
        
        if (point.value > statistics.mean + threshold) {
          type = 'spike';
        } else if (point.value < statistics.mean - threshold) {
          type = 'drop';
        }
        
        anomalies.push({
          timestamp: point.timestamp,
          value: point.value,
          severity,
          type
        });
      }
    }
    
    return anomalies;
  }

  private generateForecast(
    data: TrendDataPoint[], 
    trend: any, 
    forecastDays: number
  ): Array<{
    timestamp: Date;
    predicted: number;
    confidence: { lower: number; upper: number };
  }> {
    const forecast = [];
    const lastPoint = data[data.length - 1];
    const dailyChange = trend.changeRate / 100 / data.length; // Daily change rate
    
    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(lastPoint.timestamp);
      forecastDate.setDate(forecastDate.getDate() + i);
      
      const predicted = lastPoint.value * (1 + dailyChange * i);
      const uncertainty = Math.abs(predicted) * 0.1 * i; // Increasing uncertainty over time
      
      forecast.push({
        timestamp: forecastDate,
        predicted: Math.round(predicted * 100) / 100,
        confidence: {
          lower: Math.round((predicted - uncertainty) * 100) / 100,
          upper: Math.round((predicted + uncertainty) * 100) / 100
        }
      });
    }
    
    return forecast;
  }

  private generateTrendInsights(
    trend: any, 
    statistics: any, 
    seasonality: any, 
    anomalies: any[]
  ): string[] {
    const insights = [];

    // Trend insights
    if (trend.direction === 'increasing' && trend.strength === 'strong') {
      insights.push('Strong upward trend detected - metric is improving significantly');
    } else if (trend.direction === 'decreasing' && trend.strength === 'strong') {
      insights.push('Strong downward trend detected - metric requires attention');
    } else if (trend.direction === 'stable') {
      insights.push('Metric is stable with no significant trend');
    }

    // Confidence insights
    if (trend.confidence > 0.8) {
      insights.push('High confidence in trend analysis - pattern is consistent');
    } else if (trend.confidence < 0.5) {
      insights.push('Low confidence in trend - data may be too variable for reliable prediction');
    }

    // Seasonality insights
    if (seasonality.detected) {
      insights.push(`Weekly seasonality detected with ${seasonality.period}-day cycle`);
    }

    // Anomaly insights
    const highSeverityAnomalies = anomalies.filter(a => a.severity === 'high');
    if (highSeverityAnomalies.length > 0) {
      insights.push(`${highSeverityAnomalies.length} high-severity anomalies detected requiring investigation`);
    }

    // Variability insights
    const coefficientOfVariation = statistics.standardDeviation / statistics.mean;
    if (coefficientOfVariation > 0.5) {
      insights.push('High variability in metric - consider investigating causes of fluctuation');
    } else if (coefficientOfVariation < 0.1) {
      insights.push('Low variability - metric is very consistent');
    }

    return insights;
  }

  private calculateCorrelation(data1: TrendDataPoint[], data2: TrendDataPoint[]): number | null {
    if (data1.length < 3 || data2.length < 3) return null;

    // Align data by timestamp (simplified - assumes same timestamps)
    const minLength = Math.min(data1.length, data2.length);
    const values1 = data1.slice(-minLength).map(p => p.value);
    const values2 = data2.slice(-minLength).map(p => p.value);

    const mean1 = values1.reduce((sum, val) => sum + val, 0) / values1.length;
    const mean2 = values2.reduce((sum, val) => sum + val, 0) / values2.length;

    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;

    for (let i = 0; i < values1.length; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      
      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }

    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private getCorrelationStrength(coefficient: number): 'weak' | 'moderate' | 'strong' {
    if (coefficient < 0.3) return 'weak';
    if (coefficient < 0.7) return 'moderate';
    return 'strong';
  }
}

// Export singleton instance
export const trendAnalyzer = new TrendAnalyzer();
