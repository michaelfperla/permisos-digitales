/**
 * Authentication Security Service
 * Handles login attempts tracking and account lockout
 * Uses Redis for distributed storage of login attempts
 */
const { logger } = require('../utils/enhanced-logger');
const redisClient = require('../utils/redis-client');

// Configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_SECONDS = LOCKOUT_TIME / 1000; // Convert to seconds for Redis TTL

/**
 * Record a failed login attempt
 * @param {string} identifier - User identifier (email or username)
 * @returns {Promise<Object>} - Current attempts status
 */
async function recordFailedAttempt(identifier) {
  const config = require('../config');

  // Check if Redis client is unavailable or not in ready state
  if (!redisClient || redisClient.status !== 'ready') {
    logger.error('Redis client not available or not ready for recordFailedAttempt.');

    if (config.nodeEnv === 'production') {
      // In production, log a critical error but don't auto-lock
      // This prevents widespread lockouts during temporary Redis issues
      logger.error(`SECURITY ALERT: Unable to record failed login attempt for ${identifier} due to Redis unavailability`);
      logger.warn('Note: Account lockout status will be checked on next login attempt (fail-closed)');
      return {
        attempts: 1, // We don't know the actual count
        lockedUntil: null,
        redisUnavailable: true, // Flag to indicate this is due to Redis being down
        recorded: false // Indicate that the attempt was not actually recorded
      };
    } else {
      // In development, return a default structure
      logger.warn('Development environment: Not recording failed attempt due to Redis unavailability');
      return { attempts: 0, lockedUntil: null, redisUnavailable: true, recorded: false };
    }
  }

  try {
    const key = identifier.toLowerCase();
    const attemptKey = `lockout:attempt:${key}`; // Key for tracking attempts
    const lockKey = `lockout:locked:${key}`;   // Key to indicate actual lock
    // Increment the attempt count using Redis INCR
    // INCR is atomic, preventing race conditions
    const currentAttempts = await redisClient.incr(attemptKey);

    // If this is the first attempt in the window, set an expiry on the attempt key
    // This expiry defines the window for counting attempts
    if (currentAttempts === 1) {
      await redisClient.expire(attemptKey, LOCKOUT_SECONDS);
    }

    logger.debug(`Failed login attempt ${currentAttempts} for ${key}`);

    // Check if the attempt count reaches the limit
    if (currentAttempts >= MAX_ATTEMPTS) {
      // Set the lock key with the lockout duration
      // Using SET with EX ensures atomicity (set key AND expiry in one command)
      await redisClient.set(lockKey, 'locked', 'EX', LOCKOUT_SECONDS);
      logger.warn(`Account locked for ${LOCKOUT_SECONDS} seconds: ${key}`);
      return { attempts: currentAttempts, lockedUntil: Date.now() + LOCKOUT_TIME };
    }

    return { attempts: currentAttempts, lockedUntil: null };
  } catch (error) {
    logger.error(`Redis error in recordFailedAttempt for ${identifier.toLowerCase()}:`, error);

    // Handle Redis errors differently based on environment
    if (config.nodeEnv === 'production') {
      // In production, log a critical error but don't auto-lock
      // This prevents widespread lockouts during temporary Redis issues
      logger.error(`SECURITY ALERT: Unable to record failed login attempt for ${identifier} due to Redis error`);
      logger.warn('Note: Account lockout status will be checked on next login attempt (fail-closed)');
      return {
        attempts: 1, // We don't know the actual count
        lockedUntil: null,
        redisUnavailable: true, // Flag to indicate this is due to Redis being down
        redisError: true, // Additional flag to indicate this was an error, not just unavailability
        recorded: false // Indicate that the attempt was not actually recorded
      };
    } else {
      // In development, return a default structure
      logger.warn('Development environment: Not recording failed attempt due to Redis error');
      return { attempts: 0, lockedUntil: null, redisError: true, recorded: false };
    }
  }
}

/**
 * Reset login attempts for a user
 * @param {string} identifier - User identifier (email or username)
 * @returns {Promise<void>}
 */
async function resetAttempts(identifier) {
  const config = require('../config');

  // Check if Redis client is unavailable or not in ready state
  if (!redisClient || redisClient.status !== 'ready') {
    if (config.nodeEnv === 'production') {
      logger.error(`Redis client not available or not ready for resetAttempts on ${identifier}.`);
      logger.warn('SECURITY NOTE: Unable to reset login attempts due to Redis unavailability');
      // In production, we can't reset attempts without Redis, but this is less critical
      // than the other functions since it only affects user convenience, not security
    } else {
      logger.warn('Development environment: Skipping resetAttempts due to Redis unavailability');
    }
    return;
  }

  try {
    const key = identifier.toLowerCase();
    const attemptKey = `lockout:attempt:${key}`;
    const lockKey = `lockout:locked:${key}`;
    // Delete both keys
    await redisClient.del(attemptKey, lockKey);
    logger.debug(`Reset login attempts for ${key}`);
  } catch (error) {
    if (config.nodeEnv === 'production') {
      logger.error(`Redis error in resetAttempts for ${identifier.toLowerCase()}:`, error);
      logger.warn('SECURITY NOTE: Unable to reset login attempts due to Redis error');
      // In production, we can't reset attempts without Redis, but this is less critical
      // than the other functions since it only affects user convenience, not security
    } else {
      logger.warn(`Development environment: Failed to reset attempts for ${identifier.toLowerCase()} due to Redis error:`, error);
    }
  }
}

/**
 * Check if an account is locked
 * @param {string} identifier - User identifier (email or username)
 * @returns {Promise<Object>} - Lock status with remaining time
 */
async function checkLockStatus(identifier) {
  const config = require('../config');

  // Check if Redis client is unavailable or not in ready state
  if (!redisClient || redisClient.status !== 'ready') {
    logger.error('Redis client not available or not ready for checkLockStatus.');

    if (config.nodeEnv === 'production') {
      // In production, fail closed (safer security approach)
      logger.warn(`SECURITY: Assuming account ${identifier} is locked due to Redis unavailability`);
      return {
        locked: true,
        remainingSeconds: 300, // Default lockout period of 5 minutes
        redisUnavailable: true // Flag to indicate this is due to Redis being down
      };
    } else {
      // In development, fail open for easier testing
      logger.warn('Development environment: Assuming not locked despite Redis unavailability');
      return { locked: false, redisUnavailable: true };
    }
  }

  const key = identifier.toLowerCase();
  const lockKey = `lockout:locked:${key}`;
  const attemptKey = `lockout:attempt:${key}`;

  try {
    // Check if the lock key exists
    const locked = await redisClient.exists(lockKey);

    if (locked) {
      // Get the remaining time-to-live for the lock key
      const remainingSeconds = await redisClient.ttl(lockKey);
      // Get the current attempt count if available
      const attemptsStr = await redisClient.get(attemptKey);
      const attemptsCount = attemptsStr ? parseInt(attemptsStr, 10) : MAX_ATTEMPTS;

      if (remainingSeconds > 0) {
        logger.debug(`Account ${key} is locked. Remaining: ${remainingSeconds}s`);
        return {
          locked: true,
          remainingSeconds: remainingSeconds,
          attemptsCount: attemptsCount
        };
      } else {
        // Key exists but has no TTL or expired (shouldn't happen with EXPIRE/TTL)
        // Clean up just in case
        await redisClient.del(lockKey);
        return { locked: false };
      }
    } else {
      // Not locked
      return { locked: false };
    }
  } catch (error) {
    logger.error(`Redis error in checkLockStatus for ${key}:`, error);

    // Handle Redis errors differently based on environment
    if (config.nodeEnv === 'production') {
      // In production, fail closed (safer security approach)
      logger.warn(`SECURITY: Assuming account ${identifier} is locked due to Redis error`);
      return {
        locked: true,
        remainingSeconds: 300, // Default lockout period of 5 minutes
        redisUnavailable: true, // Flag to indicate this is due to Redis being down
        redisError: true // Additional flag to indicate this was an error, not just unavailability
      };
    } else {
      // In development, fail open for easier testing
      logger.warn('Development environment: Assuming not locked despite Redis error');
      return { locked: false, redisError: true };
    }
  }
}

module.exports = {
  recordFailedAttempt,
  resetAttempts,
  checkLockStatus
};
