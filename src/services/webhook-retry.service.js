// src/services/webhook-retry.service.js

const { logger } = require('../utils/logger');
const paymentRepository = require('../repositories/payment.repository');
const { withTransaction } = require('../utils/db-transaction');

class WebhookRetryService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelays = [60000, 300000, 900000]; // 1 min, 5 min, 15 min
    this.retryTimeouts = new Map();
  }

  /**
   * Schedule a webhook retry
   * @param {string} eventId - Webhook event ID
   * @param {number} retryCount - Current retry count
   * @param {Function} processFunction - Function to process the webhook
   * @param {Object} eventData - The webhook event data
   */
  scheduleRetry(eventId, retryCount, processFunction, eventData) {
    if (retryCount >= this.maxRetries) {
      logger.error(`[WebhookRetry] Max retries (${this.maxRetries}) reached for event ${eventId}`);
      this.markAsFailed(eventId, 'Max retries exceeded');
      return;
    }

    const delay = this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1];
    
    logger.info(`[WebhookRetry] Scheduling retry ${retryCount + 1} for event ${eventId} in ${delay}ms`);
    
    const timeoutId = setTimeout(async () => {
      try {
        logger.info(`[WebhookRetry] Retrying webhook ${eventId} (attempt ${retryCount + 1})`);
        
        await withTransaction(async (client) => {
          // Process the webhook
          await processFunction(eventData, client);
          
          // Mark as successfully processed
          await paymentRepository.updateWebhookEventStatus(eventId, 'processed', null, client);
        });
        
        logger.info(`[WebhookRetry] Successfully processed webhook ${eventId} on retry ${retryCount + 1}`);
        this.retryTimeouts.delete(eventId);
        
      } catch (error) {
        logger.error(`[WebhookRetry] Retry ${retryCount + 1} failed for webhook ${eventId}:`, error);
        
        // Update retry count in database
        await paymentRepository.updateWebhookEventStatus(eventId, 'failed', error.message);
        
        // Schedule next retry
        this.scheduleRetry(eventId, retryCount + 1, processFunction, eventData);
      }
    }, delay);
    
    this.retryTimeouts.set(eventId, timeoutId);
  }

  /**
   * Cancel a scheduled retry
   * @param {string} eventId - Webhook event ID
   */
  cancelRetry(eventId) {
    const timeoutId = this.retryTimeouts.get(eventId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.retryTimeouts.delete(eventId);
      logger.info(`[WebhookRetry] Cancelled retry for event ${eventId}`);
    }
  }

  /**
   * Mark webhook as permanently failed
   * @param {string} eventId - Webhook event ID
   * @param {string} reason - Failure reason
   */
  async markAsFailed(eventId, reason) {
    try {
      await paymentRepository.updateWebhookEventStatus(eventId, 'failed_permanent', reason);
      
      // Send alert for permanently failed webhook
      const alertService = require('./alert.service');
      await alertService.sendAlert({
        title: 'Webhook Processing Failed Permanently',
        message: `Webhook ${eventId} failed after ${this.maxRetries} retries`,
        severity: 'HIGH',
        details: {
          eventId,
          reason,
          maxRetries: this.maxRetries
        }
      });
    } catch (error) {
      logger.error(`[WebhookRetry] Error marking webhook as permanently failed:`, error);
    }
  }

  /**
   * Get retry statistics
   * @returns {Object} Retry statistics
   */
  getRetryStats() {
    return {
      pendingRetries: this.retryTimeouts.size,
      maxRetries: this.maxRetries,
      retryDelays: this.retryDelays
    };
  }

  /**
   * Clear all pending retries (for shutdown)
   */
  clearAllRetries() {
    for (const [eventId, timeoutId] of this.retryTimeouts) {
      clearTimeout(timeoutId);
      logger.info(`[WebhookRetry] Cleared pending retry for event ${eventId}`);
    }
    this.retryTimeouts.clear();
  }
}

// Create singleton instance
const webhookRetryService = new WebhookRetryService();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('[WebhookRetry] Clearing pending retries before shutdown');
  webhookRetryService.clearAllRetries();
});

module.exports = webhookRetryService;