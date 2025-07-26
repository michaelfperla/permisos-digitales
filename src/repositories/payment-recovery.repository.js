const db = require('../db');
const { logger } = require('../utils/logger');
const BaseRepository = require('./base.repository');

class PaymentRecoveryRepository extends BaseRepository {
  constructor() {
    super('payment_recovery_attempts');
  }

  /**
   * Create or update a recovery attempt record
   */
  async upsertRecoveryAttempt(applicationId, paymentIntentId, attemptData = {}) {
    try {
      const query = `
        INSERT INTO payment_recovery_attempts (
          application_id, 
          payment_intent_id, 
          attempt_count, 
          last_attempt_time, 
          last_error,
          recovery_status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (application_id, payment_intent_id) 
        DO UPDATE SET
          attempt_count = payment_recovery_attempts.attempt_count + 1,
          last_attempt_time = EXCLUDED.last_attempt_time,
          last_error = EXCLUDED.last_error,
          recovery_status = EXCLUDED.recovery_status,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const params = [
        applicationId,
        paymentIntentId,
        attemptData.attemptCount || 1,
        attemptData.lastAttemptTime || new Date(),
        attemptData.lastError || null,
        attemptData.recoveryStatus || 'recovering'
      ];

      const { rows } = await db.query(query, params);
      return rows[0];
    } catch (error) {
      logger.error('Error upserting recovery attempt:', {
        error: error.message,
        applicationId,
        paymentIntentId
      });
      throw error;
    }
  }

  /**
   * Get recovery attempt by application and payment intent
   */
  async getRecoveryAttempt(applicationId, paymentIntentId) {
    try {
      const query = `
        SELECT * FROM payment_recovery_attempts
        WHERE application_id = $1 AND payment_intent_id = $2
      `;

      const { rows } = await db.query(query, [applicationId, paymentIntentId]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error getting recovery attempt:', {
        error: error.message,
        applicationId,
        paymentIntentId
      });
      throw error;
    }
  }

  /**
   * Update recovery status
   */
  async updateRecoveryStatus(applicationId, paymentIntentId, status, error = null) {
    try {
      const query = `
        UPDATE payment_recovery_attempts
        SET recovery_status = $1,
            last_error = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE application_id = $3 AND payment_intent_id = $4
        RETURNING *
      `;

      const { rows } = await db.query(query, [status, error, applicationId, paymentIntentId]);
      return rows[0];
    } catch (error) {
      logger.error('Error updating recovery status:', {
        error: error.message,
        applicationId,
        paymentIntentId,
        status
      });
      throw error;
    }
  }

  /**
   * Get stuck payment recovery attempts
   */
  async getStuckRecoveryAttempts(minutesOld = 30) {
    try {
      const query = `
        SELECT pra.*, pa.status as application_status, pa.user_id
        FROM payment_recovery_attempts pra
        JOIN permit_applications pa ON pra.application_id = pa.id
        WHERE pra.recovery_status IN ('pending', 'recovering')
        AND pra.last_attempt_time < NOW() - ($1 || ' minute')::INTERVAL
        AND pra.attempt_count < 3
        ORDER BY pra.last_attempt_time ASC
        LIMIT 100
      `;

      const { rows } = await db.query(query, [minutesOld]);
      return rows;
    } catch (error) {
      logger.error('Error getting stuck recovery attempts:', error);
      throw error;
    }
  }

  /**
   * Clean up old recovery attempts
   */
  async cleanupOldAttempts(daysOld = 7) {
    try {
      const query = `
        DELETE FROM payment_recovery_attempts
        WHERE created_at < NOW() - INTERVAL $1 * '1 day'::INTERVAL
        AND recovery_status IN ('succeeded', 'failed', 'max_attempts_reached')
        RETURNING id
      `;

      const { rows } = await db.query(query, [daysOld]);
      logger.info(`Cleaned up ${rows.length} old recovery attempts`);
      return rows.length;
    } catch (error) {
      logger.error('Error cleaning up old recovery attempts:', error);
      throw error;
    }
  }

  /**
   * Get recovery statistics
   */
  async getRecoveryStats(hours = 24) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_attempts,
          COUNT(CASE WHEN recovery_status = 'succeeded' THEN 1 END) as successful_recoveries,
          COUNT(CASE WHEN recovery_status = 'failed' THEN 1 END) as failed_recoveries,
          COUNT(CASE WHEN recovery_status = 'max_attempts_reached' THEN 1 END) as max_attempts_reached,
          COUNT(CASE WHEN recovery_status IN ('pending', 'recovering') THEN 1 END) as in_progress,
          AVG(attempt_count) as avg_attempts
        FROM payment_recovery_attempts
        WHERE created_at > NOW() - INTERVAL '1 hour' * $1
      `;

      const { rows } = await db.query(query, [hours]);
      return rows[0];
    } catch (error) {
      logger.error('Error getting recovery stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PaymentRecoveryRepository();