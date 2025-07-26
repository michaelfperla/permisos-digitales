// src/services/pdf-queue.service.js
const EventEmitter = require('events');
const { logger } = require('../utils/logger');
const db = require('../db');
const { applicationRepository } = require('../repositories');

class PdfQueueService extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.activeJobs = 0;
    this.maxConcurrent = process.env.MAX_CONCURRENT_PDFS || 2;
    this.processing = false;
    this.jobTimeout = 120000; // 2 minutes timeout per job
    
    logger.info('PDF Queue Service initialized', { maxConcurrent: this.maxConcurrent });
  }

  /**
   * Add a job to the queue
   * @param {Object} job - Job details
   * @param {number} job.applicationId - Application ID
   * @param {Function} job.handler - Function to execute
   * @param {number} job.priority - Priority level (higher = more priority)
   * @returns {Promise} Resolves when job completes
   */
  async addJob(job) {
    const jobId = `${job.applicationId}_${Date.now()}`;
    const queuePosition = this.queue.length + 1;
    
    const jobPromise = new Promise((resolve, reject) => {
      const queuedJob = {
        id: jobId,
        applicationId: job.applicationId,
        handler: job.handler,
        priority: job.priority || 0,
        addedAt: new Date(),
        status: 'queued',
        resolve,
        reject,
        attempts: 0,
        maxAttempts: 3
      };
      
      this.queue.push(queuedJob);
      
      logger.info('Job added to queue', {
        jobId,
        applicationId: job.applicationId,
        queuePosition,
        queueLength: this.queue.length,
        activeJobs: this.activeJobs
      });
    });

    // Update application status to show it's queued
    try {
      await applicationRepository.updateQueueStatus(job.applicationId, {
        queue_position: queuePosition,
        queue_status: 'queued',
        queue_entered_at: new Date()
      });
    } catch (error) {
      logger.error('Failed to update queue status in database', { error, applicationId: job.applicationId });
    }

    // Sort queue by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);
    
    // Start processing if not already running
    this.processQueue();
    
    return jobPromise;
  }

  /**
   * Process jobs in the queue
   */
  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeJobs < this.maxConcurrent) {
      const job = this.queue.shift();
      this.activeJobs++;
      
      // Update queue positions for remaining jobs
      await this.updateQueuePositions();
      
      this.processJob(job).catch(error => {
        logger.error('Job processing failed', { 
          jobId: job.id, 
          applicationId: job.applicationId,
          error 
        });
      });
    }

    this.processing = false;
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    const startTime = Date.now();
    let timeoutId;
    
    try {
      // Update status to processing
      await applicationRepository.updateQueueStatus(job.applicationId, {
        queue_status: 'processing',
        queue_position: 0,
        queue_started_at: new Date()
      });

      logger.info('Processing job', { 
        jobId: job.id, 
        applicationId: job.applicationId,
        activeJobs: this.activeJobs 
      });

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Job timeout after ${this.jobTimeout}ms`));
        }, this.jobTimeout);
      });

      // Execute job with timeout
      const result = await Promise.race([
        job.handler(),
        timeoutPromise
      ]);

      clearTimeout(timeoutId);

      // Update status to completed
      await applicationRepository.updateQueueStatus(job.applicationId, {
        queue_status: 'completed',
        queue_completed_at: new Date(),
        queue_duration_ms: Date.now() - startTime
      });

      job.resolve(result);
      
      logger.info('Job completed successfully', { 
        jobId: job.id, 
        applicationId: job.applicationId,
        duration: Date.now() - startTime 
      });

    } catch (error) {
      clearTimeout(timeoutId);
      
      job.attempts++;
      
      if (job.attempts < job.maxAttempts) {
        logger.warn('Job failed, retrying', { 
          jobId: job.id, 
          applicationId: job.applicationId,
          attempt: job.attempts,
          error: error.message 
        });
        
        // Re-add to queue with delay
        setTimeout(() => {
          this.queue.unshift(job);
          this.processQueue();
        }, 5000 * job.attempts); // Exponential backoff
        
      } else {
        // Final failure
        await applicationRepository.updateQueueStatus(job.applicationId, {
          queue_status: 'failed',
          queue_completed_at: new Date()
        });
        await applicationRepository.updateQueueError(job.applicationId, {
          queue_error: error.message
        });
        
        job.reject(error);
        
        logger.error('Job failed after all retries', { 
          jobId: job.id, 
          applicationId: job.applicationId,
          error 
        });
      }
    } finally {
      this.activeJobs--;
      this.emit('jobComplete', job.id);
      
      // Process next job
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Update queue positions in database
   */
  async updateQueuePositions() {
    try {
      for (let i = 0; i < this.queue.length; i++) {
        await applicationRepository.updateQueueStatus(this.queue[i].applicationId, {
          queue_position: i + 1
        });
      }
    } catch (error) {
      logger.error('Failed to update queue positions', { error });
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeJobs: this.activeJobs,
      maxConcurrent: this.maxConcurrent,
      jobs: this.queue.map(job => ({
        applicationId: job.applicationId,
        status: job.status,
        addedAt: job.addedAt,
        attempts: job.attempts
      }))
    };
  }

  /**
   * Get position in queue for an application
   */
  getQueuePosition(applicationId) {
    const index = this.queue.findIndex(job => job.applicationId === applicationId);
    return index === -1 ? null : index + 1;
  }

  /**
   * Estimate wait time for an application
   */
  getEstimatedWaitTime(applicationId) {
    const position = this.getQueuePosition(applicationId);
    if (!position) return null;
    
    // Estimate 45 seconds per PDF generation
    const estimatedSecondsPerJob = 45;
    const jobsAhead = position - 1 + this.activeJobs;
    const estimatedSeconds = Math.ceil(jobsAhead / this.maxConcurrent) * estimatedSecondsPerJob;
    
    return {
      position,
      estimatedSeconds,
      estimatedMinutes: Math.ceil(estimatedSeconds / 60)
    };
  }

  /**
   * Clear the queue (emergency use only)
   */
  clearQueue() {
    const clearedJobs = this.queue.length;
    this.queue.forEach(job => {
      job.reject(new Error('Queue cleared by administrator'));
    });
    this.queue = [];
    logger.warn('Queue cleared', { clearedJobs });
    return clearedJobs;
  }

  /**
   * Adjust max concurrent jobs (for dynamic scaling)
   */
  setMaxConcurrent(max) {
    this.maxConcurrent = Math.max(1, Math.min(max, 5)); // Between 1-5
    logger.info('Max concurrent jobs updated', { maxConcurrent: this.maxConcurrent });
    this.processQueue(); // Trigger processing if we increased the limit
  }
}

// Export a factory function instead of a singleton
let serviceInstance = null;

module.exports = {
  getInstance: () => {
    if (!serviceInstance) {
      serviceInstance = new PdfQueueService();
    }
    return serviceInstance;
  },
  
  // For direct access if needed
  PdfQueueService
};