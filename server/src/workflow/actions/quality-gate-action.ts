import { BaseAction, ActionContext, ActionConfig, ActionExecutionResult } from './base-action';
import { logger } from '@/core/utils/logger';

export interface QualityGateConfig extends ActionConfig {
  metadata: {
    checks: Array<{
      name: string;
      type: 'file_count' | 'line_changes' | 'test_coverage' | 'commit_message' | 'branch_name' | 'custom';
      enabled: boolean;
      threshold?: number;
      pattern?: string;
      required?: boolean;
      severity: 'error' | 'warning' | 'info';
    }>;
    failOnError?: boolean;
    postResults?: boolean;
    blockMerge?: boolean;
  };
}

export interface QualityCheckResult {
  name: string;
  type: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: any;
}

export interface QualityGateResult {
  overallPassed: boolean;
  checks: QualityCheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  recommendation: string;
}

export class QualityGateAction extends BaseAction {
  constructor(config: QualityGateConfig) {
    super(config);
  }

  async execute(context: ActionContext): Promise<ActionExecutionResult> {
    try {
      this.validateContext(context);
      
      const config = this.config as QualityGateConfig;
      const checks = config.metadata?.checks || [];
      
      // Run all enabled quality checks
      const checkResults = await Promise.all(
        checks
          .filter(check => check.enabled)
          .map(check => this.runQualityCheck(check, context))
      );

      // Calculate summary
      const summary = this.calculateSummary(checkResults);
      
      // Determine overall result
      const overallPassed = this.determineOverallResult(checkResults, config);
      
      // Generate recommendation
      const recommendation = this.generateRecommendation(checkResults, overallPassed);

      const result: QualityGateResult = {
        overallPassed,
        checks: checkResults,
        summary,
        recommendation
      };

      // Post results if configured
      if (config.metadata?.postResults) {
        await this.postResults(result, context);
      }

      logger.info({ 
        actionId: this.config.id,
        overallPassed,
        totalChecks: checkResults.length,
        errors: summary.errors,
        warnings: summary.warnings
      }, 'Quality gate executed');

      return {
        success: !config.metadata?.failOnError || overallPassed,
        executionTime: 0,
        output: result,
        metadata: {
          overallPassed,
          totalChecks: checkResults.length,
          errors: summary.errors,
          warnings: summary.warnings
        }
      };

    } catch (error) {
      logger.error({ error, actionId: this.config.id }, 'Quality gate action failed');
      throw error;
    }
  }

  private async runQualityCheck(check: any, context: ActionContext): Promise<QualityCheckResult> {
    try {
      switch (check.type) {
        case 'file_count':
          return this.checkFileCount(check, context);
        
        case 'line_changes':
          return this.checkLineChanges(check, context);
        
        case 'test_coverage':
          return this.checkTestCoverage(check, context);
        
        case 'commit_message':
          return this.checkCommitMessage(check, context);
        
        case 'branch_name':
          return this.checkBranchName(check, context);
        
        case 'custom':
          return this.checkCustom(check, context);
        
        default:
          return {
            name: check.name,
            type: check.type,
            passed: false,
            severity: 'error',
            message: `Unknown check type: ${check.type}`
          };
      }
    } catch (error) {
      return {
        name: check.name,
        type: check.type,
        passed: false,
        severity: 'error',
        message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private checkFileCount(check: any, context: ActionContext): QualityCheckResult {
    const payload = context.eventPayload;
    const pr = payload.pullRequest || payload.pull_request;
    
    if (!pr) {
      return {
        name: check.name,
        type: check.type,
        passed: false,
        severity: check.severity,
        message: 'No PR data available for file count check'
      };
    }

    const fileCount = pr.changed_files || 0;
    const threshold = check.threshold || 20;
    const passed = fileCount <= threshold;

    return {
      name: check.name,
      type: check.type,
      passed,
      severity: check.severity,
      message: passed 
        ? `File count (${fileCount}) is within limit (${threshold})`
        : `File count (${fileCount}) exceeds limit (${threshold})`,
      details: { fileCount, threshold }
    };
  }

  private checkLineChanges(check: any, context: ActionContext): QualityCheckResult {
    const payload = context.eventPayload;
    const pr = payload.pullRequest || payload.pull_request;
    
    if (!pr) {
      return {
        name: check.name,
        type: check.type,
        passed: false,
        severity: check.severity,
        message: 'No PR data available for line changes check'
      };
    }

    const totalChanges = (pr.additions || 0) + (pr.deletions || 0);
    const threshold = check.threshold || 500;
    const passed = totalChanges <= threshold;

    return {
      name: check.name,
      type: check.type,
      passed,
      severity: check.severity,
      message: passed 
        ? `Line changes (${totalChanges}) is within limit (${threshold})`
        : `Line changes (${totalChanges}) exceeds limit (${threshold})`,
      details: { 
        totalChanges, 
        threshold,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0
      }
    };
  }

  private checkTestCoverage(check: any, context: ActionContext): QualityCheckResult {
    // In a real implementation, this would integrate with coverage tools
    // For now, we'll check if test files are included
    const payload = context.eventPayload;
    const pr = payload.pullRequest || payload.pull_request;
    
    if (!pr || !pr.changed_files) {
      return {
        name: check.name,
        type: check.type,
        passed: false,
        severity: check.severity,
        message: 'No file data available for test coverage check'
      };
    }

    const hasTestFiles = pr.changed_files.some((file: string) => 
      file.includes('test') || file.includes('spec') || file.includes('__tests__')
    );

    const hasCodeFiles = pr.changed_files.some((file: string) => 
      file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.py') || file.endsWith('.java')
    );

    const passed = !hasCodeFiles || hasTestFiles;

    return {
      name: check.name,
      type: check.type,
      passed,
      severity: check.severity,
      message: passed 
        ? hasCodeFiles 
          ? 'Test files included with code changes'
          : 'No code files changed'
        : 'Code changes without corresponding test files',
      details: { hasTestFiles, hasCodeFiles }
    };
  }

  private checkCommitMessage(check: any, context: ActionContext): QualityCheckResult {
    const payload = context.eventPayload;
    
    // For PR events, check PR title
    if (payload.pullRequest || payload.pull_request) {
      const pr = payload.pullRequest || payload.pull_request;
      const title = pr.title || '';
      const pattern = check.pattern || '^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+';
      
      const regex = new RegExp(pattern);
      const passed = regex.test(title);

      return {
        name: check.name,
        type: check.type,
        passed,
        severity: check.severity,
        message: passed 
          ? 'PR title follows conventional format'
          : `PR title doesn't match pattern: ${pattern}`,
        details: { title, pattern }
      };
    }

    // For push events, check commit messages
    if (payload.commits) {
      const commits = payload.commits;
      const pattern = check.pattern || '^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+';
      const regex = new RegExp(pattern);
      
      const invalidCommits = commits.filter((commit: any) => 
        !regex.test(commit.message)
      );

      const passed = invalidCommits.length === 0;

      return {
        name: check.name,
        type: check.type,
        passed,
        severity: check.severity,
        message: passed 
          ? 'All commit messages follow conventional format'
          : `${invalidCommits.length} commit(s) don't match pattern: ${pattern}`,
        details: { 
          totalCommits: commits.length,
          invalidCommits: invalidCommits.length,
          pattern
        }
      };
    }

    return {
      name: check.name,
      type: check.type,
      passed: false,
      severity: check.severity,
      message: 'No commit or PR data available for message check'
    };
  }

  private checkBranchName(check: any, context: ActionContext): QualityCheckResult {
    const payload = context.eventPayload;
    let branchName = '';

    // Extract branch name from different event types
    if (payload.pullRequest || payload.pull_request) {
      const pr = payload.pullRequest || payload.pull_request;
      branchName = pr.head?.ref || '';
    } else if (payload.ref) {
      branchName = payload.ref.replace('refs/heads/', '');
    }

    if (!branchName) {
      return {
        name: check.name,
        type: check.type,
        passed: false,
        severity: check.severity,
        message: 'No branch name available for check'
      };
    }

    const pattern = check.pattern || '^(feature|bugfix|hotfix|release)\/[a-z0-9-]+$';
    const regex = new RegExp(pattern);
    const passed = regex.test(branchName);

    return {
      name: check.name,
      type: check.type,
      passed,
      severity: check.severity,
      message: passed 
        ? `Branch name "${branchName}" follows naming convention`
        : `Branch name "${branchName}" doesn't match pattern: ${pattern}`,
      details: { branchName, pattern }
    };
  }

  private checkCustom(check: any, context: ActionContext): QualityCheckResult {
    // Custom checks would be implemented based on specific requirements
    // For now, return a placeholder
    return {
      name: check.name,
      type: check.type,
      passed: true,
      severity: check.severity,
      message: 'Custom check not implemented',
      details: { checkConfig: check }
    };
  }

  private calculateSummary(checks: QualityCheckResult[]): {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    warnings: number;
    infos: number;
  } {
    return {
      total: checks.length,
      passed: checks.filter(c => c.passed).length,
      failed: checks.filter(c => !c.passed).length,
      errors: checks.filter(c => !c.passed && c.severity === 'error').length,
      warnings: checks.filter(c => !c.passed && c.severity === 'warning').length,
      infos: checks.filter(c => !c.passed && c.severity === 'info').length
    };
  }

  private determineOverallResult(checks: QualityCheckResult[], config: QualityGateConfig): boolean {
    // Fail if any required check fails
    const requiredChecks = config.metadata?.checks?.filter(c => c.required) || [];
    const requiredCheckNames = requiredChecks.map(c => c.name);
    
    const failedRequiredChecks = checks.filter(c => 
      requiredCheckNames.includes(c.name) && !c.passed
    );

    if (failedRequiredChecks.length > 0) {
      return false;
    }

    // Fail if any error-level check fails
    const errorChecks = checks.filter(c => !c.passed && c.severity === 'error');
    return errorChecks.length === 0;
  }

  private generateRecommendation(checks: QualityCheckResult[], overallPassed: boolean): string {
    if (overallPassed) {
      return '✅ All quality checks passed. Ready for review/merge.';
    }

    const failedChecks = checks.filter(c => !c.passed);
    const errorChecks = failedChecks.filter(c => c.severity === 'error');
    const warningChecks = failedChecks.filter(c => c.severity === 'warning');

    let recommendation = '❌ Quality gate failed. ';

    if (errorChecks.length > 0) {
      recommendation += `Fix ${errorChecks.length} error(s): ${errorChecks.map(c => c.name).join(', ')}. `;
    }

    if (warningChecks.length > 0) {
      recommendation += `Address ${warningChecks.length} warning(s): ${warningChecks.map(c => c.name).join(', ')}.`;
    }

    return recommendation;
  }

  private async postResults(result: QualityGateResult, context: ActionContext): Promise<void> {
    // In a real implementation, this would post results as PR comment or status check
    const markdown = this.formatResultsAsMarkdown(result);
    
    logger.info({ 
      actionId: this.config.id,
      overallPassed: result.overallPassed,
      markdownLength: markdown.length
    }, 'Would post quality gate results');
  }

  private formatResultsAsMarkdown(result: QualityGateResult): string {
    const { overallPassed, checks, summary } = result;
    
    let markdown = `## 🔍 Quality Gate Results\n\n`;
    
    if (overallPassed) {
      markdown += `✅ **PASSED** - All quality checks successful\n\n`;
    } else {
      markdown += `❌ **FAILED** - Quality issues detected\n\n`;
    }

    markdown += `### 📊 Summary\n`;
    markdown += `- **Total Checks:** ${summary.total}\n`;
    markdown += `- **Passed:** ${summary.passed}\n`;
    markdown += `- **Failed:** ${summary.failed}\n`;
    
    if (summary.errors > 0) {
      markdown += `- **Errors:** ${summary.errors}\n`;
    }
    if (summary.warnings > 0) {
      markdown += `- **Warnings:** ${summary.warnings}\n`;
    }

    markdown += `\n### 📋 Check Details\n\n`;

    checks.forEach(check => {
      const icon = check.passed ? '✅' : 
        check.severity === 'error' ? '❌' : 
        check.severity === 'warning' ? '⚠️' : 'ℹ️';
      
      markdown += `${icon} **${check.name}** (${check.type})\n`;
      markdown += `   ${check.message}\n\n`;
    });

    markdown += `### 💡 Recommendation\n${result.recommendation}\n`;

    return markdown;
  }

  // Helper method to create quality gate action configs
  static createConfig(options: {
    id: string;
    name: string;
    description: string;
    checks: Array<{
      name: string;
      type: 'file_count' | 'line_changes' | 'test_coverage' | 'commit_message' | 'branch_name' | 'custom';
      enabled?: boolean;
      threshold?: number;
      pattern?: string;
      required?: boolean;
      severity?: 'error' | 'warning' | 'info';
    }>;
    failOnError?: boolean;
    postResults?: boolean;
    blockMerge?: boolean;
    enabled?: boolean;
    retryAttempts?: number;
    timeoutMs?: number;
  }): QualityGateConfig {
    return {
      id: options.id,
      name: options.name,
      description: options.description,
      enabled: options.enabled ?? true,
      retryAttempts: options.retryAttempts ?? 1,
      timeoutMs: options.timeoutMs ?? 30000,
      metadata: {
        checks: options.checks.map(check => ({
          ...check,
          enabled: check.enabled ?? true,
          severity: check.severity ?? 'error'
        })),
        failOnError: options.failOnError ?? true,
        postResults: options.postResults ?? true,
        blockMerge: options.blockMerge ?? false
      }
    };
  }
}
