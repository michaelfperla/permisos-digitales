// Development Redis client
// Uses dev-config and provides automatic mock fallback

const Redis = require('ioredis');
const config = require('../config/dev-config');
const { logger } = require('./logger');

let redisClient;
let isRedisHealthy = false;

// Mock Redis client for development
class MockRedisClient {
  constructor() {
    this.data = new Map();
    this.expirations = new Map();
    logger.info('Using MockRedisClient for development');
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
    const expiry = Date.now() + (seconds * 1000);
    this.expirations.set(key, expiry);
    return 1;
  }

  async del(key) {
    this.data.delete(key);
    this.expirations.delete(key);
    return 1;
  }

  async flushall() {
    this.data.clear();
    this.expirations.clear();
    return 'OK';
  }

  async keys(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.data.keys()).filter(key => regex.test(key));
  }

  async ttl(key) {
    const expiry = this.expirations.get(key);
    if (!expiry) return -1;
    const ttl = Math.floor((expiry - Date.now()) / 1000);
    return ttl > 0 ? ttl : -2;
  }

  _checkExpiration(key) {
    const expiry = this.expirations.get(key);
    if (expiry && Date.now() > expiry) {
      this.data.delete(key);
      this.expirations.delete(key);
    }
  }

  // Bull queue compatibility
  async eval() { return 0; }
  async evalsha() { return 0; }
  async script() { return 'OK'; }
}

// Initialize Redis client
function initializeRedis() {
  if (!config.redis.enabled) {
    redisClient = new MockRedisClient();
    isRedisHealthy = true;
    return redisClient;
  }

  try {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      enableReadyCheck: config.redis.enableReadyCheck,
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      lazyConnect: true,
    });

    redisClient.on('ready', () => {
      isRedisHealthy = true;
      logger.info('Redis connection established');
    });

    redisClient.on('error', (err) => {
      isRedisHealthy = false;
      logger.error('Redis error:', err.message);
    });

    redisClient.on('close', () => {
      isRedisHealthy = false;
      logger.warn('Redis connection closed');
    });

    // Try to connect
    redisClient.connect().catch((err) => {
      logger.error('Failed to connect to Redis, using mock client:', err.message);
      redisClient = new MockRedisClient();
      isRedisHealthy = true;
    });

  } catch (error) {
    logger.error('Error initializing Redis, using mock client:', error.message);
    redisClient = new MockRedisClient();
    isRedisHealthy = true;
  }

  return redisClient;
}

// Initialize on first import
if (!redisClient) {
  initializeRedis();
}

module.exports = redisClient;