// src/services/pdf-queue-bull.service.js
const Queue = require('bull');
const { logger } = require('../utils/logger');
const unifiedConfig = require('../config/unified-config');
const config = unifiedConfig.getSync();
const db = require('../db');
const { applicationRepository } = require('../repositories');

// Use centralized Redis configuration from config module
const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  
  // Use TLS configuration from config module when available
  ...(config.redis.tls && { tls: config.redis.tls }),
  
  // Bull-specific retry strategy (overrides config default)
  retryStrategy: config.redis.bull?.retryStrategy || ((times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
    return delay;
  }),
  
  // Bull-specific options from config
  ...(config.redis.bull && {
    maxRetriesPerRequest: config.redis.bull.maxRetriesPerRequest,
    enableReadyCheck: config.redis.bull.enableReadyCheck
  })
};

// Log Redis configuration for debugging
logger.debug('Bull Queue Redis Configuration', {
  host: redisConfig.host,
  port: redisConfig.port,
  hasTLS: !!redisConfig.tls,
  tlsServername: redisConfig.tls?.servername,
  hasPassword: !!redisConfig.password,
  bullSpecificOptions: !!config.redis.bull
});

class PdfQueueBullService {
  constructor() {
    // Initialize properties but don't create queue yet
    this.queue = null;
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_PDFS || '2', 10);
    this.initialized = false;
    
    logger.info('PDF Queue Bull Service created (not yet initialized)');
  }

  /**
   * Initialize the Bull queue (call during server startup)
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing PDF Queue Bull Service...');
    
    // Create Bull queue with Redis
    this.queue = new Queue('pdf-generation', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000 // Start with 5 seconds, then 10s, 20s
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500 // Keep last 500 failed jobs for debugging
      }
    });

    this.setupEventHandlers();
    this.startProcessing();
    this.initialized = true;
    
    logger.info('PDF Queue Bull Service initialized', { 
      maxConcurrent: this.maxConcurrent,
      redisHost: redisConfig.host,
      redisPort: redisConfig.port,
      redisTLS: !!redisConfig.tls,
      tlsServername: redisConfig.tls?.servername
    });
  }

  /**
   * Set up queue event handlers
   */
  setupEventHandlers() {
    // Job lifecycle events
    this.queue.on('completed', async (job, result) => {
      logger.info('PDF generation completed', {
        jobId: job.id,
        applicationId: job.data.applicationId,
        duration: Date.now() - job.timestamp,
        attempts: job.attemptsMade
      });
      
      // Update database
      try {
        await applicationRepository.updateQueueStatus(job.data.applicationId, {
          queue_status: 'completed',
          queue_completed_at: new Date(),
          queue_duration_ms: Date.now() - job.timestamp
        });
      } catch (error) {
        logger.error('Failed to update completed status in database', error);
      }
    });

    this.queue.on('failed', async (job, err) => {
      logger.error('PDF generation failed', {
        jobId: job.id,
        applicationId: job.data.applicationId,
        error: err.message,
        attempts: job.attemptsMade,
        willRetry: job.attemptsMade < job.opts.attempts
      });
      
      // Update database
      try {
        const isFinalFailure = job.attemptsMade >= job.opts.attempts;
        await applicationRepository.updateQueueStatus(job.data.applicationId, {
          queue_status: isFinalFailure ? 'failed' : 'pending',
          ...(isFinalFailure && { queue_completed_at: new Date() })
        });
        await applicationRepository.updateQueueError(job.data.applicationId, {
          queue_error: err.message
        });
      } catch (error) {
        logger.error('Failed to update failed status in database', error);
      }
    });

    this.queue.on('active', async (job) => {
      logger.info('PDF generation started', {
        jobId: job.id,
        applicationId: job.data.applicationId
      });
      
      // Update database
      try {
        await applicationRepository.updateQueueStatus(job.data.applicationId, {
          queue_status: 'processing',
          queue_position: 0,
          queue_started_at: new Date()
        });
      } catch (error) {
        logger.error('Failed to update processing status in database', error);
      }
    });

    this.queue.on('stalled', (job) => {
      logger.warn('PDF generation stalled', {
        jobId: job.id,
        applicationId: job.data.applicationId
      });
    });

    this.queue.on('error', (error) => {
      logger.error('Queue error', error);
    });

    // Monitor queue health
    setInterval(() => this.logQueueStats(), 60000); // Every minute
  }

  /**
   * Start processing jobs
   */
  async startProcessing() {
    const puppeteerService = require('./permit-generation-orchestrator.service');
    
    // Process jobs with concurrency limit
    this.queue.process('generate-permit', this.maxConcurrent, async (job) => {
      const { applicationId } = job.data;
      
      logger.info('Processing PDF generation job', {
        jobId: job.id,
        applicationId,
        attempt: job.attemptsMade + 1
      });
      
      try {
        // Call puppeteer service
        const result = await puppeteerService.generatePermit(applicationId);
        
        // Update job progress
        job.progress(100);
        
        return {
          success: true,
          applicationId,
          result
        };
      } catch (error) {
        // Check if it's a government site issue
        if (error.message?.includes('gobierno') || 
            error.message?.includes('timeout') ||
            error.message?.includes('navigation')) {
          // These are retryable errors
          throw error;
        }
        
        // Non-retryable errors (bad data, etc)
        if (error.message?.includes('invalid') || 
            error.message?.includes('not found')) {
          // Mark job as failed without retry
          job.discard();
          throw error;
        }
        
        throw error;
      }
    });
  }

  /**
   * Add a job to the queue with proper status synchronization
   */
  async addJob(jobData) {
    // Auto-initialize if needed
    if (!this.initialized) {
      await this.initialize();
    }

    const { applicationId, priority = 0, userId, metadata = {} } = jobData;
    
    try {
      logger.info('[QUEUE] Adding job to queue', {
        applicationId,
        userId,
        priority,
        metadata
      });
      
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
      
      // Check if job already exists for this application
      const existingJobs = await this.queue.getJobs(['waiting', 'active', 'delayed']);
      const duplicate = existingJobs.find(job => job.data.applicationId === applicationId);
      
      if (duplicate) {
        logger.warn('[QUEUE] Duplicate job detected, returning existing job', {
          applicationId,
          existingJobId: duplicate.id,
          existingJobState: await duplicate.getState()
        });
        
        // Ensure status is updated even for duplicate
        await applicationRepository.updateQueueStatus(applicationId, {
          status: 'GENERATING_PERMIT',
          queue_status: 'queued'
        });
        
        return duplicate;
      }
      
      // Add job to queue
      const job = await this.queue.add('generate-permit', {
        applicationId,
        userId,
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          addedAt: new Date().toISOString(),
          source: metadata.source || 'unknown'
        }
      }, {
        priority, // Higher priority = processed first
        delay: 0, // Start immediately
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        timeout: 180000, // 3 minutes
        removeOnComplete: 100,
        removeOnFail: false // Keep failed jobs for debugging
      });
      
      // Calculate queue position
      const position = await this.getQueuePosition(job.id);
      
      // CRITICAL: Update BOTH status and queue_status atomically
      const updateResult = await applicationRepository.updateQueueStatus(applicationId, {
        status: 'GENERATING_PERMIT',
        queue_status: 'queued',
        queue_position: position,
        queue_entered_at: new Date(),
        queue_job_id: job.id
      });
      
      if (!updateResult) {
        // This should never happen, but if it does, remove the job
        await job.remove();
        throw new Error(`Failed to update application ${applicationId} status`);
      }
      
      logger.info('[QUEUE] Job successfully added and status updated', {
        jobId: job.id,
        applicationId,
        priority,
        position,
        newStatus: 'GENERATING_PERMIT',
        newQueueStatus: 'queued'
      });
      
      return job;
      
    } catch (error) {
      logger.error('[QUEUE] Failed to add job to queue', {
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
  async getQueuePosition(jobId) {
    const waitingJobs = await this.queue.getWaiting();
    const position = waitingJobs.findIndex(job => job.id === jobId);
    return position === -1 ? null : position + 1;
  }

  /**
   * Get queue status for an application
   */
  async getApplicationQueueStatus(applicationId) {
    try {
      // Find job by application ID
      const jobs = await this.queue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
      const job = jobs.find(j => j.data.applicationId === applicationId);
      
      if (!job) {
        return null;
      }
      
      const state = await job.getState();
      const position = state === 'waiting' ? await this.getQueuePosition(job.id) : 0;
      
      return {
        jobId: job.id,
        applicationId,
        state,
        position,
        progress: job.progress(),
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
    
    // Get average processing time from recent jobs
    const recentCompleted = await this.queue.getCompleted(0, 20);
    let avgProcessingTime = 45000; // Default 45 seconds
    
    if (recentCompleted.length > 0) {
      const totalTime = recentCompleted.reduce((sum, job) => {
        return sum + (job.finishedOn - job.processedOn);
      }, 0);
      avgProcessingTime = totalTime / recentCompleted.length;
    }
    
    // Calculate based on position and concurrency
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
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount()
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * Log queue statistics
   */
  async logQueueStats() {
    try {
      const stats = await this.getQueueStats();
      logger.info('Queue statistics', stats);
    } catch (error) {
      logger.error('Failed to get queue stats', error);
    }
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(gracePeriodMs = 86400000) { // 24 hours default
    try {
      const completedJobs = await this.queue.getCompleted();
      const failedJobs = await this.queue.getFailed();
      const cutoffTime = Date.now() - gracePeriodMs;
      
      let removedCount = 0;
      
      // Remove old completed jobs
      for (const job of completedJobs) {
        if (job.finishedOn < cutoffTime) {
          await job.remove();
          removedCount++;
        }
      }
      
      // Remove old failed jobs
      for (const job of failedJobs) {
        if (job.finishedOn < cutoffTime) {
          await job.remove();
          removedCount++;
        }
      }
      
      logger.info('Cleaned old jobs', { removedCount });
      return removedCount;
    } catch (error) {
      logger.error('Failed to clean old jobs', error);
      return 0;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(applicationId) {
    try {
      const jobs = await this.queue.getFailed();
      const job = jobs.find(j => j.data.applicationId === applicationId);
      
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
    await this.queue.pause();
    logger.warn('Queue processing paused');
  }

  async resumeQueue() {
    await this.queue.resume();
    logger.info('Queue processing resumed');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down PDF queue service...');
    
    // Stop accepting new jobs
    await this.queue.pause(true);
    
    // Wait for active jobs to complete (max 2 minutes)
    let activeCount = await this.queue.getActiveCount();
    let waitTime = 0;
    
    while (activeCount > 0 && waitTime < 120000) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      waitTime += 5000;
      activeCount = await this.queue.getActiveCount();
      logger.info(`Waiting for ${activeCount} active jobs to complete...`);
    }
    
    // Close the queue
    await this.queue.close();
    logger.info('PDF queue service shut down complete');
  }
}

// Create singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new PdfQueueBullService();
    }
    return instance;
  },
  
  // Export for testing
  PdfQueueBullService
};