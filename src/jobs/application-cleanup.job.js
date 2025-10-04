const { logger } = require('../utils/logger');
const { applicationRepository } = require('../repositories');
const { ApplicationStatus } = require('../constants');
const db = require('../db');

/**
 * Daily cleanup job for expired applications
 * Handles cleanup of applications that have exceeded their expiration time
 */
class ApplicationCleanupJob {
  constructor() {
    this.jobName = 'application-cleanup';
  }

  /**
   * Execute the cleanup job
   */
  async execute() {
    try {
      logger.info('[ApplicationCleanup] Starting application cleanup job');
      
      const results = {
        expiredPayment: 0,
        expiredOxxo: 0,
        failedCard: 0,
        expiredPermits: 0,
        total: 0
      };

      // 1. Expire applications that never started payment (24+ hours old)
      const expiredPaymentResult = await this.expireAwaitingPaymentApplications();
      results.expiredPayment = expiredPaymentResult;

      // 2. Expire OXXO payments that exceeded 48 hour limit
      const expiredOxxoResult = await this.expireOxxoPayments();
      results.expiredOxxo = expiredOxxoResult;

      // 3. Fail card payments stuck in processing for > 1 hour
      const failedCardResult = await this.failStuckCardPayments();
      results.failedCard = failedCardResult;

      // 4. Expire permits that have been ready for more than 30 days
      const expiredPermitsResult = await this.expireOldPermits();
      results.expiredPermits = expiredPermitsResult;

      results.total = results.expiredPayment + results.expiredOxxo + results.failedCard + results.expiredPermits;

      logger.info('[ApplicationCleanup] Cleanup job completed', {
        results,
        timestamp: new Date().toISOString()
      });

      return results;
    } catch (error) {
      logger.error('[ApplicationCleanup] Error executing cleanup job:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Expire applications that never initiated payment
   */
  async expireAwaitingPaymentApplications() {
    try {
      const query = `
        UPDATE permit_applications 
        SET 
          status = $1,
          updated_at = NOW()
        WHERE 
          status = $2 
          AND expires_at < NOW()
          AND payment_initiated_at IS NULL
        RETURNING id, user_id, created_at, expires_at
      `;

      const result = await db.query(query, [
        ApplicationStatus.EXPIRED,
        ApplicationStatus.AWAITING_PAYMENT
      ]);

      const expiredCount = result.rows.length;

      if (expiredCount > 0) {
        logger.info('[ApplicationCleanup] Expired applications awaiting payment', {
          count: expiredCount,
          applications: result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            createdAt: row.created_at,
            expiredAt: row.expires_at
          }))
        });
      }

      return expiredCount;
    } catch (error) {
      logger.error('[ApplicationCleanup] Error expiring awaiting payment applications:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Expire OXXO payments that exceeded time limit
   */
  async expireOxxoPayments() {
    try {
      const query = `
        UPDATE permit_applications 
        SET 
          status = $1,
          updated_at = NOW()
        WHERE 
          status = $2 
          AND expires_at < NOW()
        RETURNING id, user_id, payment_initiated_at, expires_at
      `;

      const result = await db.query(query, [
        ApplicationStatus.EXPIRED,
        ApplicationStatus.AWAITING_OXXO_PAYMENT
      ]);

      const expiredCount = result.rows.length;

      if (expiredCount > 0) {
        logger.info('[ApplicationCleanup] Expired OXXO payments', {
          count: expiredCount,
          applications: result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            paymentInitiatedAt: row.payment_initiated_at,
            expiredAt: row.expires_at
          }))
        });
      }

      return expiredCount;
    } catch (error) {
      logger.error('[ApplicationCleanup] Error expiring OXXO payments:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Fail card payments stuck in processing state
   */
  async failStuckCardPayments() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const query = `
        UPDATE permit_applications 
        SET 
          status = $1,
          updated_at = NOW()
        WHERE 
          status = $2 
          AND payment_initiated_at < $3
          AND payment_initiated_at IS NOT NULL
        RETURNING id, user_id, payment_initiated_at
      `;

      const result = await db.query(query, [
        ApplicationStatus.PAYMENT_FAILED,
        ApplicationStatus.PAYMENT_PROCESSING,
        oneHourAgo
      ]);

      const failedCount = result.rows.length;

      if (failedCount > 0) {
        logger.info('[ApplicationCleanup] Failed stuck card payments', {
          count: failedCount,
          applications: result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            paymentInitiatedAt: row.payment_initiated_at
          }))
        });
      }

      return failedCount;
    } catch (error) {
      logger.error('[ApplicationCleanup] Error failing stuck card payments:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Expire permits that have been in PERMIT_READY status for more than 30 days
   */
  async expireOldPermits() {
    try {
      // Use business rule logic to determine expiration
      const { isPermitExpiredByBusinessRules } = require('../utils/permit-business-days');
      
      // First, get all PERMIT_READY permits to check with business rules
      const selectQuery = `
        SELECT id, user_id, fecha_expedicion, fecha_vencimiento, updated_at
        FROM permit_applications 
        WHERE status = $1 
        AND fecha_vencimiento IS NOT NULL
      `;
      
      const selectResult = await db.query(selectQuery, [ApplicationStatus.PERMIT_READY]);
      
      const expiredPermitIds = [];
      
      // Check each permit using business rules
      for (const permit of selectResult.rows) {
        // Use fecha_expedicion as the base date (should be set when permit became PERMIT_READY)
        // Only fall back to updated_at if fecha_expedicion is missing
        const permitReadyDate = permit.fecha_expedicion || permit.updated_at;
        
        if (permitReadyDate && isPermitExpiredByBusinessRules(permitReadyDate)) {
          expiredPermitIds.push(permit.id);
        }
      }
      
      if (expiredPermitIds.length === 0) {
        return 0;
      }
      
      // Update expired permits
      const updateQuery = `
        UPDATE permit_applications 
        SET 
          status = $1,
          updated_at = NOW()
        WHERE 
          id = ANY($2)
        RETURNING id, user_id, fecha_expedicion, fecha_vencimiento
      `;
      
      const result = await db.query(updateQuery, [
        ApplicationStatus.VENCIDO,
        expiredPermitIds
      ]);

      const expiredCount = result.rows.length;

      if (expiredCount > 0) {
        logger.info('[ApplicationCleanup] Expired old permits', {
          count: expiredCount,
          permits: result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            fechaExpedicion: row.fecha_expedicion,
            fechaVencimiento: row.fecha_vencimiento
          }))
        });
      }

      return expiredCount;
    } catch (error) {
      logger.error('[ApplicationCleanup] Error expiring old permits:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get statistics about applications that would be cleaned up (dry run)
   */
  async getCleanupStats() {
    try {
      const stats = {
        awaitingPaymentExpired: 0,
        oxxoExpired: 0,
        cardStuck: 0,
        expiredPermits: 0,
        total: 0
      };

      // Count applications awaiting payment that are expired
      const awaitingPaymentQuery = `
        SELECT COUNT(*) as count
        FROM permit_applications 
        WHERE status = $1 
        AND expires_at < NOW()
        AND payment_initiated_at IS NULL
      `;
      const awaitingResult = await db.query(awaitingPaymentQuery, [ApplicationStatus.AWAITING_PAYMENT]);
      stats.awaitingPaymentExpired = parseInt(awaitingResult.rows[0].count);

      // Count OXXO payments that are expired
      const oxxoQuery = `
        SELECT COUNT(*) as count
        FROM permit_applications 
        WHERE status = $1 
        AND expires_at < NOW()
      `;
      const oxxoResult = await db.query(oxxoQuery, [ApplicationStatus.AWAITING_OXXO_PAYMENT]);
      stats.oxxoExpired = parseInt(oxxoResult.rows[0].count);

      // Count card payments stuck in processing
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const cardQuery = `
        SELECT COUNT(*) as count
        FROM permit_applications 
        WHERE status = $1 
        AND payment_initiated_at < $2
        AND payment_initiated_at IS NOT NULL
      `;
      const cardResult = await db.query(cardQuery, [ApplicationStatus.PAYMENT_PROCESSING, oneHourAgo]);
      stats.cardStuck = parseInt(cardResult.rows[0].count);

      // Count permits that have expired using business rules
      const { isPermitExpiredByBusinessRules } = require('../utils/permit-business-days');
      
      const expiredPermitsQuery = `
        SELECT id, fecha_expedicion, updated_at
        FROM permit_applications 
        WHERE status = $1 
        AND fecha_vencimiento IS NOT NULL
      `;
      const permitsResult = await db.query(expiredPermitsQuery, [ApplicationStatus.PERMIT_READY]);
      
      let expiredCount = 0;
      for (const permit of permitsResult.rows) {
        const permitReadyDate = permit.fecha_expedicion || permit.updated_at;
        if (permitReadyDate && isPermitExpiredByBusinessRules(permitReadyDate)) {
          expiredCount++;
        }
      }
      stats.expiredPermits = expiredCount;

      stats.total = stats.awaitingPaymentExpired + stats.oxxoExpired + stats.cardStuck + stats.expiredPermits;

      return stats;
    } catch (error) {
      logger.error('[ApplicationCleanup] Error getting cleanup stats:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = new ApplicationCleanupJob();