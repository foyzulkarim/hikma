import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { RedisRateLimitStore, MemoryRateLimitStore, RateLimiter, createRateLimitMiddleware, RateLimitUtils } from '@/modules/interfaces/api/middleware/rate-limit.js';
import { redis } from '@/config/redis.js';
import { logger } from '@/core/utils/logger.js';
import { RateLimitError } from '@/core/errors/app-error.js';

// Mock external dependencies
vi.mock('@/config/redis.js', () => ({
  redis: {
    pipeline: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn(),
    })),
    keys: vi.fn(),
    del: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('@/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('RedisRateLimitStore', () => {
  let store: RedisRateLimitStore;

  beforeEach(() => {
    store = new RedisRateLimitStore();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should increment and set expiry for a key', async () => {
    const mockExec = vi.fn().mockResolvedValue([[, 1]]);
    (redis.pipeline as vi.Mock).mockReturnValue({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: mockExec,
    });

    const key = 'test-key';
    const windowMs = 60000; // 1 minute
    const result = await store.increment(key, windowMs);

    expect(redis.pipeline).toHaveBeenCalled();
    expect(mockExec).toHaveBeenCalled();
    expect(result.count).toBe(1);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it('should reset a key', async () => {
    (redis.keys as vi.Mock).mockResolvedValue(['rate_limit:test-key:123', 'rate_limit:test-key:456']);
    (redis.del as vi.Mock).mockResolvedValue(2);

    const key = 'test-key';
    await store.reset(key);

    expect(redis.keys).toHaveBeenCalledWith('rate_limit:test-key:*');
    expect(redis.del).toHaveBeenCalledWith('rate_limit:test-key:123', 'rate_limit:test-key:456');
  });

  it('should get count for a key', async () => {
    (redis.get as vi.Mock).mockResolvedValue('5');

    const key = 'test-key';
    const result = await store.get(key);

    expect(redis.get).toHaveBeenCalledWith(expect.stringContaining('rate_limit:test-key:'));
    expect(result?.count).toBe(5);
    expect(result?.resetTime).toBeGreaterThan(Date.now());
  });

  it('should return null if key not found', async () => {
    (redis.get as vi.Mock).mockResolvedValue(null);

    const key = 'non-existent-key';
    const result = await store.get(key);

    expect(result).toBeNull();
  });
});

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should increment count for a key', async () => {
    const key = 'test-key';
    const windowMs = 60000;
    const result1 = await store.increment(key, windowMs);
    expect(result1.count).toBe(1);

    const result2 = await store.increment(key, windowMs);
    expect(result2.count).toBe(2);
  });

  it('should reset count for a key', async () => {
    const key = 'test-key';
    const windowMs = 60000;
    await store.increment(key, windowMs);
    await store.increment(key, windowMs);

    await store.reset(key);
    const result = await store.get(key);
    expect(result).toBeNull();
  });

  it('should get count for a key', async () => {
    const key = 'test-key';
    const windowMs = 60000;
    await store.increment(key, windowMs);
    await store.increment(key, windowMs);

    const result = await store.get(key);
    expect(result?.count).toBe(2);
  });

  it('should clean up expired entries', async () => {
    const key1 = 'key1';
    const key2 = 'key2';
    const windowMs = 10000; // 10 seconds

    await store.increment(key1, windowMs);
    vi.advanceTimersByTime(windowMs + 1000); // Move past window
    await store.increment(key2, windowMs);

    // Trigger cleanup by another increment
    await store.increment('another-key', windowMs);

    const result1 = await store.get(key1);
    expect(result1).toBeNull(); // Should be cleaned up

    const result2 = await store.get(key2);
    expect(result2?.count).toBe(1);
  });
});

describe('RateLimiter', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockStore: MemoryRateLimitStore;

  beforeEach(() => {
    mockRequest = {
      ip: '127.0.0.1',
      user: undefined,
      url: '/test',
      method: 'GET',
      correlationId: 'mock-cid',
    };
    mockReply = {
      header: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    mockStore = new MemoryRateLimitStore();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow request if within limit', async () => {
    const limiter = new RateLimiter({
      max: 5,
      windowMs: 60000,
      store: mockStore,
    });

    await limiter.middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
    expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
    expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }), 'Rate limit check passed');
  });

  it('should throw RateLimitError if limit exceeded', async () => {
    const limiter = new RateLimiter({
      max: 1,
      windowMs: 60000,
      store: mockStore,
    });

    await limiter.middleware(mockRequest as FastifyRequest, mockReply as FastifyReply); // 1st request, allowed

    await expect(limiter.middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)).rejects.toThrow(RateLimitError);

    expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ ip: '127.0.0.1' }), 'Rate limit exceeded');
  });

  it('should use user ID for key generation if user is authenticated', async () => {
    mockRequest.user = { id: 'user123' } as any;
    const limiter = new RateLimiter({
      max: 5,
      windowMs: 60000,
      store: mockStore,
    });

    await limiter.middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    const count = (await mockStore.get('user:user123'))?.count;
    expect(count).toBe(1);
  });

  it('should skip rate limiting if skipIf condition is true', async () => {
    const limiter = new RateLimiter({
      max: 1,
      windowMs: 60000,
      store: mockStore,
      skipIf: (req) => req.url === '/test',
    });

    await limiter.middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.header).not.toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
    expect(logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Rate limit check passed'));
  });

  it('should call onLimitReached callback when limit is exceeded', async () => {
    const onLimitReachedMock = vi.fn();
    const limiter = new RateLimiter({
      max: 1,
      windowMs: 60000,
      store: mockStore,
      onLimitReached: onLimitReachedMock,
    });

    await limiter.middleware(mockRequest as FastifyRequest, mockReply as FastifyReply); // 1st request
    await expect(limiter.middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)).rejects.toThrow(RateLimitError);

    expect(onLimitReachedMock).toHaveBeenCalledWith(mockRequest, mockReply);
  });
});

describe('createRateLimitMiddleware', () => {
  it('should return a middleware function', () => {
    const middleware = createRateLimitMiddleware({
      max: 10,
      windowMs: 60000,
    });
    expect(typeof middleware).toBe('function');
  });
});

describe('RateLimitUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculateResetTime should return correct reset time', () => {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const expectedResetTime = (Math.floor(now / windowMs) + 1) * windowMs;
    expect(RateLimitUtils.calculateResetTime(windowMs)).toBe(expectedResetTime);
  });

  it('formatResetTime should format timestamp to ISO string', () => {
    const resetTime = new Date(2024, 0, 1, 10, 30, 0).getTime();
    expect(RateLimitUtils.formatResetTime(resetTime)).toBe('2024-01-01T10:30:00.000Z');
  });

  it('getRemainingTime should return correct remaining time', () => {
    const now = Date.now();
    const resetTime = now + 5000; // 5 seconds from now
    expect(RateLimitUtils.getRemainingTime(resetTime)).toBe(5000);

    const pastResetTime = now - 5000;
    expect(RateLimitUtils.getRemainingTime(pastResetTime)).toBe(0);
  });

  it('formatRemainingTime should format remaining time to human-readable string', () => {
    const now = Date.now();

    expect(RateLimitUtils.formatRemainingTime(now + 30000)).toBe('30 seconds');
    expect(RateLimitUtils.formatRemainingTime(now + 120000)).toBe('2 minutes');
    expect(RateLimitUtils.formatRemainingTime(now + 7200000)).toBe('2 hours');
  });
});


