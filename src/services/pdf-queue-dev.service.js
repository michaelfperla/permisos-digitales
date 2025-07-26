// src/services/pdf-queue-dev.service.js
// Development PDF queue service - in-memory implementation for local development

const { logger } = require('../utils/logger');
const db = require('../db');
const { applicationRepository } = require('../repositories');

class PdfQueueDevService {
  constructor() {
    this.jobs = new Map(); // jobId -> job object
    this.processing = new Map(); // jobId -> processing promise
    this.isShuttingDown = false;
    this.isPaused = false;
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_PDFS || '2', 10);
    this.currentlyProcessing = 0;
    this.nextJobId = 1;
    
    // Stats tracking
    this.stats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };
    
    // Start background processing
    this.startProcessing();
    
    logger.info('PDF Queue Dev Service initialized (in-memory)', { 
      maxConcurrent: this.maxConcurrent,
      environment: 'development'
    });
  }

  /**
   * Generate a unique job ID
   */
  generateJobId() {
    return `dev_${this.nextJobId++}_${Date.now()}`;
  }

  /**
   * Create a job object with Bull-like interface
   */
  createJob(jobData, options = {}) {
    const jobId = this.generateJobId();
    const timestamp = Date.now();
    
    const job = {
      id: jobId,
      data: jobData,
      opts: {
        attempts: options.attempts || 3,
        backoff: options.backoff || { type: 'exponential', delay: 5000 },
        timeout: options.timeout || 180000,
        priority: options.priority || 0,
        ...options
      },
      timestamp,
      processedOn: null,
      finishedOn: null,
      attemptsMade: 0,
      failedReason: null,
      returnValue: null,
      progress: 0,
      
      // Bull-like methods
      getState: () => {
        if (this.processing.has(jobId)) return 'active';
        if (job.failedReason && job.attemptsMade >= job.opts.attempts) return 'failed';
        if (job.returnValue !== null) return 'completed';
        return 'waiting';
      },
      
      progress: (value) => {
        if (value !== undefined) {
          job.progress = value;
          return job;
        }
        return job.progress;
      },
      
      remove: async () => {
        this.jobs.delete(jobId);
        this.updateStats();
        logger.info('Job removed', { jobId });
      },
      
      retry: async () => {
        if (job.getState() === 'failed') {
          job.attemptsMade = 0;
          job.failedReason = null;
          job.returnValue = null;
          job.progress = 0;
          this.updateStats();
          logger.info('Job retry initiated', { jobId });
          this.processNext(); // Try to process immediately
        }
      },
      
      discard: () => {
        job.attemptsMade = job.opts.attempts; // Force to max attempts
        logger.info('Job discarded', { jobId });
      }
    };
    
    return job;
  }

  /**
   * Add a job to the queue with proper status synchronization
   */
  async addJob(jobData) {
    const { applicationId, priority = 0, userId, metadata = {} } = jobData;
    
    try {
      logger.info('[QUEUE] Adding job to dev queue', {
        applicationId,
        userId,
        priority,
        metadata
      });
      
      // Skip status check if called from webhook (webhook has already verified status within transaction)
      if (metadata.source !== 'stripe_webhook' && metadata.source !== 'stripe_webhook_post_commit') {
        // Check current application status
        const app = await applicationRepository.getApplicationQueueStatus(applicationId);
        
        if (!app) {
          throw new Error(`Application ${applicationId} not found`);
        }
        
        const currentStatus = app.status;
        const currentQueueStatus = app.queue_status;
        
        logger.info('[QUEUE] Current application status', {
          applicationId,
          currentStatus,
          currentQueueStatus
        });
        
        // Validate status - must be PAYMENT_RECEIVED or GENERATING_PERMIT
        if (currentStatus !== 'PAYMENT_RECEIVED' && currentStatus !== 'GENERATING_PERMIT') {
          logger.error('[QUEUE] Invalid application status for PDF generation', {
            applicationId,
            currentStatus,
            expectedStatuses: ['PAYMENT_RECEIVED', 'GENERATING_PERMIT']
          });
          throw new Error(`Cannot queue PDF for application in status: ${currentStatus}`);
        }
      } else {
        logger.info('[QUEUE] Skipping status check for webhook-triggered job', {
          applicationId,
          source: metadata.source
        });
      }
      
      // Check for duplicate jobs
      const existingJob = Array.from(this.jobs.values()).find(
        job => job.data.applicationId === applicationId && job.getState() !== 'completed' && job.getState() !== 'failed'
      );
      
      if (existingJob) {
        logger.warn('[QUEUE] Duplicate job detected, returning existing job', {
          applicationId,
          existingJobId: existingJob.id,
          existingJobState: existingJob.getState()
        });
        
        // Ensure status is updated even for duplicate
        await applicationRepository.updateQueueStatus(applicationId, {
          status: 'GENERATING_PERMIT',
          queue_status: 'queued'
        });
        
        return existingJob;
      }
      
      // Create new job
      const job = this.createJob({
        applicationId,
        userId,
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          addedAt: new Date().toISOString(),
          source: metadata.source || 'unknown'
        }
      }, {
        priority,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        timeout: 180000
      });
      
      // Add to queue
      this.jobs.set(job.id, job);
      this.updateStats();
      
      // Calculate queue position
      const position = this.getQueuePosition(job.id);
      
      // Update database status
      const updateResult = await applicationRepository.updateQueueStatus(applicationId, {
        status: 'GENERATING_PERMIT',
        queue_status: 'queued',
        queue_position: position,
        queue_entered_at: new Date(),
        queue_job_id: job.id
      });
      
      if (!updateResult) {
        this.jobs.delete(job.id);
        this.updateStats();
        throw new Error(`Failed to update application ${applicationId} status`);
      }
      
      logger.info('[QUEUE] Job successfully added to dev queue', {
        jobId: job.id,
        applicationId,
        priority,
        position,
        newStatus: 'GENERATING_PERMIT',
        newQueueStatus: 'queued'
      });
      
      // Trigger processing
      this.processNext();
      
      return job;
      
    } catch (error) {
      logger.error('[QUEUE] Failed to add job to dev queue', {
        applicationId,
        error: error.message,
        stack: error.stack
      });
      
      // Update application with error status
      try {
        await applicationRepository.updateQueueError(applicationId, {
          queue_error: error.message
        });
      } catch (updateError) {
        logger.error('[QUEUE] Failed to update error status', {
          applicationId,
          error: updateError.message
        });
      }
      
      throw error;
    }
  }

  /**
   * Get queue position for a job
   */
  getQueuePosition(jobId) {
    const waitingJobs = Array.from(this.jobs.values())
      .filter(job => job.getState() === 'waiting')
      .sort((a, b) => b.opts.priority - a.opts.priority || a.timestamp - b.timestamp);
    
    const position = waitingJobs.findIndex(job => job.id === jobId);
    return position === -1 ? null : position + 1;
  }

  /**
   * Get queue status for an application
   */
  async getApplicationQueueStatus(applicationId) {
    try {
      const job = Array.from(this.jobs.values()).find(
        j => j.data.applicationId === applicationId
      );
      
      if (!job) {
        return null;
      }
      
      const state = job.getState();
      const position = state === 'waiting' ? this.getQueuePosition(job.id) : 0;
      
      return {
        jobId: job.id,
        applicationId,
        state,
        position,
        progress: job.progress,
        attempts: job.attemptsMade,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        failedReason: job.failedReason
      };
    } catch (error) {
      logger.error('Failed to get application queue status', {
        applicationId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get estimated wait time for an application
   */
  async getEstimatedWaitTime(applicationId) {
    const status = await this.getApplicationQueueStatus(applicationId);
    if (!status || status.state !== 'waiting') {
      return null;
    }
    
    // Simple estimation: 45 seconds per job
    const avgProcessingTime = 45000;
    const batchNumber = Math.ceil(status.position / this.maxConcurrent);
    const estimatedMs = batchNumber * avgProcessingTime;
    
    return {
      position: status.position,
      estimatedSeconds: Math.ceil(estimatedMs / 1000),
      estimatedMinutes: Math.ceil(estimatedMs / 60000)
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    this.updateStats();
    return {
      ...this.stats,
      total: this.stats.waiting + this.stats.active + this.stats.delayed,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * Update internal statistics
   */
  updateStats() {
    const jobs = Array.from(this.jobs.values());
    this.stats = {
      waiting: jobs.filter(job => job.getState() === 'waiting').length,
      active: jobs.filter(job => job.getState() === 'active').length,
      completed: jobs.filter(job => job.getState() === 'completed').length,
      failed: jobs.filter(job => job.getState() === 'failed').length,
      delayed: 0 // Not implemented in dev version
    };
  }

  /**
   * Retry a failed job
   */
  async retryJob(applicationId) {
    try {
      const job = Array.from(this.jobs.values()).find(
        j => j.data.applicationId === applicationId && j.getState() === 'failed'
      );
      
      if (!job) {
        throw new Error('No failed job found for this application');
      }
      
      await job.retry();
      logger.info('Job retry initiated', {
        jobId: job.id,
        applicationId
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to retry job', {
        applicationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Pause/resume queue processing
   */
  async pauseQueue() {
    this.isPaused = true;
    logger.warn('Dev queue processing paused');
  }

  async resumeQueue() {
    this.isPaused = false;
    logger.info('Dev queue processing resumed');
    this.processNext(); // Resume processing
  }

  /**
   * Start background processing
   */
  startProcessing() {
    const processInterval = setInterval(() => {
      if (!this.isShuttingDown && !this.isPaused) {
        this.processNext();
      }
    }, 1000); // Check every second
    
    // Clean up interval on shutdown
    this.processInterval = processInterval;
  }

  /**
   * Process next available job
   */
  async processNext() {
    if (this.isPaused || this.isShuttingDown || this.currentlyProcessing >= this.maxConcurrent) {
      return;
    }
    
    // Get next waiting job (highest priority first, then FIFO)
    const waitingJobs = Array.from(this.jobs.values())
      .filter(job => job.getState() === 'waiting')
      .sort((a, b) => b.opts.priority - a.opts.priority || a.timestamp - b.timestamp);
    
    if (waitingJobs.length === 0) {
      return;
    }
    
    const job = waitingJobs[0];
    this.currentlyProcessing++;
    this.processing.set(job.id, this.processJob(job));
    
    try {
      await this.processing.get(job.id);
    } catch (error) {
      logger.error('Error in job processing', { jobId: job.id, error: error.message });
    } finally {
      this.processing.delete(job.id);
      this.currentlyProcessing--;
      this.updateStats();
      
      // Try to process next job
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    const { applicationId } = job.data;
    
    try {
      job.processedOn = Date.now();
      job.attemptsMade++;
      
      logger.info('Processing PDF generation job', {
        jobId: job.id,
        applicationId,
        attempt: job.attemptsMade
      });
      
      // Emit 'active' event
      await this.updateDatabaseStatus(applicationId, 'processing', job.id);
      
      // Load the puppeteer service
      const puppeteerService = require('./permit-generation-orchestrator.service');
      
      // Process the job
      const result = await puppeteerService.generatePermit(applicationId);
      
      // Update progress
      job.progress = 100;
      job.returnValue = {
        success: true,
        applicationId,
        result
      };
      job.finishedOn = Date.now();
      
      // Emit 'completed' event
      await this.updateDatabaseStatus(applicationId, 'completed', job.id, result);
      
      logger.info('PDF generation completed', {
        jobId: job.id,
        applicationId,
        duration: job.finishedOn - job.processedOn,
        attempts: job.attemptsMade
      });
      
      return result;
      
    } catch (error) {
      job.failedReason = error.message;
      job.finishedOn = Date.now();
      
      const willRetry = job.attemptsMade < job.opts.attempts;
      
      logger.error('PDF generation failed', {
        jobId: job.id,
        applicationId,
        error: error.message,
        attempts: job.attemptsMade,
        willRetry
      });
      
      // Update database
      const isFinalFailure = !willRetry;
      await this.updateDatabaseStatus(applicationId, isFinalFailure ? 'failed' : 'pending', job.id, null, error.message);
      
      if (willRetry) {
        // Schedule retry with exponential backoff
        const delay = Math.pow(2, job.attemptsMade - 1) * job.opts.backoff.delay;
        setTimeout(() => {
          if (!this.isShuttingDown) {
            job.processedOn = null;
            job.finishedOn = null;
            this.processNext();
          }
        }, delay);
      }
      
      throw error;
    }
  }

  /**
   * Update database status for job lifecycle events
   */
  async updateDatabaseStatus(applicationId, status, jobId, result = null, error = null) {
    try {
      switch (status) {
        case 'processing':
          await applicationRepository.updateQueueStatus(applicationId, {
            queue_status: 'processing',
            queue_position: 0,
            queue_started_at: new Date()
          });
          break;
          
        case 'completed':
          // Calculate duration if we have start time
          const app = await applicationRepository.getApplicationQueueStatus(applicationId);
          let duration_ms = null;
          if (app && app.queue_started_at) {
            duration_ms = Date.now() - new Date(app.queue_started_at).getTime();
          }
          
          await applicationRepository.updateQueueStatus(applicationId, {
            queue_status: 'completed',
            queue_completed_at: new Date(),
            queue_duration_ms: duration_ms
          });
          break;
          
        case 'failed':
          await applicationRepository.updateQueueStatus(applicationId, {
            queue_status: 'failed',
            queue_completed_at: new Date()
          });
          if (error) {
            await applicationRepository.updateQueueError(applicationId, {
              queue_error: error
            });
          }
          break;
          
        case 'pending':
          await applicationRepository.updateQueueStatus(applicationId, {
            queue_status: 'pending'
          });
          if (error) {
            await applicationRepository.updateQueueError(applicationId, {
              queue_error: error
            });
          }
          break;
      }
    } catch (dbError) {
      logger.error('Failed to update database status', {
        applicationId,
        status,
        error: dbError.message
      });
    }
  }

  /**
   * Clean old jobs (simplified for dev)
   */
  async cleanOldJobs(gracePeriodMs = 86400000) { // 24 hours default
    try {
      const cutoffTime = Date.now() - gracePeriodMs;
      let removedCount = 0;
      
      for (const [jobId, job] of this.jobs) {
        if (job.finishedOn && job.finishedOn < cutoffTime) {
          this.jobs.delete(jobId);
          removedCount++;
        }
      }
      
      this.updateStats();
      logger.info('Cleaned old jobs', { removedCount });
      return removedCount;
    } catch (error) {
      logger.error('Failed to clean old jobs', error);
      return 0;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down PDF dev queue service...');
    this.isShuttingDown = true;
    
    // Clear processing interval
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }
    
    // Wait for active jobs to complete (max 2 minutes)
    let waitTime = 0;
    while (this.currentlyProcessing > 0 && waitTime < 120000) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      waitTime += 5000;
      logger.info(`Waiting for ${this.currentlyProcessing} active jobs to complete...`);
    }
    
    // Clear all jobs
    this.jobs.clear();
    this.processing.clear();
    
    logger.info('PDF dev queue service shut down complete');
  }
}

// Create singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new PdfQueueDevService();
    }
    return instance;
  },
  
  // Export for testing
  PdfQueueDevService
};