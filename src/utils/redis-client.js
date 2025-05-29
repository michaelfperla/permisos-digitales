// src/utils/redis-client.js
const Redis = require('ioredis');
const config = require('../config');
const { logger } = require('./enhanced-logger');

let redisClient;

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

  _checkExpiration(key) {
    if (this.expirations.has(key)) {
      const expiry = this.expirations.get(key);
      if (Date.now() > expiry) {
        this.data.delete(key);
        this.expirations.delete(key);
      }
    }
  }

  // Add event emitter methods to avoid errors
  on() { return this; }
}

try {
  // Prefer Redis URL if provided
  if (config.redisUrl) {
    redisClient = new Redis(config.redisUrl, {
      // Optional: Add retry strategy, etc.
      maxRetriesPerRequest: 3,
    });
    logger.info('Connecting to Redis using URL...');
  } else if (config.redisHost && config.redisPort) {
    const redisConfig = {
      host: config.redisHost,
      port: config.redisPort,
      password: config.redisPassword,
      maxRetriesPerRequest: 3,
    };

    // Add TLS configuration for production ElastiCache with encryption in transit
    if (config.nodeEnv === 'production') {
      redisConfig.tls = {
        servername: config.redisHost
      };
    }

    redisClient = new Redis(redisConfig);
    logger.info(`Connecting to Redis using Host/Port: ${config.redisHost}:${config.redisPort}...`);
  } else {
    throw new Error('Redis configuration (URL or Host/Port) not found.');
  }

  redisClient.on('connect', () => {
    logger.info('Successfully connected to Redis.');
  });

  // Track if we've already logged the Redis error to avoid repetitive messages
  let redisErrorLogged = false;

  redisClient.on('error', (err) => {
    if (config.nodeEnv === 'production') {
      // In production, don't fall back to in-memory store as it defeats the purpose of distributed lockout
      logger.error('CRITICAL: Redis connection error in production environment:', err);
      logger.error('Redis client will attempt to reconnect automatically using built-in retry strategy');
      // redisClient remains as is (in error state) - ioredis will attempt to reconnect
    } else {
      // Only in development/test, fall back to mock for developer convenience
      // Only log the error once to avoid console spam
      if (!redisErrorLogged) {
        logger.warn('Redis connection error in development environment. Using MockRedisClient as fallback.');
        redisErrorLogged = true;
      }

      if (!redisClient || redisClient.status === 'end') {
        redisClient = new MockRedisClient();
      }
    }
  });

} catch (error) {
  logger.error(`Failed to initialize Redis client: ${error.message}`);

  if (config.nodeEnv === 'production') {
    // In production, this is a critical error
    logger.error('CRITICAL: Unable to initialize Redis client in production environment');
    logger.error('Account lockout functionality may not work properly without Redis');
    // redisClient remains null or undefined - services should handle this case
  } else {
    // Only in development/test, use the mock Redis client as a fallback
    // The MockRedisClient constructor will handle logging the warning
    redisClient = new MockRedisClient();
  }
}

module.exports = redisClient; // Export the client instance
