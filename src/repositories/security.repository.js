/**
 * Security Repository
 * Handles database operations for security-related tables
 */
const BaseRepository = require('./base.repository');
const db = require('../db');
const { logger } = require('../utils/enhanced-logger');

class SecurityRepository extends BaseRepository {
  constructor() {
    super('security_audit_log');
  }

  /**
   * Log a security-related activity
   * @param {number|null} userId - User ID (null for anonymous actions)
   * @param {string} actionType - Type of action
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent
   * @param {Object} details - Additional details
   * @returns {Promise<Object>} - Created log entry
   */
  async logActivity(userId, actionType, ipAddress, userAgent, details = {}) {
    const query = `
      INSERT INTO security_audit_log
      (user_id, action_type, ip_address, user_agent, details)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, action_type, created_at
    `;

    try {
      const { rows } = await db.query(query, [
        userId || null,
        actionType,
        ipAddress,
        userAgent,
        JSON.stringify(details)
      ]);
      return rows[0];
    } catch (error) {
      logger.error('Error in logActivity:', error);
      // Don't throw the error to prevent it from affecting the main flow
      return null;
    }
  }

  /**
   * Count recent activities by IP and action type
   * @param {string} ipAddress - IP address
   * @param {string} actionType - Action type
   * @param {number} timeWindowMinutes - Time window in minutes
   * @returns {Promise<number>} - Count of activities
   */
  async countRecentActivities(ipAddress, actionType, timeWindowMinutes = 15) {
    const query = `
      SELECT COUNT(*) as attempt_count
      FROM security_audit_log
      WHERE ip_address = $1
        AND action_type = $2
        AND created_at > NOW() - INTERVAL '${timeWindowMinutes} minutes'
    `;

    try {
      const { rows } = await db.query(query, [ipAddress, actionType]);
      return parseInt(rows[0].attempt_count, 10);
    } catch (error) {
      logger.error('Error in countRecentActivities:', error);
      return 0;
    }
  }

  /**
   * Get suspicious activity report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} - Suspicious activity report
   */
  async getSuspiciousActivityReport(options = {}) {
    const { timeWindowHours = 24, minFailedLogins = 5, minRateLimitEvents = 3 } = options;

    try {
      // Get IPs with multiple failed logins
      const failedLoginsQuery = `
        SELECT ip_address, COUNT(*) as count
        FROM security_audit_log
        WHERE action_type = 'failed_login'
          AND created_at > NOW() - INTERVAL '${timeWindowHours} hours'
        GROUP BY ip_address
        HAVING COUNT(*) >= $1
        ORDER BY count DESC
      `;
      const failedLoginsResult = await db.query(failedLoginsQuery, [minFailedLogins]);

      // Get IPs with rate limit events
      const rateLimitQuery = `
        SELECT ip_address, COUNT(*) as count
        FROM security_audit_log
        WHERE action_type = 'rate_limit_exceeded'
          AND created_at > NOW() - INTERVAL '${timeWindowHours} hours'
        GROUP BY ip_address
        HAVING COUNT(*) >= $1
        ORDER BY count DESC
      `;
      const rateLimitResult = await db.query(rateLimitQuery, [minRateLimitEvents]);

      // Get recent CSRF violations
      const csrfQuery = `
        SELECT ip_address, user_agent, details, created_at
        FROM security_audit_log
        WHERE action_type = 'csrf_violation'
          AND created_at > NOW() - INTERVAL '${timeWindowHours} hours'
        ORDER BY created_at DESC
      `;
      const csrfResult = await db.query(csrfQuery);

      return {
        suspiciousIPs: {
          failedLogins: failedLoginsResult.rows,
          rateLimitExceeded: rateLimitResult.rows
        },
        csrfViolations: csrfResult.rows,
        reportTimeWindow: `${timeWindowHours} hours`,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in getSuspiciousActivityReport:', error);
      throw error;
    }
  }

  /**
   * Create a password reset token
   * @param {number} userId - User ID
   * @param {string} token - Reset token
   * @param {number} expiresInHours - Token expiration in hours
   * @returns {Promise<Object>} - Created token record
   */
  async createPasswordResetToken(userId, token, expiresInHours = 1) {
    const query = `
      INSERT INTO password_reset_tokens
      (user_id, token, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '${expiresInHours} hours')
      RETURNING id, token, expires_at
    `;

    try {
      const { rows } = await db.query(query, [userId, token]);
      return rows[0];
    } catch (error) {
      logger.error('Error in createPasswordResetToken:', error);
      throw error;
    }
  }

  /**
   * Find a valid password reset token
   * @param {string} token - Reset token
   * @returns {Promise<Object|null>} - Token record or null
   */
  async findValidResetToken(token) {
    const query = `
      SELECT prt.*, u.email
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token = $1
        AND prt.expires_at > NOW()
        AND prt.used_at IS NULL
    `;

    try {
      const { rows } = await db.query(query, [token]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error in findValidResetToken:', error);
      throw error;
    }
  }

  /**
   * Mark a password reset token as used
   * @param {string} token - Reset token
   * @returns {Promise<boolean>} - True if marked as used
   */
  async markResetTokenAsUsed(token) {
    const query = `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE token = $1
      RETURNING id
    `;

    try {
      const { rowCount } = await db.query(query, [token]);
      return rowCount > 0;
    } catch (error) {
      logger.error('Error in markResetTokenAsUsed:', error);
      throw error;
    }
  }
}

module.exports = new SecurityRepository();
