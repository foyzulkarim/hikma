import { logger } from '@/core/utils/logger';

export interface EffortEstimationInput {
  storyPoints: number;
  teamSize: number;
  teamVelocity?: number; // Average story points per sprint
  complexity: 'low' | 'medium' | 'high';
  riskFactors?: string[];
  dependencies?: number; // Number of dependencies
  projectId?: string;
  assigneeExperience?: 'junior' | 'mid' | 'senior';
}

export interface EffortEstimation {
  estimatedHours: number;
  estimatedDays: number;
  confidence: number; // 0-1 scale
  range: {
    min: number;
    max: number;
  };
  factors: {
    baseEffort: number;
    complexityMultiplier: number;
    teamEfficiencyFactor: number;
    riskBuffer: number;
    dependencyImpact: number;
  };
  recommendations: string[];
  milestones?: Array<{
    name: string;
    estimatedCompletion: string;
    percentage: number;
  }>;
}

export interface TeamMetrics {
  teamId: string;
  averageVelocity: number;
  averageHoursPerPoint: number;
  completionAccuracy: number;
  riskTolerance: number;
}

export class EffortEstimator {
  private initialized = false;
  private teamMetrics = new Map<string, TeamMetrics>();
  private baseHoursPerPoint = 6; // Default hours per story point
  private workingHoursPerDay = 6; // Effective working hours per day

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Effort Estimator...');
      
      // Load team metrics and historical data
      await this.loadTeamMetrics();
      
      this.initialized = true;
      logger.info('Effort Estimator initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Effort Estimator');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Effort Estimator...');
      this.teamMetrics.clear();
      this.initialized = false;
      logger.info('Effort Estimator cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Effort Estimator');
    }
  }

  async estimateEffort(input: EffortEstimationInput): Promise<EffortEstimation> {
    if (!this.initialized) {
      throw new Error('Effort Estimator not initialized');
    }

    try {
      // Get team-specific metrics if available
      const teamMetrics = this.getTeamMetrics(input.projectId);
      
      // Calculate base effort
      const baseHoursPerPoint = teamMetrics?.averageHoursPerPoint || this.baseHoursPerPoint;
      const baseEffort = input.storyPoints * baseHoursPerPoint;

      // Calculate various factors
      const factors = {
        baseEffort,
        complexityMultiplier: this.getComplexityMultiplier(input.complexity),
        teamEfficiencyFactor: this.getTeamEfficiencyFactor(input.teamSize, input.teamVelocity),
        riskBuffer: this.calculateRiskBuffer(input.riskFactors || []),
        dependencyImpact: this.calculateDependencyImpact(input.dependencies || 0)
      };

      // Calculate total estimated hours
      let estimatedHours = baseEffort * factors.complexityMultiplier * factors.teamEfficiencyFactor;
      estimatedHours += factors.riskBuffer + factors.dependencyImpact;

      // Apply assignee experience factor
      if (input.assigneeExperience) {
        const experienceMultiplier = this.getExperienceMultiplier(input.assigneeExperience);
        estimatedHours *= experienceMultiplier;
      }

      // Calculate confidence based on available data
      const confidence = this.calculateConfidence(input, teamMetrics);

      // Calculate range (±20% based on confidence)
      const variance = (1 - confidence) * 0.4; // 40% max variance for low confidence
      const range = {
        min: Math.max(1, estimatedHours * (1 - variance)),
        max: estimatedHours * (1 + variance)
      };

      // Convert to days
      const estimatedDays = estimatedHours / this.workingHoursPerDay;

      // Generate recommendations
      const recommendations = this.generateRecommendations(input, factors, estimatedHours);

      // Generate milestones
      const milestones = this.generateMilestones(estimatedDays);

      return {
        estimatedHours: Math.round(estimatedHours),
        estimatedDays: Math.round(estimatedDays * 10) / 10, // Round to 1 decimal
        confidence,
        range: {
          min: Math.round(range.min),
          max: Math.round(range.max)
        },
        factors,
        recommendations,
        milestones
      };

    } catch (error) {
      logger.error({ error, input }, 'Effort estimation failed');
      throw error;
    }
  }

  async updateTeamMetrics(teamId: string, metrics: Partial<TeamMetrics>): Promise<void> {
    const existing = this.teamMetrics.get(teamId) || {
      teamId,
      averageVelocity: 20,
      averageHoursPerPoint: this.baseHoursPerPoint,
      completionAccuracy: 0.8,
      riskTolerance: 0.2
    };

    this.teamMetrics.set(teamId, { ...existing, ...metrics });
    logger.debug({ teamId, metrics }, 'Team metrics updated');
  }

  private async loadTeamMetrics(): Promise<void> {
    // In a real implementation, this would load from database
    // For now, use some default team metrics
    this.teamMetrics.set('default', {
      teamId: 'default',
      averageVelocity: 25,
      averageHoursPerPoint: 6,
      completionAccuracy: 0.75,
      riskTolerance: 0.25
    });
  }

  private getTeamMetrics(projectId?: string): TeamMetrics | undefined {
    if (projectId) {
      return this.teamMetrics.get(projectId) || this.teamMetrics.get('default');
    }
    return this.teamMetrics.get('default');
  }

  private getComplexityMultiplier(complexity: string): number {
    const multipliers = {
      'low': 0.8,
      'medium': 1.0,
      'high': 1.4
    };

    return multipliers[complexity as keyof typeof multipliers] || 1.0;
  }

  private getTeamEfficiencyFactor(teamSize: number, teamVelocity?: number): number {
    // Optimal team size is around 5-7 people
    let efficiencyFactor = 1.0;

    if (teamSize < 3) {
      efficiencyFactor = 1.2; // Small teams can be more efficient but may lack expertise
    } else if (teamSize > 8) {
      efficiencyFactor = 1.3; // Large teams have communication overhead
    }

    // Adjust based on team velocity if provided
    if (teamVelocity) {
      const expectedVelocity = teamSize * 4; // Rough estimate: 4 points per person per sprint
      const velocityRatio = teamVelocity / expectedVelocity;
      
      if (velocityRatio > 1.2) {
        efficiencyFactor *= 0.9; // High-performing team
      } else if (velocityRatio < 0.8) {
        efficiencyFactor *= 1.2; // Underperforming team needs more time
      }
    }

    return efficiencyFactor;
  }

  private calculateRiskBuffer(riskFactors: string[]): number {
    const riskWeights = {
      'new_technology': 4,
      'external_dependency': 3,
      'unclear_requirements': 5,
      'tight_deadline': 2,
      'complex_integration': 4,
      'performance_critical': 3,
      'security_sensitive': 3,
      'legacy_system': 4
    };

    let totalRiskHours = 0;
    riskFactors.forEach(risk => {
      const weight = riskWeights[risk as keyof typeof riskWeights] || 2;
      totalRiskHours += weight;
    });

    return totalRiskHours;
  }

  private calculateDependencyImpact(dependencies: number): number {
    // Each dependency adds potential delay
    return dependencies * 2; // 2 hours per dependency for coordination/waiting
  }

  private getExperienceMultiplier(experience: string): number {
    const multipliers = {
      'junior': 1.3,
      'mid': 1.0,
      'senior': 0.8
    };

    return multipliers[experience as keyof typeof multipliers] || 1.0;
  }

  private calculateConfidence(input: EffortEstimationInput, teamMetrics?: TeamMetrics): number {
    let confidence = 0.6; // Base confidence

    // Increase confidence if we have team metrics
    if (teamMetrics) {
      confidence += 0.2;
      
      // Higher confidence for teams with good completion accuracy
      if (teamMetrics.completionAccuracy > 0.8) {
        confidence += 0.1;
      }
    }

    // Increase confidence if team velocity is provided
    if (input.teamVelocity) {
      confidence += 0.1;
    }

    // Decrease confidence for high-risk factors
    const riskCount = input.riskFactors?.length || 0;
    confidence -= riskCount * 0.05;

    // Decrease confidence for many dependencies
    const dependencyCount = input.dependencies || 0;
    confidence -= dependencyCount * 0.02;

    return Math.max(0.3, Math.min(1, confidence));
  }

  private generateRecommendations(
    input: EffortEstimationInput, 
    factors: any, 
    estimatedHours: number
  ): string[] {
    const recommendations: string[] = [];

    // Team size recommendations
    if (input.teamSize < 2) {
      recommendations.push('Consider adding team members for knowledge sharing and risk mitigation');
    } else if (input.teamSize > 8) {
      recommendations.push('Large team size may cause communication overhead - consider splitting work');
    }

    // Complexity recommendations
    if (input.complexity === 'high') {
      recommendations.push('High complexity work - consider breaking into smaller tasks');
      recommendations.push('Plan for additional code review and testing time');
    }

    // Risk factor recommendations
    const riskFactors = input.riskFactors || [];
    if (riskFactors.includes('new_technology')) {
      recommendations.push('Allocate time for learning and experimentation with new technology');
    }
    if (riskFactors.includes('unclear_requirements')) {
      recommendations.push('Clarify requirements before starting development to avoid rework');
    }
    if (riskFactors.includes('external_dependency')) {
      recommendations.push('Identify and communicate with external dependencies early');
    }

    // Time-based recommendations
    if (estimatedHours > 40) {
      recommendations.push('Consider breaking this work into multiple iterations or sprints');
    }

    // Experience-based recommendations
    if (input.assigneeExperience === 'junior') {
      recommendations.push('Pair junior developer with senior team member for guidance');
    }

    return recommendations;
  }

  private generateMilestones(estimatedDays: number): Array<{
    name: string;
    estimatedCompletion: string;
    percentage: number;
  }> {
    const milestones = [];
    const startDate = new Date();

    if (estimatedDays > 1) {
      // 25% milestone
      const milestone25 = new Date(startDate);
      milestone25.setDate(startDate.getDate() + Math.ceil(estimatedDays * 0.25));
      milestones.push({
        name: 'Initial Setup & Planning',
        estimatedCompletion: milestone25.toISOString().split('T')[0],
        percentage: 25
      });
    }

    if (estimatedDays > 3) {
      // 50% milestone
      const milestone50 = new Date(startDate);
      milestone50.setDate(startDate.getDate() + Math.ceil(estimatedDays * 0.5));
      milestones.push({
        name: 'Core Implementation',
        estimatedCompletion: milestone50.toISOString().split('T')[0],
        percentage: 50
      });

      // 75% milestone
      const milestone75 = new Date(startDate);
      milestone75.setDate(startDate.getDate() + Math.ceil(estimatedDays * 0.75));
      milestones.push({
        name: 'Testing & Integration',
        estimatedCompletion: milestone75.toISOString().split('T')[0],
        percentage: 75
      });
    }

    // Completion milestone
    const completion = new Date(startDate);
    completion.setDate(startDate.getDate() + Math.ceil(estimatedDays));
    milestones.push({
      name: 'Completion & Delivery',
      estimatedCompletion: completion.toISOString().split('T')[0],
      percentage: 100
    });

    return milestones;
  }

  // Get estimator statistics
  getEstimatorStats(): {
    teamCount: number;
    baseHoursPerPoint: number;
    workingHoursPerDay: number;
    averageAccuracy?: number;
  } {
    return {
      teamCount: this.teamMetrics.size,
      baseHoursPerPoint: this.baseHoursPerPoint,
      workingHoursPerDay: this.workingHoursPerDay
    };
  }
}

// Export singleton instance
export const effortEstimator = new EffortEstimator();
