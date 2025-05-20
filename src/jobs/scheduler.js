/**
 * =============================================================================
 * Permisos Digitales - Job Scheduler
 * =============================================================================
 *
 * Sets up scheduled jobs using node-cron.
 */

const cron = require('node-cron');
const { logger } = require('../utils/enhanced-logger');
const { processScheduledApplications } = require('./scheduled-verification');

/**
 * Initializes all scheduled jobs
 */
function initScheduledJobs() {
  logger.info('Initializing scheduled jobs');

  // Schedule the verification job to run daily at 1:00 AM
  // Cron format: second(optional) minute hour day-of-month month day-of-week
  cron.schedule('0 1 * * *', async () => {
    logger.info('Running scheduled verification job');
    try {
      await processScheduledApplications();
    } catch (error) {
      logger.error('Error running scheduled verification job:', error);
    }
  });

  logger.info('Scheduled jobs initialized');
}

module.exports = {
  initScheduledJobs
};
