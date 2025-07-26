/**
 * SES Webhook Controller
 * 
 * Handles AWS SES event notifications for email delivery tracking
 * Processes bounce, complaint, delivery, open, and click events
 */

const { logger } = require('../utils/logger');
const { emailHistoryRepository, emailBlacklistRepository } = require('../repositories/queue.repository');
const alertService = require('../services/alert.service');

/**
 * Handle SES webhook events
 */
exports.handleSesWebhook = async (req, res) => {
  try {
    // Validate SNS subscription confirmation
    if (req.headers['x-amz-sns-message-type'] === 'SubscriptionConfirmation') {
      logger.info('[SESWebhook] Subscription confirmation received');
      // In production, you would confirm the subscription here
      return res.status(200).send('OK');
    }

    // Parse SNS message
    const message = JSON.parse(req.body);
    const sesEvent = JSON.parse(message.Message);

    logger.info('[SESWebhook] Event received', {
      eventType: sesEvent.eventType,
      messageId: sesEvent.mail?.messageId
    });

    // Process based on event type
    switch (sesEvent.eventType) {
      case 'Send':
        await handleSendEvent(sesEvent);
        break;
        
      case 'Delivery':
        await handleDeliveryEvent(sesEvent);
        break;
        
      case 'Bounce':
        await handleBounceEvent(sesEvent);
        break;
        
      case 'Complaint':
        await handleComplaintEvent(sesEvent);
        break;
        
      case 'Open':
        await handleOpenEvent(sesEvent);
        break;
        
      case 'Click':
        await handleClickEvent(sesEvent);
        break;
        
      default:
        logger.warn('[SESWebhook] Unknown event type', {
          eventType: sesEvent.eventType
        });
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('[SESWebhook] Failed to process webhook', {
      error: error.message,
      body: req.body
    });
    
    // Return 200 to prevent SNS retries for malformed data
    res.status(200).send('Error logged');
  }
};

/**
 * Handle send event
 */
async function handleSendEvent(event) {
  // Update email history with send confirmation
  const messageId = event.mail.messageId;
  
  await emailHistoryRepository.updateDeliveryStatus(
    messageId,
    'sent',
    new Date(event.mail.timestamp)
  );
}

/**
 * Handle delivery event
 */
async function handleDeliveryEvent(event) {
  const messageId = event.mail.messageId;
  const timestamp = new Date(event.delivery.timestamp);
  
  await emailHistoryRepository.updateDeliveryStatus(
    messageId,
    'delivered',
    timestamp
  );
  
  logger.info('[SESWebhook] Email delivered', {
    messageId,
    recipients: event.delivery.recipients
  });
}

/**
 * Handle bounce event
 */
async function handleBounceEvent(event) {
  const messageId = event.mail.messageId;
  const bounce = event.bounce;
  const timestamp = new Date(bounce.timestamp);
  
  // Update email history
  await emailHistoryRepository.updateDeliveryStatus(
    messageId,
    'bounced',
    timestamp
  );
  
  // Process bounced recipients
  for (const recipient of bounce.bouncedRecipients) {
    const email = recipient.emailAddress;
    const bounceType = bounce.bounceType;
    
    logger.warn('[SESWebhook] Email bounced', {
      email,
      bounceType,
      bounceSubType: bounce.bounceSubType,
      diagnosticCode: recipient.diagnosticCode
    });
    
    // Add to blacklist for hard bounces
    if (bounceType === 'Permanent') {
      await emailBlacklistRepository.addToBlacklist(
        email,
        'bounce',
        `${bounce.bounceSubType}: ${recipient.diagnosticCode}`
      );
      
      // Alert for high bounce rate
      await alertService.sendAlert({
        type: 'email-bounce',
        severity: 'warning',
        title: 'Email Hard Bounce',
        message: `Permanent bounce for ${email}`,
        data: {
          email,
          bounceType: bounce.bounceSubType,
          diagnosticCode: recipient.diagnosticCode
        }
      });
    }
  }
}

/**
 * Handle complaint event
 */
async function handleComplaintEvent(event) {
  const messageId = event.mail.messageId;
  const complaint = event.complaint;
  const timestamp = new Date(complaint.timestamp);
  
  // Update email history
  await emailHistoryRepository.updateDeliveryStatus(
    messageId,
    'complained',
    timestamp
  );
  
  // Process complained recipients
  for (const recipient of complaint.complainedRecipients) {
    const email = recipient.emailAddress;
    
    logger.error('[SESWebhook] Email complaint received', {
      email,
      complaintFeedbackType: complaint.complaintFeedbackType
    });
    
    // Always add complaints to blacklist
    await emailBlacklistRepository.addToBlacklist(
      email,
      'complaint',
      complaint.complaintFeedbackType || 'Unknown complaint type'
    );
    
    // Alert for complaints (serious issue)
    await alertService.sendAlert({
      type: 'email-complaint',
      severity: 'high',
      title: 'Email Complaint Received',
      message: `Spam complaint from ${email}`,
      data: {
        email,
        complaintType: complaint.complaintFeedbackType
      }
    });
  }
}

/**
 * Handle open event
 */
async function handleOpenEvent(event) {
  const messageId = event.mail.messageId;
  const timestamp = new Date(event.open.timestamp);
  
  const updated = await emailHistoryRepository.db('email_history')
    .where('ses_message_id', messageId)
    .update({
      opened_at: timestamp
    })
    .returning('*');
  
  if (updated.length > 0) {
    logger.debug('[SESWebhook] Email opened', {
      messageId,
      userAgent: event.open.userAgent,
      ipAddress: event.open.ipAddress
    });
  }
}

/**
 * Handle click event
 */
async function handleClickEvent(event) {
  const messageId = event.mail.messageId;
  const timestamp = new Date(event.click.timestamp);
  
  const updated = await emailHistoryRepository.db('email_history')
    .where('ses_message_id', messageId)
    .update({
      clicked_at: timestamp
    })
    .returning('*');
  
  if (updated.length > 0) {
    logger.debug('[SESWebhook] Email link clicked', {
      messageId,
      link: event.click.link,
      userAgent: event.click.userAgent,
      ipAddress: event.click.ipAddress
    });
  }
}

/**
 * Get email tracking statistics
 */
exports.getEmailStats = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await emailHistoryRepository.getDeliveryStats(days);
    
    res.json({
      success: true,
      stats,
      period: `${days} days`
    });
  } catch (error) {
    logger.error('[SESWebhook] Failed to get email stats', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve email statistics'
    });
  }
};

/**
 * Get blacklist entries
 */
exports.getBlacklist = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const blacklist = await emailBlacklistRepository.db('email_blacklist')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
    
    const total = await emailBlacklistRepository.db('email_blacklist')
      .count('* as count')
      .first();
    
    res.json({
      success: true,
      data: blacklist,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        pages: Math.ceil(total.count / limit)
      }
    });
  } catch (error) {
    logger.error('[SESWebhook] Failed to get blacklist', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve blacklist'
    });
  }
};

/**
 * Remove email from blacklist
 */
exports.removeFromBlacklist = async (req, res) => {
  try {
    const { email } = req.params;
    
    const removed = await emailBlacklistRepository.removeFromBlacklist(email);
    
    if (removed) {
      logger.info('[SESWebhook] Email removed from blacklist', { email });
      
      res.json({
        success: true,
        message: 'Email removed from blacklist'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Email not found in blacklist'
      });
    }
  } catch (error) {
    logger.error('[SESWebhook] Failed to remove from blacklist', {
      error: error.message,
      email: req.params.email
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to remove from blacklist'
    });
  }
};