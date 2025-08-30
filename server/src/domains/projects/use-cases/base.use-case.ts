// Base Use Case Class
// Provides common functionality and validation patterns for all use cases

export abstract class BaseUseCase<TRequest, TResponse> {
  /**
   * Execute the use case with the given request
   */
  abstract execute(request: TRequest): Promise<TResponse>;

  /**
   * Validate the request object
   * Override this method to provide specific validation logic
   */
  protected validateRequest(request: TRequest): void {
    if (!request) {
      throw new Error('Request is required');
    }
  }

  /**
   * Validate that a string field is not empty
   */
  protected validateRequiredString(value: string | undefined, fieldName: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error(`${fieldName} is required and cannot be empty`);
    }
  }

  /**
   * Validate that a field is not null or undefined
   */
  protected validateRequired<T>(value: T | undefined | null, fieldName: string): void {
    if (value === null || value === undefined) {
      throw new Error(`${fieldName} is required`);
    }
  }

  /**
   * Validate string length constraints
   */
  protected validateStringLength(
    value: string,
    fieldName: string,
    minLength?: number,
    maxLength?: number
  ): void {
    if (minLength !== undefined && value.length < minLength) {
      throw new Error(`${fieldName} must be at least ${minLength} characters long`);
    }
    if (maxLength !== undefined && value.length > maxLength) {
      throw new Error(`${fieldName} must be no more than ${maxLength} characters long`);
    }
  }

  /**
   * Validate email format
   */
  protected validateEmail(email: string, fieldName: string = 'Email'): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error(`${fieldName} must be a valid email address`);
    }
  }

  /**
   * Validate URL format
   */
  protected validateUrl(url: string, fieldName: string = 'URL'): void {
    try {
      new URL(url);
    } catch {
      throw new Error(`${fieldName} must be a valid URL`);
    }
  }

  /**
   * Validate repository URL format (supports git protocols)
   */
  protected validateRepositoryUrl(url: string): void {
    const gitUrlPatterns = [
      /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/,
      /^git@github\.com:[\w.-]+\/[\w.-]+(\.git)?$/,
      /^https:\/\/gitlab\.com\/[\w.-]+\/[\w.-]+(\.git)?$/,
      /^git@gitlab\.com:[\w.-]+\/[\w.-]+(\.git)?$/,
      /^https:\/\/bitbucket\.org\/[\w.-]+\/[\w.-]+(\.git)?$/,
      /^git@bitbucket\.org:[\w.-]+\/[\w.-]+(\.git)?$/,
      /^https?:\/\/.+\.git$/,
      /^git@.+:.+\.git$/
    ];

    const isValid = gitUrlPatterns.some(pattern => pattern.test(url));
    if (!isValid) {
      throw new Error('Repository URL must be a valid Git repository URL');
    }
  }

  /**
   * Validate array constraints
   */
  protected validateArray<T>(
    array: T[] | undefined,
    fieldName: string,
    minLength?: number,
    maxLength?: number
  ): void {
    if (!array) return;

    if (minLength !== undefined && array.length < minLength) {
      throw new Error(`${fieldName} must contain at least ${minLength} items`);
    }
    if (maxLength !== undefined && array.length > maxLength) {
      throw new Error(`${fieldName} must contain no more than ${maxLength} items`);
    }
  }

  /**
   * Validate numeric constraints
   */
  protected validateNumber(
    value: number | undefined,
    fieldName: string,
    min?: number,
    max?: number
  ): void {
    if (value === undefined) return;

    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${fieldName} must be a valid number`);
    }

    if (min !== undefined && value < min) {
      throw new Error(`${fieldName} must be at least ${min}`);
    }
    if (max !== undefined && value > max) {
      throw new Error(`${fieldName} must be no more than ${max}`);
    }
  }

  /**
   * Handle errors consistently across use cases
   */
  protected handleError(error: unknown, context: string): never {
    if (error instanceof Error) {
      throw new Error(`${context}: ${error.message}`);
    }
    throw new Error(`${context}: An unexpected error occurred`);
  }

  /**
   * Sanitize string input by trimming whitespace
   */
  protected sanitizeString(value: string | undefined): string | undefined {
    return value?.trim();
  }

  /**
   * Convert string to slug format
   */
  protected toSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Check if a value is empty (null, undefined, empty string, or empty array)
   */
  protected isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }
}

/**
 * Base interface for all use case requests
 */
export interface BaseRequest {
  userId: string;
}

/**
 * Base interface for all use case responses
 */
export interface BaseResponse {
  success?: boolean;
  message?: string;
}