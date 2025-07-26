/**
 * Email Queue Service
 * 
 * Manages email queuing, processing, and delivery using Bull queue
 * Similar to PDF queue but optimized for email delivery
 */

const Bull = require('bull');
const unifiedConfig = require('../config/unified-config');
const { logger } = require('../utils/logger');
const redisClient = require('../utils/redis-client');
const {
  emailQueueRepository,
  emailHistoryRepository,
  emailTemplateRepository,
  emailBlacklistRepository
} = require('../repositories/queue.repository');

// Priority levels
const PRIORITY = {
  IMMEDIATE: 1,  // Password reset, verification
  HIGH: 2,       // Payment confirmations
  NORMAL: 3,     // General notifications
  LOW: 4         // Marketing, reminders
};

// Email types to priority mapping
const EMAIL_TYPE_PRIORITY = {
  'password-reset': PRIORITY.IMMEDIATE,
  'email-verification': PRIORITY.IMMEDIATE,
  'payment-confirmation': PRIORITY.HIGH,
  'permit-ready': PRIORITY.HIGH,
  'permit-expiration': PRIORITY.NORMAL,
  'oxxo-reminder': PRIORITY.NORMAL,
  'application-expiration': PRIORITY.HIGH
};

class EmailQueueService {
  constructor() {
    this.queue = null;
    this.statusSyncQueue = null;
    this.isProcessing = false;
    this.sesRateLimit = 14; // SES allows 14 emails/second
    this.lastSendTime = 0;
    this._config = null;
  }

  /**
   * Lazy load configuration to avoid race conditions
   */
  _getConfig() {
    if (!this._config) {
      this._config = unifiedConfig.getSync();
    }
    return this._config;
  }

  /**
   * Initialize the email queue
   */
  async initialize() {
    try {
      // FIX: Check if Redis is available before creating Bull queues
      const redisAvailable = await this.checkRedisAvailability();
      
      if (!redisAvailable) {
        logger.warn('[EmailQueue] Redis not available, email queue service will be disabled');
        this.queue = null;
        this.statusSyncQueue = null;
        return;
      }

      // Create main email queue
      const config = this._getConfig();
      this.queue = new Bull('email-queue', {
        redis: {
          port: config.redis.port,
          host: config.redis.host,
          password: config.redis.password,
          tls: config.redis.tls
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 1000,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000 // Start with 5 second delay
          }
        }
      });

      // Create status sync queue
      this.statusSyncQueue = new Bull('email-status-sync', {
        redis: {
          port: config.redis.port,
          host: config.redis.host,
          password: config.redis.password,
          tls: config.redis.tls
        }
      });

      // Set up processors
      this.setupProcessors();

      // Set up event handlers
      this.setupEventHandlers();

      // Clean up old completed jobs periodically
      setInterval(() => this.cleanOldJobs(), 60 * 60 * 1000); // Every hour

      logger.info('[EmailQueue] Email queue service initialized');
    } catch (error) {
      logger.error('[EmailQueue] Failed to initialize email queue', {
        error: error.message
      });
      // FIX: Don't re-throw, allow service to be partially functional
      this.queue = null;
      this.statusSyncQueue = null;
    }
  }

  /**
   * FIX: Check Redis availability
   */
  async checkRedisAvailability() {
    try {
      // Check if Redis client has a ping method
      if (redisClient.ping) {
        await redisClient.ping();
        return true;
      }
      
      // Check if Redis client has a getStatus method (from fault-tolerant wrapper)
      if (redisClient.getStatus) {
        const status = redisClient.getStatus();
        return status && status.healthy;
      }
      
      // Try a simple get operation as health check
      await redisClient.get('health-check-key');
      return true;
    } catch (error) {
      logger.error('[EmailQueue] Redis availability check failed:', error);
      return false;
    }
  }

  /**
   * Set up queue processors
   */
  setupProcessors() {
    // Main email processor
    this.queue.process('send-email', 5, async (job) => {
      return await this.processEmail(job);
    });

    // Status sync processor
    this.statusSyncQueue.process('sync-status', async (job) => {
      return await this.syncEmailStatus(job);
    });
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    this.queue.on('completed', async (job, result) => {
      logger.info('[EmailQueue] Email sent successfully', {
        jobId: job.id,
        emailId: job.data.emailId,
        recipient: job.data.recipient
      });

      // Schedule status sync
      await this.statusSyncQueue.add('sync-status', {
        emailId: job.data.emailId,
        sesMessageId: result.messageId
      }, {
        delay: 5000 // Check status after 5 seconds
      });
    });

    this.queue.on('failed', (job, err) => {
      logger.error('[EmailQueue] Email job failed', {
        jobId: job.id,
        emailId: job.data.emailId,
        attempt: job.attemptsMade,
        error: err.message
      });
    });

    this.queue.on('stalled', (job) => {
      logger.warn('[EmailQueue] Email job stalled', {
        jobId: job.id,
        emailId: job.data.emailId
      });
    });
  }

  /**
   * Add email to queue
   */
  async queueEmail({
    to,
    subject,
    template,
    templateData = {},
    htmlBody,
    textBody,
    priority,
    scheduledFor,
    metadata = {},
    deduplicate = true
  }) {
    try {
      // FIX: Check if queue is available
      if (!this.queue) {
        logger.warn('[EmailQueue] Queue not initialized, cannot queue email', { to, subject });
        return { error: 'Queue service unavailable' };
      }

      // Validate recipient
      if (!to || !this.isValidEmail(to)) {
        throw new Error('Invalid recipient email address');
      }

      // Check blacklist
      const isBlacklisted = await emailBlacklistRepository.isBlacklisted(to);
      if (isBlacklisted) {
        logger.warn('[EmailQueue] Email blocked - recipient blacklisted', { to });
        return { blocked: true, reason: 'blacklisted' };
      }

      // Check for duplicates if requested
      if (deduplicate) {
        const isDuplicate = await emailQueueRepository.isDuplicate(
          to,
          subject,
          template,
          60 // Within last 60 minutes
        );
        if (isDuplicate) {
          logger.debug('[EmailQueue] Duplicate email skipped', { to, subject });
          return { skipped: true, reason: 'duplicate' };
        }
      }

      // Determine priority
      const emailPriority = priority || this.getEmailPriority(template) || 'normal';

      // Get template if specified
      let processedContent = { subject, htmlBody, textBody };
      if (template) {
        processedContent = await this.processTemplate(template, templateData, subject);
      }

      // Store in database
      const emailRecord = await emailQueueRepository.enqueue({
        recipientEmail: to,
        recipientName: templateData.name || null,
        subject: processedContent.subject,
        templateName: template,
        templateData,
        htmlBody: processedContent.htmlBody,
        textBody: processedContent.textBody,
        priority: emailPriority,
        scheduledFor,
        metadata
      });

      // Add to Bull queue
      const jobOptions = {
        priority: this.getPriorityValue(emailPriority),
        delay: scheduledFor ? new Date(scheduledFor) - new Date() : 0
      };

      const job = await this.queue.add('send-email', {
        emailId: emailRecord.id,
        recipient: to,
        subject: processedContent.subject
      }, jobOptions);

      logger.info('[EmailQueue] Email queued', {
        emailId: emailRecord.id,
        jobId: job.id,
        recipient: to,
        priority: emailPriority
      });

      return {
        success: true,
        emailId: emailRecord.id,
        jobId: job.id
      };
    } catch (error) {
      logger.error('[EmailQueue] Failed to queue email', {
        error: error.message,
        to,
        subject
      });
      throw error;
    }
  }

  /**
   * Process email job
   */
  async processEmail(job) {
    const { emailId } = job.data;

    try {
      // Get email from database
      const email = await emailQueueRepository.findById(emailId);
      if (!email) {
        throw new Error('Email not found in database');
      }

      // Update status to processing
      await emailQueueRepository.updateStatus(emailId, 'processing');

      // Rate limiting for SES
      await this.enforceRateLimit();

      // Prepare email data
      const emailData = {
        to: email.recipient_email,
        subject: email.subject,
        html: email.html_body,
        text: email.text_body
      };

      // FIX: Lazy load email service to avoid circular dependency
      // Load inside function to break circular dependency at module load time
      const emailService = require('./email.service');
      
      // Send email
      const result = await emailService.sendEmail(
        emailData.to,
        emailData.subject,
        emailData.html,
        emailData.text
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to send email');
      }

      // Update database
      await emailQueueRepository.markAsSent(emailId, result.messageId);

      // Record in history
      const config = this._getConfig();
      await emailHistoryRepository.recordEmail(email, {
        fromEmail: config.services.email.from,
        sesMessageId: result.messageId
      });

      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      // Update failure in database
      await emailQueueRepository.markAsFailed(
        emailId,
        error,
        job.attemptsMade < job.opts.attempts
      );

      throw error;
    }
  }

  /**
   * Sync email status from SES
   */
  async syncEmailStatus(job) {
    const { emailId, sesMessageId } = job.data;

    try {
      // This is where you would check SES for delivery status
      // For now, we'll just mark as delivered
      // In production, integrate with SES event webhooks

      await emailHistoryRepository.updateDeliveryStatus(
        sesMessageId,
        'delivered',
        new Date()
      );

      logger.debug('[EmailQueue] Email status synced', {
        emailId,
        sesMessageId
      });
    } catch (error) {
      logger.error('[EmailQueue] Failed to sync email status', {
        error: error.message,
        emailId,
        sesMessageId
      });
    }
  }

  /**
   * Process template
   */
  async processTemplate(templateName, data, defaultSubject) {
    try {
      const template = await emailTemplateRepository.getTemplate(templateName);
      if (!template) {
        logger.warn('[EmailQueue] Template not found, using provided content', {
          templateName
        });
        return {
          subject: defaultSubject,
          htmlBody: null,
          textBody: null
        };
      }

      // Replace variables in template
      let htmlBody = template.html_body;
      let textBody = template.text_body || '';
      let subject = template.subject;

      // Simple variable replacement
      Object.keys(data).forEach(key => {
        const value = data[key] || '';
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        htmlBody = htmlBody.replace(regex, value);
        textBody = textBody.replace(regex, value);
        subject = subject.replace(regex, value);
      });

      return { subject, htmlBody, textBody };
    } catch (error) {
      logger.error('[EmailQueue] Template processing failed', {
        error: error.message,
        templateName
      });
      throw error;
    }
  }

  /**
   * Enforce SES rate limit
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastSend = now - this.lastSendTime;
    const minInterval = 1000 / this.sesRateLimit; // Milliseconds between sends

    if (timeSinceLastSend < minInterval) {
      const delay = minInterval - timeSinceLastSend;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastSendTime = Date.now();
  }

  /**
   * Get email priority based on type
   */
  getEmailPriority(templateName) {
    return EMAIL_TYPE_PRIORITY[templateName] || PRIORITY.NORMAL;
  }

  /**
   * Convert priority to numeric value
   */
  getPriorityValue(priority) {
    if (typeof priority === 'number') return priority;
    
    const priorityMap = {
      'immediate': PRIORITY.IMMEDIATE,
      'high': PRIORITY.HIGH,
      'normal': PRIORITY.NORMAL,
      'low': PRIORITY.LOW
    };
    
    return priorityMap[priority] || PRIORITY.NORMAL;
  }

  /**
   * Validate email address
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [
      waiting,
      active,
      completed,
      failed,
      delayed
    ] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount()
    ]);

    const dbStats = await emailQueueRepository.getStatistics(24);
    const deliveryStats = await emailHistoryRepository.getDeliveryStats(7);

    return {
      queue: {
        waiting,
        active,
        completed,
        failed,
        delayed
      },
      database: dbStats,
      delivery: deliveryStats
    };
  }

  /**
   * Process retry queue
   */
  async processRetryQueue() {
    try {
      const retryEmails = await emailQueueRepository.getRetryEmails(50);
      
      for (const email of retryEmails) {
        await this.queue.add('send-email', {
          emailId: email.id,
          recipient: email.recipient_email,
          subject: email.subject,
          isRetry: true
        }, {
          priority: this.getPriorityValue(email.priority)
        });
      }

      logger.info('[EmailQueue] Processed retry queue', {
        count: retryEmails.length
      });
    } catch (error) {
      logger.error('[EmailQueue] Failed to process retry queue', {
        error: error.message
      });
    }
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs() {
    try {
      await this.queue.clean(7 * 24 * 60 * 60 * 1000); // 7 days
      await emailQueueRepository.cleanOldEmails(30); // 30 days
      
      logger.info('[EmailQueue] Cleaned old jobs');
    } catch (error) {
      logger.error('[EmailQueue] Failed to clean old jobs', {
        error: error.message
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('[EmailQueue] Shutting down email queue service');
    
    await this.queue.close();
    await this.statusSyncQueue.close();
  }
}

// Export a factory function instead of a singleton
let serviceInstance = null;

module.exports = {
  getInstance: () => {
    if (!serviceInstance) {
      serviceInstance = new EmailQueueService();
    }
    return serviceInstance;
  },
  
  // For direct access if needed
  EmailQueueService,
  
  // Priority constants
  PRIORITY,
  EMAIL_TYPE_PRIORITY
};