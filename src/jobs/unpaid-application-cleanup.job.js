/**
 * Unpaid Application Cleanup Job
 * 
 * Automatically deletes applications that have been pending payment for more than 3 days
 * as per client requirement: "Que el sistema elimine solicitudes pendientes después de 3 días de no haberse pagado"
 */

const { logger } = require('../utils/logger');
const applicationRepository = require('../repositories/application.repository');
const { ApplicationStatus } = require('../constants');

/**
 * Clean up unpaid applications older than 3 days
 */
async function cleanupUnpaidApplications() {
  const startTime = Date.now();
  
  try {
    logger.info('Starting unpaid application cleanup job');
    
    // Find applications that are:
    // 1. In pending payment status
    // 2. Older than 3 days
    // 3. Have no successful payment
    const db = require('../db');
    const { rows: unpaidApplications } = await db.query(`
      SELECT 
        pa.id,
        pa.user_id,
        pa.status,
        pa.created_at,
        pa.payment_processor_order_id,
        u.account_email as user_email,
        EXTRACT(DAYS FROM NOW() - pa.created_at) as days_old
      FROM permit_applications pa
      JOIN users u ON pa.user_id = u.id
      LEFT JOIN payment_events pe ON pa.id = pe.application_id 
        AND pe.event_type IN ('payment.succeeded', 'payment_intent.succeeded')
      WHERE pa.status IN ($1, $2, $3, $4, $5)
        AND pa.created_at < NOW() - INTERVAL '3 days'
        AND pe.id IS NULL
      ORDER BY pa.created_at ASC
      LIMIT 100
    `, [
      ApplicationStatus.PENDING_PAYMENT,
      ApplicationStatus.PAYMENT_PROCESSING,
      ApplicationStatus.PROCESSING_PAYMENT,
      ApplicationStatus.PAYMENT_FAILED,
      ApplicationStatus.EXPIRED
    ]);
    
    logger.info(`Found ${unpaidApplications.length} unpaid applications older than 3 days`);
    
    const deletionResults = {
      successful: [],
      failed: [],
      totalProcessed: 0
    };
    
    // Process each application for deletion
    for (const app of unpaidApplications) {
      deletionResults.totalProcessed++;
      
      try {
        logger.info(`Deleting unpaid application ${app.id}`, {
          applicationId: app.id,
          userEmail: app.user_email,
          daysOld: app.days_old,
          status: app.status
        });
        
        // Delete the application and all related data
        await applicationRepository.deleteApplication(app.id, {
          deletedBy: 'automatic_cleanup',
          reason: 'unpaid_after_3_days'
        });
        
        deletionResults.successful.push({
          applicationId: app.id,
          userEmail: app.user_email,
          daysOld: app.days_old
        });
        
        logger.info(`Successfully deleted unpaid application ${app.id}`);
        
        // TODO: Send notification to user about deletion (if required)
        // This could be implemented later if the client wants to notify users
        
      } catch (error) {
        logger.error(`Failed to delete application ${app.id}:`, error);
        deletionResults.failed.push({
          applicationId: app.id,
          error: error.message
        });
      }
      
      // Add small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const duration = Date.now() - startTime;
    
    logger.info('Unpaid application cleanup job completed', {
      duration: `${duration}ms`,
      totalFound: unpaidApplications.length,
      successfulDeletions: deletionResults.successful.length,
      failedDeletions: deletionResults.failed.length
    });
    
    // Send alert if there were failures
    if (deletionResults.failed.length > 0) {
      const alertService = require('../services/alert.service');
      await alertService.sendAlert({
        title: 'Unpaid Application Cleanup - Some Failures',
        message: `Cleanup job completed with ${deletionResults.failed.length} failures`,
        severity: 'WARNING',
        details: {
          successful: deletionResults.successful.length,
          failed: deletionResults.failed.length,
          failures: deletionResults.failed.slice(0, 10) // First 10 failures
        }
      });
    }
    
    return deletionResults;
    
  } catch (error) {
    logger.error('Fatal error in unpaid application cleanup job:', error);
    
    // Send critical alert
    try {
      const alertService = require('../services/alert.service');
      await alertService.sendAlert({
        title: 'Unpaid Application Cleanup Job Failed',
        message: 'The cleanup job encountered a fatal error',
        severity: 'CRITICAL',
        details: {
          error: error.message
        }
      });
    } catch (alertError) {
      logger.error('Failed to send cleanup job alert:', alertError);
    }
    
    throw error;
  }
}

/**
 * Get statistics about applications pending deletion
 */
async function getCleanupStatistics() {
  try {
    const db = require('../db');
    const { rows } = await db.query(`
      SELECT 
        COUNT(*) as total_pending_deletion,
        MIN(created_at) as oldest_application,
        MAX(created_at) as newest_application,
        COUNT(CASE WHEN EXTRACT(DAYS FROM NOW() - created_at) > 7 THEN 1 END) as older_than_week,
        COUNT(CASE WHEN EXTRACT(DAYS FROM NOW() - created_at) > 30 THEN 1 END) as older_than_month
      FROM permit_applications pa
      LEFT JOIN payment_events pe ON pa.id = pe.application_id 
        AND pe.event_type IN ('payment.succeeded', 'payment_intent.succeeded')
      WHERE pa.status IN ($1, $2, $3, $4, $5)
        AND pa.created_at < NOW() - INTERVAL '3 days'
        AND pe.id IS NULL
    `, [
      ApplicationStatus.PENDING_PAYMENT,
      ApplicationStatus.PAYMENT_PROCESSING,
      ApplicationStatus.PROCESSING_PAYMENT,
      ApplicationStatus.PAYMENT_FAILED,
      ApplicationStatus.EXPIRED
    ]);
    
    return rows[0];
  } catch (error) {
    logger.error('Error getting cleanup statistics:', error);
    throw error;
  }
}

module.exports = {
  cleanupUnpaidApplications,
  getCleanupStatistics
};