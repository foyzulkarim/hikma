import { BaseAction, ActionContext, ActionConfig, ActionExecutionResult } from './base-action';
import { logger } from '@/core/utils/logger';

export interface PRSummaryConfig extends ActionConfig {
  metadata: {
    includeFileChanges?: boolean;
    includeCommitAnalysis?: boolean;
    maxFilesToList?: number;
    summaryTemplate?: string;
    postAsComment?: boolean;
    updateDescription?: boolean;
    analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
  };
}

export interface PRSummaryResult {
  summary: string;
  analysis: {
    complexity: 'low' | 'medium' | 'high';
    riskLevel: 'low' | 'medium' | 'high';
    estimatedReviewTime: number; // in minutes
    keyChanges: string[];
    potentialIssues: string[];
    recommendations: string[];
  };
  metrics: {
    filesChanged: number;
    linesAdded: number;
    linesDeleted: number;
    commits: number;
  };
  formatted: {
    markdown: string;
    html?: string;
  };
}

export class PRSummaryAction extends BaseAction {
  constructor(config: PRSummaryConfig) {
    super(config);
  }

  async execute(context: ActionContext): Promise<ActionExecutionResult> {
    try {
      this.validateContext(context);
      
      // Extract PR information from event payload
      const prInfo = this.extractPRInfo(context);
      if (!prInfo) {
        throw new Error('Could not extract PR information from event payload');
      }

      // Generate PR summary and analysis
      const summaryResult = await this.generatePRSummary(prInfo, context);

      // Post summary if configured
      if (this.shouldPostSummary()) {
        await this.postSummary(summaryResult, prInfo, context);
      }

      logger.info({ 
        actionId: this.config.id,
        prNumber: prInfo.number,
        complexity: summaryResult.analysis.complexity,
        riskLevel: summaryResult.analysis.riskLevel
      }, 'PR summary generated successfully');

      return {
        success: true,
        executionTime: 0, // Will be set by base class
        output: summaryResult,
        metadata: {
          prNumber: prInfo.number,
          complexity: summaryResult.analysis.complexity,
          riskLevel: summaryResult.analysis.riskLevel
        }
      };

    } catch (error) {
      logger.error({ error, actionId: this.config.id }, 'PR summary action failed');
      throw error;
    }
  }

  private extractPRInfo(context: ActionContext): {
    number: number;
    title: string;
    body: string;
    author: string;
    baseBranch: string;
    headBranch: string;
    filesChanged: string[];
    commits: Array<{
      message: string;
      author: string;
      sha: string;
    }>;
    additions: number;
    deletions: number;
    isDraft: boolean;
    labels: string[];
  } | null {
    try {
      const payload = context.eventPayload;
      const pr = payload.pullRequest || payload.pull_request;
      
      if (!pr) {
        return null;
      }

      return {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        author: pr.user?.login || 'unknown',
        baseBranch: pr.base?.ref || 'main',
        headBranch: pr.head?.ref || 'feature',
        filesChanged: pr.changed_files || [],
        commits: pr.commits || [],
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        isDraft: pr.draft || false,
        labels: (pr.labels || []).map((label: any) => label.name)
      };
    } catch (error) {
      logger.error({ error }, 'Failed to extract PR info');
      return null;
    }
  }

  private async generatePRSummary(prInfo: any, context: ActionContext): Promise<PRSummaryResult> {
    const config = this.config as PRSummaryConfig;
    const analysisDepth = config.metadata?.analysisDepth || 'basic';

    // Analyze PR complexity
    const complexity = this.analyzeComplexity(prInfo);
    
    // Assess risk level
    const riskLevel = this.assessRiskLevel(prInfo);
    
    // Estimate review time
    const estimatedReviewTime = this.estimateReviewTime(prInfo, complexity);
    
    // Identify key changes
    const keyChanges = this.identifyKeyChanges(prInfo);
    
    // Identify potential issues
    const potentialIssues = this.identifyPotentialIssues(prInfo);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(prInfo, complexity, riskLevel);

    // Create summary text
    const summary = this.createSummary(prInfo, {
      complexity,
      riskLevel,
      estimatedReviewTime,
      keyChanges,
      potentialIssues,
      recommendations
    });

    // Format as markdown
    const markdown = this.formatAsMarkdown(prInfo, {
      complexity,
      riskLevel,
      estimatedReviewTime,
      keyChanges,
      potentialIssues,
      recommendations
    });

    return {
      summary,
      analysis: {
        complexity,
        riskLevel,
        estimatedReviewTime,
        keyChanges,
        potentialIssues,
        recommendations
      },
      metrics: {
        filesChanged: prInfo.filesChanged.length,
        linesAdded: prInfo.additions,
        linesDeleted: prInfo.deletions,
        commits: prInfo.commits.length
      },
      formatted: {
        markdown
      }
    };
  }

  private analyzeComplexity(prInfo: any): 'low' | 'medium' | 'high' {
    let complexityScore = 0;

    // File count factor
    if (prInfo.filesChanged.length > 20) complexityScore += 3;
    else if (prInfo.filesChanged.length > 10) complexityScore += 2;
    else if (prInfo.filesChanged.length > 5) complexityScore += 1;

    // Line changes factor
    const totalChanges = prInfo.additions + prInfo.deletions;
    if (totalChanges > 1000) complexityScore += 3;
    else if (totalChanges > 500) complexityScore += 2;
    else if (totalChanges > 100) complexityScore += 1;

    // Commit count factor
    if (prInfo.commits.length > 10) complexityScore += 2;
    else if (prInfo.commits.length > 5) complexityScore += 1;

    // File type analysis
    const hasConfigFiles = prInfo.filesChanged.some((file: string) => 
      file.includes('config') || file.includes('.json') || file.includes('.yml') || file.includes('.yaml')
    );
    if (hasConfigFiles) complexityScore += 1;

    const hasDatabaseFiles = prInfo.filesChanged.some((file: string) => 
      file.includes('migration') || file.includes('schema') || file.includes('.sql')
    );
    if (hasDatabaseFiles) complexityScore += 2;

    if (complexityScore >= 6) return 'high';
    if (complexityScore >= 3) return 'medium';
    return 'low';
  }

  private assessRiskLevel(prInfo: any): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Critical file changes
    const criticalFiles = prInfo.filesChanged.filter((file: string) => 
      file.includes('auth') || 
      file.includes('security') || 
      file.includes('payment') || 
      file.includes('database') ||
      file.includes('migration') ||
      file.includes('config')
    );
    riskScore += criticalFiles.length * 2;

    // Large deletions
    if (prInfo.deletions > prInfo.additions * 2) riskScore += 2;

    // Many files changed
    if (prInfo.filesChanged.length > 15) riskScore += 2;

    // Draft status
    if (prInfo.isDraft) riskScore -= 1;

    // Labels indicating risk
    const riskLabels = ['breaking-change', 'security', 'database', 'critical'];
    const hasRiskLabel = prInfo.labels.some((label: string) => 
      riskLabels.some(riskLabel => label.toLowerCase().includes(riskLabel))
    );
    if (hasRiskLabel) riskScore += 3;

    if (riskScore >= 6) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  private estimateReviewTime(prInfo: any, complexity: string): number {
    let baseTime = 15; // 15 minutes base

    // Adjust based on complexity
    if (complexity === 'high') baseTime *= 3;
    else if (complexity === 'medium') baseTime *= 2;

    // Adjust based on file count
    baseTime += Math.min(prInfo.filesChanged.length * 2, 30);

    // Adjust based on line changes
    const totalChanges = prInfo.additions + prInfo.deletions;
    baseTime += Math.min(totalChanges / 50, 60);

    return Math.round(baseTime);
  }

  private identifyKeyChanges(prInfo: any): string[] {
    const keyChanges: string[] = [];

    // Analyze file types
    const fileTypes = new Map<string, number>();
    prInfo.filesChanged.forEach((file: string) => {
      const ext = file.split('.').pop()?.toLowerCase() || 'unknown';
      fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
    });

    // Report significant file type changes
    for (const [ext, count] of fileTypes.entries()) {
      if (count > 3) {
        keyChanges.push(`Modified ${count} ${ext} files`);
      }
    }

    // Check for specific patterns
    if (prInfo.filesChanged.some((file: string) => file.includes('test'))) {
      keyChanges.push('Includes test changes');
    }

    if (prInfo.filesChanged.some((file: string) => file.includes('doc'))) {
      keyChanges.push('Includes documentation updates');
    }

    if (prInfo.filesChanged.some((file: string) => file.includes('config'))) {
      keyChanges.push('Includes configuration changes');
    }

    // Analyze commit messages for patterns
    const commitMessages = prInfo.commits.map((commit: any) => commit.message.toLowerCase());
    if (commitMessages.some((msg: string) => msg.includes('fix') || msg.includes('bug'))) {
      keyChanges.push('Contains bug fixes');
    }

    if (commitMessages.some((msg: string) => msg.includes('feat') || msg.includes('feature'))) {
      keyChanges.push('Adds new features');
    }

    if (commitMessages.some((msg: string) => msg.includes('refactor'))) {
      keyChanges.push('Includes refactoring');
    }

    return keyChanges;
  }

  private identifyPotentialIssues(prInfo: any): string[] {
    const issues: string[] = [];

    // Large PR warning
    if (prInfo.filesChanged.length > 20) {
      issues.push('Large PR - consider breaking into smaller changes');
    }

    // Missing tests
    const hasTestFiles = prInfo.filesChanged.some((file: string) => 
      file.includes('test') || file.includes('spec')
    );
    const hasCodeFiles = prInfo.filesChanged.some((file: string) => 
      file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.py')
    );
    
    if (hasCodeFiles && !hasTestFiles) {
      issues.push('No test files modified - consider adding tests');
    }

    // Missing documentation
    const hasDocFiles = prInfo.filesChanged.some((file: string) => 
      file.includes('doc') || file.includes('readme') || file.endsWith('.md')
    );
    
    if (prInfo.filesChanged.length > 10 && !hasDocFiles) {
      issues.push('Large change without documentation updates');
    }

    // Potential merge conflicts
    if (prInfo.commits.length > 10) {
      issues.push('Many commits - consider squashing before merge');
    }

    return issues;
  }

  private generateRecommendations(prInfo: any, complexity: string, riskLevel: string): string[] {
    const recommendations: string[] = [];

    if (complexity === 'high') {
      recommendations.push('Schedule dedicated time for thorough review');
      recommendations.push('Consider pair review for complex changes');
    }

    if (riskLevel === 'high') {
      recommendations.push('Test thoroughly in staging environment');
      recommendations.push('Plan rollback strategy before deployment');
    }

    if (prInfo.isDraft) {
      recommendations.push('Mark as ready for review when complete');
    }

    // File-specific recommendations
    const hasConfigChanges = prInfo.filesChanged.some((file: string) => 
      file.includes('config') || file.includes('.env')
    );
    if (hasConfigChanges) {
      recommendations.push('Verify configuration changes in all environments');
    }

    const hasDatabaseChanges = prInfo.filesChanged.some((file: string) => 
      file.includes('migration') || file.includes('schema')
    );
    if (hasDatabaseChanges) {
      recommendations.push('Review database migration carefully');
      recommendations.push('Test migration on copy of production data');
    }

    return recommendations;
  }

  private createSummary(prInfo: any, analysis: any): string {
    const config = this.config as PRSummaryConfig;
    const template = config.metadata?.summaryTemplate;
    
    if (template) {
      return this.formatTemplate(template, {
        title: prInfo.title,
        author: prInfo.author,
        filesChanged: prInfo.filesChanged.length,
        additions: prInfo.additions,
        deletions: prInfo.deletions,
        complexity: analysis.complexity,
        riskLevel: analysis.riskLevel,
        estimatedReviewTime: analysis.estimatedReviewTime
      });
    }

    return `PR #${prInfo.number}: ${prInfo.title}

This PR modifies ${prInfo.filesChanged.length} files with ${prInfo.additions} additions and ${prInfo.deletions} deletions.

Complexity: ${analysis.complexity.toUpperCase()}
Risk Level: ${analysis.riskLevel.toUpperCase()}
Estimated Review Time: ${analysis.estimatedReviewTime} minutes`;
  }

  private formatAsMarkdown(prInfo: any, analysis: any): string {
    const config = this.config as PRSummaryConfig;
    
    let markdown = `## 📋 PR Summary

**Complexity:** ${this.getComplexityEmoji(analysis.complexity)} ${analysis.complexity.toUpperCase()}
**Risk Level:** ${this.getRiskEmoji(analysis.riskLevel)} ${analysis.riskLevel.toUpperCase()}
**Estimated Review Time:** ⏱️ ${analysis.estimatedReviewTime} minutes

### 📊 Metrics
- **Files Changed:** ${prInfo.filesChanged.length}
- **Lines Added:** +${prInfo.additions}
- **Lines Deleted:** -${prInfo.deletions}
- **Commits:** ${prInfo.commits.length}

`;

    if (analysis.keyChanges.length > 0) {
      markdown += `### 🔑 Key Changes
${analysis.keyChanges.map((change: string) => `- ${change}`).join('\n')}

`;
    }

    if (analysis.potentialIssues.length > 0) {
      markdown += `### ⚠️ Potential Issues
${analysis.potentialIssues.map((issue: string) => `- ${issue}`).join('\n')}

`;
    }

    if (analysis.recommendations.length > 0) {
      markdown += `### 💡 Recommendations
${analysis.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

`;
    }

    if (config.metadata?.includeFileChanges && prInfo.filesChanged.length > 0) {
      const maxFiles = config.metadata?.maxFilesToList || 10;
      const filesToShow = prInfo.filesChanged.slice(0, maxFiles);
      
      markdown += `### 📁 Changed Files
${filesToShow.map((file: string) => `- \`${file}\``).join('\n')}`;
      
      if (prInfo.filesChanged.length > maxFiles) {
        markdown += `\n... and ${prInfo.filesChanged.length - maxFiles} more files`;
      }
    }

    return markdown;
  }

  private getComplexityEmoji(complexity: string): string {
    switch (complexity) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🔴';
      default: return '⚪';
    }
  }

  private getRiskEmoji(risk: string): string {
    switch (risk) {
      case 'low': return '✅';
      case 'medium': return '⚠️';
      case 'high': return '🚨';
      default: return '❓';
    }
  }

  private shouldPostSummary(): boolean {
    const config = this.config as PRSummaryConfig;
    return config.metadata?.postAsComment === true || config.metadata?.updateDescription === true;
  }

  private async postSummary(summaryResult: PRSummaryResult, prInfo: any, context: ActionContext): Promise<void> {
    // In a real implementation, this would post to GitHub API
    // For now, just log the action
    logger.info({ 
      actionId: this.config.id,
      prNumber: prInfo.number,
      summaryLength: summaryResult.formatted.markdown.length
    }, 'Would post PR summary (GitHub API integration needed)');
  }

  // Helper method to create PR summary action configs
  static createConfig(options: {
    id: string;
    name: string;
    description: string;
    includeFileChanges?: boolean;
    includeCommitAnalysis?: boolean;
    maxFilesToList?: number;
    postAsComment?: boolean;
    updateDescription?: boolean;
    analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
    summaryTemplate?: string;
    enabled?: boolean;
    retryAttempts?: number;
    timeoutMs?: number;
  }): PRSummaryConfig {
    return {
      id: options.id,
      name: options.name,
      description: options.description,
      enabled: options.enabled ?? true,
      retryAttempts: options.retryAttempts ?? 2,
      timeoutMs: options.timeoutMs ?? 30000,
      metadata: {
        includeFileChanges: options.includeFileChanges ?? true,
        includeCommitAnalysis: options.includeCommitAnalysis ?? true,
        maxFilesToList: options.maxFilesToList ?? 10,
        postAsComment: options.postAsComment ?? true,
        updateDescription: options.updateDescription ?? false,
        analysisDepth: options.analysisDepth ?? 'basic',
        summaryTemplate: options.summaryTemplate
      }
    };
  }
}
