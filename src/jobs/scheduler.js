const cron = require('node-cron');
const { logger } = require('../utils/enhanced-logger');
const { processScheduledApplications } = require('./scheduled-verification');

function initScheduledJobs() {
  logger.info('Initializing scheduled jobs');

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
