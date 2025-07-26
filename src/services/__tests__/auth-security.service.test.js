/**
 * Tests for Authentication Security Service
 */
const path = require('path');

// Mock Redis client before importing the service
jest.mock('../../utils/redis-client', () => ({
  status: 'ready',
  incr: jest.fn(),
  expire: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
  del: jest.fn(),
  isHealthy: jest.fn(() => true)
}));

// Mock enhanced logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock config to control environment
jest.mock('../../../config', () => ({
  nodeEnv: 'development' // Default to development, we'll override in specific tests
}));

// Import the service and dependencies after mocking
const authSecurity = require('../auth-security.service');
const redisClient = require('../../utils/redis-client');
const { logger } = require('../../utils/logger');
const config = require('../../../config');

describe('Auth Security Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Default Redis client to ready state
    redisClient.status = 'ready';
    redisClient.isHealthy.mockReturnValue(true);
  });

  describe('recordFailedAttempt', () => {
    it('should increment attempt count and return current status', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.incr.mockResolvedValue(1);
      redisClient.expire.mockResolvedValue('OK');

      // Act
      const result = await authSecurity.recordFailedAttempt(email);

      // Assert
      expect(redisClient.incr).toHaveBeenCalledWith('lockout:attempt:test@example.com');
      expect(redisClient.expire).toHaveBeenCalled();
      expect(result).toEqual({ attempts: 1, lockedUntil: null });
    });

    it('should lock account when max attempts reached', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.incr.mockResolvedValue(5); // MAX_ATTEMPTS is 5
      redisClient.set.mockResolvedValue('OK');

      // Act
      const result = await authSecurity.recordFailedAttempt(email);

      // Assert
      expect(redisClient.incr).toHaveBeenCalledWith('lockout:attempt:test@example.com');
      expect(redisClient.set).toHaveBeenCalled();
      expect(result.attempts).toBe(5);
      expect(result.lockedUntil).toBeDefined();
    });

    it('should handle Redis errors by using in-memory fallback', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.incr.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await authSecurity.recordFailedAttempt(email);

      // Assert
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({ 
        attempts: 1, 
        lockedUntil: null, 
        remainingSeconds: null,
        redisError: true, 
        usingMemoryFallback: true 
      });
    });

    it('should handle Redis unavailability by using in-memory fallback', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.isHealthy.mockReturnValue(false);

      // Act
      const result = await authSecurity.recordFailedAttempt(email);

      // Assert
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({
        attempts: 1,
        lockedUntil: null,
        remainingSeconds: null,
        redisUnavailable: true,
        usingMemoryFallback: true
      });
    });

    it('should lock account after max attempts in memory fallback', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.isHealthy.mockReturnValue(false);

      // Act - simulate 5 failed attempts
      let result;
      for (let i = 0; i < 5; i++) {
        result = await authSecurity.recordFailedAttempt(email);
      }

      // Assert
      expect(result.attempts).toBe(5);
      expect(result.lockedUntil).toBeDefined();
      expect(result.remainingSeconds).toBeGreaterThan(0);
      expect(result.usingMemoryFallback).toBe(true);
    });
  });

  describe('resetAttempts', () => {
    it('should delete attempt and lock keys', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.del.mockResolvedValue(2);

      // Act
      await authSecurity.resetAttempts(email);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(
        'lockout:attempt:test@example.com',
        'lockout:locked:test@example.com'
      );
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should handle Redis errors by using in-memory fallback', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.del.mockRejectedValue(new Error('Redis error'));

      // Act
      await authSecurity.resetAttempts(email);

      // Assert
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should handle Redis unavailability by using in-memory fallback', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.isHealthy.mockReturnValue(false);

      // Act
      await authSecurity.resetAttempts(email);

      // Assert
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalled();
    });

  });

  describe('checkLockStatus', () => {
    it('should return not locked when no lock exists', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.exists.mockResolvedValue(0);

      // Act
      const result = await authSecurity.checkLockStatus(email);

      // Assert
      expect(redisClient.exists).toHaveBeenCalledWith('lockout:locked:test@example.com');
      expect(result).toEqual({ locked: false });
    });

    it('should return locked status with remaining time', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.exists.mockResolvedValue(1);
      redisClient.ttl.mockResolvedValue(300);
      redisClient.get.mockResolvedValue('5');

      // Act
      const result = await authSecurity.checkLockStatus(email);

      // Assert
      expect(redisClient.exists).toHaveBeenCalledWith('lockout:locked:test@example.com');
      expect(redisClient.ttl).toHaveBeenCalledWith('lockout:locked:test@example.com');
      expect(result).toEqual({
        locked: true,
        remainingSeconds: 300,
        attemptsCount: 5
      });
    });

    it('should handle Redis errors by using in-memory fallback', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.exists.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await authSecurity.checkLockStatus(email);

      // Assert
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({ 
        locked: false, 
        redisError: true, 
        usingMemoryFallback: true 
      });
    });

    it('should handle Redis unavailability by using in-memory fallback', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.isHealthy.mockReturnValue(false);

      // Act
      const result = await authSecurity.checkLockStatus(email);

      // Assert
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({
        locked: false,
        redisUnavailable: true,
        usingMemoryFallback: true
      });
    });

    it('should return locked status from memory cache', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.isHealthy.mockReturnValue(false);
      
      // First record 5 failed attempts to lock the account
      for (let i = 0; i < 5; i++) {
        await authSecurity.recordFailedAttempt(email);
      }

      // Act
      const result = await authSecurity.checkLockStatus(email);

      // Assert
      expect(result.locked).toBe(true);
      expect(result.remainingSeconds).toBeGreaterThan(0);
      expect(result.usingMemoryFallback).toBe(true);
    });

    it('should handle Redis unavailability in development mode (fail-open)', async () => {
      // Arrange
      const email = 'test@example.com';
      config.nodeEnv = 'development';
      redisClient.status = 'reconnecting'; // Redis not ready

      // Act
      const result = await authSecurity.checkLockStatus(email);

      // Assert
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({ locked: false, redisUnavailable: true });
    });
  });
});
