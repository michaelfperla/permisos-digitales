const db = require('../db');
const { logger } = require('../utils/logger');
const { ApplicationStatus } = require('../constants');
const BaseRepository = require('./base.repository');

/**
 * Repository for managing email reminders
 */
class ReminderRepository extends BaseRepository {
  constructor() {
    super('email_reminders');
  }

  /**
   * Get permits expiring within the specified threshold that need reminders
   * @param {number} daysThreshold - Number of days before expiration to look for
   * @returns {Promise<Array>} Array of expiring applications with user details
   */
  async getExpiringPermitsForReminders(daysThreshold = 1) {
    try {
      // Validate and sanitize input to prevent SQL injection
      const safeDaysThreshold = parseInt(daysThreshold);
      if (isNaN(safeDaysThreshold) || safeDaysThreshold < 0 || safeDaysThreshold > 365) {
        throw new Error('Invalid daysThreshold parameter');
      }
      
      logger.debug(`Looking for permits expiring within ${safeDaysThreshold} days`);

      const query = `
        SELECT pa.*, u.email, u.first_name, u.last_name, u.id as user_id
        FROM permit_applications pa
        JOIN users u ON pa.user_id = u.id
        WHERE pa.status IN ($1, $2, $3)
        AND pa.expires_at BETWEEN NOW() + INTERVAL '1 day' * $4 AND NOW() + INTERVAL '1 day' * $5
        AND pa.expires_at > NOW()
        ORDER BY pa.expires_at ASC
      `;

      const { rows } = await db.query(query, [
        ApplicationStatus.AWAITING_PAYMENT,
        ApplicationStatus.AWAITING_OXXO_PAYMENT,
        ApplicationStatus.PAYMENT_PROCESSING,
        safeDaysThreshold - 1,
        safeDaysThreshold
      ]);

      logger.debug(`Found ${rows.length} permits expiring within ${daysThreshold} days`);
      return rows;
    } catch (error) {
      logger.error(`Error getting expiring permits for ${daysThreshold} days threshold:`, error);
      throw error;
    }
  }

  /**
   * Update or insert reminder sent record
   * @param {number} applicationId - Application ID
   * @param {string} reminderType - Type of reminder ('expiration_warning', 'final_warning')
   * @param {Date} sentAt - When the reminder was sent (defaults to current timestamp)
   * @returns {Promise<Object>} Created or updated reminder record
   */
  async updateReminderSent(applicationId, reminderType, sentAt = null) {
    try {
      // Get application and user details for the reminder record
      const appQuery = `
        SELECT pa.id, pa.user_id, u.email, pa.expires_at
        FROM permit_applications pa
        JOIN users u ON pa.user_id = u.id
        WHERE pa.id = $1
      `;
      
      const appResult = await db.query(appQuery, [applicationId]);
      
      if (appResult.rows.length === 0) {
        throw new Error(`Application with ID ${applicationId} not found`);
      }
      
      const app = appResult.rows[0];
      
      const query = `
        INSERT INTO email_reminders (application_id, user_id, reminder_type, email_address, expires_at, sent_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (application_id, reminder_type) 
        DO UPDATE SET 
          sent_at = EXCLUDED.sent_at,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const sentAtTimestamp = sentAt || new Date();
      const { rows } = await db.query(query, [
        applicationId,
        app.user_id,
        reminderType,
        app.email,
        app.expires_at,
        sentAtTimestamp
      ]);

      logger.info(`Updated reminder sent record for application ${applicationId}`, {
        reminderType,
        sentAt: sentAtTimestamp
      });

      return rows[0];
    } catch (error) {
      logger.error(`Error updating reminder sent for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Get reminder statistics
   * @param {number} daysBack - Number of days to look back for statistics (defaults to 7)
   * @returns {Promise<Object>} Reminder statistics
   */
  async getReminderStats(daysBack = 7) {
    try {
      // Validate and sanitize input to prevent SQL injection
      const safeDaysBack = parseInt(daysBack);
      if (isNaN(safeDaysBack) || safeDaysBack < 0 || safeDaysBack > 365) {
        throw new Error('Invalid daysBack parameter');
      }
      
      // Get reminder counts by type for the specified period
      const reminderStatsQuery = `
        SELECT 
          reminder_type,
          COUNT(*) as count,
          DATE(sent_at) as date
        FROM email_reminders
        WHERE sent_at >= NOW() - INTERVAL '1 day' * $1
        GROUP BY reminder_type, DATE(sent_at)
        ORDER BY date DESC, reminder_type
      `;
      
      const reminderStats = await db.query(reminderStatsQuery, [safeDaysBack]);
      
      // Get applications that would receive reminders now
      const pendingRemindersQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE expires_at BETWEEN NOW() + INTERVAL '4 hours' AND NOW() + INTERVAL '5 hours') as expiration_warnings,
          COUNT(*) FILTER (WHERE expires_at BETWEEN NOW() + INTERVAL '1 hour' AND NOW() + INTERVAL '2 hours') as final_warnings
        FROM permit_applications pa
        WHERE status IN ($1, $2, $3)
        AND expires_at > NOW()
      `;
      
      const pendingReminders = await db.query(pendingRemindersQuery, [
        ApplicationStatus.AWAITING_PAYMENT,
        ApplicationStatus.AWAITING_OXXO_PAYMENT,
        ApplicationStatus.PAYMENT_PROCESSING
      ]);

      // Get total reminders sent in period
      const totalQuery = `
        SELECT COUNT(*) as total_sent
        FROM email_reminders
        WHERE sent_at >= NOW() - INTERVAL '1 day' * $1
      `;
      const totalResult = await db.query(totalQuery, [safeDaysBack]);

      return {
        recent_reminders: reminderStats.rows,
        pending_reminders: pendingReminders.rows[0],
        total_sent: parseInt(totalResult.rows[0].total_sent),
        period_days: daysBack
      };
    } catch (error) {
      logger.error(`Error getting reminder stats for ${daysBack} days:`, error);
      throw error;
    }
  }

  /**
   * Get applications that need reminders based on expiration time windows
   * @returns {Promise<Object>} Object containing arrays of applications needing different types of reminders
   */
  async getApplicationsNeedingReminders() {
    try {
      // Get applications expiring in 4-5 hours (expiration warning)
      const expirationWarningQuery = `
        SELECT pa.*, u.email, u.first_name, u.last_name, u.id as user_id
        FROM permit_applications pa
        JOIN users u ON pa.user_id = u.id
        LEFT JOIN email_reminders er ON pa.id = er.application_id AND er.reminder_type = 'expiration_warning'
        WHERE pa.status IN ($1, $2, $3)
        AND pa.expires_at BETWEEN NOW() + INTERVAL '4 hours' AND NOW() + INTERVAL '5 hours'
        AND pa.expires_at > NOW()
        AND er.id IS NULL
        ORDER BY pa.expires_at ASC
      `;

      const expirationWarningApps = await db.query(expirationWarningQuery, [
        ApplicationStatus.AWAITING_PAYMENT,
        ApplicationStatus.AWAITING_OXXO_PAYMENT,
        ApplicationStatus.PAYMENT_PROCESSING
      ]);

      // Get applications expiring in 1-2 hours (final warning)
      const finalWarningQuery = `
        SELECT pa.*, u.email, u.first_name, u.last_name, u.id as user_id
        FROM permit_applications pa
        JOIN users u ON pa.user_id = u.id
        LEFT JOIN email_reminders er ON pa.id = er.application_id AND er.reminder_type = 'final_warning'
        WHERE pa.status IN ($1, $2, $3)
        AND pa.expires_at BETWEEN NOW() + INTERVAL '1 hour' AND NOW() + INTERVAL '2 hours'
        AND pa.expires_at > NOW()
        AND er.id IS NULL
        ORDER BY pa.expires_at ASC
      `;

      const finalWarningApps = await db.query(finalWarningQuery, [
        ApplicationStatus.AWAITING_PAYMENT,
        ApplicationStatus.AWAITING_OXXO_PAYMENT,
        ApplicationStatus.PAYMENT_PROCESSING
      ]);

      logger.info('Retrieved applications needing reminders', {
        expirationWarningCount: expirationWarningApps.rows.length,
        finalWarningCount: finalWarningApps.rows.length
      });

      return {
        expiration_warnings: expirationWarningApps.rows,
        final_warnings: finalWarningApps.rows
      };
    } catch (error) {
      logger.error('Error getting applications needing reminders:', error);
      throw error;
    }
  }

  /**
   * Check if reminder has already been sent for a specific application and type
   * @param {number} applicationId - Application ID
   * @param {string} reminderType - Type of reminder to check
   * @returns {Promise<boolean>} Whether the reminder has been sent
   */
  async hasReminderBeenSent(applicationId, reminderType) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM email_reminders
        WHERE application_id = $1 AND reminder_type = $2
      `;
      const result = await db.query(query, [applicationId, reminderType]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      logger.error(`Error checking reminder status for application ${applicationId}:`, error);
      return false; // In case of error, allow sending to be safe
    }
  }

  /**
   * Get reminder history for a specific application
   * @param {number} applicationId - Application ID
   * @returns {Promise<Array>} Array of reminder records for the application
   */
  async getReminderHistory(applicationId) {
    try {
      const query = `
        SELECT er.*, u.account_email as user_email, u.first_name, u.last_name
        FROM email_reminders er
        JOIN users u ON er.user_id = u.id
        WHERE er.application_id = $1
        ORDER BY er.sent_at DESC
      `;
      
      const { rows } = await db.query(query, [applicationId]);
      return rows;
    } catch (error) {
      logger.error(`Error getting reminder history for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up old reminder records (older than specified days)
   * @param {number} daysToKeep - Number of days of records to keep (defaults to 90)
   * @returns {Promise<number>} Number of records deleted
   */
  async cleanupOldReminders(daysToKeep = 90) {
    try {
      // Validate and sanitize input to prevent SQL injection
      const safeDaysToKeep = parseInt(daysToKeep);
      if (isNaN(safeDaysToKeep) || safeDaysToKeep < 1 || safeDaysToKeep > 3650) {
        throw new Error('Invalid daysToKeep parameter');
      }
      
      const query = `
        DELETE FROM email_reminders
        WHERE sent_at < NOW() - INTERVAL '1 day' * $1
      `;
      
      const result = await db.query(query, [safeDaysToKeep]);
      const deletedCount = result.rowCount;
      
      logger.info(`Cleaned up ${deletedCount} old reminder records older than ${safeDaysToKeep} days`);
      return deletedCount;
    } catch (error) {
      logger.error(`Error cleaning up old reminders older than ${daysToKeep} days:`, error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const reminderRepository = new ReminderRepository();
module.exports = reminderRepository;