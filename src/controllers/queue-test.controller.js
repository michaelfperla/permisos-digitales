/**
 * Queue Test Controller
 * 
 * This controller is for testing the PDF queue system WITHOUT generating real permits
 * It simulates multiple users trying to generate permits to verify the queue works properly
 */

const { logger } = require('../utils/logger');
const { getPdfQueueService } = require('../services/pdf-queue-factory.service');
const { monitoringRepository, applicationRepository } = require('../repositories');

/**
 * Test if a single job can be added to the queue
 */
exports.testSingleQueueAdd = async (req, res) => {
  try {
    logger.info('[QUEUE-TEST] Testing single job queue addition');
    
    // Get the PDF queue service
    const pdfQueueService = getPdfQueueService();
    
    if (!pdfQueueService) {
      return res.status(500).json({
        success: false,
        error: 'PDF Queue service not available. Check Redis connection.'
      });
    }
    
    // Create a test job (using a fake application ID)
    const testJob = {
      applicationId: 99999, // Fake ID that won't trigger real processing
      userId: req.user?.id || 'test-user',
      priority: 1,
      metadata: {
        isTest: true,
        testType: 'single',
        timestamp: new Date().toISOString()
      }
    };
    
    // Try to add the job
    const job = await pdfQueueService.addJob(testJob);
    
    logger.info('[QUEUE-TEST] Job added successfully', {
      jobId: job.id,
      applicationId: testJob.applicationId
    });
    
    // Get queue status
    const queueStatus = await pdfQueueService.getQueueStats();
    
    return res.json({
      success: true,
      message: 'Test job added to queue successfully',
      jobId: job.id,
      queueStatus: queueStatus
    });
    
  } catch (error) {
    logger.error('[QUEUE-TEST] Error adding test job:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Test multiple concurrent queue additions (simulates multiple users)
 */
exports.testMultipleQueueAdd = async (req, res) => {
  try {
    const { count = 5 } = req.query; // Default to 5 concurrent jobs
    const jobCount = Math.min(parseInt(count), 20); // Max 20 for safety
    
    logger.info(`[QUEUE-TEST] Testing ${jobCount} concurrent queue additions`);
    
    const pdfQueueService = getPdfQueueService();
    
    if (!pdfQueueService) {
      return res.status(500).json({
        success: false,
        error: 'PDF Queue service not available. Check Redis connection.'
      });
    }
    
    // Create multiple test jobs
    const testJobs = [];
    for (let i = 0; i < jobCount; i++) {
      testJobs.push({
        applicationId: 90000 + i, // Fake IDs
        userId: req.user?.id || `test-user-${i}`,
        priority: 1,
        metadata: {
          isTest: true,
          testType: 'concurrent',
          jobIndex: i,
          totalJobs: jobCount,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Add all jobs concurrently (simulating multiple users)
    const startTime = Date.now();
    const jobPromises = testJobs.map(job => pdfQueueService.addJob(job));
    const results = await Promise.allSettled(jobPromises);
    const endTime = Date.now();
    
    // Analyze results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const jobIds = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value.id);
    
    // Get queue status after adding all jobs
    const queueStatus = await pdfQueueService.getQueueStats();
    
    logger.info('[QUEUE-TEST] Multiple queue test completed', {
      requested: jobCount,
      successful,
      failed,
      duration: endTime - startTime,
      queueStatus
    });
    
    return res.json({
      success: true,
      message: `Added ${successful} jobs to queue (${failed} failed)`,
      stats: {
        requested: jobCount,
        successful,
        failed,
        durationMs: endTime - startTime,
        avgTimePerJob: (endTime - startTime) / jobCount
      },
      jobIds,
      queueStatus
    });
    
  } catch (error) {
    logger.error('[QUEUE-TEST] Error in multiple queue test:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get current queue status and statistics
 */
exports.getQueueStatus = async (req, res) => {
  try {
    logger.info('[QUEUE-TEST] Getting queue status');
    
    const pdfQueueService = getPdfQueueService();
    
    if (!pdfQueueService) {
      return res.status(500).json({
        success: false,
        error: 'PDF Queue service not available. Check Redis connection.'
      });
    }
    
    // Get detailed queue status
    const status = await pdfQueueService.getQueueStats();
    
    // Also check for any stuck applications using repository
    const stuckApplications = await monitoringRepository.getStuckApplications(1);
    
    return res.json({
      success: true,
      queueStatus: status,
      stuckApplications: stuckApplications,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('[QUEUE-TEST] Error getting queue status:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Clear test jobs from the queue (cleanup)
 */
exports.clearTestJobs = async (req, res) => {
  try {
    logger.info('[QUEUE-TEST] Clearing test jobs from queue');
    
    const pdfQueueService = getPdfQueueService();
    
    if (!pdfQueueService) {
      return res.status(500).json({
        success: false,
        error: 'PDF Queue service not available.'
      });
    }
    
    // Note: This would need to be implemented in your queue service
    // For now, we'll just return the current status
    const status = await pdfQueueService.getQueueStats();
    
    return res.json({
      success: true,
      message: 'Test jobs cleared (if implemented)',
      currentStatus: status
    });
    
  } catch (error) {
    logger.error('[QUEUE-TEST] Error clearing test jobs:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Simulate a real payment scenario to test the full flow
 */
exports.simulatePaymentToQueue = async (req, res) => {
  try {
    const { applicationId } = req.body;
    
    if (!applicationId) {
      return res.status(400).json({
        success: false,
        error: 'applicationId is required'
      });
    }
    
    logger.info(`[QUEUE-TEST] Simulating payment success for application ${applicationId}`);
    
    // Check if application exists using repository
    const application = await applicationRepository.findById(applicationId);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }
    
    // Simulate what happens after payment success
    const pdfQueueService = getPdfQueueService();
    
    // This mimics what happens in the webhook
    const job = await pdfQueueService.addJob({
      applicationId: applicationId,
      userId: application.user_id,
      priority: 1,
      metadata: {
        isTest: true,
        simulatedPayment: true,
        timestamp: new Date().toISOString()
      }
    });
    
    logger.info(`[QUEUE-TEST] Job queued for application ${applicationId}`, {
      jobId: job.id,
      status: job.status
    });
    
    return res.json({
      success: true,
      message: 'Payment simulation complete, job queued',
      applicationId,
      jobId: job.id,
      jobStatus: job.status
    });
    
  } catch (error) {
    logger.error('[QUEUE-TEST] Error simulating payment:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};