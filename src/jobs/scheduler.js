const cron = require('node-cron');
const { logger } = require('../utils/logger');
const { processScheduledApplications } = require('./scheduled-verification');
const { processMultipleExpirationIntervals } = require('./permit-expiration-notifications');
const { reconcileStuckPayments } = require('./payment-reconciliation');
const applicationCleanupJob = require('./application-cleanup.job');
const { cleanupUnpaidApplications } = require('./unpaid-application-cleanup.job');
const emailReminderService = require('../services/email-reminder.service');
const emailService = require('../services/email.service');
const { processStuckPermits } = require('./stuck-permits.job');
const { getInstance: getPdfProcessorInstance } = require('./pdf-generation-processor.job');
const whatsappRetentionJob = require('./whatsapp-data-retention.job');
const WhatsAppStateCleanupJob = require('./whatsapp-state-cleanup.job');
const unifiedConfig = require('../config/unified-config');
const config = unifiedConfig.getSync();

function initScheduledJobs() {
  logger.info('Initializing scheduled jobs');

  // Daily verification job at 1:00 AM
  // DISABLED: This job references columns that don't exist in current schema
  // cron.schedule('0 1 * * *', async () => {
  //   logger.info('Running scheduled verification job');
  //   try {
  //     await processScheduledApplications();
  //   } catch (error) {
  //     logger.error('Error running scheduled verification job:', error);
  //   }
  // });

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

  // Payment reconciliation job - runs every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    logger.info('Running payment reconciliation job');
    try {
      const result = await reconcileStuckPayments();
      logger.info('Payment reconciliation job completed:', result);
    } catch (error) {
      logger.error('Error running payment reconciliation job:', error);
    }
  });
  logger.info('Payment reconciliation job scheduled to run every 30 minutes');

  // Unpaid application cleanup job - runs daily at 2:00 AM
  // Deletes applications that have been pending payment for more than 3 days
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running unpaid application cleanup job');
    try {
      const result = await cleanupUnpaidApplications();
      logger.info('Unpaid application cleanup job completed:', {
        successful: result.successful.length,
        failed: result.failed.length,
        total: result.totalProcessed
      });
    } catch (error) {
      logger.error('Error running unpaid application cleanup job:', error);
    }
  });
  logger.info('Unpaid application cleanup job scheduled to run daily at 2:00 AM');

  // Stuck permits job - runs every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    logger.info('Running stuck permits job');
    try {
      const result = await processStuckPermits();
      logger.info('Stuck permits job completed:', result);
    } catch (error) {
      logger.error('Error running stuck permits job:', error);
    }
  });
  logger.info('Stuck permits job scheduled to run every 10 minutes');

  // Application cleanup job - runs daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running application cleanup job');
    try {
      const result = await applicationCleanupJob.execute();
      logger.info('Application cleanup job completed:', result);
    } catch (error) {
      logger.error('Error running application cleanup job:', error);
    }
  });
  logger.info('Application cleanup job scheduled for 2:00 AM daily');

  // Email reminder job - runs every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Running email reminder job');
    try {
      const result = await emailReminderService.processExpirationReminders();
      logger.info('Email reminder job completed:', result);
    } catch (error) {
      logger.error('Error running email reminder job:', error);
    }
  });
  logger.info('Email reminder job scheduled to run every hour');

  // Email queue retry processing - runs every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Running email retry queue processing');
    try {
      await emailService.processRetryQueue();
      logger.info('Email retry queue processing completed');
    } catch (error) {
      logger.error('Error running email retry queue processing:', error);
    }
  });
  logger.info('Email retry queue processing scheduled to run every 15 minutes');

  // Email queue cleanup - runs daily at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    logger.info('Running email queue cleanup');
    try {
      const { getInstance: getEmailQueueService } = require('../services/queue.service');
      const emailQueueService = getEmailQueueService();
      await emailQueueService.cleanOldJobs();
      logger.info('Email queue cleanup completed');
    } catch (error) {
      logger.error('Error running email queue cleanup:', error);
    }
  });
  logger.info('Email queue cleanup scheduled for 3:00 AM daily');

  // WhatsApp data retention cleanup - runs daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running WhatsApp data retention cleanup');
    try {
      const result = await whatsappRetentionJob.execute();
      logger.info('WhatsApp data retention cleanup completed:', result);
    } catch (error) {
      logger.error('Error running WhatsApp data retention cleanup:', error);
    }
  });
  logger.info('WhatsApp data retention cleanup scheduled for 2:00 AM daily');

  // WhatsApp state cleanup - schedule to run every 30 minutes
  WhatsAppStateCleanupJob.schedule();
  logger.info('WhatsApp state cleanup job scheduled');

  // Start PDF Generation Processor (not a cron job, runs continuously)
  try {
    const pdfProcessor = getPdfProcessorInstance();
    pdfProcessor.start();
    logger.info('PDF Generation Processor started successfully');
  } catch (error) {
    logger.error('Failed to start PDF Generation Processor:', error);
  }

  // Run payment reconciliation immediately on startup in production
  if (config.nodeEnv === 'production') {
    setTimeout(async () => {
      logger.info('Running initial payment reconciliation on startup');
      try {
        await reconcileStuckPayments();
      } catch (error) {
        logger.error('Error in initial payment reconciliation:', error);
      }
    }, 5000); // Wait 5 seconds for services to initialize
    
    // Also run unpaid application cleanup on startup to clean existing old applications
    setTimeout(async () => {
      logger.info('Running initial unpaid application cleanup on startup');
      try {
        const result = await cleanupUnpaidApplications();
        logger.info('Initial unpaid application cleanup completed:', {
          successful: result.successful.length,
          failed: result.failed.length,
          total: result.totalProcessed
        });
      } catch (error) {
        logger.error('Error in initial unpaid application cleanup:', error);
      }
    }, 10000); // Wait 10 seconds for services to initialize
  }

  logger.info('Scheduled jobs initialized');
}

// Store PDF processor instance for shutdown
let pdfProcessorInstance = null;

// Modified init function to store processor instance
function initScheduledJobsWithShutdown() {
  // Store instance when starting
  const originalInit = initScheduledJobs;
  const wrappedInit = function() {
    originalInit.apply(this, arguments);
    // Store the PDF processor instance
    try {
      pdfProcessorInstance = getPdfProcessorInstance();
    } catch (error) {
      logger.error('Failed to get PDF processor instance for shutdown:', error);
    }
  };
  return wrappedInit();
}

// Shutdown function for graceful termination
async function shutdownScheduledJobs() {
  logger.info('Shutting down scheduled jobs...');
  
  // Stop PDF processor if running
  if (pdfProcessorInstance) {
    try {
      await pdfProcessorInstance.stop();
      logger.info('PDF Generation Processor stopped');
    } catch (error) {
      logger.error('Error stopping PDF processor:', error);
    }
  }
  
  logger.info('Scheduled jobs shutdown complete');
}

module.exports = {
  initScheduledJobs: initScheduledJobsWithShutdown,
  startScheduledJobs: initScheduledJobsWithShutdown,  // Alias for backwards compatibility
  shutdownScheduledJobs
};
