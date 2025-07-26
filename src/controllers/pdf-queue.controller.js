// src/controllers/pdf-queue.controller.js
const { logger } = require('../utils/logger');
const ApiResponse = require('../utils/api-response');
// Import service container singleton
const { getService } = require('../core/service-container-singleton');

// Helper to get PDF queue service
const getPdfQueueService = () => {
  try {
    return getService('pdfQueue');
  } catch (error) {
    logger.error('PDF Queue service not available:', error.message);
    throw new Error('PDF Queue service is not available');
  }
};

/**
 * Get queue statistics
 */
const getQueueStats = async (req, res) => {
  try {
    const pdfQueueService = getPdfQueueService();
    const stats = await pdfQueueService.getQueueStats();
    
    ApiResponse.success(res, stats, {
      message: 'Queue statistics retrieved successfully'
    });
  } catch (error) {
    logger.error('Error getting queue stats:', error);
    ApiResponse.error(res, 'Error retrieving queue statistics', 500);
  }
};

/**
 * Get application queue status
 */
const getApplicationQueueStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user?.id;
    
    // Verify user owns this application
    const applicationRepository = require('../repositories').applicationRepository;
    const application = await applicationRepository.findById(applicationId);
    
    if (!application) {
      return ApiResponse.notFound(res, 'Application not found');
    }
    
    if (application.user_id !== userId && req.user?.accountType !== 'admin') {
      return ApiResponse.forbidden(res, 'Not authorized to view this application');
    }
    
    const pdfQueueService = getPdfQueueService();
    
    if (!pdfQueueService) {
      return ApiResponse.error(res, 'PDF queue service unavailable', 503);
    }
    
    const status = await pdfQueueService.getApplicationQueueStatus(applicationId);
    
    if (!status) {
      return ApiResponse.success(res, {
        applicationId,
        inQueue: false,
        message: 'Application is not in the PDF generation queue'
      });
    }
    
    const waitTime = status.state === 'waiting' 
      ? await pdfQueueService.getEstimatedWaitTime(applicationId)
      : null;
    
    ApiResponse.success(res, {
      ...status,
      waitTime
    });
  } catch (error) {
    logger.error('Error getting application queue status:', error);
    ApiResponse.error(res, 'Error retrieving application queue status', 500);
  }
};

/**
 * Retry failed PDF generation (admin only)
 */
const retryFailedJob = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    const pdfQueueService = getPdfQueueService();
    await pdfQueueService.retryJob(applicationId);
    
    ApiResponse.success(res, {
      applicationId,
      message: 'PDF generation retry initiated'
    });
  } catch (error) {
    logger.error('Error retrying failed job:', error);
    ApiResponse.error(res, error.message || 'Error retrying PDF generation', 500);
  }
};

/**
 * Get all failed jobs (admin only)
 */
const getFailedJobs = async (req, res) => {
  try {
    const pdfQueueService = getPdfQueueService();
    const queue = pdfQueueService.queue;
    
    const failedJobs = await queue.getFailed();
    const jobs = failedJobs.map(job => ({
      jobId: job.id,
      applicationId: job.data.applicationId,
      userId: job.data.userId,
      failedAt: new Date(job.finishedOn),
      attempts: job.attemptsMade,
      error: job.failedReason,
      canRetry: true
    }));
    
    ApiResponse.success(res, {
      count: jobs.length,
      jobs
    });
  } catch (error) {
    logger.error('Error getting failed jobs:', error);
    ApiResponse.error(res, 'Error retrieving failed jobs', 500);
  }
};

/**
 * Clean old completed/failed jobs (admin only)
 */
const cleanOldJobs = async (req, res) => {
  try {
    const { gracePeriodHours = 24 } = req.body;
    const gracePeriodMs = gracePeriodHours * 3600000;
    
    const pdfQueueService = getPdfQueueService();
    const removedCount = await pdfQueueService.cleanOldJobs(gracePeriodMs);
    
    ApiResponse.success(res, {
      removedCount,
      message: `Removed ${removedCount} old jobs`
    });
  } catch (error) {
    logger.error('Error cleaning old jobs:', error);
    ApiResponse.error(res, 'Error cleaning old jobs', 500);
  }
};

/**
 * Pause queue processing (admin only)
 */
const pauseQueue = async (req, res) => {
  try {
    const pdfQueueService = getPdfQueueService();
    await pdfQueueService.pauseQueue();
    
    ApiResponse.success(res, {
      message: 'Queue processing paused'
    });
  } catch (error) {
    logger.error('Error pausing queue:', error);
    ApiResponse.error(res, 'Error pausing queue', 500);
  }
};

/**
 * Resume queue processing (admin only)
 */
const resumeQueue = async (req, res) => {
  try {
    const pdfQueueService = getPdfQueueService();
    await pdfQueueService.resumeQueue();
    
    ApiResponse.success(res, {
      message: 'Queue processing resumed'
    });
  } catch (error) {
    logger.error('Error resuming queue:', error);
    ApiResponse.error(res, 'Error resuming queue', 500);
  }
};

/**
 * Get queue health check
 */
const getQueueHealth = async (req, res) => {
  try {
    const pdfQueueService = getPdfQueueService();
    const stats = await pdfQueueService.getQueueStats();
    
    // Determine health status
    let status = 'healthy';
    const issues = [];
    
    // Check for high failure rate
    const totalJobs = stats.completed + stats.failed;
    if (totalJobs > 10 && stats.failed / totalJobs > 0.1) {
      status = 'degraded';
      issues.push(`High failure rate: ${((stats.failed / totalJobs) * 100).toFixed(1)}%`);
    }
    
    // Check for queue backup
    if (stats.waiting > 50) {
      status = 'degraded';
      issues.push(`Large queue backlog: ${stats.waiting} jobs waiting`);
    }
    
    // Check if processing is stuck
    if (stats.active === 0 && stats.waiting > 0) {
      status = 'unhealthy';
      issues.push('Queue processing appears to be stopped');
    }
    
    const health = {
      status,
      stats,
      issues,
      timestamp: new Date().toISOString()
    };
    
    if (status === 'healthy') {
      ApiResponse.success(res, health);
    } else {
      res.status(status === 'unhealthy' ? 503 : 200).json({
        success: status !== 'unhealthy',
        data: health
      });
    }
  } catch (error) {
    logger.error('Error checking queue health:', error);
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = {
  getQueueStats,
  getApplicationQueueStatus,
  retryFailedJob,
  getFailedJobs,
  cleanOldJobs,
  pauseQueue,
  resumeQueue,
  getQueueHealth
};