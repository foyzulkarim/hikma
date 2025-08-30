export class InputSanitizer {
  /**
   * Sanitize string input to prevent XSS and injection attacks
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Sanitize query input for search
   */
  static sanitizeQuery(query: string): string {
    if (typeof query !== 'string') {
      return '';
    }

    return query
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/['"]/g, '') // Remove quotes that could break queries
      .replace(/;/g, '') // Remove semicolons
      .trim();
  }

  /**
   * Sanitize file path to prevent directory traversal
   */
  static sanitizeFilePath(path: string): string {
    if (typeof path !== 'string') {
      return '';
    }

    return path
      .replace(/\.\./g, '') // Remove parent directory references
      .replace(/[<>"|*?]/g, '') // Remove invalid file characters
      .replace(/^\/+/, '') // Remove leading slashes
      .trim();
  }

  /**
   * Sanitize object by recursively sanitizing string values
   */
  static sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }
}
