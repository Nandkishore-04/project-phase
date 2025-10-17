import Redis from 'ioredis';

// Redis is optional for Phase 1 - gracefully handle connection failures
let redis: Redis | null = null;

try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
      // Stop retrying after 3 attempts
      if (times > 3) {
        console.warn('⚠️  Redis unavailable - running without cache');
        return null;
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redis.on('error', (err) => {
    console.warn('⚠️  Redis error (app will continue):', err.message);
  });
} catch (error) {
  console.warn('⚠️  Redis unavailable - running without cache');
}

// Mock Redis for development without Redis server
const mockRedis = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 1,
  quit: () => {},
};

export default redis || (mockRedis as any);
