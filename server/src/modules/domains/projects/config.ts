export interface ProjectModuleConfig {
  maxProjectsPerUser: number;
  defaultSyncInterval: number;
  allowedRepositoryTypes: string[];
  maxProjectNameLength: number;
  maxDescriptionLength: number;
  slugPattern: RegExp;
}

export const projectConfig: ProjectModuleConfig = {
  maxProjectsPerUser: parseInt(process.env.MAX_PROJECTS_PER_USER || '10'),
  defaultSyncInterval: parseInt(process.env.DEFAULT_SYNC_INTERVAL || '3600000'), // 1 hour
  allowedRepositoryTypes: process.env.ALLOWED_REPO_TYPES?.split(',') || ['git', 'github'],
  maxProjectNameLength: 100,
  maxDescriptionLength: 500,
  slugPattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
};