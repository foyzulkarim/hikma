import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient, ProjectStatus } from '@prisma/client';
import { ProjectService } from '@/modules/projects/services/project-service.js';
import { logger } from '@/core/utils/logger.js';
import { NotFoundError, ValidationError, ConflictError } from '@/core/errors/app-error.js';

// Mock PrismaClient
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    project: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    projectSettings: {
      delete: vi.fn(),
    },
    projectStats: {
      delete: vi.fn(),
    },
    $transaction: vi.fn((queries) => Promise.all(queries.map((q: any) => q()))),
  };
  return { PrismaClient: vi.fn(() => mockPrisma), ProjectStatus: ProjectStatus };
});

// Mock logger
vi.mock('@/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProjectService', () => {
  let projectService: ProjectService;
  let prisma: PrismaClient;

  const mockProject = {
    id: 'project123',
    name: 'Test Project',
    description: 'A test project',
    repositoryUrl: 'https://github.com/test/test-repo',
    repositoryPath: '/tmp/test-repo',
    ownerId: 'user123',
    status: ProjectStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSyncAt: null,
    settings: {
      id: 'settings123',
      projectId: 'project123',
      includePatterns: ['**/*.js'],
      excludePatterns: ['node_modules/**'],
      maxFileSize: 1024 * 1024,
      enableAutoSync: false,
      syncInterval: 3600,
    },
    stats: {
      id: 'stats123',
      projectId: 'project123',
      totalFiles: 0,
      totalSize: 0,
      lastSyncDuration: 0,
    },
  };

  beforeEach(() => {
    projectService = new ProjectService();
    prisma = new PrismaClient(); // Re-initialize mock Prisma for each test
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createProject', () => {
    it('should create a new project successfully', async () => {
      (prisma.project.findFirst as vi.Mock).mockResolvedValue(null);
      (prisma.project.create as vi.Mock).mockResolvedValue(mockProject);

      const result = await projectService.createProject({
        name: 'New Project',
        ownerId: 'user123',
      });

      expect(prisma.project.findFirst).toHaveBeenCalledWith({ where: { name: 'New Project', ownerId: 'user123' } });
      expect(prisma.project.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          name: 'New Project',
          ownerId: 'user123',
          status: ProjectStatus.ACTIVE,
        }),
      }));
      expect(result).toEqual(mockProject);
      expect(logger.info).toHaveBeenCalledWith({ projectId: mockProject.id, ownerId: 'user123' }, 'Project created successfully');
    });

    it('should throw ConflictError if project name already exists for owner', async () => {
      (prisma.project.findFirst as vi.Mock).mockResolvedValue(mockProject);

      await expect(projectService.createProject({
        name: 'Test Project',
        ownerId: 'user123',
      })).rejects.toThrow(ConflictError);
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('getProjectsByOwner', () => {
    it('should return projects for a given owner', async () => {
      (prisma.project.findMany as vi.Mock).mockResolvedValue([mockProject]);
      (prisma.project.count as vi.Mock).mockResolvedValue(1);

      const { projects, total } = await projectService.getProjectsByOwner('user123');

      expect(projects).toEqual([mockProject]);
      expect(total).toBe(1);
      expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'user123' } }));
      expect(prisma.project.count).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'user123' } }));
    });

    it('should apply limit and offset', async () => {
      (prisma.project.findMany as vi.Mock).mockResolvedValue([]);
      (prisma.project.count as vi.Mock).mockResolvedValue(0);

      await projectService.getProjectsByOwner('user123', 10, 5);

      expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
        take: 10,
        skip: 5,
      }));
    });

    it('should filter by status', async () => {
      (prisma.project.findMany as vi.Mock).mockResolvedValue([]);
      (prisma.project.count as vi.Mock).mockResolvedValue(0);

      await projectService.getProjectsByOwner('user123', 50, 0, ProjectStatus.ACTIVE);

      expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { ownerId: 'user123', status: ProjectStatus.ACTIVE },
      }));
    });
  });

  describe('getProjectById', () => {
    it('should return a project if found and owned by user', async () => {
      (prisma.project.findUnique as vi.Mock).mockResolvedValue(mockProject);

      const result = await projectService.getProjectById('project123', 'user123');
      expect(result).toEqual(mockProject);
      expect(prisma.project.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'project123', ownerId: 'user123' },
      }));
    });

    it('should throw NotFoundError if project not found or not owned by user', async () => {
      (prisma.project.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(projectService.getProjectById('nonexistent', 'user123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateProject', () => {
    it('should update a project successfully', async () => {
      const updatedData = { name: 'Updated Project Name', description: 'New description' };
      (prisma.project.findUnique as vi.Mock).mockResolvedValue(mockProject);
      (prisma.project.update as vi.Mock).mockResolvedValue({ ...mockProject, ...updatedData });

      const result = await projectService.updateProject('project123', 'user123', updatedData);

      expect(prisma.project.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'project123', ownerId: 'user123' } }));
      expect(prisma.project.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'project123' },
        data: expect.objectContaining({
          name: 'Updated Project Name',
          description: 'New description',
        }),
      }));
      expect(result.name).toBe('Updated Project Name');
      expect(logger.info).toHaveBeenCalledWith({ projectId: 'project123', ownerId: 'user123' }, 'Project updated successfully');
    });

    it('should throw NotFoundError if project not found or not owned by user', async () => {
      (prisma.project.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(projectService.updateProject('nonexistent', 'user123', { name: 'New Name' })).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if new name already exists for owner', async () => {
      const anotherProject = { ...mockProject, id: 'project456', name: 'Another Project' };
      (prisma.project.findUnique as vi.Mock).mockResolvedValueOnce(mockProject); // For initial check
      (prisma.project.findFirst as vi.Mock).mockResolvedValueOnce(anotherProject); // For duplicate name check

      await expect(projectService.updateProject('project123', 'user123', { name: 'Another Project' })).rejects.toThrow(ConflictError);
    });

    it('should update settings correctly', async () => {
      const updatedSettings = { maxFileSize: 2 * 1024 * 1024, enableAutoSync: true };
      (prisma.project.findUnique as vi.Mock).mockResolvedValue(mockProject);
      (prisma.project.update as vi.Mock).mockResolvedValue({ ...mockProject, settings: { ...mockProject.settings, ...updatedSettings } });

      const result = await projectService.updateProject('project123', 'user123', { settings: updatedSettings });
      expect(prisma.project.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          settings: { update: updatedSettings },
        }),
      }));
      expect(result.settings.maxFileSize).toBe(updatedSettings.maxFileSize);
    });
  });

  describe('deleteProject', () => {
    it('should delete a project successfully', async () => {
      (prisma.project.findUnique as vi.Mock).mockResolvedValue(mockProject);
      (prisma.projectSettings.delete as vi.Mock).mockResolvedValue({});
      (prisma.projectStats.delete as vi.Mock).mockResolvedValue({});
      (prisma.project.delete as vi.Mock).mockResolvedValue({});

      await projectService.deleteProject('project123', 'user123');

      expect(prisma.project.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'project123', ownerId: 'user123' } }));
      expect(prisma.projectSettings.delete).toHaveBeenCalledWith({ where: { projectId: 'project123' } });
      expect(prisma.projectStats.delete).toHaveBeenCalledWith({ where: { projectId: 'project123' } });
      expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'project123' } });
      expect(logger.info).toHaveBeenCalledWith({ projectId: 'project123', ownerId: 'user123' }, 'Project deleted successfully');
    });

    it('should throw NotFoundError if project not found or not owned by user', async () => {
      (prisma.project.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(projectService.deleteProject('nonexistent', 'user123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('syncProject', () => {
    it('should initiate a project sync successfully', async () => {
      (prisma.project.findUnique as vi.Mock).mockResolvedValue(mockProject);
      (prisma.project.update as vi.Mock).mockResolvedValue({ ...mockProject, status: ProjectStatus.SYNCING });

      const result = await projectService.syncProject('project123', 'user123');

      expect(prisma.project.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'project123', ownerId: 'user123' } }));
      expect(prisma.project.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'project123' },
        data: { status: ProjectStatus.SYNCING, updatedAt: expect.any(Date) },
      }));
      expect(result.status).toBe(ProjectStatus.SYNCING);
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project123' }), 'Project sync initiated');

      // Advance timers to simulate async update
      vi.advanceTimersByTime(2000);
      await vi.waitFor(() => expect(prisma.project.update).toHaveBeenCalledTimes(2)); // Initial update + simulated completion update

      expect(prisma.project.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'project123' },
        data: expect.objectContaining({
          status: ProjectStatus.ACTIVE,
          lastSyncAt: expect.any(Date),
          updatedAt: expect.any(Date),
          stats: expect.objectContaining({ update: expect.any(Object) }),
        }),
      }));
    });

    it('should throw NotFoundError if project not found or not owned by user', async () => {
      (prisma.project.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(projectService.syncProject('nonexistent', 'user123')).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if project is already syncing', async () => {
      (prisma.project.findUnique as vi.Mock).mockResolvedValue({ ...mockProject, status: ProjectStatus.SYNCING });

      await expect(projectService.syncProject('project123', 'user123')).rejects.toThrow(ConflictError);
    });

    it('should log error if simulated sync update fails', async () => {
      (prisma.project.findUnique as vi.Mock).mockResolvedValue(mockProject);
      (prisma.project.update as vi.Mock).mockResolvedValueOnce({ ...mockProject, status: ProjectStatus.SYNCING }); // Initial update
      (prisma.project.update as vi.Mock).mockRejectedValueOnce(new Error('Simulated DB error')); // Second update (simulated completion)

      await projectService.syncProject('project123', 'user123');

      vi.advanceTimersByTime(2000);
      await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project123' }), 'Project sync simulation failed to update status'));
      expect(prisma.project.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'project123' },
        data: { status: ProjectStatus.ERROR, updatedAt: expect.any(Date) },
      }));
    });
  });
});


