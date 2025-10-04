/**
 * Data Retention Job
 * Automatically handles data cleanup based on retention policies
 */

const { logger } = require('../utils/logger');
const db = require('../db');
const privacyAuditService = require('../services/privacy-audit.service');

module.exports = {
  name: 'data-retention',
  schedule: '0 2 * * *', // Run daily at 2 AM
  
  async execute() {
    const startTime = Date.now();
    logger.info('[DataRetentionJob] Starting data retention job');
    
    const results = {
      incompleteApplications: 0,
      abandonedSessions: 0,
      expiredExports: 0,
      processedDeletions: 0,
      oldWhatsAppData: 0,
      errors: []
    };
    
    try {
      // 1. Delete incomplete applications older than 30 days
      results.incompleteApplications = await this.cleanIncompleteApplications();
      
      // 2. Clean abandoned WhatsApp sessions
      results.abandonedSessions = await this.cleanAbandonedSessions();
      
      // 3. Remove expired data export links
      results.expiredExports = await this.cleanExpiredExports();
      
      // 4. Process scheduled deletion requests
      results.processedDeletions = await this.processScheduledDeletions();
      
      // 5. Clean old WhatsApp interaction data
      results.oldWhatsAppData = await this.cleanOldWhatsAppData();
      
      // 6. Archive old audit logs
      await this.archiveOldAuditLogs();
      
      const duration = Date.now() - startTime;
      logger.info('[DataRetentionJob] Completed successfully', {
        duration,
        results
      });
      
    } catch (error) {
      logger.error('[DataRetentionJob] Fatal error', {
        error: error.message,
        stack: error.stack
      });
      results.errors.push(error.message);
    }
    
    return results;
  },
  
  /**
   * Clean incomplete applications older than 30 days
   */
  async cleanIncompleteApplications() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // First, get the applications to be deleted for logging
      const toDeleteQuery = `
        SELECT id, user_id, created_at 
        FROM applications 
        WHERE status IN ('DRAFT', 'INCOMPLETE') 
        AND created_at < $1
        AND payment_status != 'completed'
      `;
      
      const toDelete = await db.query(toDeleteQuery, [thirtyDaysAgo]);
      
      if (toDelete.rows.length === 0) {
        return 0;
      }
      
      // Log deletions
      for (const app of toDelete.rows) {
        await privacyAuditService.logDataDeletion(
          app.user_id,
          'system',
          ['incomplete_application'],
          'Automatic cleanup after 30 days',
          { applicationId: app.id }
        );
      }
      
      // Delete the applications
      const deleteQuery = `
        DELETE FROM applications 
        WHERE status IN ('DRAFT', 'INCOMPLETE') 
        AND created_at < $1
        AND payment_status != 'completed'
      `;
      
      const result = await db.query(deleteQuery, [thirtyDaysAgo]);
      
      logger.info('[DataRetentionJob] Cleaned incomplete applications', {
        count: result.rowCount,
        olderThan: thirtyDaysAgo
      });
      
      return result.rowCount;
    } catch (error) {
      logger.error('[DataRetentionJob] Error cleaning incomplete applications', {
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Clean abandoned WhatsApp sessions
   */
  async cleanAbandonedSessions() {
    try {
      const redis = require('../utils/redis-client');
      const client = await redis.getClient();
      
      if (!client || !client.connected) {
        logger.warn('[DataRetentionJob] Redis not available for session cleanup');
        return 0;
      }
      
      let cleaned = 0;
      const pattern = 'wa:*';
      const stream = client.scanStream({ match: pattern });
      
      stream.on('data', async (keys) => {
        if (!keys.length) return;
        
        const pipeline = client.pipeline();
        
        for (const key of keys) {
          pipeline.get(key);
        }
        
        const results = await pipeline.exec();
        
        for (let i = 0; i < keys.length; i++) {
          try {
            const [err, value] = results[i];
            if (err || !value) continue;
            
            const session = JSON.parse(value);
            const lastActivity = session.lastActivity || session.timestamp;
            const hoursSinceActivity = (Date.now() - lastActivity) / (1000 * 60 * 60);
            
            // Delete sessions older than 24 hours
            if (hoursSinceActivity > 24) {
              await client.del(keys[i]);
              cleaned++;
            }
          } catch (parseError) {
            // Skip invalid sessions
            await client.del(keys[i]);
            cleaned++;
          }
        }
      });
      
      return new Promise((resolve) => {
        stream.on('end', () => {
          logger.info('[DataRetentionJob] Cleaned abandoned sessions', {
            count: cleaned
          });
          resolve(cleaned);
        });
      });
      
    } catch (error) {
      logger.error('[DataRetentionJob] Error cleaning abandoned sessions', {
        error: error.message
      });
      return 0;
    }
  },
  
  /**
   * Clean expired data export links
   */
  async cleanExpiredExports() {
    try {
      const redis = require('../utils/redis-client');
      const client = await redis.getClient();
      
      if (!client || !client.connected) {
        return 0;
      }
      
      let cleaned = 0;
      const pattern = 'export:*';
      const stream = client.scanStream({ match: pattern });
      
      stream.on('data', async (keys) => {
        if (!keys.length) return;
        
        // TTL is already set on these keys, so we just count the ones that exist
        cleaned += keys.length;
      });
      
      return new Promise((resolve) => {
        stream.on('end', () => {
          logger.info('[DataRetentionJob] Export links auto-expire via TTL', {
            currentActive: cleaned
          });
          resolve(0); // No manual cleanup needed
        });
      });
      
    } catch (error) {
      logger.error('[DataRetentionJob] Error checking export links', {
        error: error.message
      });
      return 0;
    }
  },
  
  /**
   * Process scheduled deletion requests
   */
  async processScheduledDeletions() {
    const client = await db.getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      // Get pending deletion requests that are due
      const pendingQuery = `
        SELECT * FROM data_deletion_requests
        WHERE status = 'pending'
        AND scheduled_date <= NOW()
        LIMIT 10
      `;
      
      const pending = await client.query(pendingQuery);
      
      let processed = 0;
      
      for (const request of pending.rows) {
        try {
          // Process the deletion
          await this.processUserDataDeletion(client, request.user_id);
          
          // Update request status
          await client.query(
            `UPDATE data_deletion_requests 
             SET status = 'completed', 
                 processed_date = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [request.id]
          );
          
          processed++;
          
          logger.info('[DataRetentionJob] Processed deletion request', {
            requestId: request.id,
            userId: request.user_id
          });
          
        } catch (error) {
          logger.error('[DataRetentionJob] Error processing deletion request', {
            requestId: request.id,
            userId: request.user_id,
            error: error.message
          });
          
          // Update request with error
          await client.query(
            `UPDATE data_deletion_requests 
             SET notes = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [request.id, `Error: ${error.message}`]
          );
        }
      }
      
      await client.query('COMMIT');
      
      return processed;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[DataRetentionJob] Error processing scheduled deletions', {
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  },
  
  /**
   * Process user data deletion
   */
  async processUserDataDeletion(client, userId) {
    // Archive user data first
    const archiveQuery = `
      INSERT INTO archived_users 
      SELECT * FROM users WHERE id = $1
    `;
    await client.query(archiveQuery, [userId]);
    
    // Anonymize user data
    const anonymizeQuery = `
      UPDATE users SET
        email = CONCAT('deleted_', id, '@deleted.com'),
        first_name = 'Deleted',
        last_name = 'User',
        phone = NULL,
        whatsapp_phone = NULL,
        password = 'DELETED',
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `;
    await client.query(anonymizeQuery, [userId]);
    
    // Anonymize applications
    await client.query(
      `UPDATE applications SET
        nombre_completo = 'DELETED',
        curp = 'DELETED',
        rfc = 'DELETED',
        domicilio = 'DELETED',
        email = 'deleted@deleted.com',
        telefono = 'DELETED'
      WHERE user_id = $1`,
      [userId]
    );
    
    // Log the deletion
    await privacyAuditService.logDataDeletion(
      userId,
      'system',
      ['personal_data', 'applications', 'contact_info'],
      'Scheduled deletion processed',
      { method: 'anonymization' }
    );
  },
  
  /**
   * Clean old WhatsApp interaction data
   */
  async cleanOldWhatsAppData() {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      // Delete old consent audit records (keep 2 years)
      const consentQuery = `
        DELETE FROM whatsapp_consent_audit
        WHERE created_at < $1
        AND action NOT IN ('privacy_consent_accepted', 'privacy_consent_rejected')
      `;
      
      const consentResult = await db.query(consentQuery, [oneYearAgo]);
      
      logger.info('[DataRetentionJob] Cleaned old WhatsApp data', {
        consentRecords: consentResult.rowCount,
        olderThan: oneYearAgo
      });
      
      return consentResult.rowCount;
      
    } catch (error) {
      logger.error('[DataRetentionJob] Error cleaning old WhatsApp data', {
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Archive old audit logs
   */
  async archiveOldAuditLogs() {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      // Archive old access logs
      const archiveQuery = `
        INSERT INTO archived_audit_logs (table_name, data, archived_at)
        SELECT 'data_access_log', row_to_json(dal), NOW()
        FROM data_access_log dal
        WHERE created_at < $1
      `;
      
      await db.query(archiveQuery, [sixMonthsAgo]);
      
      // Delete archived records
      await db.query(
        'DELETE FROM data_access_log WHERE created_at < $1',
        [sixMonthsAgo]
      );
      
      logger.info('[DataRetentionJob] Archived old audit logs', {
        olderThan: sixMonthsAgo
      });
      
    } catch (error) {
      logger.error('[DataRetentionJob] Error archiving audit logs', {
        error: error.message
      });
      // Non-critical, don't throw
    }
  }
};