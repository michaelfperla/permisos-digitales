// src/utils/redis-client.js
const Redis = require('ioredis');
// Configuration compatibility layer for dev/prod environments
function getConfig() {
  try {
    // Try unified config first (production)
    const unifiedConfig = require('../config/unified-config');
    if (unifiedConfig.isInitialized && unifiedConfig.isInitialized()) {
      return unifiedConfig.getSync();
    }
  } catch (error) {
    // Unified config not available or not initialized
  }
  
  try {
    // Fall back to dev config (development)
    return require('../config/dev-config');
  } catch (error) {
    // Neither config available
    const { logger } = require('./logger');
    logger.error('No configuration system available');
    throw new Error('Configuration system not available');
  }
}
// RACE CONDITION FIX: Don't get config at module load time
const { logger } = require('./logger');

let redisClient;
let isRedisHealthy = false;
let lastRedisError = null;
let reconnectAttempts = 0;

// Create a mock Redis client for development/testing when Redis is not available
// Track if we've already logged the MockRedisClient warning
let mockClientWarningLogged = false;

class MockRedisClient {
  constructor() {
    this.data = new Map();
    this.expirations = new Map();

    // Only log this warning once to avoid console spam
    if (!mockClientWarningLogged) {
      logger.warn('Using MockRedisClient because Redis is not available');
      mockClientWarningLogged = true;
    }
  }

  async get(key) {
    this._checkExpiration(key);
    return this.data.get(key) || null;
  }

  async set(key, value, expiryMode, time) {
    this.data.set(key, value);
    if (expiryMode === 'EX' && time) {
      const expiry = Date.now() + (time * 1000);
      this.expirations.set(key, expiry);
    }
    return 'OK';
  }

  async setex(key, seconds, value) {
    this.data.set(key, value);
    const expiry = Date.now() + (seconds * 1000);
    this.expirations.set(key, expiry);
    return 'OK';
  }

  async incr(key) {
    this._checkExpiration(key);
    const currentValue = this.data.get(key);
    const newValue = currentValue ? parseInt(currentValue, 10) + 1 : 1;
    this.data.set(key, newValue.toString());
    return newValue;
  }

  async expire(key, seconds) {
    if (this.data.has(key)) {
      const expiry = Date.now() + (seconds * 1000);
      this.expirations.set(key, expiry);
      return 1;
    }
    return 0;
  }

  async ttl(key) {
    this._checkExpiration(key);
    if (!this.data.has(key)) return -2; // Key doesn't exist
    if (!this.expirations.has(key)) return -1; // Key exists but has no expiry

    const expiry = this.expirations.get(key);
    const now = Date.now();
    return Math.ceil((expiry - now) / 1000);
  }

  async exists(key) {
    this._checkExpiration(key);
    return this.data.has(key) ? 1 : 0;
  }

  async del(...keys) {
    let count = 0;
    for (const key of keys) {
      if (this.data.delete(key)) count++;
      this.expirations.delete(key);
    }
    return count;
  }

  async keys(pattern) {
    const allKeys = Array.from(this.data.keys());
    if (pattern === '*') {
      return allKeys;
    }
    // Simple pattern matching for cache keys like "config:*"
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  _checkExpiration(key) {
    if (this.expirations.has(key)) {
      const expiry = this.expirations.get(key);
      if (Date.now() > expiry) {
        this.data.delete(key);
        this.expirations.delete(key);
      }
    }
  }

  async ping() {
    return 'PONG';
  }

  async scan(cursor = '0', ...args) {
    // Extract MATCH pattern and COUNT from args
    let matchPattern = '*';
    let count = 10;
    
    for (let i = 0; i < args.length; i += 2) {
      if (args[i] === 'MATCH') {
        matchPattern = args[i + 1];
      } else if (args[i] === 'COUNT') {
        count = parseInt(args[i + 1], 10);
      }
    }
    
    const allKeys = await this.keys(matchPattern);
    const startIndex = parseInt(cursor, 10);
    const endIndex = Math.min(startIndex + count, allKeys.length);
    const keys = allKeys.slice(startIndex, endIndex);
    const nextCursor = endIndex >= allKeys.length ? '0' : endIndex.toString();
    
    return [nextCursor, keys];
  }

  async smembers(key) {
    // For mock, just return empty array since sets aren't fully implemented
    return [];
  }

  async sadd(key, ...members) {
    // For mock, just return count of members added
    return members.length;
  }

  // Add event emitter methods to avoid errors
  on() { return this; }
}

// Production-grade Redis configuration with proper retry strategy
const createRedisClient = () => {
  // RACE CONDITION FIX: Get config when needed
  const config = getConfig();
  
  const redisOptions = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000,
    
    // Robust retry strategy for production
    retryStrategy(times) {
      reconnectAttempts = times;
      
      // After 10 attempts, slow down reconnection attempts
      if (times > 10) {
        logger.error(`Redis reconnection attempt ${times} failed`);
        // Try every 30 seconds after 10 attempts
        return 30000;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(times * 1000, 5000) + Math.random() * 500;
      logger.warn(`Retrying Redis connection in ${delay}ms (attempt ${times})`);
      return delay;
    },
    
    // Handle connection errors
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Only reconnect when the error contains "READONLY"
        return true;
      }
      return false;
    }
  };
  
  // Add Redis configuration
  if (config.redis?.host) {
    Object.assign(redisOptions, {
      host: config.redis.host,
      port: config.redis.port || 6379,
      password: config.redis.password,
      keyPrefix: config.redis.keyPrefix || 'pd:'
    });
    
    // Use TLS configuration from config module if available
    if (config.redis.tls) {
      redisOptions.tls = config.redis.tls;
      logger.info('Configuring Redis with TLS for production', {
        tlsEnabled: true,
        environment: config.nodeEnv
      });
    }
  }
  
  return new Redis(redisOptions);
};

// Defer Redis connection until explicitly requested
const initializeRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  // RACE CONDITION FIX: Get config when needed
  const config = getConfig();
  
  try {
    if (config.redis?.enabled && config.redis?.host) {
      redisClient = createRedisClient();
      logger.info('Connecting to Redis...', {
        hasRedisConfig: true,
        environment: config.nodeEnv
      });
    } else {
      throw new Error('Redis disabled or configuration not found.');
    }

    redisClient.on('connect', () => {
      isRedisHealthy = true;
      reconnectAttempts = 0;
      logger.info('Successfully connected to Redis.');
    });

    redisClient.on('ready', () => {
      isRedisHealthy = true;
      logger.info('Redis client is ready to accept commands.');
    });

    redisClient.on('error', (err) => {
      lastRedisError = err;
      isRedisHealthy = false;
      
      // Log error only if it's different from the last one
      const errorMessage = err.message || err.toString();
      if (!lastRedisError || lastRedisError.message !== errorMessage) {
        logger.error('Redis connection error:', errorMessage);
      }
    });

    redisClient.on('close', () => {
      isRedisHealthy = false;
      logger.warn('Redis connection closed.');
    });

    redisClient.on('reconnecting', (delay) => {
      logger.info(`Reconnecting to Redis in ${delay}ms...`);
    });

    redisClient.on('end', () => {
      isRedisHealthy = false;
      logger.error('Redis connection terminated.');
    });

    return redisClient;

  } catch (error) {
    logger.error(`Failed to initialize Redis client: ${error.message}`);

    if (config.nodeEnv === 'production') {
      // In production, create a failsafe wrapper
      logger.error('CRITICAL: Unable to initialize Redis client in production');
      logger.error('Using failsafe mode - lockout protection will be limited');
      
      // Create a no-op client that doesn't crash the application
      redisClient = null;
      return null;
    } else {
      // Only in development/test, use the mock Redis client
      redisClient = new MockRedisClient();
      return redisClient;
    }
  }
};

// Create a getter function for the Redis client
const getRedisClient = () => {
  if (!redisClient) {
    return initializeRedisClient();
  }
  return redisClient;
};

// Production-safe wrapper that handles Redis failures gracefully
class ResilientRedisWrapper {
  constructor(client) {
    this.client = client;
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
  
  async executeCommand(command, args = []) {
    try {
      // If no client or client is not healthy, handle gracefully
      if (!this.client || !isRedisHealthy) {
        logger.warn(`Redis unavailable, skipping ${command} operation`);
        
        // Return sensible defaults for read operations
        if (command === 'get') return null;
        if (command === 'exists') return 0;
        if (command === 'ttl') return -2;
        if (command === 'incr') return 1; // Allow operation but don't track
        
        // For write operations, just acknowledge
        return 'OK';
      }
      
      // Execute the actual Redis command
      const result = await this.client[command](...args);
      
      // Reset failure tracking on success
      this.failureCount = 0;
      this.lastFailureTime = null;
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      // Log error with rate limiting
      if (this.failureCount === 1 || this.failureCount % 10 === 0) {
        logger.error(`Redis command ${command} failed (${this.failureCount} failures):`, error.message);
      }
      
      // Return safe defaults
      if (command === 'get') return null;
      if (command === 'exists') return 0;
      if (command === 'ttl') return -2;
      if (command === 'incr') return 1;
      
      return 'OK';
    }
  }
  
  // Implement all Redis methods with resilient wrapper
  async get(key) {
    return this.executeCommand('get', [key]);
  }
  
  async set(key, value, ...args) {
    return this.executeCommand('set', [key, value, ...args]);
  }
  
  async incr(key) {
    return this.executeCommand('incr', [key]);
  }
  
  async setex(key, seconds, value) {
    return this.executeCommand('setex', [key, seconds, value]);
  }
  
  async expire(key, seconds) {
    return this.executeCommand('expire', [key, seconds]);
  }
  
  async ttl(key) {
    return this.executeCommand('ttl', [key]);
  }
  
  async exists(key) {
    return this.executeCommand('exists', [key]);
  }
  
  async del(...keys) {
    return this.executeCommand('del', keys);
  }
  
  async ping() {
    return this.executeCommand('ping', []);
  }
  
  async scan(cursor, ...args) {
    return this.executeCommand('scan', [cursor, ...args]);
  }
  
  async smembers(key) {
    return this.executeCommand('smembers', [key]);
  }
  
  async sadd(key, ...members) {
    return this.executeCommand('sadd', [key, ...members]);
  }
  
  // Health check method
  isHealthy() {
    return isRedisHealthy && this.client && this.client.status === 'ready';
  }
  
  // Get connection status
  getStatus() {
    return {
      healthy: this.isHealthy(),
      status: this.client?.status || 'disconnected',
      lastError: lastRedisError?.message || null,
      reconnectAttempts,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Add test connection function
const testRedisConnection = async () => {
  try {
    const client = getRedisClient();
    if (!client) {
      logger.warn('Redis client not available for testing');
      return false;
    }
    
    // Try a simple ping
    if (client instanceof MockRedisClient) {
      logger.info('Using MockRedisClient - connection test passed');
      return true;
    }
    
    // For real Redis client, wait for ready state
    if (client.status === 'ready') {
      return true;
    }
    
    // Wait for connection with timeout
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.warn('Redis connection test timed out');
        resolve(false);
      }, 5000);
      
      client.once('ready', () => {
        clearTimeout(timeout);
        resolve(true);
      });
      
      client.once('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  } catch (error) {
    logger.error('Redis connection test failed:', error);
    return false;
  }
};

// RACE CONDITION FIX: Create exports lazily to avoid accessing config at module load
const createProductionExports = () => ({
    // In production, export wrapper that handles getRedisClient lazily
    ...new ResilientRedisWrapper(null),
    getRedisClient,
    testRedisConnection,
    // Override methods to use lazy initialization
    async get(key) {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.get(key);
    },
    async set(key, value, ...args) {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.set(key, value, ...args);
    },
    async incr(key) {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.incr(key);
    },
    async setex(key, seconds, value) {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.setex(key, seconds, value);
    },
    async expire(key, seconds) {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.expire(key, seconds);
    },
    async ttl(key) {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.ttl(key);
    },
    async exists(key) {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.exists(key);
    },
    async del(...keys) {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.del(...keys);
    },
    async ping() {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.ping();
    },
    async scan(cursor, ...args) {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.scan(cursor, ...args);
    },
    async smembers(key) {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.smembers(key);
    },
    async sadd(key, ...members) {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.sadd(key, ...members);
    },
    isHealthy() {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.isHealthy();
    },
    getStatus() {
      const wrapper = new ResilientRedisWrapper(getRedisClient());
      return wrapper.getStatus();
    }
});

const createDevelopmentExports = () => ({
    getRedisClient,
    testRedisConnection,
    get: (key) => getRedisClient().get(key),
    set: (key, value, ...args) => getRedisClient().set(key, value, ...args),
    setex: (key, seconds, value) => getRedisClient().setex(key, seconds, value),
    incr: (key) => getRedisClient().incr(key),
    expire: (key, seconds) => getRedisClient().expire(key, seconds),
    ttl: (key) => getRedisClient().ttl(key),
    exists: (key) => getRedisClient().exists(key),
    del: (...keys) => getRedisClient().del(...keys),
    keys: (pattern) => getRedisClient().keys(pattern),
    ping: () => getRedisClient().ping(),
    scan: (cursor, ...args) => getRedisClient().scan(cursor, ...args),
    smembers: (key) => getRedisClient().smembers(key),
    sadd: (key, ...members) => getRedisClient().sadd(key, ...members),
    on: (...args) => getRedisClient().on(...args)
});

// Export a proxy that creates the real exports on first access
let cachedExports = null;
module.exports = new Proxy({}, {
  get(target, prop) {
    if (!cachedExports) {
      const config = getConfig();
      cachedExports = config.nodeEnv === 'production' 
        ? createProductionExports() 
        : createDevelopmentExports();
    }
    return cachedExports[prop];
  },
  has(target, prop) {
    if (!cachedExports) {
      const config = getConfig();
      cachedExports = config.nodeEnv === 'production' 
        ? createProductionExports() 
        : createDevelopmentExports();
    }
    return prop in cachedExports;
  }
});
