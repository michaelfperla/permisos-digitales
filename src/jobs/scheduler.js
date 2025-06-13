const cron = require('node-cron');
const { logger } = require('../utils/enhanced-logger');
const { processScheduledApplications } = require('./scheduled-verification');
const { processMultipleExpirationIntervals } = require('./permit-expiration-notifications');
const config = require('../config');

function initScheduledJobs() {
  logger.info('Initializing scheduled jobs');

  // Daily verification job at 1:00 AM
  cron.schedule('0 1 * * *', async () => {
    logger.info('Running scheduled verification job');
    try {
      await processScheduledApplications();
    } catch (error) {
      logger.error('Error running scheduled verification job:', error);
    }
  });

  // Daily permit expiration notification job at 9:00 AM (if enabled)
  if (config.permitExpirationJobEnabled) {
    cron.schedule('0 9 * * *', async () => {
      logger.info('Running permit expiration notification job');
      try {
        await processMultipleExpirationIntervals();
      } catch (error) {
        logger.error('Error running permit expiration notification job:', error);
      }
    });
    logger.info('Permit expiration notification job scheduled for 9:00 AM daily');
  } else {
    logger.info('Permit expiration notification job is disabled');
  }

  logger.info('Scheduled jobs initialized');
}

module.exports = {
  initScheduledJobs
};
