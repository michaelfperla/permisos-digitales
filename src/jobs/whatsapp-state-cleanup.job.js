/**
 * WhatsApp State Cleanup Job
 * Cleans up abandoned WhatsApp conversation states
 */

const { logger } = require('../utils/logger');
const redisClient = require('../utils/redis-client');
const db = require('../db');

class WhatsAppStateCleanupJob {
  constructor() {
    this.jobName = 'whatsapp-state-cleanup';
    this.STATE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    this.SCAN_BATCH_SIZE = 100;
  }

  /**
   * Execute the cleanup job
   */
  async execute() {
    const startTime = Date.now();
    let cleanedCount = 0;
    let errorCount = 0;
    let cursor = '0';

    try {
      logger.info(`[${this.jobName}] Starting WhatsApp state cleanup`);

      // Scan Redis for WhatsApp state keys
      do {
        try {
          const result = await redisClient.scan(
            cursor,
            'MATCH',
            'wa:*',
            'COUNT',
            this.SCAN_BATCH_SIZE
          );

          cursor = result[0];
          const keys = result[1];

          // Process each key
          for (const key of keys) {
            try {
              await this.processStateKey(key);
              cleanedCount++;
            } catch (error) {
              logger.error(`[${this.jobName}] Error processing key ${key}`, {
                error: error.message
              });
              errorCount++;
            }
          }

          // Add small delay to avoid Redis overload
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (scanError) {
          logger.error(`[${this.jobName}] Redis scan error`, {
            error: scanError.message
          });
          break;
        }
      } while (cursor !== '0');

      // Clean up database sessions
      await this.cleanupDatabaseSessions();

      const duration = Date.now() - startTime;
      logger.info(`[${this.jobName}] Cleanup completed`, {
        duration,
        cleanedCount,
        errorCount
      });

      return {
        success: true,
        cleanedCount,
        errorCount,
        duration
      };
    } catch (error) {
      logger.error(`[${this.jobName}] Job failed`, {
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process individual state key
   */
  async processStateKey(key) {
    try {
      // Get TTL of the key
      const ttl = await redisClient.ttl(key);
      
      // If no TTL set, check the state content
      if (ttl === -1) {
        const stateData = await redisClient.get(key);
        if (stateData) {
          const state = JSON.parse(stateData);
          
          // Check if state is older than timeout
          if (state.timestamp) {
            const age = Date.now() - state.timestamp;
            if (age > this.STATE_TIMEOUT_MS) {
              logger.info(`[${this.jobName}] Removing expired state`, {
                key,
                age: Math.floor(age / 1000 / 60) + ' minutes'
              });
              await redisClient.del(key);
            }
          } else {
            // No timestamp, set TTL to expire in 30 minutes
            logger.warn(`[${this.jobName}] State without timestamp, setting TTL`, { key });
            await redisClient.expire(key, 1800); // 30 minutes
          }
        }
      }
    } catch (error) {
      logger.error(`[${this.jobName}] Error processing key`, {
        key,
        error: error.message
      });
    }
  }

  /**
   * Clean up incomplete database sessions with transaction safety
   */
  async cleanupDatabaseSessions() {
    const pool = db.getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Mark incomplete applications older than 24 hours with no payment as expired
      const result = await client.query(`
        UPDATE permit_applications
        SET status = 'EXPIRED',
            updated_at = NOW()
        WHERE status IN ('AWAITING_PAYMENT', 'INCOMPLETE')
          AND created_at < NOW() - INTERVAL '24 hours'
          AND NOT EXISTS (
            SELECT 1 FROM payment_events
            WHERE payment_events.application_id = permit_applications.id
            AND payment_events.event_type IN ('payment_intent.succeeded', 'checkout.session.completed')
          )
        RETURNING id
      `);

      // Log the cleanup details before committing
      if (result.rows.length > 0) {
        const auditResult = await client.query(`
          INSERT INTO audit_logs (user_id, action, details, created_at)
          VALUES (NULL, 'SYSTEM_CLEANUP', $1, NOW())
        `, [JSON.stringify({
          job: this.jobName,
          cleanedApplications: result.rows.map(r => r.id),
          count: result.rows.length
        })]);
      }

      await client.query('COMMIT');

      if (result.rows.length > 0) {
        logger.info(`[${this.jobName}] Cleaned up database sessions`, {
          count: result.rows.length,
          applicationIds: result.rows.map(r => r.id)
        });
      }
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`[${this.jobName}] Database cleanup error`, {
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Schedule the job
   */
  static schedule() {
    const job = new WhatsAppStateCleanupJob();
    
    // Run every 30 minutes
    setInterval(() => {
      job.execute().catch(error => {
        logger.error('[WhatsAppStateCleanup] Scheduled execution failed', {
          error: error.message
        });
      });
    }, 30 * 60 * 1000);

    // Run once on startup after 5 minutes
    setTimeout(() => {
      job.execute().catch(error => {
        logger.error('[WhatsAppStateCleanup] Initial execution failed', {
          error: error.message
        });
      });
    }, 5 * 60 * 1000);

    logger.info('[WhatsAppStateCleanup] Job scheduled');
  }
}

module.exports = WhatsAppStateCleanupJob;