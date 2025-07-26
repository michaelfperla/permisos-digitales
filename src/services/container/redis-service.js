/**
 * Redis Service
 * Manages Redis connections with automatic fallback to in-memory storage
 */

const redis = require('redis');
const { logger } = require('../../utils/logger');
const config = require('../../config/v2/config');

class RedisService {
  constructor() {
    this.client = null;
    this.isRedis = false;
    this.fallbackStore = null;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
  }

  /**
   * Initialize Redis connection or fallback
   */
  async initialize() {
    logger.info('[RedisService] Initializing...');
    
    const redisConfig = config.getValue('redis');
    
    // Check if Redis is enabled
    if (!redisConfig.enabled) {
      logger.info('[RedisService] Redis disabled, using in-memory fallback');
      this._initializeFallback();
      return;
    }

    // Try to connect to Redis
    try {
      await this._connectToRedis(redisConfig);
    } catch (error) {
      logger.warn('[RedisService] Redis connection failed, using in-memory fallback:', error.message);
      this._initializeFallback();
    }
  }

  /**
   * Connect to Redis
   */
  async _connectToRedis(redisConfig) {
    return new Promise((resolve, reject) => {
      const connectionOptions = {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        tls: redisConfig.tls,
        retry_strategy: (options) => {
          this.connectionAttempts++;
          
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('[RedisService] Redis connection refused');
            return new Error('Redis connection refused');
          }

          if (this.connectionAttempts > this.maxConnectionAttempts) {
            logger.error('[RedisService] Max connection attempts reached');
            return new Error('Max connection attempts reached');
          }

          // Exponential backoff
          const delay = Math.min(options.attempt * 1000, 10000);
          logger.warn(`[RedisService] Retrying connection in ${delay}ms (attempt ${options.attempt})`);
          return delay;
        }
      };

      this.client = redis.createClient(connectionOptions);

      this.client.on('error', (error) => {
        logger.error('[RedisService] Redis error:', error);
      });

      this.client.on('connect', () => {
        logger.info('[RedisService] Connected to Redis');
        this.isRedis = true;
        this.connectionAttempts = 0;
        resolve();
      });

      this.client.on('ready', () => {
        logger.info('[RedisService] Redis connection ready');
      });

      this.client.on('reconnecting', () => {
        logger.warn('[RedisService] Reconnecting to Redis...');
      });

      this.client.on('end', () => {
        logger.warn('[RedisService] Redis connection closed');
      });

      // Set connection timeout
      setTimeout(() => {
        if (!this.isRedis) {
          this.client.quit();
          reject(new Error('Redis connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Initialize in-memory fallback
   */
  _initializeFallback() {
    this.isRedis = false;
    this.fallbackStore = new Map();
    this.fallbackExpiry = new Map();
    
    // Clean up expired entries periodically
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpired();
    }, 60000); // Every minute

    logger.info('[RedisService] In-memory fallback initialized');
  }

  /**
   * Clean up expired entries in fallback store
   */
  _cleanupExpired() {
    const now = Date.now();
    for (const [key, expiry] of this.fallbackExpiry.entries()) {
      if (expiry && expiry < now) {
        this.fallbackStore.delete(key);
        this.fallbackExpiry.delete(key);
      }
    }
  }

  /**
   * Get a value
   * @param {string} key - Key to get
   * @returns {Promise<string|null>} Value or null
   */
  async get(key) {
    if (this.isRedis) {
      return new Promise((resolve, reject) => {
        this.client.get(key, (err, value) => {
          if (err) {
            logger.error('[RedisService] Error getting value:', err);
            reject(err);
          } else {
            resolve(value);
          }
        });
      });
    } else {
      // Fallback implementation
      const expiry = this.fallbackExpiry.get(key);
      if (expiry && expiry < Date.now()) {
        this.fallbackStore.delete(key);
        this.fallbackExpiry.delete(key);
        return null;
      }
      return this.fallbackStore.get(key) || null;
    }
  }

  /**
   * Set a value
   * @param {string} key - Key to set
   * @param {string} value - Value to set
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<void>}
   */
  async set(key, value, ttl = null) {
    if (this.isRedis) {
      return new Promise((resolve, reject) => {
        if (ttl) {
          this.client.setex(key, ttl, value, (err) => {
            if (err) {
              logger.error('[RedisService] Error setting value:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        } else {
          this.client.set(key, value, (err) => {
            if (err) {
              logger.error('[RedisService] Error setting value:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        }
      });
    } else {
      // Fallback implementation
      this.fallbackStore.set(key, value);
      if (ttl) {
        this.fallbackExpiry.set(key, Date.now() + (ttl * 1000));
      } else {
        this.fallbackExpiry.delete(key);
      }
    }
  }

  /**
   * Delete a key
   * @param {string} key - Key to delete
   * @returns {Promise<void>}
   */
  async del(key) {
    if (this.isRedis) {
      return new Promise((resolve, reject) => {
        this.client.del(key, (err) => {
          if (err) {
            logger.error('[RedisService] Error deleting key:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      this.fallbackStore.delete(key);
      this.fallbackExpiry.delete(key);
    }
  }

  /**
   * Check if a key exists
   * @param {string} key - Key to check
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    if (this.isRedis) {
      return new Promise((resolve, reject) => {
        this.client.exists(key, (err, exists) => {
          if (err) {
            logger.error('[RedisService] Error checking existence:', err);
            reject(err);
          } else {
            resolve(exists === 1);
          }
        });
      });
    } else {
      const expiry = this.fallbackExpiry.get(key);
      if (expiry && expiry < Date.now()) {
        this.fallbackStore.delete(key);
        this.fallbackExpiry.delete(key);
        return false;
      }
      return this.fallbackStore.has(key);
    }
  }

  /**
   * Set expiry on a key
   * @param {string} key - Key to expire
   * @param {number} seconds - Seconds until expiry
   * @returns {Promise<void>}
   */
  async expire(key, seconds) {
    if (this.isRedis) {
      return new Promise((resolve, reject) => {
        this.client.expire(key, seconds, (err) => {
          if (err) {
            logger.error('[RedisService] Error setting expiry:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      if (this.fallbackStore.has(key)) {
        this.fallbackExpiry.set(key, Date.now() + (seconds * 1000));
      }
    }
  }

  /**
   * Increment a counter
   * @param {string} key - Key to increment
   * @returns {Promise<number>} New value
   */
  async incr(key) {
    if (this.isRedis) {
      return new Promise((resolve, reject) => {
        this.client.incr(key, (err, value) => {
          if (err) {
            logger.error('[RedisService] Error incrementing:', err);
            reject(err);
          } else {
            resolve(value);
          }
        });
      });
    } else {
      const current = parseInt(this.fallbackStore.get(key) || '0', 10);
      const newValue = current + 1;
      this.fallbackStore.set(key, newValue.toString());
      return newValue;
    }
  }

  /**
   * Add to a set
   * @param {string} key - Set key
   * @param {string} member - Member to add
   * @returns {Promise<void>}
   */
  async sadd(key, member) {
    if (this.isRedis) {
      return new Promise((resolve, reject) => {
        this.client.sadd(key, member, (err) => {
          if (err) {
            logger.error('[RedisService] Error adding to set:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      const set = this.fallbackStore.get(key) || new Set();
      if (!(set instanceof Set)) {
        throw new Error('WRONGTYPE Operation against a key holding the wrong kind of value');
      }
      set.add(member);
      this.fallbackStore.set(key, set);
    }
  }

  /**
   * Get all members of a set
   * @param {string} key - Set key
   * @returns {Promise<string[]>} Set members
   */
  async smembers(key) {
    if (this.isRedis) {
      return new Promise((resolve, reject) => {
        this.client.smembers(key, (err, members) => {
          if (err) {
            logger.error('[RedisService] Error getting set members:', err);
            reject(err);
          } else {
            resolve(members || []);
          }
        });
      });
    } else {
      const set = this.fallbackStore.get(key);
      if (!set) return [];
      if (!(set instanceof Set)) {
        throw new Error('WRONGTYPE Operation against a key holding the wrong kind of value');
      }
      return Array.from(set);
    }
  }

  /**
   * Flush all data (use with caution)
   * @returns {Promise<void>}
   */
  async flushall() {
    if (this.isRedis) {
      return new Promise((resolve, reject) => {
        this.client.flushall((err) => {
          if (err) {
            logger.error('[RedisService] Error flushing:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      this.fallbackStore.clear();
      this.fallbackExpiry.clear();
    }
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    const status = {
      healthy: true,
      service: 'redis',
      usingRedis: this.isRedis,
      details: {}
    };

    if (this.isRedis) {
      try {
        const startTime = Date.now();
        await this.set('health:check', Date.now().toString(), 10);
        const value = await this.get('health:check');
        const responseTime = Date.now() - startTime;

        status.details = {
          connected: true,
          responseTime,
          host: config.getValue('redis.host'),
          port: config.getValue('redis.port')
        };
      } catch (error) {
        status.healthy = false;
        status.error = error.message;
        status.details = {
          connected: false
        };
      }
    } else {
      status.details = {
        type: 'in-memory',
        entries: this.fallbackStore.size,
        expiringEntries: this.fallbackExpiry.size
      };
    }

    return status;
  }

  /**
   * Shutdown service
   */
  async shutdown() {
    logger.info('[RedisService] Shutting down...');
    
    if (this.isRedis && this.client) {
      return new Promise((resolve) => {
        this.client.quit(() => {
          logger.info('[RedisService] Redis connection closed');
          resolve();
        });
      });
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.fallbackStore = null;
    this.fallbackExpiry = null;
  }
}

// Factory function for service container
function createRedisService() {
  return new RedisService();
}

module.exports = createRedisService;
module.exports.RedisService = RedisService;