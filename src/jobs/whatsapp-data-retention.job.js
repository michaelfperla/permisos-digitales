/**
 * WhatsApp Data Retention Job
 * Implements data retention policy for WhatsApp-related data
 * Runs daily to clean up old data according to privacy policy
 */

const { logger } = require('../utils/logger');
const db = require('../db');

class WhatsAppDataRetentionJob {
  constructor() {
    this.name = 'WhatsApp Data Retention';
    this.schedule = '0 2 * * *'; // Run at 2 AM daily
  }

  /**
   * Execute the data retention cleanup
   */
  async execute() {
    const startTime = Date.now();
    logger.info('[WhatsApp Data Retention] Starting data retention cleanup');

    try {
      const results = await Promise.allSettled([
        this.cleanOldNotifications(),
        this.cleanOldConsentAuditLogs(),
        this.cleanDeletedUserData(),
        this.cleanOldRedisConversations()
      ]);

      const summary = {
        notifications: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason },
        consentLogs: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason },
        deletedUsers: results[2].status === 'fulfilled' ? results[2].value : { error: results[2].reason },
        conversations: results[3].status === 'fulfilled' ? results[3].value : { error: results[3].reason }
      };

      const duration = Date.now() - startTime;
      logger.info('[WhatsApp Data Retention] Cleanup completed', {
        duration,
        summary
      });

      return summary;
    } catch (error) {
      logger.error('[WhatsApp Data Retention] Job failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Clean old WhatsApp notifications (90 days retention)
   */
  async cleanOldNotifications() {
    try {
      // First, archive old notifications before deletion
      const archiveQuery = `
        INSERT INTO whatsapp_notifications_archive 
        (original_id, application_id, user_id, phone_number, 
         notification_type, status, created_at, archived_at)
        SELECT id, application_id, user_id, 
               CONCAT(LEFT(phone_number, 3), '****', RIGHT(phone_number, 4)) as phone_number,
               notification_type, status, created_at, NOW()
        FROM whatsapp_notifications
        WHERE created_at < NOW() - INTERVAL '90 days'
          AND status = 'sent'
        ON CONFLICT DO NOTHING
      `;
      
      await db.query(archiveQuery);

      // Delete notifications older than 90 days
      const deleteQuery = `
        DELETE FROM whatsapp_notifications
        WHERE created_at < NOW() - INTERVAL '90 days'
          OR (should_delete_at IS NOT NULL AND should_delete_at < NOW())
      `;
      
      const result = await db.query(deleteQuery);
      const deletedCount = result.rowCount;

      logger.info('[WhatsApp Data Retention] Cleaned old notifications', {
        deletedCount
      });

      return { deletedNotifications: deletedCount };
    } catch (error) {
      logger.error('[WhatsApp Data Retention] Error cleaning notifications', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean old consent audit logs (2 years retention for legal compliance)
   */
  async cleanOldConsentAuditLogs() {
    try {
      // Archive consent logs older than 2 years
      const archiveQuery = `
        INSERT INTO whatsapp_consent_audit_archive
        (original_id, user_id, action, created_at, archived_at)
        SELECT id, user_id, action, created_at, NOW()
        FROM whatsapp_consent_audit
        WHERE created_at < NOW() - INTERVAL '2 years'
        ON CONFLICT DO NOTHING
      `;
      
      await db.query(archiveQuery);

      // Delete consent logs older than 2 years
      const deleteQuery = `
        DELETE FROM whatsapp_consent_audit
        WHERE created_at < NOW() - INTERVAL '2 years'
      `;
      
      const result = await db.query(deleteQuery);
      const deletedCount = result.rowCount;

      logger.info('[WhatsApp Data Retention] Cleaned old consent logs', {
        deletedCount
      });

      return { deletedConsentLogs: deletedCount };
    } catch (error) {
      logger.error('[WhatsApp Data Retention] Error cleaning consent logs', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean deleted user data after legal retention period (5 years)
   */
  async cleanDeletedUserData() {
    try {
      // Permanently delete user archives older than 5 years
      const deleteQuery = `
        DELETE FROM deleted_users_archive
        WHERE deleted_at < NOW() - INTERVAL '5 years'
      `;
      
      const result = await db.query(deleteQuery);
      const deletedCount = result.rowCount;

      if (deletedCount > 0) {
        logger.info('[WhatsApp Data Retention] Cleaned old deleted user archives', {
          deletedCount
        });
      }

      return { deletedUserArchives: deletedCount };
    } catch (error) {
      logger.error('[WhatsApp Data Retention] Error cleaning deleted user data', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean old Redis conversation data
   * Note: Redis TTL already handles this, but this is a safety check
   */
  async cleanOldRedisConversations() {
    try {
      const redisClient = require('../utils/redis-client');
      
      if (!redisClient || !redisClient.keys) {
        logger.debug('[WhatsApp Data Retention] Redis not available for cleanup');
        return { cleanedConversations: 0 };
      }

      // Get all WhatsApp conversation keys
      const keys = await redisClient.keys('wa:*');
      let cleanedCount = 0;

      for (const key of keys) {
        try {
          // Check TTL
          const ttl = await redisClient.ttl(key);
          
          // If no TTL set, set it to 1 hour
          if (ttl === -1) {
            await redisClient.expire(key, 3600);
            cleanedCount++;
          }
        } catch (error) {
          logger.debug('[WhatsApp Data Retention] Error checking Redis key', {
            key,
            error: error.message
          });
        }
      }

      if (cleanedCount > 0) {
        logger.info('[WhatsApp Data Retention] Set TTL on Redis conversations', {
          cleanedCount
        });
      }

      return { cleanedConversations: cleanedCount };
    } catch (error) {
      logger.error('[WhatsApp Data Retention] Error cleaning Redis data', {
        error: error.message
      });
      // Don't throw - Redis cleanup is not critical
      return { cleanedConversations: 0, error: error.message };
    }
  }

  /**
   * Generate retention report
   */
  async generateRetentionReport() {
    try {
      const report = await db.query(`
        SELECT 
          'notifications' as data_type,
          COUNT(*) as total_records,
          COUNT(CASE WHEN created_at < NOW() - INTERVAL '90 days' THEN 1 END) as records_to_delete,
          MIN(created_at) as oldest_record,
          MAX(created_at) as newest_record
        FROM whatsapp_notifications
        
        UNION ALL
        
        SELECT 
          'consent_audit' as data_type,
          COUNT(*) as total_records,
          COUNT(CASE WHEN created_at < NOW() - INTERVAL '2 years' THEN 1 END) as records_to_delete,
          MIN(created_at) as oldest_record,
          MAX(created_at) as newest_record
        FROM whatsapp_consent_audit
        
        UNION ALL
        
        SELECT 
          'optout_list' as data_type,
          COUNT(*) as total_records,
          0 as records_to_delete,
          MIN(created_at) as oldest_record,
          MAX(created_at) as newest_record
        FROM whatsapp_optout_list
      `);

      return report.rows;
    } catch (error) {
      logger.error('[WhatsApp Data Retention] Error generating report', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new WhatsAppDataRetentionJob();