/**
 * Authentication Security Service
 * Handles login attempts tracking and account lockout
 * Uses Redis for distributed storage of login attempts
 * Falls back to secure in-memory rate limiting when Redis is unavailable
 */
const { logger } = require('../utils/logger');
const redisClient = require('../utils/redis-client');
const securityRepository = require('../repositories/security.repository');

// Configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_SECONDS = LOCKOUT_TIME / 1000; // Convert to seconds for Redis TTL

// In-memory fallback for when Redis is unavailable
// Structure: { identifier: { attempts: number, firstAttempt: timestamp, lockedUntil: timestamp|null } }
const memoryCache = new Map();

// Cleanup interval for expired entries (runs every 5 minutes)
let cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [identifier, data] of memoryCache.entries()) {
    // Remove entries older than lockout time if not currently locked
    // Or remove locked entries that have expired
    if (
      (!data.lockedUntil && (now - data.firstAttempt) > LOCKOUT_TIME) ||
      (data.lockedUntil && now > data.lockedUntil)
    ) {
      memoryCache.delete(identifier);
      logger.debug(`Cleaned up expired memory cache entry for ${identifier}`);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

// Graceful cleanup on process exit
process.on('SIGINT', () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
});
process.on('SIGTERM', () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
});

/**
 * Helper function to check if Redis is available
 * @returns {boolean}
 */
function isRedisAvailable() {
  return redisClient && (typeof redisClient.isHealthy === 'function' ? redisClient.isHealthy() : true);
}

/**
 * Record a failed attempt in memory cache (fallback when Redis is unavailable)
 * @param {string} identifier - User identifier (email or username)
 * @returns {Object} - Current attempts status
 */
function recordFailedAttemptInMemory(identifier) {
  const now = Date.now();
  const key = identifier.toLowerCase();
  
  let userData = memoryCache.get(key);
  
  if (!userData) {
    // First attempt
    userData = {
      attempts: 1,
      firstAttempt: now,
      lockedUntil: null
    };
  } else {
    // Check if this is within the lockout window
    if ((now - userData.firstAttempt) > LOCKOUT_TIME && !userData.lockedUntil) {
      // Reset the window - this is a new attempt cycle
      userData = {
        attempts: 1,
        firstAttempt: now,
        lockedUntil: null
      };
    } else if (userData.lockedUntil && now < userData.lockedUntil) {
      // Account is still locked, don't increment but return current status
      const remainingMs = userData.lockedUntil - now;
      logger.debug(`Memory cache: Account ${key} is still locked. Remaining: ${Math.ceil(remainingMs / 1000)}s`);
      return {
        attempts: userData.attempts,
        lockedUntil: userData.lockedUntil,
        remainingSeconds: Math.ceil(remainingMs / 1000)
      };
    } else if (userData.lockedUntil && now >= userData.lockedUntil) {
      // Lock has expired, reset
      userData = {
        attempts: 1,
        firstAttempt: now,
        lockedUntil: null
      };
    } else {
      // Increment attempt count
      userData.attempts++;
    }
  }
  
  // Check if we need to lock the account
  if (userData.attempts >= MAX_ATTEMPTS) {
    userData.lockedUntil = now + LOCKOUT_TIME;
    logger.warn(`Memory cache: Account locked for ${LOCKOUT_TIME / 1000} seconds: ${key}`);
  }
  
  memoryCache.set(key, userData);
  logger.debug(`Memory cache: Failed login attempt ${userData.attempts} for ${key}`);
  
  return {
    attempts: userData.attempts,
    lockedUntil: userData.lockedUntil,
    remainingSeconds: userData.lockedUntil ? Math.ceil((userData.lockedUntil - now) / 1000) : null
  };
}

/**
 * Check lock status in memory cache (fallback when Redis is unavailable)
 * @param {string} identifier - User identifier (email or username)
 * @returns {Object} - Lock status with remaining time
 */
function checkLockStatusInMemory(identifier) {
  const now = Date.now();
  const key = identifier.toLowerCase();
  const userData = memoryCache.get(key);
  
  if (!userData || (!userData.lockedUntil && (now - userData.firstAttempt) > LOCKOUT_TIME)) {
    // No data or data is expired
    return { locked: false };
  }
  
  if (userData.lockedUntil) {
    const remainingMs = userData.lockedUntil - now;
    if (remainingMs > 0) {
      logger.debug(`Memory cache: Account ${key} is locked. Remaining: ${Math.ceil(remainingMs / 1000)}s`);
      return {
        locked: true,
        remainingSeconds: Math.ceil(remainingMs / 1000),
        attemptsCount: userData.attempts
      };
    } else {
      // Lock has expired, clean up
      memoryCache.delete(key);
      return { locked: false };
    }
  }
  
  return { locked: false };
}

/**
 * Reset attempts in memory cache (fallback when Redis is unavailable)
 * @param {string} identifier - User identifier (email or username)
 */
function resetAttemptsInMemory(identifier) {
  const key = identifier.toLowerCase();
  const deleted = memoryCache.delete(key);
  if (deleted) {
    logger.debug(`Memory cache: Reset login attempts for ${key}`);
  }
}

/**
 * Record a failed login attempt
 * @param {string} identifier - User identifier (email or username)
 * @param {Object} context - Request context for audit logging {ipAddress, userAgent, userId}
 * @returns {Promise<Object>} - Current attempts status
 */
async function recordFailedAttempt(identifier, context = {}) {
  const unifiedConfig = require('../config/unified-config');
const config = unifiedConfig.getSync();

  // Check if Redis client is unavailable or not in ready state
  if (!isRedisAvailable()) {
    logger.warn(`Redis unavailable for recordFailedAttempt, using in-memory fallback for: ${identifier}`);
    
    // Use secure in-memory fallback instead of failing open
    const result = recordFailedAttemptInMemory(identifier);
    result.redisUnavailable = true;
    result.usingMemoryFallback = true;
    
    logger.info(`SECURITY: Using in-memory rate limiting for ${identifier} - attempts: ${result.attempts}${result.lockedUntil ? ', account locked' : ''}`);
    return result;
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

    // Log failed login attempt to audit log
    if (context.ipAddress) {
      await securityRepository.logActivity(
        context.userId || null,
        'failed_login',
        context.ipAddress,
        context.userAgent || 'Unknown',
        {
          email: identifier,
          attemptNumber: currentAttempts,
          source: 'redis'
        }
      );
    }

    // Check if the attempt count reaches the limit
    if (currentAttempts >= MAX_ATTEMPTS) {
      // Set the lock key with the lockout duration
      // Using SET with EX ensures atomicity (set key AND expiry in one command)
      await redisClient.set(lockKey, 'locked', 'EX', LOCKOUT_SECONDS);
      logger.warn(`Account locked for ${LOCKOUT_SECONDS} seconds: ${key}`);
      
      // Log account lockout to audit log
      if (context.ipAddress) {
        await securityRepository.logActivity(
          context.userId || null,
          'account_locked',
          context.ipAddress,
          context.userAgent || 'Unknown',
          {
            email: identifier,
            lockDurationSeconds: LOCKOUT_SECONDS,
            totalAttempts: currentAttempts
          }
        );
      }
      
      return { attempts: currentAttempts, lockedUntil: Date.now() + LOCKOUT_TIME };
    }

    return { attempts: currentAttempts, lockedUntil: null };
  } catch (error) {
    logger.error(`Redis error in recordFailedAttempt for ${identifier.toLowerCase()}:`, error);
    logger.warn(`Redis error encountered, falling back to in-memory rate limiting for: ${identifier}`);
    
    // Use secure in-memory fallback instead of failing open
    const result = recordFailedAttemptInMemory(identifier);
    result.redisError = true;
    result.usingMemoryFallback = true;
    
    logger.info(`SECURITY: Using in-memory rate limiting after Redis error for ${identifier} - attempts: ${result.attempts}${result.lockedUntil ? ', account locked' : ''}`);
    return result;
  }
}

/**
 * Reset login attempts for a user
 * @param {string} identifier - User identifier (email or username)
 * @returns {Promise<void>}
 */
async function resetAttempts(identifier) {
  const unifiedConfig = require('../config/unified-config');
const config = unifiedConfig.getSync();

  // Check if Redis client is unavailable or not in ready state
  if (!isRedisAvailable()) {
    logger.warn(`Redis unavailable for resetAttempts, using in-memory fallback for: ${identifier}`);
    
    // Reset attempts in memory cache
    resetAttemptsInMemory(identifier);
    logger.debug(`Reset attempts in memory cache for: ${identifier}`);
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
    logger.error(`Redis error in resetAttempts for ${identifier.toLowerCase()}:`, error);
    logger.warn(`Redis error encountered, falling back to in-memory reset for: ${identifier}`);
    
    // Reset attempts in memory cache as fallback
    resetAttemptsInMemory(identifier);
    logger.debug(`Reset attempts in memory cache after Redis error for: ${identifier}`);
  }
}

/**
 * Check if an account is locked
 * @param {string} identifier - User identifier (email or username)
 * @returns {Promise<Object>} - Lock status with remaining time
 */
async function checkLockStatus(identifier) {
  const unifiedConfig = require('../config/unified-config');
const config = unifiedConfig.getSync();

  // Check if Redis client is unavailable or not in ready state
  if (!isRedisAvailable()) {
    logger.warn(`Redis unavailable for checkLockStatus, using in-memory fallback for: ${identifier}`);
    
    // Use secure in-memory fallback instead of failing open
    const result = checkLockStatusInMemory(identifier);
    result.redisUnavailable = true;
    result.usingMemoryFallback = true;
    
    logger.info(`SECURITY: Using in-memory lock check for ${identifier} - locked: ${result.locked}${result.locked ? `, remaining: ${result.remainingSeconds}s` : ''}`);
    return result;
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
    logger.warn(`Redis error encountered, falling back to in-memory lock check for: ${identifier}`);
    
    // Use secure in-memory fallback instead of failing open
    const result = checkLockStatusInMemory(identifier);
    result.redisError = true;
    result.usingMemoryFallback = true;
    
    logger.info(`SECURITY: Using in-memory lock check after Redis error for ${identifier} - locked: ${result.locked}${result.locked ? `, remaining: ${result.remainingSeconds}s` : ''}`);
    return result;
  }
}

/**
 * Change user password
 * @param {number} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} - Result object with success flag and message
 */
async function changePassword(userId, currentPassword, newPassword) {
  const { userRepository } = require('../repositories');
  const { verifyPassword, hashPassword } = require('../utils/password-utils');

  try {
    logger.debug(`Changing password for user ID: ${userId}`);

    // Get user from repository
    const user = await userRepository.findById(userId);

    if (!user) {
      logger.warn(`User not found for ID: ${userId}`);
      return {
        success: false,
        message: 'Usuario no encontrado.',
        reason: 'USER_NOT_FOUND'
      };
    }

    // Verify current password
    const isPasswordValid = await verifyPassword(currentPassword, user.password_hash);

    if (!isPasswordValid) {
      logger.warn(`Invalid current password for user ID: ${userId}`);
      return {
        success: false,
        message: 'La contraseña actual es incorrecta.',
        reason: 'INVALID_CURRENT_PASSWORD'
      };
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password in database
    const updated = await userRepository.updatePassword(userId, newPasswordHash);

    if (!updated) {
      logger.error(`Failed to update password for user ID: ${userId}`);
      return {
        success: false,
        message: 'Error al actualizar la contraseña.',
        reason: 'UPDATE_FAILED'
      };
    }

    logger.info(`Password changed successfully for user ID: ${userId}`);
    
    // Log password change to audit log (Note: context would need to be passed in production)
    // For now, we'll skip this as we don't have request context in this function
    
    return {
      success: true,
      message: 'Contraseña cambiada exitosamente.'
    };
  } catch (error) {
    logger.error(`Error changing password for user ID: ${userId}:`, error);
    return {
      success: false,
      message: 'Ocurrió un error al cambiar la contraseña.',
      reason: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Record a successful login
 * @param {string} identifier - User identifier (email or username)
 * @param {Object} context - Request context {ipAddress, userAgent, userId}
 * @returns {Promise<void>}
 */
async function recordSuccessfulLogin(identifier, context = {}) {
  try {
    // Reset any failed attempts
    await resetAttempts(identifier);
    
    // Log successful login to audit log
    if (context.ipAddress) {
      await securityRepository.logActivity(
        context.userId || null,
        'successful_login',
        context.ipAddress,
        context.userAgent || 'Unknown',
        {
          email: identifier,
          timestamp: new Date().toISOString()
        }
      );
    }
    
    logger.info(`Successful login recorded for ${identifier.toLowerCase()}`);
  } catch (error) {
    logger.error(`Error recording successful login for ${identifier}:`, error);
    // Don't throw - this shouldn't break the login flow
  }
}

module.exports = {
  recordFailedAttempt,
  resetAttempts,
  checkLockStatus,
  changePassword,
  recordSuccessfulLogin
};
