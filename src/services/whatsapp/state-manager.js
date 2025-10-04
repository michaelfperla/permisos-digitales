const { logger } = require('../../utils/logger');
const redisClient = require('../../utils/redis-client');
const SecureRedisWrapper = require('./redis-wrapper');

/**
 * Centralized state management for WhatsApp conversations
 * Handles Redis operations with memory fallback and proper error handling
 * Uses LRU (Least Recently Used) eviction policy for memory management
 */
class StateManager {
  constructor() {
    this.memoryCache = new Map();
    this.accessOrder = new Map(); // Track access order for LRU
    this.CACHE_TTL = 3600000; // 1 hour
    this.MAX_MEMORY_ENTRIES = 100;
    
    // Initialize secure Redis wrapper if encryption is enabled
    if (process.env.ENABLE_REDIS_ENCRYPTION === 'true') {
      this.redis = new SecureRedisWrapper(redisClient);
      logger.info('StateManager: Redis encryption enabled');
    } else {
      this.redis = redisClient;
    }
  }

  /**
   * Get state with Redis primary, memory fallback
   */
  async getState(userId) {
    const key = `wa:${userId}`;
    
    try {
      // Try Redis first
      const redisData = await this.redis.get(key);
      if (redisData) {
        try {
          return JSON.parse(redisData);
        } catch (parseError) {
          logger.error('Error parsing Redis state data', { 
            error: parseError.message, 
            userId 
          });
          // Clear corrupted Redis data
          await this.redis.del(key);
        }
      }
    } catch (redisError) {
      logger.error('Redis get operation failed', { 
        error: redisError.message, 
        userId 
      });
    }

    // Fallback to memory cache
    try {
      const cached = this.memoryCache.get(key);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        // Update access order for LRU
        this._updateAccessOrder(key);
        
        try {
          return JSON.parse(cached.data);
        } catch (parseError) {
          logger.error('Error parsing memory cache data', { 
            error: parseError.message, 
            userId 
          });
          this._removeFromCache(key);
        }
      } else if (cached) {
        // Remove expired entry
        this._removeFromCache(key);
      }
    } catch (memoryError) {
      logger.error('Memory cache get operation failed', { 
        error: memoryError.message, 
        userId 
      });
    }

    return null;
  }

  /**
   * Set state in both Redis and memory
   */
  async setState(userId, state, ttl = 3600) {
    const key = `wa:${userId}`;
    const stateData = JSON.stringify(state);
    
    // Save to Redis (primary)
    try {
      await this.redis.setex(key, ttl, stateData);
    } catch (redisError) {
      logger.error('Redis set operation failed', { 
        error: redisError.message, 
        userId 
      });
    }

    // Save to memory cache (backup)
    try {
      // Add to cache with LRU management
      this._addToCache(key, {
        data: stateData,
        timestamp: Date.now()
      });
    } catch (memoryError) {
      logger.error('Memory cache set operation failed', { 
        error: memoryError.message, 
        userId 
      });
    }
  }

  /**
   * Clear state from both Redis and memory
   */
  async clearState(userId) {
    const key = `wa:${userId}`;
    
    // Clear from Redis
    try {
      await this.redis.del(key);
    } catch (redisError) {
      logger.error('Redis delete operation failed', { 
        error: redisError.message, 
        userId 
      });
    }

    // Clear from memory
    try {
      this._removeFromCache(key);
    } catch (memoryError) {
      logger.error('Memory cache delete operation failed', { 
        error: memoryError.message, 
        userId 
      });
    }
  }

  /**
   * Check if state exists
   */
  async hasState(userId) {
    const state = await this.getState(userId);
    return state !== null;
  }

  /**
   * Update specific field in existing state
   */
  async updateStateField(userId, fieldName, value) {
    const currentState = await this.getState(userId);
    if (!currentState) {
      throw new Error('No state found to update');
    }
    
    currentState[fieldName] = value;
    await this.setState(userId, currentState);
    return currentState;
  }

  /**
   * Get state statistics for monitoring
   */
  getStatistics() {
    const cacheUtilization = (this.memoryCache.size / this.MAX_MEMORY_ENTRIES) * 100;
    
    return {
      memoryCacheSize: this.memoryCache.size,
      maxMemoryEntries: this.MAX_MEMORY_ENTRIES,
      cacheUtilization: `${cacheUtilization.toFixed(1)}%`,
      accessOrderTracking: this.accessOrder.size,
      cacheTTL: this.CACHE_TTL,
      evictionPolicy: 'LRU (Least Recently Used)'
    };
  }

  /**
   * Add entry to cache with LRU management
   */
  _addToCache(key, value) {
    // Remove if already exists to update position
    if (this.memoryCache.has(key)) {
      this._removeFromCache(key);
    }
    
    // Add new entry
    this.memoryCache.set(key, value);
    this._updateAccessOrder(key);
    
    // Evict LRU entries if over limit
    if (this.memoryCache.size > this.MAX_MEMORY_ENTRIES) {
      this._evictLRU();
    }
  }

  /**
   * Remove entry from cache and access order
   */
  _removeFromCache(key) {
    this.memoryCache.delete(key);
    this.accessOrder.delete(key);
  }

  /**
   * Update access order for LRU tracking
   */
  _updateAccessOrder(key) {
    // Remove existing entry if present
    if (this.accessOrder.has(key)) {
      this.accessOrder.delete(key);
    }
    
    // Add to end (most recently used)
    this.accessOrder.set(key, Date.now());
    
    // Check if eviction is needed
    if (this.memoryCache.size > this.MAX_MEMORY_ENTRIES) {
      this._evictLRU();
    }
  }

  /**
   * Evict least recently used entries
   */
  _evictLRU() {
    const entriesToRemove = this.memoryCache.size - this.MAX_MEMORY_ENTRIES;
    
    if (entriesToRemove <= 0) {
      return;
    }

    // Sort by access time (ascending - oldest first)
    const sortedByAccess = Array.from(this.accessOrder.entries())
      .sort((a, b) => a[1] - b[1]);
    
    let removedCount = 0;
    for (const [key] of sortedByAccess) {
      if (removedCount >= entriesToRemove) {
        break;
      }
      
      this._removeFromCache(key);
      removedCount++;
    }

    logger.info('LRU cache eviction completed', {
      removedEntries: removedCount,
      currentSize: this.memoryCache.size,
      maxSize: this.MAX_MEMORY_ENTRIES
    });
  }

  /**
   * Clean up old entries from memory cache (legacy method - now uses LRU)
   */
  _cleanupMemoryCache() {
    // This method is kept for compatibility but now uses LRU eviction
    this._evictLRU();
  }

  /**
   * Force cleanup of expired entries
   */
  cleanupExpiredEntries() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, value] of this.memoryCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.memoryCache.delete(key));

    if (expiredKeys.length > 0) {
      logger.info('Expired cache entries cleaned', {
        cleanedEntries: expiredKeys.length,
        currentSize: this.memoryCache.size
      });
    }
  }
}

module.exports = StateManager;