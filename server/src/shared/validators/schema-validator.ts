import { z } from 'zod';

export class SchemaValidator {
  static validateQuery(query: any): boolean {
    // Basic query validation
    return typeof query === 'string' && query.length > 0 && query.length <= 10000;
  }

  static validateProject(project: any): boolean {
    // Basic project validation
    return project && typeof project.name === 'string' && project.name.length > 0;
  }

  static validateUserId(userId: any): boolean {
    // Basic user ID validation
    return typeof userId === 'string' && userId.length > 0;
  }

  static validateProjectId(projectId: any): boolean {
    // Basic project ID validation
    return typeof projectId === 'string' && projectId.length > 0;
  }

  static validateEmail(email: any): boolean {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === 'string' && emailRegex.test(email);
  }

  static validatePassword(password: any): boolean {
    // Basic password validation
    return typeof password === 'string' && password.length >= 8;
  }
}

// Common Zod schemas for reuse
export const CommonSchemas = {
  id: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8),
  query: z.string().min(1).max(10000),
  projectName: z.string().min(1).max(255),
  userName: z.string().min(1).max(100),
  timestamp: z.string().datetime(),
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),
};
