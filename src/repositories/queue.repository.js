/**
 * Email Queue Repository
 * 
 * Handles all database operations for the email queue system
 */

const BaseRepository = require('./base.repository');
const { logger } = require('../utils/logger');

class EmailQueueRepository extends BaseRepository {
  constructor() {
    super('email_queue');
  }

  /**
   * Add email to queue
   */
  async enqueue({
    recipientEmail,
    recipientName,
    subject,
    templateName,
    templateData,
    htmlBody,
    textBody,
    priority = 'normal',
    scheduledFor = null,
    metadata = {}
  }) {
    try {
      const [email] = await this.db('email_queue')
        .insert({
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          subject,
          template_name: templateName,
          template_data: templateData,
          html_body: htmlBody,
          text_body: textBody,
          priority,
          scheduled_for: scheduledFor,
          metadata,
          status: 'pending'
        })
        .returning('*');

      logger.info('Email enqueued', {
        id: email.id,
        recipient: recipientEmail,
        subject,
        priority
      });

      return email;
    } catch (error) {
      logger.error('Failed to enqueue email', {
        error: error.message,
        recipientEmail,
        subject
      });
      throw error;
    }
  }

  /**
   * Get next emails to process
   */
  async getNextBatch(limit = 10) {
    const now = new Date();
    
    return await this.db('email_queue')
      .where('status', 'pending')
      .andWhere(function() {
        this.whereNull('scheduled_for')
          .orWhere('scheduled_for', '<=', now);
      })
      .andWhere(function() {
        this.whereNull('next_retry_at')
          .orWhere('next_retry_at', '<=', now);
      })
      .orderBy([
        { column: 'priority', order: 'asc' },
        { column: 'created_at', order: 'asc' }
      ])
      .limit(limit)
      .forUpdate()
      .skipLocked();
  }

  /**
   * Update email status
   */
  async updateStatus(id, status, updates = {}) {
    const data = {
      status,
      ...updates,
      updated_at: new Date()
    };

    if (status === 'processing') {
      data.processed_at = new Date();
    }

    const [updated] = await this.db('email_queue')
      .where('id', id)
      .update(data)
      .returning('*');

    return updated;
  }

  /**
   * Mark email as sent
   */
  async markAsSent(id, sesMessageId) {
    return await this.updateStatus(id, 'sent', {
      ses_message_id: sesMessageId,
      processed_at: new Date()
    });
  }

  /**
   * Mark email as failed
   */
  async markAsFailed(id, error, canRetry = true) {
    const email = await this.findById(id);
    const attempts = (email.attempts || 0) + 1;
    const maxAttempts = email.max_attempts || 3;

    const updates = {
      attempts,
      last_attempt_at: new Date(),
      error_message: error.message || error,
      error_details: {
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode
      }
    };

    // Calculate next retry time with exponential backoff
    if (canRetry && attempts < maxAttempts) {
      const delayMinutes = Math.pow(2, attempts - 1) * 5; // 5, 10, 20 minutes
      updates.next_retry_at = new Date(Date.now() + delayMinutes * 60 * 1000);
      updates.status = 'retry';
    } else {
      updates.status = 'failed';
    }

    return await this.db('email_queue')
      .where('id', id)
      .update(updates)
      .returning('*');
  }

  /**
   * Get emails that need retry
   */
  async getRetryEmails(limit = 10) {
    const now = new Date();
    
    return await this.db('email_queue')
      .where('status', 'retry')
      .where('next_retry_at', '<=', now)
      .where('attempts', '<', this.db.raw('max_attempts'))
      .orderBy('priority', 'asc')
      .limit(limit);
  }

  /**
   * Get email statistics
   */
  async getStatistics(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const stats = await this.db('email_queue')
      .select('status')
      .count('* as count')
      .where('created_at', '>=', since)
      .groupBy('status');

    const queueDepth = await this.db('email_queue')
      .where('status', 'pending')
      .count('* as count')
      .first();

    return {
      byStatus: stats.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      queueDepth: parseInt(queueDepth.count),
      period: `${hours}h`
    };
  }

  /**
   * Check if email exists in queue
   */
  async isDuplicate(recipientEmail, subject, templateName, withinMinutes = 60) {
    const since = new Date(Date.now() - withinMinutes * 60 * 1000);
    
    const existing = await this.db('email_queue')
      .where('recipient_email', recipientEmail)
      .where('subject', subject)
      .where('created_at', '>=', since)
      .whereIn('status', ['pending', 'processing', 'sent'])
      .first();

    return !!existing;
  }

  /**
   * Clean old processed emails
   */
  async cleanOldEmails(daysToKeep = 30) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const deleted = await this.db('email_queue')
      .whereIn('status', ['sent', 'failed', 'cancelled'])
      .where('updated_at', '<', cutoffDate)
      .delete();

    logger.info('Cleaned old emails from queue', {
      deleted,
      cutoffDate
    });

    return deleted;
  }
}

class EmailHistoryRepository extends BaseRepository {
  constructor() {
    super('email_history');
  }

  /**
   * Record email in history
   */
  async recordEmail(queueEmail, additionalData = {}) {
    const historyRecord = {
      queue_id: queueEmail.id,
      recipient_email: queueEmail.recipient_email,
      recipient_name: queueEmail.recipient_name,
      subject: queueEmail.subject,
      template_name: queueEmail.template_name,
      status: queueEmail.status,
      ses_message_id: queueEmail.ses_message_id,
      sent_at: queueEmail.processed_at,
      from_email: additionalData.fromEmail,
      reply_to: additionalData.replyTo,
      metadata: {
        ...queueEmail.metadata,
        ...additionalData
      }
    };

    const [record] = await this.db('email_history')
      .insert(historyRecord)
      .returning('*');

    return record;
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(sesMessageId, status, timestamp) {
    const statusField = `${status}_at`;
    
    const [updated] = await this.db('email_history')
      .where('ses_message_id', sesMessageId)
      .update({
        status,
        [statusField]: timestamp || new Date()
      })
      .returning('*');

    return updated;
  }

  /**
   * Get email history for recipient
   */
  async getRecipientHistory(email, limit = 50) {
    return await this.db('email_history')
      .where('recipient_email', email)
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const stats = await this.db('email_history')
      .select(this.db.raw(`
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
        COUNT(CASE WHEN status = 'complained' THEN 1 END) as complained,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked
      `))
      .where('created_at', '>=', since)
      .first();

    return {
      ...stats,
      deliveryRate: stats.total > 0 ? (stats.delivered / stats.total * 100).toFixed(2) : 0,
      openRate: stats.delivered > 0 ? (stats.opened / stats.delivered * 100).toFixed(2) : 0,
      clickRate: stats.opened > 0 ? (stats.clicked / stats.opened * 100).toFixed(2) : 0
    };
  }
}

class EmailTemplateRepository extends BaseRepository {
  constructor() {
    super('email_templates');
  }

  /**
   * Get active template by name
   */
  async getTemplate(name) {
    return await this.db('email_templates')
      .where('name', name)
      .where('active', true)
      .first();
  }

  /**
   * Create or update template
   */
  async upsertTemplate(template) {
    const existing = await this.getTemplate(template.name);
    
    if (existing) {
      const [updated] = await this.db('email_templates')
        .where('id', existing.id)
        .update({
          ...template,
          version: existing.version + 1,
          updated_at: new Date()
        })
        .returning('*');
      
      return updated;
    } else {
      const [created] = await this.db('email_templates')
        .insert(template)
        .returning('*');
      
      return created;
    }
  }

  /**
   * List all templates
   */
  async listTemplates(activeOnly = true) {
    let query = this.db('email_templates');
    
    if (activeOnly) {
      query = query.where('active', true);
    }
    
    return await query.orderBy('name', 'asc');
  }
}

class EmailBlacklistRepository extends BaseRepository {
  constructor() {
    super('email_blacklist');
  }

  /**
   * Check if email is blacklisted
   */
  async isBlacklisted(email) {
    const entry = await this.db('email_blacklist')
      .where('email', email.toLowerCase())
      .first();
    
    return !!entry;
  }

  /**
   * Add email to blacklist
   */
  async addToBlacklist(email, reason, details = null) {
    try {
      const [entry] = await this.db('email_blacklist')
        .insert({
          email: email.toLowerCase(),
          reason,
          details
        })
        .returning('*');
      
      logger.info('Email added to blacklist', {
        email,
        reason
      });
      
      return entry;
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        logger.debug('Email already in blacklist', { email });
        return await this.db('email_blacklist')
          .where('email', email.toLowerCase())
          .first();
      }
      throw error;
    }
  }

  /**
   * Remove email from blacklist
   */
  async removeFromBlacklist(email) {
    const deleted = await this.db('email_blacklist')
      .where('email', email.toLowerCase())
      .delete();
    
    return deleted > 0;
  }
}

module.exports = {
  emailQueueRepository: new EmailQueueRepository(),
  emailHistoryRepository: new EmailHistoryRepository(),
  emailTemplateRepository: new EmailTemplateRepository(),
  emailBlacklistRepository: new EmailBlacklistRepository()
};