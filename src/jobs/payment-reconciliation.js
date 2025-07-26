const { logger } = require('../utils/logger');
const paymentRecoveryService = require('../services/payment-recovery.service');
const applicationRepository = require('../repositories/application.repository');
const paymentRepository = require('../repositories/payment.repository');
const paymentRecoveryRepository = require('../repositories/payment-recovery.repository');
const { ApplicationStatus } = require('../constants');

/**
 * Process stuck payments that need reconciliation
 */
async function reconcileStuckPayments() {
  const startTime = Date.now();
  let processedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  
  try {
    logger.info('Starting payment reconciliation job');
    
    // Find payments that are stuck in processing states
    const db = require('../db');
    const { rows: stuckPayments } = await db.query(`
      SELECT 
        pa.id as application_id,
        pa.payment_processor_order_id as payment_intent_id,
        pa.status,
        pa.created_at,
        pa.updated_at
      FROM permit_applications pa
      WHERE pa.status IN ($1, $2, $3, $4)
      AND pa.payment_processor_order_id IS NOT NULL
      AND pa.updated_at < NOW() - INTERVAL '1 hour'
      ORDER BY pa.updated_at ASC
      LIMIT 50
    `, [
      ApplicationStatus.PENDING_PAYMENT,
      ApplicationStatus.PAYMENT_PROCESSING,
      ApplicationStatus.PROCESSING_PAYMENT,
      ApplicationStatus.PAYMENT_FAILED
    ]);
    
    logger.info(`Found ${stuckPayments.length} stuck payments to reconcile`);
    
    // Process each stuck payment
    for (const payment of stuckPayments) {
      processedCount++;
      
      try {
        logger.info(`Reconciling payment for application ${payment.application_id}`);
        
        const result = await paymentRecoveryService.reconcilePaymentStatus(payment.application_id);
        
        if (result.success) {
          successCount++;
          logger.info(`Successfully reconciled payment for application ${payment.application_id}`, {
            oldStatus: result.oldStatus,
            newStatus: result.newStatus,
            reason: result.reason
          });
        } else {
          failureCount++;
          logger.warn(`Failed to reconcile payment for application ${payment.application_id}`, {
            reason: result.reason,
            error: result.error
          });
        }
        
        // Add small delay to avoid overwhelming Stripe API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        failureCount++;
        logger.error(`Error reconciling payment for application ${payment.application_id}:`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    // Process stuck recovery attempts
    const stuckRecoveryAttempts = await paymentRecoveryRepository.getStuckRecoveryAttempts(30);
    
    logger.info(`Found ${stuckRecoveryAttempts.length} stuck recovery attempts`);
    
    for (const attempt of stuckRecoveryAttempts) {
      processedCount++;
      
      try {
        logger.info(`Retrying recovery for application ${attempt.application_id}`);
        
        const result = await paymentRecoveryService.attemptPaymentRecovery(
          attempt.application_id,
          attempt.payment_intent_id,
          { message: 'Scheduled reconciliation retry' }
        );
        
        if (result.success) {
          successCount++;
          logger.info(`Successfully recovered payment for application ${attempt.application_id}`);
        } else if (result.reason === 'still_processing') {
          logger.info(`Payment still processing for application ${attempt.application_id}`);
        } else {
          failureCount++;
          logger.warn(`Failed to recover payment for application ${attempt.application_id}`, {
            reason: result.reason
          });
        }
        
        // Add small delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        failureCount++;
        logger.error(`Error processing recovery attempt for application ${attempt.application_id}:`, {
          error: error.message
        });
      }
    }
    
    const duration = Date.now() - startTime;
    
    logger.info('Payment reconciliation job completed', {
      duration: `${duration}ms`,
      processed: processedCount,
      successful: successCount,
      failed: failureCount
    });
    
    // Get and log recovery statistics
    const stats = await paymentRecoveryService.getRecoveryStats(24);
    logger.info('Payment recovery statistics (last 24h):', stats);
    
    return {
      processed: processedCount,
      successful: successCount,
      failed: failureCount,
      duration
    };
    
  } catch (error) {
    logger.error('Fatal error in payment reconciliation job:', {
      error: error.message,
      stack: error.stack
    });
    
    // Send critical alert
    try {
      const alertService = require('../services/alert.service');
      await alertService.sendAlert({
        title: 'Payment Reconciliation Job Failed',
        message: 'The payment reconciliation job encountered a fatal error',
        severity: 'CRITICAL',
        details: {
          error: error.message,
          processedBeforeError: processedCount
        }
      });
    } catch (alertError) {
      logger.error('Failed to send reconciliation job alert:', alertError);
    }
    
    throw error;
  }
}

module.exports = {
  reconcileStuckPayments
};