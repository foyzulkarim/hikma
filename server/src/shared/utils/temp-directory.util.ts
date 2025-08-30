import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { logger } from '@/core/utils/logger.js';
import { ExternalServiceError } from '@/core/errors/app-error.js';

export interface TempDirectoryOptions {
  prefix?: string;
  suffix?: string;
  baseDir?: string;
  autoCleanup?: boolean;
  maxAge?: number; // in milliseconds
}

export interface TempDirectoryInfo {
  path: string;
  created: Date;
  autoCleanup: boolean;
  cleanupScheduled?: NodeJS.Timeout;
}

export class TempDirectoryManager {
  private static instance: TempDirectoryManager;
  private tempDirectories = new Map<string, TempDirectoryInfo>();
  private cleanupInterval?: NodeJS.Timeout;
  private readonly defaultBaseDir: string;

  private constructor() {
    // Use system temp directory or a custom one
    this.defaultBaseDir = process.env.TEMP_BASE_DIR || '/tmp';
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    // Cleanup on process exit
    process.on('exit', () => this.cleanupAll());
    process.on('SIGINT', () => this.cleanupAll());
    process.on('SIGTERM', () => this.cleanupAll());
  }

  static getInstance(): TempDirectoryManager {
    if (!TempDirectoryManager.instance) {
      TempDirectoryManager.instance = new TempDirectoryManager();
    }
    return TempDirectoryManager.instance;
  }

  /**
   * Create a temporary directory
   */
  async createTempDirectory(options: TempDirectoryOptions = {}): Promise<string> {
    const {
      prefix = 'hikma-temp',
      suffix = '',
      baseDir = this.defaultBaseDir,
      autoCleanup = true,
      maxAge = 3600000, // 1 hour default
    } = options;

    try {
      // Ensure base directory exists
      await fs.mkdir(baseDir, { recursive: true });

      // Generate unique directory name
      const randomId = randomBytes(8).toString('hex');
      const timestamp = Date.now();
      const dirName = `${prefix}-${timestamp}-${randomId}${suffix}`;
      const tempPath = path.join(baseDir, dirName);

      // Create the directory
      await fs.mkdir(tempPath, { recursive: true });

      // Track the directory
      const info: TempDirectoryInfo = {
        path: tempPath,
        created: new Date(),
        autoCleanup,
      };

      if (autoCleanup && maxAge > 0) {
        info.cleanupScheduled = setTimeout(() => {
          this.removeTempDirectory(tempPath).catch(error => {
            logger.error('Failed to auto-cleanup temp directory', {
              path: tempPath,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
        }, maxAge);
      }

      this.tempDirectories.set(tempPath, info);

      logger.info('Created temporary directory', {
        path: tempPath,
        autoCleanup,
        maxAge,
      });

      return tempPath;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create temporary directory', { error: errorMessage });
      throw new ExternalServiceError(`Failed to create temporary directory: ${errorMessage}`);
    }
  }

  /**
   * Remove a temporary directory and all its contents
   */
  async removeTempDirectory(tempPath: string): Promise<void> {
    try {
      const info = this.tempDirectories.get(tempPath);
      
      if (info?.cleanupScheduled) {
        clearTimeout(info.cleanupScheduled);
      }

      // Check if directory exists before attempting removal
      try {
        await fs.access(tempPath);
      } catch {
        // Directory doesn't exist, nothing to remove
        this.tempDirectories.delete(tempPath);
        return;
      }

      // Remove directory recursively
      await fs.rm(tempPath, { recursive: true, force: true });
      
      this.tempDirectories.delete(tempPath);

      logger.info('Removed temporary directory', { path: tempPath });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to remove temporary directory', {
        path: tempPath,
        error: errorMessage,
      });
      throw new ExternalServiceError(`Failed to remove temporary directory: ${errorMessage}`);
    }
  }

  /**
   * Check if a path is a managed temporary directory
   */
  isTempDirectory(path: string): boolean {
    return this.tempDirectories.has(path);
  }

  /**
   * Get information about a temporary directory
   */
  getTempDirectoryInfo(path: string): TempDirectoryInfo | undefined {
    return this.tempDirectories.get(path);
  }

  /**
   * List all managed temporary directories
   */
  listTempDirectories(): TempDirectoryInfo[] {
    return Array.from(this.tempDirectories.values());
  }

  /**
   * Clean up all temporary directories
   */
  async cleanupAll(): Promise<void> {
    logger.info('Cleaning up all temporary directories', {
      count: this.tempDirectories.size,
    });

    const cleanupPromises = Array.from(this.tempDirectories.keys()).map(path =>
      this.removeTempDirectory(path).catch(error => {
        logger.error('Failed to cleanup temp directory during shutdown', {
          path,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      })
    );

    await Promise.allSettled(cleanupPromises);

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Clean up expired temporary directories
   */
  async cleanupExpired(maxAge: number = 3600000): Promise<void> {
    const now = Date.now();
    const expiredPaths: string[] = [];

    for (const [path, info] of this.tempDirectories.entries()) {
      const age = now - info.created.getTime();
      if (age > maxAge) {
        expiredPaths.push(path);
      }
    }

    if (expiredPaths.length > 0) {
      logger.info('Cleaning up expired temporary directories', {
        count: expiredPaths.length,
        maxAge,
      });

      const cleanupPromises = expiredPaths.map(path =>
        this.removeTempDirectory(path).catch(error => {
          logger.error('Failed to cleanup expired temp directory', {
            path,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        })
      );

      await Promise.allSettled(cleanupPromises);
    }
  }

  /**
   * Start periodic cleanup of expired directories
   */
  private startPeriodicCleanup(): void {
    // Run cleanup every 30 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired().catch(error => {
        logger.error('Periodic cleanup failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }, 30 * 60 * 1000);
  }

  /**
   * Create a scoped temporary directory that automatically cleans up
   */
  async withTempDirectory<T>(
    callback: (tempPath: string) => Promise<T>,
    options: TempDirectoryOptions = {}
  ): Promise<T> {
    const tempPath = await this.createTempDirectory({
      ...options,
      autoCleanup: false, // We'll handle cleanup manually
    });

    try {
      return await callback(tempPath);
    } finally {
      await this.removeTempDirectory(tempPath);
    }
  }
}

// Export singleton instance
export const tempDirectoryManager = TempDirectoryManager.getInstance();

// Convenience functions
export const createTempDirectory = (options?: TempDirectoryOptions) =>
  tempDirectoryManager.createTempDirectory(options);

export const removeTempDirectory = (path: string) =>
  tempDirectoryManager.removeTempDirectory(path);

export const withTempDirectory = <T>(
  callback: (tempPath: string) => Promise<T>,
  options?: TempDirectoryOptions
) => tempDirectoryManager.withTempDirectory(callback, options);