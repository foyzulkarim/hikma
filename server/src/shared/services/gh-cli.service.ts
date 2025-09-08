import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import path from 'path';

import { logger } from '@/core/utils/logger.js';
import { ExternalServiceError, ValidationError } from '@/core/errors/app-error.js';

const execAsync = promisify(exec);



export interface GhCliInfo {
  version: string;
  authenticated: boolean;
  user?: string;
}

export class GhCliService {

  /**
   * Check if GitHub CLI is installed and available
   */
  async isGhCliAvailable(correlationId?: string): Promise<boolean> {
    const checkCorrelationId = correlationId || `gh-cli-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('Checking GitHub CLI availability', {
      correlationId: checkCorrelationId
    });
    
    try {
      const { stdout } = await execAsync('gh --version');
      const duration = Date.now() - startTime;
      
      logger.info('GitHub CLI is available and accessible', {
        version: stdout.split('\n')[0],
        duration,
        correlationId: checkCorrelationId
      });
      
      return true;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.warn('GitHub CLI is not available or not installed', {
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId: checkCorrelationId
      });
      
      return false;
    }
  }

  /**
   * Get GitHub CLI information including version and authentication status
   */
  async getGhCliInfo(correlationId?: string): Promise<GhCliInfo> {
    const infoCorrelationId = correlationId || `gh-cli-info-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('Retrieving GitHub CLI information', {
      correlationId: infoCorrelationId
    });
    
    try {
      const { stdout: versionOutput } = await execAsync('gh --version');
      const version = versionOutput.split('\n')[0].replace('gh version ', '');
      
      logger.debug('GitHub CLI version retrieved', {
        version,
        correlationId: infoCorrelationId
      });

      let authenticated = false;
      let user: string | undefined;

      logger.debug('Checking GitHub CLI authentication status', {
        correlationId: infoCorrelationId
      });

      try {
        const { stdout: authOutput } = await execAsync('gh auth status');
        authenticated = authOutput.includes('Logged in');
        
        if (authenticated) {
          const userMatch = authOutput.match(/Logged in to github\.com as ([^\s]+)/);
          user = userMatch ? userMatch[1] : undefined;
          
          logger.info('GitHub CLI authentication confirmed', {
            user,
            correlationId: infoCorrelationId
          });
        } else {
          logger.warn('GitHub CLI is not authenticated', {
            correlationId: infoCorrelationId
          });
        }
      } catch (authError) {
        // Auth check failed, user is not authenticated
        authenticated = false;
        const authErrorMessage = authError instanceof Error ? authError.message : 'Unknown error';
        
        logger.warn('GitHub CLI authentication check failed', {
          error: authErrorMessage,
          correlationId: infoCorrelationId
        });
      }
      
      const duration = Date.now() - startTime;
      const result = { version, authenticated, user };
      
      logger.info('GitHub CLI information retrieved successfully', {
        ...result,
        duration,
        correlationId: infoCorrelationId
      });

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to get GitHub CLI information', {
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId: infoCorrelationId
      });
      
      throw new ExternalServiceError(`Failed to get GitHub CLI info: ${errorMessage}`);
    }
  }




  /**
   * Check if a repository exists and is accessible
   */
  async checkRepositoryExists(repositoryUrl: string, correlationId?: string): Promise<boolean> {
    const checkCorrelationId = correlationId || `gh-repo-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('Checking repository existence and accessibility', {
      repositoryUrl,
      correlationId: checkCorrelationId
    });
    
    try {
      // Simple parsing for owner/repo from GitHub URL
      const match = repositoryUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
      if (!match) {
        logger.warn('Invalid repository URL format', {
          repositoryUrl,
          correlationId: checkCorrelationId
        });
        return false;
      }
      
      const owner = match[1];
      const repo = match[2];
      
      logger.debug('Repository URL parsed successfully', {
        repositoryUrl,
        owner,
        repo,
        correlationId: checkCorrelationId
      });
      const command = `gh repo view "${owner}/${repo}" --json name`;
      
      logger.debug('Executing repository existence check command', {
        repositoryUrl,
        owner,
        repo,
        correlationId: checkCorrelationId
      });
      
      await execAsync(command);
      
      const duration = Date.now() - startTime;
      
      logger.info('Repository exists and is accessible', {
        repositoryUrl,
        owner,
        repo,
        duration,
        correlationId: checkCorrelationId
      });
      
      return true;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.warn('Repository check failed - repository may not exist or is not accessible', {
        repositoryUrl,
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId: checkCorrelationId
      });
      
      return false;
    }
  }

  /**
   * Get repository information using GitHub CLI
   */
  async getRepositoryInfo(repositoryUrl: string, correlationId?: string): Promise<any> {
    const infoCorrelationId = correlationId || `gh-repo-info-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('Retrieving repository information', {
      repositoryUrl,
      correlationId: infoCorrelationId
    });
    
    try {
      // Simple parsing for owner/repo from GitHub URL
      const match = repositoryUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
      if (!match) {
        logger.error('Invalid repository URL format for info retrieval', {
          repositoryUrl,
          correlationId: infoCorrelationId
        });
        throw new Error('Invalid repository URL format');
      }
      
      const owner = match[1];
      const repo = match[2];
      
      logger.debug('Repository URL parsed for info retrieval', {
        repositoryUrl,
        owner,
        repo,
        correlationId: infoCorrelationId
      });
      const command = `gh repo view "${owner}/${repo}" --json name,description,defaultBranch,isPrivate,pushedAt,createdAt`;
      
      logger.debug('Executing repository info retrieval command', {
        repositoryUrl,
        owner,
        repo,
        correlationId: infoCorrelationId
      });
      
      const { stdout } = await execAsync(command);
      
      logger.debug('Repository info command executed successfully', {
        repositoryUrl,
        hasOutput: !!stdout,
        correlationId: infoCorrelationId
      });
      
      const repoInfo = JSON.parse(stdout);
      const duration = Date.now() - startTime;
      
      logger.info('Repository information retrieved successfully', {
        repositoryUrl,
        repoName: repoInfo.name,
        defaultBranch: repoInfo.defaultBranch,
        isPrivate: repoInfo.isPrivate,
        duration,
        correlationId: infoCorrelationId
      });

      return repoInfo;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to retrieve repository information', {
        repositoryUrl,
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId: infoCorrelationId
      });
      
      throw new ExternalServiceError(`Repository info retrieval failed: ${errorMessage}`);
    }
  }
}