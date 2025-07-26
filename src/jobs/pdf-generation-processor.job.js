// src/jobs/pdf-generation-processor.job.js
// Processes deferred PDF generation events created by the webhook handler

const { logger } = require('../utils/logger');
const { ApplicationStatus } = require('../constants');
const { applicationRepository, paymentRepository } = require('../repositories');
const { getService } = require('../core/service-container-singleton');

// Helper to get PDF queue service
const getPdfQueueService = () => {
  try {
    const service = getService('pdfQueue');
    if (service) {
      return service;
    }
  } catch (error) {
    logger.warn('Service container not available for pdfQueue, using factory directly:', error.message);
  }
  
  try {
    const pdfQueueFactory = require('../services/pdf-queue-factory.service');
    return pdfQueueFactory.getInstance();
  } catch (error) {
    logger.error('PDF Queue service not available:', error.message);
    return null;
  }
};

class PdfGenerationProcessor {
  constructor() {
    this.isRunning = false;
    this.intervalMs = parseInt(process.env.PDF_PROCESSOR_INTERVAL || '5000', 10); // Check every 5 seconds
    this.batchSize = parseInt(process.env.PDF_PROCESSOR_BATCH_SIZE || '10', 10);
    this.intervalId = null;
  }

  async start() {
    if (this.isRunning) {
      logger.warn('PDF Generation Processor already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting PDF Generation Processor', { 
      intervalMs: this.intervalMs,
      batchSize: this.batchSize 
    });

    // Run immediately
    await this.processPendingApplications();

    // Then run on interval
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.processPendingApplications();
      }
    }, this.intervalMs);
  }

  async stop() {
    logger.info('Stopping PDF Generation Processor');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async processPendingApplications() {
    try {
      // Find applications in PAYMENT_RECEIVED status that need PDF generation
      const pendingApplications = await applicationRepository.findPendingPdfGeneration(this.batchSize);
      
      if (pendingApplications.length === 0) {
        return;
      }

      logger.info(`Found ${pendingApplications.length} applications pending PDF generation`);

      const pdfQueueService = getPdfQueueService();
      if (!pdfQueueService) {
        logger.error('PDF Queue service not available, skipping batch');
        return;
      }

      // Process each application
      for (const app of pendingApplications) {
        try {
          await this.processApplication(app, pdfQueueService);
        } catch (error) {
          logger.error('Failed to process application', {
            applicationId: app.id,
            error: error.message,
            stack: error.stack
          });
        }
      }
    } catch (error) {
      logger.error('Error in PDF Generation Processor', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  async processApplication(application, pdfQueueService) {
    const { id: applicationId, user_id: userId, payment_processor_order_id } = application;
    
    logger.info('Processing deferred PDF generation', {
      applicationId,
      userId,
      paymentIntentId: payment_processor_order_id
    });

    try {
      // Check if already queued (idempotency)
      const queueStatus = await pdfQueueService.getApplicationQueueStatus(applicationId);
      if (queueStatus && ['waiting', 'active', 'completed'].includes(queueStatus.state)) {
        logger.info('Application already in queue, skipping', {
          applicationId,
          queueState: queueStatus.state
        });
        return;
      }

      // Add to PDF queue
      const job = await pdfQueueService.addJob({
        applicationId,
        userId,
        priority: 1,
        metadata: {
          paymentIntentId: payment_processor_order_id,
          source: 'pdf_generation_processor',
          processedAt: new Date().toISOString()
        }
      });

      logger.info('Successfully queued PDF generation', {
        applicationId,
        jobId: job.id
      });

      // Update application status to GENERATING_PERMIT
      await applicationRepository.update(applicationId, {
        status: ApplicationStatus.GENERATING_PERMIT,
        queue_job_id: job.id,
        queue_status: 'queued',
        queue_entered_at: new Date()
      });

      // Create success event
      await paymentRepository.createPaymentEvent(
        applicationId,
        'pdf_generation.queued',
        {
          jobId: job.id,
          paymentIntentId: payment_processor_order_id,
          queuedAt: new Date().toISOString()
        },
        payment_processor_order_id
      );

    } catch (error) {
      logger.error('Failed to queue PDF generation', {
        applicationId,
        error: error.message,
        stack: error.stack
      });

      // Update application with error
      await applicationRepository.update(applicationId, {
        queue_status: 'failed',
        queue_error: error.message,
        puppeteer_error_message: `Failed to queue: ${error.message}`
      });

      // Create error event
      await paymentRepository.createPaymentEvent(
        applicationId,
        'pdf_generation.failed',
        {
          error: error.message,
          paymentIntentId: payment_processor_order_id,
          failedAt: new Date().toISOString()
        },
        payment_processor_order_id
      );

      // Send alert for critical failures
      if (error.message.includes('Queue service') || error.message.includes('initialization')) {
        try {
          const alertService = require('../services/alert.service');
          await alertService.sendCriticalAlert(
            'PDF Generation Processor Failure',
            `Failed to process application ${applicationId}: ${error.message}`,
            {
              type: 'PDF_PROCESSOR_FAILURE',
              applicationId,
              error: error.message
            }
          );
        } catch (alertError) {
          logger.error('Failed to send alert', { error: alertError.message });
        }
      }
    }
  }
}

// Create singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new PdfGenerationProcessor();
    }
    return instance;
  },
  PdfGenerationProcessor
};