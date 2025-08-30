import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '@/core/utils/logger.js';
import { ExternalServiceError, ValidationError } from '@/core/errors/app-error.js';

const execAsync = promisify(exec);

export interface CloneOptions {
  repositoryUrl: string;
  targetDirectory: string;
  branch?: string;
  depth?: number;
}

export interface GhCliInfo {
  version: string;
  authenticated: boolean;
  user?: string;
}

export class GhCliService {

  /**
   * Check if GitHub CLI is installed and available
   */
  async isGhCliAvailable(): Promise<boolean> {
    try {
      await execAsync('gh --version');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('GitHub CLI is not available', { error: errorMessage });
      return false;
    }
  }

  /**
   * Get GitHub CLI information including version and authentication status
   */
  async getGhCliInfo(): Promise<GhCliInfo> {
    try {
      const { stdout: versionOutput } = await execAsync('gh --version');
      const version = versionOutput.split('\n')[0].replace('gh version ', '');

      let authenticated = false;
      let user: string | undefined;

      try {
        const { stdout: authOutput } = await execAsync('gh auth status');
        authenticated = authOutput.includes('Logged in');
        
        if (authenticated) {
          const userMatch = authOutput.match(/Logged in to github\.com as ([^\s]+)/);
          user = userMatch ? userMatch[1] : undefined;
        }
      } catch (authError) {
        // Auth check failed, user is not authenticated
        authenticated = false;
      }

      return { version, authenticated, user };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ExternalServiceError(`Failed to get GitHub CLI info: ${errorMessage}`);
    }
  }

  /**
   * Clone a repository using GitHub CLI
   */
  async cloneRepository(options: CloneOptions): Promise<void> {
    const { repositoryUrl, targetDirectory, branch, depth } = options;

    try {
      // Ensure target directory exists
      await fs.mkdir(path.dirname(targetDirectory), { recursive: true });

      // Build gh repo clone command
      let command = `gh repo clone "${repositoryUrl}" "${targetDirectory}"`;
      
      if (branch) {
        command += ` -- --branch "${branch}"`;
      }
      
      if (depth) {
        command += ` -- --depth ${depth}`;
      }

      logger.info(`Cloning repository: ${repositoryUrl} to ${targetDirectory}`);
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 300000, // 5 minutes timeout
      });

      if (stderr && !stderr.includes('Cloning into')) {
        logger.warn(`Clone stderr: ${stderr}`);
      }

      logger.info(`Repository cloned successfully: ${repositoryUrl}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to clone repository ${repositoryUrl}:`, { error: errorMessage });
      throw new ExternalServiceError(`Repository clone failed: ${errorMessage}`);
    }
  }

  /**
   * Extract repository owner and name from various URL formats
   */
  parseRepositoryUrl(repositoryUrl: string): { owner: string; repo: string } | null {
    try {
      // Handle different GitHub URL formats
      const patterns = [
        // HTTPS: https://github.com/owner/repo or https://github.com/owner/repo.git
        /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
        // SSH: git@github.com:owner/repo.git
        /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
        // Short format: owner/repo
        /^([^/]+)\/([^/]+)$/,
      ];

      for (const pattern of patterns) {
        const match = repositoryUrl.match(pattern);
        if (match) {
          return {
            owner: match[1],
            repo: match[2],
          };
        }
      }

      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to parse repository URL: ${repositoryUrl}`, { error: errorMessage });
      return null;
    }
  }

  /**
   * Check if a repository exists and is accessible
   */
  async checkRepositoryExists(repositoryUrl: string): Promise<boolean> {
    try {
      const parsed = this.parseRepositoryUrl(repositoryUrl);
      if (!parsed) {
        return false;
      }

      const { owner, repo } = parsed;
      await execAsync(`gh repo view "${owner}/${repo}" --json name`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Repository check failed for ${repositoryUrl}:`, { error: errorMessage });
      return false;
    }
  }

  /**
   * Get repository information using GitHub CLI
   */
  async getRepositoryInfo(repositoryUrl: string): Promise<any> {
    try {
      const parsed = this.parseRepositoryUrl(repositoryUrl);
      if (!parsed) {
        throw new Error('Invalid repository URL format');
      }

      const { owner, repo } = parsed;
      const { stdout } = await execAsync(
        `gh repo view "${owner}/${repo}" --json name,description,defaultBranch,isPrivate,pushedAt,createdAt`
      );

      return JSON.parse(stdout);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get repository info for ${repositoryUrl}:`, { error: errorMessage });
      throw new ExternalServiceError(`Repository info retrieval failed: ${errorMessage}`);
    }
  }
}