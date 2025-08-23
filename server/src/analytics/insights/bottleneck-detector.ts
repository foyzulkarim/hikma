import { logger } from '@/core/utils/logger';

export interface WorkflowStage {
  name: string;
  type: 'development' | 'review' | 'testing' | 'deployment' | 'planning';
  averageTime: number; // in hours
  capacity: number; // items that can be processed simultaneously
  throughput: number; // items processed per day
  queueLength: number; // current items waiting
  utilizationRate: number; // 0-1 scale
}

export interface BottleneckData {
  stageId: string;
  stageName: string;
  itemId: string;
  itemType: 'story' | 'bug' | 'task';
  entryTime: Date;
  exitTime?: Date;
  waitTime: number; // time spent waiting in queue
  processTime: number; // time spent being actively worked on
  assignee?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface BottleneckAnalysis {
  teamId: string;
  analysisDate: Date;
  bottlenecks: Array<{
    stageId: string;
    stageName: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    impact: number; // 0-1 scale
    metrics: {
      averageWaitTime: number;
      queueLength: number;
      utilizationRate: number;
      throughputRate: number;
    };
    causes: string[];
    recommendations: string[];
  }>;
  flowEfficiency: number; // ratio of process time to total cycle time
  cycleTime: {
    average: number;
    p50: number;
    p90: number;
    p95: number;
  };
  insights: string[];
}

export class BottleneckDetector {
  private initialized = false;
  private workflowData = new Map<string, BottleneckData[]>();
  private stageDefinitions = new Map<string, WorkflowStage>();

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Bottleneck Detector...');
      
      // Initialize default workflow stages
      await this.initializeDefaultStages();
      
      // Load historical workflow data
      await this.loadWorkflowData();
      
      this.initialized = true;
      logger.info('Bottleneck Detector initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Bottleneck Detector');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Bottleneck Detector...');
      this.workflowData.clear();
      this.stageDefinitions.clear();
      this.initialized = false;
      logger.info('Bottleneck Detector cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Bottleneck Detector');
    }
  }

  async addWorkflowData(teamId: string, data: BottleneckData[]): Promise<void> {
    const teamData = this.workflowData.get(teamId) || [];
    teamData.push(...data);
    
    // Keep only last 1000 items for analysis
    if (teamData.length > 1000) {
      teamData.splice(0, teamData.length - 1000);
    }
    
    this.workflowData.set(teamId, teamData);
    
    logger.debug({ teamId, itemCount: data.length }, 'Workflow data added');
  }

  async detectBottlenecks(teamId: string, daysBack: number = 30): Promise<BottleneckAnalysis> {
    if (!this.initialized) {
      throw new Error('Bottleneck Detector not initialized');
    }

    const teamData = this.workflowData.get(teamId);
    if (!teamData || teamData.length === 0) {
      throw new Error(`No workflow data found for team ${teamId}`);
    }

    try {
      // Filter data for the specified time period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      
      const recentData = teamData.filter(item => 
        item.entryTime >= cutoffDate && item.exitTime
      );

      if (recentData.length === 0) {
        throw new Error('No recent completed workflow data available');
      }

      // Analyze each stage for bottlenecks
      const bottlenecks = await this.analyzeStageBottlenecks(recentData);
      
      // Calculate flow efficiency
      const flowEfficiency = this.calculateFlowEfficiency(recentData);
      
      // Calculate cycle time metrics
      const cycleTime = this.calculateCycleTimeMetrics(recentData);
      
      // Generate insights
      const insights = this.generateBottleneckInsights(bottlenecks, flowEfficiency, cycleTime);

      return {
        teamId,
        analysisDate: new Date(),
        bottlenecks,
        flowEfficiency,
        cycleTime,
        insights
      };

    } catch (error) {
      logger.error({ error, teamId }, 'Bottleneck detection failed');
      throw error;
    }
  }

  async updateStageDefinition(stageId: string, stage: WorkflowStage): Promise<void> {
    this.stageDefinitions.set(stageId, stage);
    logger.debug({ stageId, stage }, 'Stage definition updated');
  }

  async getWorkflowMetrics(teamId: string): Promise<{
    totalItems: number;
    averageCycleTime: number;
    averageWaitTime: number;
    stageMetrics: Array<{
      stageId: string;
      stageName: string;
      averageTime: number;
      throughput: number;
      utilization: number;
    }>;
  }> {
    const teamData = this.workflowData.get(teamId) || [];
    const completedItems = teamData.filter(item => item.exitTime);

    if (completedItems.length === 0) {
      throw new Error('No completed items found for metrics calculation');
    }

    // Calculate overall metrics
    const totalCycleTime = completedItems.reduce((sum, item) => {
      const cycleTime = item.exitTime!.getTime() - item.entryTime.getTime();
      return sum + (cycleTime / (1000 * 60 * 60)); // Convert to hours
    }, 0);

    const totalWaitTime = completedItems.reduce((sum, item) => sum + item.waitTime, 0);

    const averageCycleTime = totalCycleTime / completedItems.length;
    const averageWaitTime = totalWaitTime / completedItems.length;

    // Calculate stage-specific metrics
    const stageMetrics = Array.from(this.stageDefinitions.entries()).map(([stageId, stage]) => {
      const stageItems = completedItems.filter(item => item.stageId === stageId);
      const stageProcessTime = stageItems.reduce((sum, item) => sum + item.processTime, 0);
      const avgProcessTime = stageItems.length > 0 ? stageProcessTime / stageItems.length : 0;

      return {
        stageId,
        stageName: stage.name,
        averageTime: Math.round(avgProcessTime * 10) / 10,
        throughput: Math.round((stageItems.length / 30) * 10) / 10, // items per day over 30 days
        utilization: Math.round(stage.utilizationRate * 100) / 100
      };
    });

    return {
      totalItems: completedItems.length,
      averageCycleTime: Math.round(averageCycleTime * 10) / 10,
      averageWaitTime: Math.round(averageWaitTime * 10) / 10,
      stageMetrics
    };
  }

  private async initializeDefaultStages(): Promise<void> {
    const defaultStages: Array<[string, WorkflowStage]> = [
      ['planning', {
        name: 'Planning & Analysis',
        type: 'planning',
        averageTime: 4,
        capacity: 3,
        throughput: 2,
        queueLength: 5,
        utilizationRate: 0.7
      }],
      ['development', {
        name: 'Development',
        type: 'development',
        averageTime: 16,
        capacity: 5,
        throughput: 1.5,
        queueLength: 8,
        utilizationRate: 0.85
      }],
      ['code_review', {
        name: 'Code Review',
        type: 'review',
        averageTime: 2,
        capacity: 3,
        throughput: 4,
        queueLength: 12,
        utilizationRate: 0.9
      }],
      ['testing', {
        name: 'Testing',
        type: 'testing',
        averageTime: 6,
        capacity: 2,
        throughput: 2,
        queueLength: 15,
        utilizationRate: 0.95
      }],
      ['deployment', {
        name: 'Deployment',
        type: 'deployment',
        averageTime: 1,
        capacity: 1,
        throughput: 5,
        queueLength: 3,
        utilizationRate: 0.6
      }]
    ];

    defaultStages.forEach(([id, stage]) => {
      this.stageDefinitions.set(id, stage);
    });
  }

  private async loadWorkflowData(): Promise<void> {
    // In a real implementation, this would load from database
    // For now, generate some sample data
    const sampleData: BottleneckData[] = [
      {
        stageId: 'development',
        stageName: 'Development',
        itemId: 'story-1',
        itemType: 'story',
        entryTime: new Date('2024-01-01T09:00:00Z'),
        exitTime: new Date('2024-01-03T17:00:00Z'),
        waitTime: 4,
        processTime: 16,
        assignee: 'dev-1',
        priority: 'medium'
      },
      {
        stageId: 'testing',
        stageName: 'Testing',
        itemId: 'story-1',
        itemType: 'story',
        entryTime: new Date('2024-01-03T17:00:00Z'),
        exitTime: new Date('2024-01-05T15:00:00Z'),
        waitTime: 8,
        processTime: 6,
        assignee: 'tester-1',
        priority: 'medium'
      }
    ];

    this.workflowData.set('team-alpha', sampleData);
  }

  private async analyzeStageBottlenecks(data: BottleneckData[]): Promise<Array<{
    stageId: string;
    stageName: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    impact: number;
    metrics: {
      averageWaitTime: number;
      queueLength: number;
      utilizationRate: number;
      throughputRate: number;
    };
    causes: string[];
    recommendations: string[];
  }>> {
    const stageAnalysis = new Map<string, {
      items: BottleneckData[];
      totalWaitTime: number;
      totalProcessTime: number;
    }>();

    // Group data by stage
    data.forEach(item => {
      if (!stageAnalysis.has(item.stageId)) {
        stageAnalysis.set(item.stageId, {
          items: [],
          totalWaitTime: 0,
          totalProcessTime: 0
        });
      }
      
      const analysis = stageAnalysis.get(item.stageId)!;
      analysis.items.push(item);
      analysis.totalWaitTime += item.waitTime;
      analysis.totalProcessTime += item.processTime;
    });

    const bottlenecks = [];

    for (const [stageId, analysis] of stageAnalysis.entries()) {
      const stage = this.stageDefinitions.get(stageId);
      if (!stage) continue;

      const itemCount = analysis.items.length;
      const averageWaitTime = analysis.totalWaitTime / itemCount;
      const averageProcessTime = analysis.totalProcessTime / itemCount;
      const throughputRate = itemCount / 30; // items per day over 30 days

      // Calculate bottleneck severity
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let impact = 0;

      // High wait time indicates bottleneck
      if (averageWaitTime > stage.averageTime * 2) {
        severity = 'high';
        impact += 0.4;
      } else if (averageWaitTime > stage.averageTime) {
        severity = 'medium';
        impact += 0.2;
      }

      // High utilization indicates bottleneck
      if (stage.utilizationRate > 0.9) {
        if (severity === 'low') severity = 'medium';
        else if (severity === 'medium') severity = 'high';
        else if (severity === 'high') severity = 'critical';
        impact += 0.3;
      }

      // Low throughput compared to capacity indicates bottleneck
      if (throughputRate < stage.capacity * 0.5) {
        if (severity === 'low') severity = 'medium';
        impact += 0.2;
      }

      // High queue length indicates bottleneck
      if (stage.queueLength > stage.capacity * 3) {
        if (severity === 'low') severity = 'medium';
        else if (severity === 'medium') severity = 'high';
        impact += 0.1;
      }

      const causes = this.identifyBottleneckCauses(stage, averageWaitTime, throughputRate);
      const recommendations = this.generateBottleneckRecommendations(stage, severity, causes);

      bottlenecks.push({
        stageId,
        stageName: stage.name,
        severity,
        impact: Math.min(1, impact),
        metrics: {
          averageWaitTime: Math.round(averageWaitTime * 10) / 10,
          queueLength: stage.queueLength,
          utilizationRate: stage.utilizationRate,
          throughputRate: Math.round(throughputRate * 10) / 10
        },
        causes,
        recommendations
      });
    }

    // Sort by impact (highest first)
    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  private calculateFlowEfficiency(data: BottleneckData[]): number {
    const totalProcessTime = data.reduce((sum, item) => sum + item.processTime, 0);
    const totalCycleTime = data.reduce((sum, item) => {
      if (!item.exitTime) return sum;
      const cycleTime = (item.exitTime.getTime() - item.entryTime.getTime()) / (1000 * 60 * 60);
      return sum + cycleTime;
    }, 0);

    return totalCycleTime > 0 ? Math.round((totalProcessTime / totalCycleTime) * 100) / 100 : 0;
  }

  private calculateCycleTimeMetrics(data: BottleneckData[]): {
    average: number;
    p50: number;
    p90: number;
    p95: number;
  } {
    const cycleTimes = data
      .filter(item => item.exitTime)
      .map(item => {
        const cycleTime = (item.exitTime!.getTime() - item.entryTime.getTime()) / (1000 * 60 * 60);
        return cycleTime;
      })
      .sort((a, b) => a - b);

    if (cycleTimes.length === 0) {
      return { average: 0, p50: 0, p90: 0, p95: 0 };
    }

    const average = cycleTimes.reduce((sum, time) => sum + time, 0) / cycleTimes.length;
    const p50 = cycleTimes[Math.floor(cycleTimes.length * 0.5)];
    const p90 = cycleTimes[Math.floor(cycleTimes.length * 0.9)];
    const p95 = cycleTimes[Math.floor(cycleTimes.length * 0.95)];

    return {
      average: Math.round(average * 10) / 10,
      p50: Math.round(p50 * 10) / 10,
      p90: Math.round(p90 * 10) / 10,
      p95: Math.round(p95 * 10) / 10
    };
  }

  private identifyBottleneckCauses(
    stage: WorkflowStage, 
    averageWaitTime: number, 
    throughputRate: number
  ): string[] {
    const causes: string[] = [];

    if (stage.utilizationRate > 0.9) {
      causes.push('High resource utilization - team members overloaded');
    }

    if (averageWaitTime > stage.averageTime * 2) {
      causes.push('Excessive wait times - work piling up in queue');
    }

    if (throughputRate < stage.capacity * 0.5) {
      causes.push('Low throughput - capacity not being fully utilized');
    }

    if (stage.queueLength > stage.capacity * 3) {
      causes.push('Large queue size - work backing up');
    }

    if (stage.type === 'review' && stage.utilizationRate > 0.85) {
      causes.push('Review bottleneck - limited reviewers available');
    }

    if (stage.type === 'testing' && stage.queueLength > 10) {
      causes.push('Testing bottleneck - insufficient test capacity');
    }

    return causes;
  }

  private generateBottleneckRecommendations(
    stage: WorkflowStage, 
    severity: string, 
    causes: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (causes.includes('High resource utilization - team members overloaded')) {
      recommendations.push('Add more team members to this stage or redistribute workload');
      recommendations.push('Consider cross-training team members to increase flexibility');
    }

    if (causes.includes('Excessive wait times - work piling up in queue')) {
      recommendations.push('Implement WIP (Work In Progress) limits to control queue size');
      recommendations.push('Prioritize items more effectively to reduce wait times');
    }

    if (causes.includes('Review bottleneck - limited reviewers available')) {
      recommendations.push('Train more team members to perform code reviews');
      recommendations.push('Implement pair programming to reduce review overhead');
    }

    if (causes.includes('Testing bottleneck - insufficient test capacity')) {
      recommendations.push('Invest in test automation to increase testing throughput');
      recommendations.push('Add dedicated testing resources or cross-train developers');
    }

    if (severity === 'critical') {
      recommendations.push('This is a critical bottleneck requiring immediate attention');
      recommendations.push('Consider emergency measures to clear the backlog');
    }

    return recommendations;
  }

  private generateBottleneckInsights(
    bottlenecks: any[], 
    flowEfficiency: number, 
    cycleTime: any
  ): string[] {
    const insights: string[] = [];

    // Flow efficiency insights
    if (flowEfficiency < 0.2) {
      insights.push('Very low flow efficiency - most time is spent waiting rather than working');
    } else if (flowEfficiency > 0.5) {
      insights.push('Good flow efficiency - work moves through the system effectively');
    }

    // Cycle time insights
    if (cycleTime.p95 > cycleTime.average * 2) {
      insights.push('High variability in cycle times - some items take much longer than others');
    }

    // Bottleneck insights
    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) {
      insights.push(`${criticalBottlenecks.length} critical bottleneck(s) detected requiring immediate attention`);
    }

    const highImpactBottlenecks = bottlenecks.filter(b => b.impact > 0.7);
    if (highImpactBottlenecks.length > 0) {
      insights.push(`Focus on ${highImpactBottlenecks[0].stageName} stage for maximum improvement impact`);
    }

    return insights;
  }
}

// Export singleton instance
export const bottleneckDetector = new BottleneckDetector();
