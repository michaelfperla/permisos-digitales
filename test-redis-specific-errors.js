// test-redis-specific-errors.js
// Test script to verify the behavior when Redis encounters specific errors

// Set NODE_ENV to production for this test
process.env.NODE_ENV = 'production';

// Import required modules
const path = require('path');
const { logger } = require('./src/utils/enhanced-logger');

// Path to the redis-client module
const redisClientPath = path.resolve('./src/utils/redis-client.js');

// Create a mock Redis client that throws errors for specific operations
const errorProneRedisClient = {
  status: 'ready',
  data: new Map(),
  expirations: new Map(),
  
  // This operation will work normally
  async get(key) {
    return this.data.get(key) || null;
  },
  
  // This operation will work normally
  async set(key, value, expiryMode, time) {
    this.data.set(key, value);
    if (expiryMode === 'EX' && time) {
      const expiry = Date.now() + (time * 1000);
      this.expirations.set(key, expiry);
    }
    return 'OK';
  },
  
  // This operation will fail
  async incr(key) {
    throw new Error('Redis error: INCR command failed');
  },
  
  // This operation will fail
  async expire(key, seconds) {
    throw new Error('Redis error: EXPIRE command failed');
  },
  
  // This operation will work normally
  async ttl(key) {
    if (!this.data.has(key)) return -2; // Key doesn't exist
    if (!this.expirations.has(key)) return -1; // Key exists but has no expiry
    
    const expiry = this.expirations.get(key);
    const now = Date.now();
    return Math.ceil((expiry - now) / 1000);
  },
  
  // This operation will fail
  async exists(key) {
    throw new Error('Redis error: EXISTS command failed');
  },
  
  // This operation will fail
  async del(...keys) {
    throw new Error('Redis error: DEL command failed');
  },
  
  // Add event emitter methods to avoid errors
  on() { return this; }
};

// Test the behavior with specific Redis errors
async function testRedisSpecificErrors() {
  try {
    console.log('=== Testing with specific Redis errors ===');
    
    // Force Redis client to be the error-prone one
    require.cache[redisClientPath] = {
      id: redisClientPath,
      filename: redisClientPath,
      loaded: true,
      exports: errorProneRedisClient
    };
    
    // Clear require cache for auth-security service to reload with the error-prone Redis client
    delete require.cache[require.resolve('./src/services/auth-security.service.js')];
    
    // Import the auth-security service with the error-prone Redis client
    const authSecurity = require('./src/services/auth-security.service');
    
    console.log('\nTesting checkLockStatus (will fail on EXISTS):');
    const lockStatus = await authSecurity.checkLockStatus('test@example.com');
    console.log('Lock status:', lockStatus);
    
    console.log('\nTesting recordFailedAttempt (will fail on INCR):');
    const attemptResult = await authSecurity.recordFailedAttempt('test@example.com');
    console.log('Attempt result:', attemptResult);
    
    console.log('\nTesting resetAttempts (will fail on DEL):');
    await authSecurity.resetAttempts('test@example.com');
    console.log('Reset attempts completed');
    
  } catch (error) {
    console.error('Error during tests:', error);
  }
}

// Run the test
testRedisSpecificErrors();
