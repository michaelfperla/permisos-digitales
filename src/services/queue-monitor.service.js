// src/services/queue-monitor.service.js
const { logger } = require('../utils/logger');
const { monitoringRepository } = require('../repositories');

class QueueMonitorService {
  constructor() {
    this.metricsInterval = null;
    this.metricsFrequency = 60000; // Log metrics every minute
  }

  /**
   * Start monitoring the queue
   */
  start() {
    logger.info('Starting queue monitoring service');
    
    try {
      // FIX: Safely get the queue service instance
      const { getInstance } = require('./pdf-queue.service');
      this.pdfQueueService = getInstance();
      
      // FIX: Check if service actually exists and has event methods
      if (this.pdfQueueService && typeof this.pdfQueueService.on === 'function') {
        // Listen to queue events
        this.pdfQueueService.on('jobComplete', (jobId) => {
          logger.debug('Queue job completed', { jobId });
        });
      } else {
        logger.warn('[QueueMonitor] PDF queue service not available or missing event support');
      }
      
      // Log metrics periodically
      this.metricsInterval = setInterval(() => {
        this.logMetrics();
      }, this.metricsFrequency);
    } catch (error) {
      logger.error('[QueueMonitor] Failed to start monitoring:', error);
      // FIX: Don't throw, allow monitor to be partially functional
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    logger.info('Stopped queue monitoring service');
  }

  /**
   * Log queue metrics to database and logs
   */
  async logMetrics() {
    try {
      // FIX: Check if service exists before using it
      if (!this.pdfQueueService) {
        logger.debug('[QueueMonitor] PDF queue service not available, skipping metrics');
        return;
      }
      
      const status = this.pdfQueueService.getStatus();
      
      // Get queue health data and store metrics
      const healthData = await monitoringRepository.getQueueHealth();
      
      // Store metrics in database using repository
      await monitoringRepository.storeQueueMetrics({
        queueLength: status.queueLength,
        activeJobs: status.activeJobs,
        averageWaitTimeMs: healthData.avg_wait_time_ms || 0,
        averageProcessingTimeMs: healthData.avg_processing_time_ms || 0,
        totalCompleted: healthData.completed_count || 0,
        totalFailed: healthData.failed_count || 0
      });
      
      // Log to console/logs
      logger.info('Queue metrics', {
        queue: {
          length: status.queueLength,
          active: status.activeJobs,
          max: status.maxConcurrent,
          utilization: `${Math.round((status.activeJobs / status.maxConcurrent) * 100)}%`
        },
        performance: {
          avgWaitTime: `${Math.round((healthData.avg_wait_time_ms || 0) / 1000)}s`,
          avgProcessingTime: `${Math.round((healthData.avg_processing_time_ms || 0) / 1000)}s`,
          completedLastHour: healthData.completed_count || 0,
          failedLastHour: healthData.failed_count || 0
        }
      });
      
      // Alert if queue is getting too long
      if (status.queueLength > 10) {
        logger.warn('Queue length is high', { queueLength: status.queueLength });
        // Could send alert to admin here
      }
      
    } catch (error) {
      logger.error('Error logging queue metrics', error);
    }
  }

  /**
   * Get queue health status
   */
  async getHealthStatus() {
    try {
      // FIX: Get the queue service safely
      const { getInstance } = require('./pdf-queue.service');
      const pdfQueueService = getInstance();
      
      if (!pdfQueueService) {
        return {
          status: 'error',
          message: 'PDF queue service not available'
        };
      }
      
      const status = pdfQueueService.getStatus();
      
      // Get health data from repository
      const healthData = await monitoringRepository.getQueueHealth();
      const failureRate = parseFloat(healthData.failure_rate_percent || 0) / 100;
      
      const health = {
        status: 'healthy',
        queueLength: status.queueLength,
        activeJobs: status.activeJobs,
        utilization: Math.round((status.activeJobs / status.maxConcurrent) * 100),
        failureRate: Math.round(failureRate * 100),
        checks: []
      };
      
      // Health checks
      if (status.queueLength > 20) {
        health.status = 'degraded';
        health.checks.push('Queue length is very high');
      }
      
      if (failureRate > 0.1) {
        health.status = 'degraded';
        health.checks.push(`High failure rate: ${Math.round(failureRate * 100)}%`);
      }
      
      if (status.activeJobs === 0 && status.queueLength > 0) {
        health.status = 'unhealthy';
        health.checks.push('Queue is not processing jobs');
      }
      
      return health;
    } catch (error) {
      logger.error('Error checking queue health', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

// Create singleton instance
const queueMonitorService = new QueueMonitorService();

module.exports = queueMonitorService;