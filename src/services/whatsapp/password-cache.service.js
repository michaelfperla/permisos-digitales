/**
 * Password Cache Service
 * Temporarily stores passwords for WhatsApp users in Redis
 * Used to bridge the gap between user creation and payment processing
 */

const { logger } = require('../../utils/logger');
const redisClient = require('../../utils/redis-client');

class PasswordCacheService {
  constructor() {
    this.TTL = 72 * 60 * 60; // 72 hours in seconds
    this.keyPrefix = 'whatsapp:temp_password:';
  }

  /**
   * Store temporary password for a WhatsApp user
   * @param {number} userId - User ID
   * @param {string} password - Plain text password to store
   * @returns {Promise<boolean>} Success status
   */
  async storeTemporaryPassword(userId, password) {
    try {
      if (!userId || !password) {
        throw new Error('User ID and password are required');
      }

      const key = `${this.keyPrefix}${userId}`;
      
      // Store password with TTL for security
      await redisClient.setex(key, this.TTL, password);
      
      logger.info('Temporary password stored in cache', {
        userId,
        ttlHours: this.TTL / 3600,
        key: key.replace(password, '[REDACTED]') // Don't log the actual password
      });

      return true;

    } catch (error) {
      logger.error('Error storing temporary password in cache', {
        error: error.message,
        userId,
        stack: error.stack
      });
      
      // Don't throw - this should be non-blocking
      // System will fallback to generating new password later
      return false;
    }
  }

  /**
   * Retrieve temporary password for a WhatsApp user
   * @param {number} userId - User ID
   * @returns {Promise<string|null>} Password if found, null otherwise
   */
  async getTemporaryPassword(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const key = `${this.keyPrefix}${userId}`;
      const password = await redisClient.get(key);
      
      if (password) {
        logger.info('Temporary password retrieved from cache', {
          userId,
          hasPassword: !!password
        });
      } else {
        logger.debug('No temporary password found in cache', {
          userId
        });
      }

      return password;

    } catch (error) {
      logger.error('Error retrieving temporary password from cache', {
        error: error.message,
        userId,
        stack: error.stack
      });
      
      // Return null on error - system will fallback to generating new password
      return null;
    }
  }

  /**
   * Clear temporary password from cache
   * Should be called after password is successfully delivered
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async clearTemporaryPassword(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const key = `${this.keyPrefix}${userId}`;
      const deleted = await redisClient.del(key);
      
      logger.info('Temporary password cleared from cache', {
        userId,
        wasDeleted: deleted > 0
      });

      return deleted > 0;

    } catch (error) {
      logger.error('Error clearing temporary password from cache', {
        error: error.message,
        userId,
        stack: error.stack
      });
      
      // Don't throw - this is cleanup and non-critical
      return false;
    }
  }

  /**
   * Check if temporary password exists for user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Whether password exists
   */
  async hasTemporaryPassword(userId) {
    try {
      if (!userId) {
        return false;
      }

      const key = `${this.keyPrefix}${userId}`;
      const exists = await redisClient.exists(key);
      
      return exists === 1;

    } catch (error) {
      logger.error('Error checking temporary password existence', {
        error: error.message,
        userId
      });
      
      return false;
    }
  }

  /**
   * Get TTL for a stored password
   * @param {number} userId - User ID
   * @returns {Promise<number>} TTL in seconds, -1 if key doesn't exist
   */
  async getPasswordTTL(userId) {
    try {
      if (!userId) {
        return -1;
      }

      const key = `${this.keyPrefix}${userId}`;
      const ttl = await redisClient.ttl(key);
      
      return ttl;

    } catch (error) {
      logger.error('Error getting password TTL', {
        error: error.message,
        userId
      });
      
      return -1;
    }
  }

  /**
   * Extend TTL for existing password
   * @param {number} userId - User ID
   * @param {number} additionalSeconds - Additional seconds to add
   * @returns {Promise<boolean>} Success status
   */
  async extendPasswordTTL(userId, additionalSeconds = 24 * 60 * 60) {
    try {
      if (!userId) {
        return false;
      }

      const key = `${this.keyPrefix}${userId}`;
      const currentTTL = await redisClient.ttl(key);
      
      if (currentTTL <= 0) {
        // Key doesn't exist or has no expiry
        return false;
      }

      const newTTL = currentTTL + additionalSeconds;
      const success = await redisClient.expire(key, newTTL);
      
      logger.info('Password TTL extended', {
        userId,
        previousTTL: currentTTL,
        newTTL,
        additionalSeconds
      });

      return success === 1;

    } catch (error) {
      logger.error('Error extending password TTL', {
        error: error.message,
        userId,
        additionalSeconds
      });
      
      return false;
    }
  }

  /**
   * Get health status of the cache service
   * @returns {Promise<object>} Health status information
   */
  async getHealthStatus() {
    try {
      // Test Redis connectivity
      const testKey = `${this.keyPrefix}health_check`;
      const testValue = Date.now().toString();
      
      await redisClient.setex(testKey, 10, testValue);
      const retrieved = await redisClient.get(testKey);
      await redisClient.del(testKey);
      
      const isHealthy = retrieved === testValue;
      
      return {
        healthy: isHealthy,
        timestamp: new Date().toISOString(),
        redisConnected: isHealthy,
        error: null
      };

    } catch (error) {
      logger.error('Password cache health check failed', {
        error: error.message
      });
      
      return {
        healthy: false,
        timestamp: new Date().toISOString(),
        redisConnected: false,
        error: error.message
      };
    }
  }
}

module.exports = new PasswordCacheService();