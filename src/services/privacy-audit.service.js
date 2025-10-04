/**
 * Privacy Audit Service
 * Centralized service for privacy-related logging and compliance
 */

const { logger } = require('../utils/logger');
const db = require('../db');

class PrivacyAuditService {
  constructor() {
    this.auditTypes = {
      CONSENT_GIVEN: 'consent_given',
      CONSENT_WITHDRAWN: 'consent_withdrawn',
      DATA_ACCESS: 'data_access',
      DATA_EXPORT: 'data_export',
      DATA_DELETION: 'data_deletion',
      DATA_MODIFICATION: 'data_modification',
      PRIVACY_SETTINGS_CHANGED: 'privacy_settings_changed'
    };
  }

  /**
   * Log privacy consent
   */
  async logConsent(userId, consentType, accepted, metadata = {}) {
    try {
      const query = `
        INSERT INTO privacy_consent_log
        (user_id, consent_type, consent_given, consent_version, ip_address, user_agent, source, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `;

      const values = [
        userId,
        consentType,
        accepted,
        metadata.version || '1.0',
        metadata.ipAddress || null,
        metadata.userAgent || null,
        metadata.source || 'whatsapp',
        JSON.stringify(metadata)
      ];

      const result = await db.query(query, values);
      
      logger.info('Privacy consent logged', {
        logId: result.rows[0].id,
        userId,
        consentType,
        accepted
      });

      return result.rows[0].id;
    } catch (error) {
      logger.error('Error logging privacy consent', {
        error: error.message,
        userId,
        consentType
      });
      throw error;
    }
  }

  /**
   * Log data access event
   */
  async logDataAccess(userId, accessedBy, purpose, dataTypes = [], metadata = {}) {
    try {
      const query = `
        INSERT INTO data_access_log
        (user_id, accessed_by, access_purpose, data_types, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `;

      const values = [
        userId,
        accessedBy,
        purpose,
        JSON.stringify(dataTypes),
        JSON.stringify(metadata)
      ];

      const result = await db.query(query, values);

      logger.info('Data access logged', {
        logId: result.rows[0].id,
        userId,
        purpose,
        dataTypes: dataTypes.length
      });

      return result.rows[0].id;
    } catch (error) {
      logger.error('Error logging data access', {
        error: error.message,
        userId,
        purpose
      });
      // Don't throw - audit logging should not break the flow
      return null;
    }
  }

  /**
   * Log data modification
   */
  async logDataModification(userId, modifiedBy, fieldName, oldValue, newValue, metadata = {}) {
    try {
      const query = `
        INSERT INTO data_modification_log
        (user_id, modified_by, field_name, old_value, new_value, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `;

      // Mask sensitive values
      const maskedOldValue = this.maskSensitiveValue(fieldName, oldValue);
      const maskedNewValue = this.maskSensitiveValue(fieldName, newValue);

      const values = [
        userId,
        modifiedBy,
        fieldName,
        maskedOldValue,
        maskedNewValue,
        JSON.stringify(metadata)
      ];

      const result = await db.query(query, values);

      logger.info('Data modification logged', {
        logId: result.rows[0].id,
        userId,
        fieldName,
        modifiedBy
      });

      return result.rows[0].id;
    } catch (error) {
      logger.error('Error logging data modification', {
        error: error.message,
        userId,
        fieldName
      });
      return null;
    }
  }

  /**
   * Log data deletion
   */
  async logDataDeletion(userId, deletedBy, dataTypes = [], reason = null, metadata = {}) {
    try {
      const query = `
        INSERT INTO data_deletion_log
        (user_id, deleted_by, data_types, deletion_reason, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `;

      const values = [
        userId,
        deletedBy,
        JSON.stringify(dataTypes),
        reason,
        JSON.stringify(metadata)
      ];

      const result = await db.query(query, values);

      logger.info('Data deletion logged', {
        logId: result.rows[0].id,
        userId,
        dataTypes: dataTypes.length,
        reason
      });

      return result.rows[0].id;
    } catch (error) {
      logger.error('Error logging data deletion', {
        error: error.message,
        userId
      });
      return null;
    }
  }

  /**
   * Get consent history for user
   */
  async getConsentHistory(userId) {
    try {
      const query = `
        SELECT * FROM privacy_consent_log
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `;

      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching consent history', {
        error: error.message,
        userId
      });
      return [];
    }
  }

  /**
   * Get data access history for user
   */
  async getAccessHistory(userId, days = 90) {
    try {
      // Validate days parameter
      const daysNum = parseInt(days, 10);
      if (isNaN(daysNum) || daysNum < 0 || daysNum > 3650) {
        throw new Error('Invalid days parameter');
      }
      
      const query = `
        SELECT * FROM data_access_log
        WHERE user_id = $1 
        AND created_at > NOW() - INTERVAL '${daysNum} days'
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching access history', {
        error: error.message,
        userId
      });
      return [];
    }
  }

  /**
   * Check if user has valid consent
   */
  async hasValidConsent(userId, consentType = 'data_processing') {
    try {
      const query = `
        SELECT consent_given, created_at 
        FROM privacy_consent_log
        WHERE user_id = $1 
        AND consent_type = $2
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await db.query(query, [userId, consentType]);
      
      if (result.rows.length === 0) {
        return false;
      }

      return result.rows[0].consent_given === true;
    } catch (error) {
      logger.error('Error checking consent status', {
        error: error.message,
        userId,
        consentType
      });
      return false;
    }
  }

  /**
   * Generate privacy report for user
   */
  async generatePrivacyReport(userId) {
    try {
      const [
        consents,
        accesses,
        modifications,
        deletions
      ] = await Promise.all([
        this.getConsentHistory(userId),
        this.getAccessHistory(userId),
        this.getModificationHistory(userId),
        this.getDeletionHistory(userId)
      ]);

      return {
        userId,
        generatedAt: new Date().toISOString(),
        consents: {
          total: consents.length,
          current: consents[0] || null,
          history: consents
        },
        dataAccess: {
          total: accesses.length,
          last90Days: accesses.length,
          history: accesses
        },
        modifications: {
          total: modifications.length,
          history: modifications
        },
        deletions: {
          total: deletions.length,
          history: deletions
        }
      };
    } catch (error) {
      logger.error('Error generating privacy report', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Get modification history
   */
  async getModificationHistory(userId) {
    try {
      const query = `
        SELECT * FROM data_modification_log
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `;

      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching modification history', {
        error: error.message,
        userId
      });
      return [];
    }
  }

  /**
   * Get deletion history
   */
  async getDeletionHistory(userId) {
    try {
      const query = `
        SELECT * FROM data_deletion_log
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching deletion history', {
        error: error.message,
        userId
      });
      return [];
    }
  }

  /**
   * Mask sensitive values for logging
   */
  maskSensitiveValue(fieldName, value) {
    if (!value) return null;

    const sensitiveFields = [
      'password',
      'curp',
      'rfc',
      'credit_card',
      'bank_account'
    ];

    if (sensitiveFields.some(field => fieldName.toLowerCase().includes(field))) {
      return '***MASKED***';
    }

    // Partial masking for emails
    if (fieldName.toLowerCase().includes('email') && value.includes('@')) {
      const [localPart, domain] = value.split('@');
      const maskedLocal = localPart.substring(0, 2) + '***';
      return `${maskedLocal}@${domain}`;
    }

    // Partial masking for phone numbers
    if (fieldName.toLowerCase().includes('phone') && value.length > 6) {
      return value.substring(0, 3) + '***' + value.substring(value.length - 2);
    }

    return value;
  }

  /**
   * Schedule data deletion
   */
  async scheduleDataDeletion(userId, requestedBy, daysUntilDeletion = 30) {
    try {
      // Validate daysUntilDeletion is a number
      const days = parseInt(daysUntilDeletion, 10);
      if (isNaN(days) || days < 0 || days > 365) {
        throw new Error('Invalid retention period');
      }
      
      // Use proper SQL INTERVAL syntax
      const query = `
        INSERT INTO data_deletion_requests
        (user_id, requested_by, request_source, scheduled_date, status)
        VALUES ($1, $2, 'service', NOW() + INTERVAL '${days} days', 'pending')
        RETURNING id, scheduled_date
      `;

      const result = await db.query(query, [userId, requestedBy]);
      
      logger.info('Data deletion scheduled', {
        requestId: result.rows[0].id,
        userId,
        scheduledDate: result.rows[0].scheduled_date
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error scheduling data deletion', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Cancel scheduled deletion
   */
  async cancelScheduledDeletion(userId, cancelledBy, reason) {
    try {
      const query = `
        UPDATE data_deletion_requests
        SET status = 'cancelled',
            notes = $3,
            updated_at = NOW()
        WHERE user_id = $1
        AND status = 'pending'
        RETURNING id
      `;

      const result = await db.query(query, [userId, cancelledBy, reason]);
      
      if (result.rows.length > 0) {
        logger.info('Scheduled deletion cancelled', {
          requestId: result.rows[0].id,
          userId,
          cancelledBy
        });
      }

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error cancelling scheduled deletion', {
        error: error.message,
        userId
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PrivacyAuditService();