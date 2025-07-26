/**
 * Redis wrapper with retry logic and fallback for WhatsApp
 */

const { logger } = require('../../utils/logger');

class RedisWrapper {
  constructor(redisClient) {
    this.redis = redisClient;
    this.retryAttempts = 3;
    this.retryDelay = 100; // ms
  }

  /**
   * Wrapper for Redis get with retry
   */
  async get(key) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await this.redis.get(key);
      } catch (error) {
        logger.warn(`Redis get failed, attempt ${attempt}/${this.retryAttempts}`, {
          key,
          error: error.message
        });
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Wrapper for Redis setex with retry
   */
  async setex(key, ttl, value) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await this.redis.setex(key, ttl, value);
      } catch (error) {
        logger.warn(`Redis setex failed, attempt ${attempt}/${this.retryAttempts}`, {
          key,
          ttl,
          error: error.message
        });
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Wrapper for Redis del with retry
   */
  async del(key) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await this.redis.del(key);
      } catch (error) {
        logger.warn(`Redis del failed, attempt ${attempt}/${this.retryAttempts}`, {
          key,
          error: error.message
        });
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        } else {
          // Delete is less critical, log and continue
          logger.error('Redis del failed after retries', { key, error: error.message });
          return 0;
        }
      }
    }
  }

  /**
   * Check if Redis is healthy
   */
  async isHealthy() {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * State-specific methods with automatic TTL
   */
  async getState(userId) {
    const key = `wa:${userId}`;
    return this.get(key);
  }

  async setState(userId, state, ttl = 3600) {
    const key = `wa:${userId}`;
    // Always include timestamp
    if (!state.timestamp) {
      state.timestamp = Date.now();
    }
    // Ensure lastActivity is tracked
    state.lastActivity = Date.now();
    
    return this.setex(key, ttl, JSON.stringify(state));
  }

  async deleteState(userId) {
    const key = `wa:${userId}`;
    return this.del(key);
  }

  /**
   * Lock management with connection validation
   */
  async acquireLock(userId, timeout = 5000) {
    // Validate connection first
    if (!await this.isHealthy()) {
      logger.error('Cannot acquire lock - Redis unavailable', { userId });
      throw new Error('Redis connection unavailable');
    }
    
    const lockKey = `lock:wa:${userId}`;
    const lockId = Date.now().toString();
    
    try {
      // SET NX PX - atomic lock acquisition
      const result = await this.redis.set(lockKey, lockId, 'NX', 'PX', timeout);
      return result === 'OK' ? lockId : null;
    } catch (error) {
      logger.error('Failed to acquire lock', { userId, error: error.message });
      return null;
    }
  }

  async releaseLock(userId, lockId) {
    const lockKey = `lock:wa:${userId}`;
    
    try {
      const currentLock = await this.get(lockKey);
      if (currentLock === lockId) {
        await this.del(lockKey);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to release lock', { userId, error: error.message });
      return false;
    }
  }
}

module.exports = RedisWrapper;