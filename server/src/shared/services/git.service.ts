import { promises as fs } from 'fs';
import path from 'path';
import simpleGit from 'simple-git';

/**
 * Options for cloning a repository
 */
export interface CloneOptions {
  repositoryUrl: string;
  targetDirectory: string;
  branch?: string;
  depth?: number;
  githubToken?: string; // Optional GitHub Personal Access Token for private repositories
}

/**
 * Service for Git operations using simple-git
 */
export class GitService {
  /**
   * Clone a repository with optional authentication
   * 
   * @param options - Clone configuration options
   * @param correlationId - Optional correlation ID for logging
   * 
   * @throws {Error} When repository URL is invalid
   * @throws {Error} When authentication fails (401)
   * @throws {Error} When repository is not found or access is denied (404/403)
   * @throws {Error} When clone operation fails
   * 
   * @security This method supports token-based authentication for private repositories.
   * When githubToken is provided, it constructs an authenticated HTTPS URL.
   * For public repositories, githubToken can be omitted.
   */
  async cloneRepository(options: CloneOptions, correlationId?: string): Promise<void> {
    const { repositoryUrl, targetDirectory, branch, depth, githubToken } = options;
    
    console.log(`📥 Cloning repository ${repositoryUrl} to ${targetDirectory}...`, {
      correlationId,
      branch,
      depth,
      hasToken: !!githubToken
    });

    try {
      // Parse repository URL to extract owner and repo name
      const { owner, repo } = this.parseRepositoryUrl(repositoryUrl);
      
      // Construct clone URL based on authentication requirements
      let cloneUrl: string;
      if (githubToken) {
        // Use authenticated HTTPS URL for private repositories
        cloneUrl = `https://${githubToken}@github.com/${owner}/${repo}.git`;
      } else {
        // For public repositories, ensure URL ends with .git
        cloneUrl = repositoryUrl.endsWith('.git') ? repositoryUrl : `${repositoryUrl}.git`;
      }

      // Ensure target directory parent exists
      await fs.mkdir(path.dirname(targetDirectory), { recursive: true });

      // Configure clone options
      const cloneOptions: any = {};
      if (branch) {
        cloneOptions['--branch'] = branch;
      }
      if (depth) {
        cloneOptions['--depth'] = depth;
      }

      // Perform the clone operation
      const git = simpleGit();
      await git.clone(cloneUrl, targetDirectory, cloneOptions);
      
      console.log(`✅ Repository cloned successfully to ${targetDirectory}`, { correlationId });
    } catch (error: any) {
      console.error(`❌ Failed to clone repository:`, {
        error: error.message,
        repositoryUrl,
        targetDirectory,
        correlationId
      });

      // Enhanced error handling with specific error types
      if (error.message?.includes('Authentication failed') || error.message?.includes('401')) {
        throw new Error(`Authentication failed. Please check your GitHub token and ensure it has the necessary permissions to access the repository: ${repositoryUrl}`);
      }
      
      if (error.message?.includes('Repository not found') || error.message?.includes('404')) {
        throw new Error(`Repository not found: ${repositoryUrl}. Please verify the repository URL and ensure you have access to it.`);
      }
      
      if (error.message?.includes('Permission denied') || error.message?.includes('403')) {
        throw new Error(`Access denied to repository: ${repositoryUrl}. Please check your permissions or provide a valid GitHub token for private repositories.`);
      }
      
      throw new Error(`Failed to clone repository ${repositoryUrl}: ${error.message}`);
    }
  }

  /**
   * Extract repository owner and name from various URL formats
   * Supports HTTPS, SSH, and GitHub short format URLs
   */
  private parseRepositoryUrl(repositoryUrl: string): { owner: string; repo: string } {
    // Remove .git suffix if present for parsing
    const cleanUrl = repositoryUrl.replace(/\.git$/, '');
    
    // Match different GitHub URL formats
    const patterns = [
      // HTTPS: https://github.com/owner/repo
      /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)$/,
      // SSH: git@github.com:owner/repo
      /^git@github\.com:([^\/]+)\/([^\/]+)$/,
      // Short format: owner/repo
      /^([^\/]+)\/([^\/]+)$/
    ];

    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2]
        };
      }
    }

    throw new Error(`Invalid repository URL format: ${repositoryUrl}. Supported formats: https://github.com/owner/repo, git@github.com:owner/repo, or owner/repo`);
  }
}

// Export a singleton instance
export const gitService = new GitService();