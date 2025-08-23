import { logger } from '@/core/utils/logger';

export interface VelocityData {
  sprintId: string;
  teamId: string;
  startDate: Date;
  endDate: Date;
  plannedPoints: number;
  completedPoints: number;
  carriedOverPoints: number;
  addedPoints: number;
  teamSize: number;
  workingDays: number;
}

export interface VelocityMetrics {
  averageVelocity: number;
  velocityTrend: 'increasing' | 'decreasing' | 'stable';
  predictability: number; // 0-1 scale, how consistent velocity is
  efficiency: number; // completed vs planned ratio
  capacity: number; // points per team member per day
  recommendations: string[];
}

export interface VelocityAnalysis {
  teamId: string;
  period: {
    startDate: Date;
    endDate: Date;
    sprintCount: number;
  };
  metrics: VelocityMetrics;
  trends: {
    velocityByWeek: Array<{ week: string; velocity: number }>;
    efficiencyByWeek: Array<{ week: string; efficiency: number }>;
    capacityByWeek: Array<{ week: string; capacity: number }>;
  };
  insights: string[];
  forecasts: {
    nextSprintVelocity: number;
    confidenceInterval: { min: number; max: number };
    capacityForecast: number;
  };
}

export class VelocityAnalyzer {
  private initialized = false;
  private velocityHistory = new Map<string, VelocityData[]>();

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Velocity Analyzer...');
      
      // Load historical velocity data
      await this.loadVelocityHistory();
      
      this.initialized = true;
      logger.info('Velocity Analyzer initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Velocity Analyzer');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Velocity Analyzer...');
      this.velocityHistory.clear();
      this.initialized = false;
      logger.info('Velocity Analyzer cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Velocity Analyzer');
    }
  }

  async addVelocityData(data: VelocityData): Promise<void> {
    const teamHistory = this.velocityHistory.get(data.teamId) || [];
    teamHistory.push(data);
    
    // Keep only last 20 sprints for analysis
    if (teamHistory.length > 20) {
      teamHistory.shift();
    }
    
    // Sort by start date
    teamHistory.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    
    this.velocityHistory.set(data.teamId, teamHistory);
    
    logger.debug({ teamId: data.teamId, sprintId: data.sprintId }, 'Velocity data added');
  }

  async analyzeVelocity(teamId: string, sprintCount: number = 10): Promise<VelocityAnalysis> {
    if (!this.initialized) {
      throw new Error('Velocity Analyzer not initialized');
    }

    const teamHistory = this.velocityHistory.get(teamId);
    if (!teamHistory || teamHistory.length === 0) {
      throw new Error(`No velocity data found for team ${teamId}`);
    }

    try {
      // Get recent sprints for analysis
      const recentSprints = teamHistory.slice(-sprintCount);
      
      if (recentSprints.length === 0) {
        throw new Error('No recent sprint data available');
      }

      // Calculate metrics
      const metrics = this.calculateVelocityMetrics(recentSprints);
      
      // Generate trends
      const trends = this.generateVelocityTrends(recentSprints);
      
      // Generate insights
      const insights = this.generateInsights(recentSprints, metrics);
      
      // Generate forecasts
      const forecasts = this.generateForecasts(recentSprints, metrics);

      const period = {
        startDate: recentSprints[0].startDate,
        endDate: recentSprints[recentSprints.length - 1].endDate,
        sprintCount: recentSprints.length
      };

      return {
        teamId,
        period,
        metrics,
        trends,
        insights,
        forecasts
      };

    } catch (error) {
      logger.error({ error, teamId }, 'Velocity analysis failed');
      throw error;
    }
  }

  async compareTeamVelocities(teamIds: string[]): Promise<Array<{
    teamId: string;
    averageVelocity: number;
    efficiency: number;
    predictability: number;
    rank: number;
  }>> {
    const comparisons = [];

    for (const teamId of teamIds) {
      try {
        const analysis = await this.analyzeVelocity(teamId, 5);
        comparisons.push({
          teamId,
          averageVelocity: analysis.metrics.averageVelocity,
          efficiency: analysis.metrics.efficiency,
          predictability: analysis.metrics.predictability,
          rank: 0 // Will be calculated after sorting
        });
      } catch (error) {
        logger.warn({ teamId, error }, 'Could not analyze team velocity for comparison');
      }
    }

    // Rank teams by overall performance (weighted average of metrics)
    comparisons.forEach(team => {
      team.rank = (team.averageVelocity * 0.4) + (team.efficiency * 0.3) + (team.predictability * 0.3);
    });

    comparisons.sort((a, b) => b.rank - a.rank);
    
    // Assign final ranks
    comparisons.forEach((team, index) => {
      team.rank = index + 1;
    });

    return comparisons;
  }

  private async loadVelocityHistory(): Promise<void> {
    // In a real implementation, this would load from database
    // For now, generate some sample data
    const sampleData: VelocityData[] = [
      {
        sprintId: 'sprint-1',
        teamId: 'team-alpha',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
        plannedPoints: 25,
        completedPoints: 23,
        carriedOverPoints: 2,
        addedPoints: 3,
        teamSize: 5,
        workingDays: 10
      },
      {
        sprintId: 'sprint-2',
        teamId: 'team-alpha',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-28'),
        plannedPoints: 27,
        completedPoints: 26,
        carriedOverPoints: 1,
        addedPoints: 2,
        teamSize: 5,
        workingDays: 10
      }
    ];

    sampleData.forEach(data => {
      const teamHistory = this.velocityHistory.get(data.teamId) || [];
      teamHistory.push(data);
      this.velocityHistory.set(data.teamId, teamHistory);
    });
  }

  private calculateVelocityMetrics(sprints: VelocityData[]): VelocityMetrics {
    const velocities = sprints.map(s => s.completedPoints);
    const efficiencies = sprints.map(s => s.completedPoints / s.plannedPoints);
    
    // Average velocity
    const averageVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    
    // Velocity trend
    const firstHalf = velocities.slice(0, Math.floor(velocities.length / 2));
    const secondHalf = velocities.slice(Math.floor(velocities.length / 2));
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
    
    let velocityTrend: 'increasing' | 'decreasing' | 'stable';
    const trendThreshold = 0.1; // 10% change threshold
    if (secondAvg > firstAvg * (1 + trendThreshold)) {
      velocityTrend = 'increasing';
    } else if (secondAvg < firstAvg * (1 - trendThreshold)) {
      velocityTrend = 'decreasing';
    } else {
      velocityTrend = 'stable';
    }
    
    // Predictability (inverse of coefficient of variation)
    const velocityStdDev = Math.sqrt(
      velocities.reduce((sum, v) => sum + Math.pow(v - averageVelocity, 2), 0) / velocities.length
    );
    const predictability = Math.max(0, 1 - (velocityStdDev / averageVelocity));
    
    // Efficiency (average completion rate)
    const efficiency = efficiencies.reduce((sum, e) => sum + e, 0) / efficiencies.length;
    
    // Capacity (points per team member per day)
    const totalCapacity = sprints.reduce((sum, s) => {
      return sum + (s.completedPoints / (s.teamSize * s.workingDays));
    }, 0);
    const capacity = totalCapacity / sprints.length;
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      averageVelocity, velocityTrend, predictability, efficiency
    );

    return {
      averageVelocity: Math.round(averageVelocity * 10) / 10,
      velocityTrend,
      predictability: Math.round(predictability * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100,
      capacity: Math.round(capacity * 100) / 100,
      recommendations
    };
  }

  private generateVelocityTrends(sprints: VelocityData[]): {
    velocityByWeek: Array<{ week: string; velocity: number }>;
    efficiencyByWeek: Array<{ week: string; efficiency: number }>;
    capacityByWeek: Array<{ week: string; capacity: number }>;
  } {
    const velocityByWeek = sprints.map(sprint => ({
      week: sprint.startDate.toISOString().split('T')[0],
      velocity: sprint.completedPoints
    }));

    const efficiencyByWeek = sprints.map(sprint => ({
      week: sprint.startDate.toISOString().split('T')[0],
      efficiency: Math.round((sprint.completedPoints / sprint.plannedPoints) * 100) / 100
    }));

    const capacityByWeek = sprints.map(sprint => ({
      week: sprint.startDate.toISOString().split('T')[0],
      capacity: Math.round((sprint.completedPoints / (sprint.teamSize * sprint.workingDays)) * 100) / 100
    }));

    return {
      velocityByWeek,
      efficiencyByWeek,
      capacityByWeek
    };
  }

  private generateInsights(sprints: VelocityData[], metrics: VelocityMetrics): string[] {
    const insights: string[] = [];

    // Velocity insights
    if (metrics.velocityTrend === 'increasing') {
      insights.push('Team velocity is improving over time, indicating growing efficiency');
    } else if (metrics.velocityTrend === 'decreasing') {
      insights.push('Team velocity is declining, consider investigating potential blockers');
    } else {
      insights.push('Team velocity is stable, showing consistent performance');
    }

    // Predictability insights
    if (metrics.predictability > 0.8) {
      insights.push('High predictability indicates reliable sprint planning and execution');
    } else if (metrics.predictability < 0.6) {
      insights.push('Low predictability suggests need for better estimation or scope management');
    }

    // Efficiency insights
    if (metrics.efficiency > 0.9) {
      insights.push('Excellent sprint completion rate, team is meeting commitments consistently');
    } else if (metrics.efficiency < 0.7) {
      insights.push('Low completion rate indicates over-commitment or unexpected obstacles');
    }

    // Capacity insights
    const avgCapacity = metrics.capacity;
    if (avgCapacity > 0.5) {
      insights.push('High individual capacity suggests efficient work distribution');
    } else if (avgCapacity < 0.3) {
      insights.push('Low individual capacity may indicate process inefficiencies or complex work');
    }

    // Sprint-specific insights
    const recentSprint = sprints[sprints.length - 1];
    if (recentSprint.addedPoints > recentSprint.plannedPoints * 0.2) {
      insights.push('High scope creep in recent sprint, consider better change management');
    }

    if (recentSprint.carriedOverPoints > recentSprint.plannedPoints * 0.3) {
      insights.push('Significant work carried over, review estimation accuracy and task breakdown');
    }

    return insights;
  }

  private generateForecasts(sprints: VelocityData[], metrics: VelocityMetrics): {
    nextSprintVelocity: number;
    confidenceInterval: { min: number; max: number };
    capacityForecast: number;
  } {
    const recentVelocities = sprints.slice(-3).map(s => s.completedPoints);
    const avgRecentVelocity = recentVelocities.reduce((sum, v) => sum + v, 0) / recentVelocities.length;
    
    // Adjust forecast based on trend
    let nextSprintVelocity = avgRecentVelocity;
    if (metrics.velocityTrend === 'increasing') {
      nextSprintVelocity *= 1.05; // 5% increase
    } else if (metrics.velocityTrend === 'decreasing') {
      nextSprintVelocity *= 0.95; // 5% decrease
    }

    // Calculate confidence interval based on predictability
    const variance = (1 - metrics.predictability) * 0.3; // Max 30% variance
    const confidenceInterval = {
      min: Math.max(1, Math.round(nextSprintVelocity * (1 - variance))),
      max: Math.round(nextSprintVelocity * (1 + variance))
    };

    return {
      nextSprintVelocity: Math.round(nextSprintVelocity),
      confidenceInterval,
      capacityForecast: metrics.capacity
    };
  }

  private generateRecommendations(
    averageVelocity: number,
    velocityTrend: string,
    predictability: number,
    efficiency: number
  ): string[] {
    const recommendations: string[] = [];

    if (velocityTrend === 'decreasing') {
      recommendations.push('Investigate causes of declining velocity - consider team retrospectives');
      recommendations.push('Review recent changes in process, tools, or team composition');
    }

    if (predictability < 0.6) {
      recommendations.push('Improve estimation accuracy through story point calibration sessions');
      recommendations.push('Consider breaking down large stories into smaller, more predictable tasks');
    }

    if (efficiency < 0.7) {
      recommendations.push('Review sprint planning process to avoid over-commitment');
      recommendations.push('Identify and address common blockers that prevent story completion');
    }

    if (averageVelocity < 15) {
      recommendations.push('Consider if team size or skill mix is appropriate for the workload');
      recommendations.push('Review if stories are appropriately sized for the team');
    }

    if (recommendations.length === 0) {
      recommendations.push('Team performance is strong - maintain current practices');
      recommendations.push('Consider sharing best practices with other teams');
    }

    return recommendations;
  }
}

// Export singleton instance
export const velocityAnalyzer = new VelocityAnalyzer();
