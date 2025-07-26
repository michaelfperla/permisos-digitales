/**
 * Permit Expiration Notification Job
 * Handles scheduled notifications for permits approaching expiration
 */

const { logger } = require('../utils/logger');
const applicationService = require('../services/application.service');
const unifiedConfig = require('../config/unified-config');
const config = unifiedConfig.getSync();

/**
 * Process permits that are approaching expiration and send notifications
 * This function is designed to be called by the scheduler
 * @param {number} daysUntilExpiration - Days until permit expiration (default: 5)
 * @returns {Promise<Object>} - Processing results
 */
async function processExpiringPermitNotifications(daysUntilExpiration = 5) {
  logger.info(`Starting permit expiration notification job for permits expiring within ${daysUntilExpiration} days`);

  try {
    const result = await applicationService.notifyExpiringPermits(daysUntilExpiration);
    
    logger.info(`Permit expiration notification job completed: ${result.message}`, {
      total: result.total,
      notified: result.notified,
      failed: result.failed,
      success: result.success
    });

    return result;
  } catch (error) {
    logger.error('Error in permit expiration notification job:', {
      error: error.message,
      stack: error.stack,
      daysUntilExpiration
    });

    return {
      success: false,
      notified: 0,
      failed: 0,
      total: 0,
      message: `Job failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Process multiple notification intervals for permits
 * Sends notifications at different intervals based on configuration
 * @returns {Promise<Object>} - Combined processing results
 */
async function processMultipleExpirationIntervals() {
  logger.info('Starting multi-interval permit expiration notification job');

  // Check if the job is enabled
  if (!config.permitExpirationJobEnabled) {
    logger.info('Permit expiration notification job is disabled');
    return {
      success: true,
      totalNotified: 0,
      totalFailed: 0,
      totalProcessed: 0,
      message: 'Job disabled by configuration',
      intervals: []
    };
  }

  // Get warning days from configuration
  const warningDays = config.permitExpirationWarningDays || [7, 3, 1];
  const intervals = warningDays.map(days => ({
    days,
    description: days === 1 ? '1-day final warning' :
                 days <= 3 ? `${days}-day urgent warning` :
                 `${days}-day warning`
  }));

  const combinedResults = {
    success: true,
    totalNotified: 0,
    totalFailed: 0,
    totalProcessed: 0,
    intervals: []
  };

  for (const interval of intervals) {
    try {
      logger.info(`Processing ${interval.description} notifications`);
      const result = await applicationService.notifyExpiringPermits(interval.days);
      
      combinedResults.intervals.push({
        days: interval.days,
        description: interval.description,
        ...result
      });

      combinedResults.totalNotified += result.notified;
      combinedResults.totalFailed += result.failed;
      combinedResults.totalProcessed += result.total;

      if (!result.success) {
        combinedResults.success = false;
      }

      logger.info(`Completed ${interval.description}: ${result.notified} notified, ${result.failed} failed`);
    } catch (error) {
      logger.error(`Error processing ${interval.description}:`, error);
      combinedResults.success = false;
      combinedResults.intervals.push({
        days: interval.days,
        description: interval.description,
        success: false,
        error: error.message,
        notified: 0,
        failed: 0,
        total: 0
      });
    }
  }

  const message = `Multi-interval notification job completed: ${combinedResults.totalNotified} total notified, ${combinedResults.totalFailed} total failed across ${intervals.length} intervals`;
  logger.info(message);

  return {
    ...combinedResults,
    message
  };
}

module.exports = {
  processExpiringPermitNotifications,
  processMultipleExpirationIntervals
};
