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
  async createTempDirectory(options: TempDirectoryOptions = {}, correlationId?: string): Promise<string> {
    const createCorrelationId = correlationId || `temp-create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    const {
      prefix = 'hikma-temp',
      suffix = '',
      baseDir = this.defaultBaseDir,
      autoCleanup = true,
      maxAge = 3600000, // 1 hour default
    } = options;

    logger.info('Creating temporary directory', {
      prefix,
      suffix,
      baseDir,
      autoCleanup,
      maxAge,
      correlationId: createCorrelationId
    });

    try {
      // Ensure base directory exists
      logger.debug('Ensuring base directory exists', {
        baseDir,
        correlationId: createCorrelationId
      });
      
      await fs.mkdir(baseDir, { recursive: true });

      // Generate unique directory name
      const randomId = randomBytes(8).toString('hex');
      const timestamp = Date.now();
      const dirName = `${prefix}-${timestamp}-${randomId}${suffix}`;
      const tempPath = path.join(baseDir, dirName);
      
      logger.debug('Generated temporary directory path', {
        dirName,
        tempPath,
        randomId,
        correlationId: createCorrelationId
      });

      // Create the directory
      await fs.mkdir(tempPath, { recursive: true });
      
      logger.debug('Temporary directory created on filesystem', {
        tempPath,
        correlationId: createCorrelationId
      });

      // Track the directory
      const info: TempDirectoryInfo = {
        path: tempPath,
        created: new Date(),
        autoCleanup,
      };

      if (autoCleanup && maxAge > 0) {
        logger.debug('Scheduling auto-cleanup for temporary directory', {
          tempPath,
          maxAge,
          correlationId: createCorrelationId
        });
        
        info.cleanupScheduled = setTimeout(() => {
          this.removeTempDirectory(tempPath, createCorrelationId).catch(error => {
            logger.error('Failed to auto-cleanup temp directory', {
              path: tempPath,
              error: error instanceof Error ? error.message : 'Unknown error',
              correlationId: createCorrelationId
            });
          });
        }, maxAge);
      }

      this.tempDirectories.set(tempPath, info);
      
      const duration = Date.now() - startTime;

      logger.info('Temporary directory created successfully', {
        path: tempPath,
        autoCleanup,
        maxAge,
        duration,
        totalManagedDirectories: this.tempDirectories.size,
        correlationId: createCorrelationId
      });

      return tempPath;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to create temporary directory', {
        prefix,
        baseDir,
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId: createCorrelationId
      });
      
      throw new ExternalServiceError(`Failed to create temporary directory: ${errorMessage}`);
    }
  }

  /**
   * Remove a temporary directory and all its contents
   */
  async removeTempDirectory(tempPath: string, correlationId?: string): Promise<void> {
    const removeCorrelationId = correlationId || `temp-remove-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('Removing temporary directory', {
      path: tempPath,
      correlationId: removeCorrelationId
    });
    
    try {
      const info = this.tempDirectories.get(tempPath);
      
      if (info?.cleanupScheduled) {
        logger.debug('Clearing scheduled cleanup for temporary directory', {
          path: tempPath,
          correlationId: removeCorrelationId
        });
        clearTimeout(info.cleanupScheduled);
      }

      // Check if directory exists before attempting removal
      try {
        await fs.access(tempPath);
        logger.debug('Temporary directory exists, proceeding with removal', {
          path: tempPath,
          correlationId: removeCorrelationId
        });
      } catch {
        // Directory doesn't exist, nothing to remove
        logger.debug('Temporary directory does not exist, skipping removal', {
          path: tempPath,
          correlationId: removeCorrelationId
        });
        this.tempDirectories.delete(tempPath);
        return;
      }

      // Remove directory recursively
      logger.debug('Executing recursive directory removal', {
        path: tempPath,
        correlationId: removeCorrelationId
      });
      
      await fs.rm(tempPath, { recursive: true, force: true });
      
      this.tempDirectories.delete(tempPath);
      
      const duration = Date.now() - startTime;

      logger.info('Temporary directory removed successfully', {
        path: tempPath,
        duration,
        remainingManagedDirectories: this.tempDirectories.size,
        correlationId: removeCorrelationId
      });
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to remove temporary directory', {
        path: tempPath,
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId: removeCorrelationId
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
  async cleanupAll(correlationId?: string): Promise<void> {
    const cleanupCorrelationId = correlationId || `temp-cleanup-all-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('Starting cleanup of all temporary directories', {
      count: this.tempDirectories.size,
      correlationId: cleanupCorrelationId
    });

    const cleanupPromises = Array.from(this.tempDirectories.keys()).map(path =>
      this.removeTempDirectory(path, cleanupCorrelationId).catch(error => {
        logger.error('Failed to cleanup temp directory during shutdown', {
          path,
          error: error instanceof Error ? error.message : 'Unknown error',
          correlationId: cleanupCorrelationId
        });
      })
    );

    const results = await Promise.allSettled(cleanupPromises);
    
    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failureCount = results.filter(result => result.status === 'rejected').length;
    
    if (this.cleanupInterval) {
      logger.debug('Clearing periodic cleanup interval', {
        correlationId: cleanupCorrelationId
      });
      clearInterval(this.cleanupInterval);
    }
    
    const duration = Date.now() - startTime;
    
    logger.info('Completed cleanup of all temporary directories', {
      totalDirectories: cleanupPromises.length,
      successCount,
      failureCount,
      duration,
      correlationId: cleanupCorrelationId
    });
  }

  /**
   * Clean up expired temporary directories
   */
  async cleanupExpired(maxAge: number = 3600000, correlationId?: string): Promise<void> {
    const expiredCorrelationId = correlationId || `temp-cleanup-expired-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const now = Date.now();
    const expiredPaths: string[] = [];
    
    logger.info('Starting cleanup of expired temporary directories', {
      maxAge,
      totalManagedDirectories: this.tempDirectories.size,
      correlationId: expiredCorrelationId
    });

    for (const [path, info] of this.tempDirectories.entries()) {
      const age = now - info.created.getTime();
      if (age > maxAge) {
        expiredPaths.push(path);
        logger.debug('Found expired temporary directory', {
          path,
          age,
          maxAge,
          created: info.created.toISOString(),
          correlationId: expiredCorrelationId
        });
      }
    }

    if (expiredPaths.length > 0) {
      logger.info('Cleaning up expired temporary directories', {
        count: expiredPaths.length,
        maxAge,
        correlationId: expiredCorrelationId
      });

      const cleanupPromises = expiredPaths.map(path =>
        this.removeTempDirectory(path, expiredCorrelationId).catch(error => {
          logger.error('Failed to cleanup expired temp directory', {
            path,
            error: error instanceof Error ? error.message : 'Unknown error',
            correlationId: expiredCorrelationId
          });
        })
      );

      const results = await Promise.allSettled(cleanupPromises);
      
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      const failureCount = results.filter(result => result.status === 'rejected').length;
      const duration = Date.now() - startTime;
      
      logger.info('Completed cleanup of expired temporary directories', {
        expiredCount: expiredPaths.length,
        successCount,
        failureCount,
        duration,
        correlationId: expiredCorrelationId
      });
    } else {
      const duration = Date.now() - startTime;
      logger.debug('No expired temporary directories found', {
        maxAge,
        totalManagedDirectories: this.tempDirectories.size,
        duration,
        correlationId: expiredCorrelationId
      });
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
    options: TempDirectoryOptions = {},
    correlationId?: string
  ): Promise<T> {
    const scopedCorrelationId = correlationId || `temp-scoped-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('Creating scoped temporary directory', {
      options,
      correlationId: scopedCorrelationId
    });
    
    const tempPath = await this.createTempDirectory({
      ...options,
      autoCleanup: false, // We'll handle cleanup manually
    }, scopedCorrelationId);

    try {
      logger.debug('Executing callback with temporary directory', {
        tempPath,
        correlationId: scopedCorrelationId
      });
      
      const result = await callback(tempPath);
      
      const duration = Date.now() - startTime;
      
      logger.info('Scoped temporary directory callback completed successfully', {
        tempPath,
        duration,
        correlationId: scopedCorrelationId
      });
      
      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Scoped temporary directory callback failed', {
        tempPath,
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId: scopedCorrelationId
      });
      
      throw error;
    } finally {
      logger.debug('Cleaning up scoped temporary directory', {
        tempPath,
        correlationId: scopedCorrelationId
      });
      
      await this.removeTempDirectory(tempPath, scopedCorrelationId);
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