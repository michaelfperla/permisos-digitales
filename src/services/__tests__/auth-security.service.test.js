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
  del: jest.fn()
}));

// Mock enhanced logger
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock config to control environment
jest.mock('../../config', () => ({
  nodeEnv: 'development' // Default to development, we'll override in specific tests
}));

// Import the service and dependencies after mocking
const authSecurity = require('../auth-security.service');
const redisClient = require('../../utils/redis-client');
const { logger } = require('../../utils/enhanced-logger');
const config = require('../../config');

describe('Auth Security Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Default Redis client to ready state
    redisClient.status = 'ready';
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

    it('should handle Redis errors in development mode', async () => {
      // Arrange
      const email = 'test@example.com';
      config.nodeEnv = 'development';
      redisClient.incr.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await authSecurity.recordFailedAttempt(email);

      // Assert
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({ 
        attempts: 0, 
        lockedUntil: null, 
        redisError: true, 
        recorded: false 
      });
    });

    it('should handle Redis errors in production mode (fail-closed)', async () => {
      // Arrange
      const email = 'test@example.com';
      config.nodeEnv = 'production';
      redisClient.incr.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await authSecurity.recordFailedAttempt(email);

      // Assert
      expect(logger.error).toHaveBeenCalled();
      expect(result).toEqual({
        attempts: 1,
        lockedUntil: null,
        redisUnavailable: true,
        redisError: true,
        recorded: false
      });
    });

    it('should handle Redis unavailability in production mode', async () => {
      // Arrange
      const email = 'test@example.com';
      config.nodeEnv = 'production';
      redisClient.status = 'reconnecting'; // Redis not ready

      // Act
      const result = await authSecurity.recordFailedAttempt(email);

      // Assert
      expect(logger.error).toHaveBeenCalled();
      expect(result).toEqual({
        attempts: 1,
        lockedUntil: null,
        redisUnavailable: true,
        recorded: false
      });
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

    it('should handle Redis errors in development mode', async () => {
      // Arrange
      const email = 'test@example.com';
      config.nodeEnv = 'development';
      redisClient.del.mockRejectedValue(new Error('Redis error'));

      // Act
      await authSecurity.resetAttempts(email);

      // Assert
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle Redis errors in production mode', async () => {
      // Arrange
      const email = 'test@example.com';
      config.nodeEnv = 'production';
      redisClient.del.mockRejectedValue(new Error('Redis error'));

      // Act
      await authSecurity.resetAttempts(email);

      // Assert
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle Redis unavailability', async () => {
      // Arrange
      const email = 'test@example.com';
      redisClient.status = 'reconnecting'; // Redis not ready

      // Act
      await authSecurity.resetAttempts(email);

      // Assert
      expect(logger.error).toHaveBeenCalled();
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

    it('should handle Redis errors in development mode', async () => {
      // Arrange
      const email = 'test@example.com';
      config.nodeEnv = 'development';
      redisClient.exists.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await authSecurity.checkLockStatus(email);

      // Assert
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({ locked: false, redisError: true });
    });

    it('should handle Redis errors in production mode (fail-closed)', async () => {
      // Arrange
      const email = 'test@example.com';
      config.nodeEnv = 'production';
      redisClient.exists.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await authSecurity.checkLockStatus(email);

      // Assert
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({
        locked: true,
        remainingSeconds: 300,
        redisUnavailable: true,
        redisError: true
      });
    });

    it('should handle Redis unavailability in production mode (fail-closed)', async () => {
      // Arrange
      const email = 'test@example.com';
      config.nodeEnv = 'production';
      redisClient.status = 'reconnecting'; // Redis not ready

      // Act
      const result = await authSecurity.checkLockStatus(email);

      // Assert
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({
        locked: true,
        remainingSeconds: 300,
        redisUnavailable: true
      });
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
