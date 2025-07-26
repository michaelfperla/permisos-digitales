// src/services/security.service.js
const { securityRepository } = require('../repositories');
const { logger } = require('../utils/logger');

/**
 * Log a security-related activity to the dedicated 'security_audit_log' database table.
 * This provides a persistent and queryable audit trail for important security events
 * like logins, logouts, failed attempts, password changes, rate limits, etc.
 * Use this for actions that need to be audited for security compliance or investigation.
 *
 * @param {number|null} userId - User ID (null for anonymous actions)
 * @param {string} actionType - Type of action (login, logout, failed_login, etc.)
 * @param {string} ipAddress - IP address of the request
 * @param {string} userAgent - User agent string
 * @param {object} details - Additional details about the action
 * @returns {Promise<object>} - The created log entry
 */
exports.logActivity = async (userId, actionType, ipAddress, userAgent, details = {}) => {
  try {
    const result = await securityRepository.logSecurityActivity(userId, actionType, ipAddress, userAgent, details);
    if (result) {
      logger.debug(`Security audit log created: ${actionType} by user ${userId || 'anonymous'}`);
    }
    return result;
  } catch (error) {
    logger.error('Error creating security audit log:', error);
    // We don't throw the error to prevent it from affecting the main flow
    return null;
  }
};

/**
 * Check if an IP address has exceeded the rate limit for a specific action
 *
 * @param {string} ipAddress - IP address to check
 * @param {string} actionType - Type of action to check
 * @param {number} limit - Maximum number of attempts allowed
 * @param {number} timeWindowMinutes - Time window in minutes
 * @returns {Promise<boolean>} - True if rate limit exceeded, false otherwise
 */
exports.isRateLimitExceeded = async (ipAddress, actionType, limit = 5, timeWindowMinutes = 15) => {
  try {
    const attemptCount = await securityRepository.countRecentActivities(ipAddress, actionType, timeWindowMinutes);
    const isLimited = attemptCount >= limit;

    if (isLimited) {
      logger.warn(`Rate limit exceeded for ${actionType} from IP ${ipAddress}: ${attemptCount} attempts`);

      // Log the rate limit event itself using the new repository method
      await securityRepository.recordRateLimitViolation(ipAddress, actionType, {
        attemptCount,
        limit,
        timeWindowMinutes
      });
    }

    return isLimited;
  } catch (error) {
    logger.error('Error checking rate limit:', error);
    // If there's an error, we default to false to prevent blocking legitimate users
    return false;
  }
};

/**
 * Get recent security events for a specific user
 *
 * @param {number} userId - User ID
 * @param {number} limit - Maximum number of events to return
 * @returns {Promise<Array>} - Array of security events
 */
exports.getUserSecurityEvents = async (userId, limit = 20) => {
  try {
    return await securityRepository.getSecurityEvents(userId, limit);
  } catch (error) {
    logger.error(`Error getting security events for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Get suspicious activity reports for admins
 */
exports.getSuspiciousActivityReport = async (daysBack = 7, limit = 100) => {
  try {
    // Convert days to hours for the repository method
    const timeWindowHours = daysBack * 24;
    return await securityRepository.getSuspiciousActivityReport({
      timeWindowHours,
      minFailedLogins: 5,
      minRateLimitEvents: 3
    });
  } catch (error) {
    logger.error('Error generating suspicious activity report:', error);
    throw error;
  }
};
