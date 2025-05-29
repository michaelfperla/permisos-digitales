/**
 * Mock Redis Client for Testing
 * 
 * This mock implementation provides the same interface as the real Redis client
 * but stores data in memory for testing purposes.
 */

const { logger } = require('./enhanced-logger');

class MockRedisClient {
  constructor() {
    this.data = new Map();
    this.expirations = new Map();
    logger.warn('Using MockRedisClient because Redis is not available');
  }

  async get(key) {
    this._checkExpiration(key);
    return this.data.get(key) || null;
  }

  async set(key, value, ...args) {
    this.data.set(key, value);
    
    // Handle expiration arguments (EX seconds, PX milliseconds)
    if (args.length >= 2) {
      const mode = args[0];
      const time = parseInt(args[1]);
      
      if (mode === 'EX') {
        // Seconds
        this.expirations.set(key, Date.now() + (time * 1000));
      } else if (mode === 'PX') {
        // Milliseconds
        this.expirations.set(key, Date.now() + time);
      }
    }
    
    return 'OK';
  }

  async incr(key) {
    this._checkExpiration(key);
    const current = parseInt(this.data.get(key) || '0');
    const newValue = current + 1;
    this.data.set(key, newValue.toString());
    return newValue;
  }

  async expire(key, seconds) {
    if (!this.data.has(key)) {
      return 0;
    }
    
    this.expirations.set(key, Date.now() + (seconds * 1000));
    return 1;
  }

  async ttl(key) {
    this._checkExpiration(key);
    
    if (!this.data.has(key)) {
      return -2; // Key doesn't exist
    }
    
    const expiration = this.expirations.get(key);
    if (!expiration) {
      return -1; // Key exists but has no expiration
    }
    
    const remaining = Math.ceil((expiration - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async exists(key) {
    this._checkExpiration(key);
    return this.data.has(key) ? 1 : 0;
  }

  async del(...keys) {
    let deletedCount = 0;
    
    for (const key of keys) {
      if (this.data.has(key)) {
        this.data.delete(key);
        this.expirations.delete(key);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  _checkExpiration(key) {
    const expiration = this.expirations.get(key);
    if (expiration && Date.now() > expiration) {
      this.data.delete(key);
      this.expirations.delete(key);
    }
  }

  // Event emitter methods for compatibility
  on(event, callback) {
    // Mock implementation - just return this for chaining
    return this;
  }

  // Additional methods that might be needed
  async flushall() {
    this.data.clear();
    this.expirations.clear();
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }
}

module.exports = MockRedisClient;
