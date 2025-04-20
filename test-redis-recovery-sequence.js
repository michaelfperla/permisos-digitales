// test-redis-recovery-sequence.js
// Test script to verify the behavior when Redis fails and then recovers

// Set NODE_ENV to production for this test
process.env.NODE_ENV = 'production';

// Import required modules
const path = require('path');
const { logger } = require('./src/utils/enhanced-logger');

// Path to the redis-client module
const redisClientPath = path.resolve('./src/utils/redis-client.js');

// Create a mock Redis client that works normally
const workingMockRedisClient = {
  status: 'ready',
  data: new Map(),
  expirations: new Map(),
  
  async get(key) {
    return this.data.get(key) || null;
  },
  
  async set(key, value, expiryMode, time) {
    this.data.set(key, value);
    if (expiryMode === 'EX' && time) {
      const expiry = Date.now() + (time * 1000);
      this.expirations.set(key, expiry);
    }
    return 'OK';
  },
  
  async incr(key) {
    const currentValue = this.data.get(key);
    const newValue = currentValue ? parseInt(currentValue, 10) + 1 : 1;
    this.data.set(key, newValue.toString());
    return newValue;
  },
  
  async expire(key, seconds) {
    if (this.data.has(key)) {
      const expiry = Date.now() + (seconds * 1000);
      this.expirations.set(key, expiry);
      return 1;
    }
    return 0;
  },
  
  async ttl(key) {
    if (!this.data.has(key)) return -2; // Key doesn't exist
    if (!this.expirations.has(key)) return -1; // Key exists but has no expiry
    
    const expiry = this.expirations.get(key);
    const now = Date.now();
    return Math.ceil((expiry - now) / 1000);
  },
  
  async exists(key) {
    return this.data.has(key) ? 1 : 0;
  },
  
  async del(...keys) {
    let count = 0;
    for (const key of keys) {
      if (this.data.delete(key)) count++;
      this.expirations.delete(key);
    }
    return count;
  },
  
  // Add event emitter methods to avoid errors
  on() { return this; }
};

// Create a mock Redis client that is in error state
const errorMockRedisClient = {
  status: 'reconnecting',
  on() { return this; }
};

// Test the sequence
async function testRedisRecoverySequence() {
  try {
    console.log('=== STEP 1: Redis is down ===');
    
    // Force Redis client to be in error state
    require.cache[redisClientPath] = {
      id: redisClientPath,
      filename: redisClientPath,
      loaded: true,
      exports: errorMockRedisClient
    };
    
    // Clear require cache for auth-security service to reload with the error Redis client
    delete require.cache[require.resolve('./src/services/auth-security.service.js')];
    
    // Import the auth-security service with Redis in error state
    const authSecurityWithError = require('./src/services/auth-security.service');
    
    console.log('\nTesting recordFailedAttempt with Redis down:');
    const attemptResult = await authSecurityWithError.recordFailedAttempt('test@example.com');
    console.log('Attempt result:', attemptResult);
    
    console.log('\nTesting checkLockStatus with Redis down:');
    const lockStatus = await authSecurityWithError.checkLockStatus('test@example.com');
    console.log('Lock status:', lockStatus);
    
    console.log('\n=== STEP 2: Redis recovers ===');
    
    // Force Redis client to be working again
    require.cache[redisClientPath] = {
      id: redisClientPath,
      filename: redisClientPath,
      loaded: true,
      exports: workingMockRedisClient
    };
    
    // Clear require cache for auth-security service to reload with the working Redis client
    delete require.cache[require.resolve('./src/services/auth-security.service.js')];
    
    // Import the auth-security service with Redis working
    const authSecurityWorking = require('./src/services/auth-security.service');
    
    console.log('\nTesting recordFailedAttempt with Redis recovered:');
    const attemptResult2 = await authSecurityWorking.recordFailedAttempt('test@example.com');
    console.log('Attempt result:', attemptResult2);
    
    console.log('\nTesting checkLockStatus with Redis recovered:');
    const lockStatus2 = await authSecurityWorking.checkLockStatus('test@example.com');
    console.log('Lock status:', lockStatus2);
    
    console.log('\nTesting recordFailedAttempt multiple times to trigger lockout:');
    for (let i = 0; i < 4; i++) {
      const result = await authSecurityWorking.recordFailedAttempt('test@example.com');
      console.log(`Attempt ${i+2} result:`, result);
    }
    
    console.log('\nTesting checkLockStatus after multiple failed attempts:');
    const lockStatus3 = await authSecurityWorking.checkLockStatus('test@example.com');
    console.log('Lock status:', lockStatus3);
    
    console.log('\nTesting resetAttempts:');
    await authSecurityWorking.resetAttempts('test@example.com');
    
    console.log('\nTesting checkLockStatus after reset:');
    const lockStatus4 = await authSecurityWorking.checkLockStatus('test@example.com');
    console.log('Lock status:', lockStatus4);
    
  } catch (error) {
    console.error('Error during tests:', error);
  }
}

// Run the test
testRedisRecoverySequence();
