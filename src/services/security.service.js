// src/services/security.service.js
const db = require('../db');
const { logger } = require('../utils/enhanced-logger');

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
    const query = `
      INSERT INTO security_audit_log
      (user_id, action_type, ip_address, user_agent, details)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, action_type, created_at
    `;

    const params = [
      userId || null,
      actionType,
      ipAddress,
      userAgent,
      JSON.stringify(details)
    ];

    const { rows } = await db.query(query, params);
    logger.debug(`Security audit log created: ${actionType} by user ${userId || 'anonymous'}`);
    return rows[0];
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
    const query = `
      SELECT COUNT(*) as attempt_count
      FROM security_audit_log
      WHERE ip_address = $1
        AND action_type = $2
        AND created_at > NOW() - INTERVAL '${timeWindowMinutes} minutes'
    `;

    const params = [ipAddress, actionType];
    const { rows } = await db.query(query, params);

    const attemptCount = parseInt(rows[0].attempt_count, 10);
    const isLimited = attemptCount >= limit;

    if (isLimited) {
      logger.warn(`Rate limit exceeded for ${actionType} from IP ${ipAddress}: ${attemptCount} attempts`);

      // Log the rate limit event itself
      await exports.logActivity(
        null,
        'rate_limit_exceeded',
        ipAddress,
        null,
        { actionType, attemptCount, limit, timeWindowMinutes }
      );
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
    const query = `
      SELECT id, action_type, ip_address, user_agent, details, created_at
      FROM security_audit_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const params = [userId, limit];
    const { rows } = await db.query(query, params);
    return rows;
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
    const query = `
      WITH login_attempts AS (
        SELECT
          ip_address,
          COUNT(*) FILTER (WHERE action_type = 'failed_login') as failed_logins,
          COUNT(*) FILTER (WHERE action_type = 'login') as successful_logins,
          COUNT(DISTINCT user_id) as unique_users,
          MAX(created_at) as last_attempt
        FROM security_audit_log
        WHERE created_at > NOW() - INTERVAL '${daysBack} days'
        GROUP BY ip_address
      )
      SELECT * FROM login_attempts
      WHERE failed_logins > 5 OR (failed_logins > 0 AND unique_users > 2)
      ORDER BY failed_logins DESC, unique_users DESC
      LIMIT $1
    `;

    const { rows } = await db.query(query, [limit]);
    return rows;
  } catch (error) {
    logger.error('Error generating suspicious activity report:', error);
    throw error;
  }
};
