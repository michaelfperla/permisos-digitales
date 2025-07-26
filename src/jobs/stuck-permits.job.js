const db = require('../db');
const { getInstance } = require('../services/pdf-queue-factory.service');
const { logger } = require('../utils/logger');

/**
 * Job to find and process applications that are paid but stuck without PDF generation
 * This catches cases where the webhook failed to queue the PDF
 */
async function processStuckPermits() {
  try {
    logger.info('[StuckPermitsJob] Starting stuck permits check');
    
    // Find applications that are paid but not queued for PDF generation
    const stuckApplications = await db.query(`
      SELECT id, user_id, nombre_completo, payment_processor_order_id 
      FROM permit_applications 
      WHERE status = 'PAYMENT_RECEIVED' 
      AND (queue_status IS NULL OR queue_status = 'error' OR queue_status = 'failed')
      AND created_at > NOW() - INTERVAL '7 days'
      AND payment_processor_order_id IS NOT NULL
      LIMIT 10
    `);

    if (stuckApplications.rows.length === 0) {
      logger.info('[StuckPermitsJob] No stuck permits found');
      return { processed: 0, success: 0, failed: 0 };
    }

    logger.info(`[StuckPermitsJob] Found ${stuckApplications.rows.length} stuck permits`);

    const pdfQueueService = getInstance();
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    for (const application of stuckApplications.rows) {
      processedCount++;
      
      try {
        logger.info(`[StuckPermitsJob] Processing stuck application ${application.id} for ${application.nombre_completo}`);
        
        // Clear any previous errors
        await db.query(
          'UPDATE permit_applications SET queue_status = NULL, queue_error = NULL WHERE id = $1',
          [application.id]
        );
        
        // Queue for PDF generation
        // Note: addJob will automatically update status to GENERATING_PERMIT
        const jobData = {
          applicationId: application.id,
          userId: application.user_id,
          metadata: {
            triggeredBy: 'stuck-permits-job',
            originalPaymentIntent: application.payment_processor_order_id
          }
        };
        
        const job = await pdfQueueService.addJob(jobData);
        
        logger.info(`[StuckPermitsJob] Successfully queued application ${application.id}, job ID: ${job.id}`);
        successCount++;
        
      } catch (error) {
        failedCount++;
        logger.error(`[StuckPermitsJob] Failed to queue application ${application.id}:`, error);
        
        // Update with error
        await db.query(
          'UPDATE permit_applications SET queue_error = $1 WHERE id = $2',
          [`Stuck permits job error: ${error.message}`, application.id]
        );
      }
    }
    
    const summary = {
      processed: processedCount,
      success: successCount,
      failed: failedCount
    };
    
    logger.info('[StuckPermitsJob] Stuck permits check completed', summary);
    return summary;
    
  } catch (error) {
    logger.error('[StuckPermitsJob] Error in stuck permits job:', error);
    throw error;
  }
}

module.exports = {
  processStuckPermits,
  // Run every 10 minutes
  schedule: '*/10 * * * *'
};