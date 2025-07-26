/**
 * WhatsApp Controller
 * Handles WhatsApp webhook endpoints and message processing
 */

const PermitConversationService = require('../services/whatsapp/permit-conversation.service');
const WhatsAppClientService = require('../services/whatsapp/whatsapp-client.service');
const { logger } = require('../utils/logger');
const { validationResult } = require('express-validator');

class WhatsAppController {
  constructor() {
    this.permitConversation = new PermitConversationService();
    this.whatsappClient = new WhatsAppClientService();
  }

  /**
   * Webhook verification endpoint (GET)
   * Used by WhatsApp to verify the webhook URL
   */
  async verifyWebhook(req, res) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      // Check if mode and token are correct
      if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
          logger.info('WhatsApp webhook verified successfully');
          res.status(200).send(challenge);
        } else {
          logger.warn('WhatsApp webhook verification failed', { mode, token });
          res.sendStatus(403);
        }
      } else {
        res.sendStatus(400);
      }
    } catch (error) {
      logger.error('Error in webhook verification', { error: error.message });
      res.sendStatus(500);
    }
  }

  /**
   * Webhook message handler (POST)
   * Receives and processes WhatsApp messages
   */
  async handleWebhook(req, res) {
    try {
      // Immediately respond to WhatsApp to avoid timeout
      res.sendStatus(200);

      // Validate webhook signature
      const signature = req.headers['x-hub-signature-256'];
      const isValid = this.whatsappClient.validateWebhookSignature(
        signature,
        JSON.stringify(req.body)
      );

      if (!isValid && process.env.NODE_ENV === 'production') {
        logger.warn('Invalid webhook signature');
        return;
      }

      // Process the webhook data
      const { entry } = req.body;

      if (!entry || !entry[0]) {
        logger.warn('Invalid webhook payload structure');
        return;
      }

      for (const entryItem of entry) {
        const changes = entryItem.changes;
        
        if (!changes || !changes[0]) {
          continue;
        }

        for (const change of changes) {
          await this.processWebhookChange(change);
        }
      }
    } catch (error) {
      logger.error('Error handling WhatsApp webhook', { 
        error: error.message,
        stack: error.stack,
        body: req.body 
      });
    }
  }

  /**
   * Process individual webhook change
   */
  async processWebhookChange(change) {
    try {
      const { field, value } = change;

      if (field !== 'messages') {
        // Handle other webhook types (status updates, etc.)
        if (field === 'message_template_status_update') {
          logger.info('Template status update received', { value });
        }
        return;
      }

      // Handle message webhooks
      if (value.messages && value.messages[0]) {
        for (const message of value.messages) {
          await this.processMessage(message, value.metadata);
        }
      }

      // Handle status updates
      if (value.statuses && value.statuses[0]) {
        for (const status of value.statuses) {
          await this.processStatusUpdate(status);
        }
      }
    } catch (error) {
      logger.error('Error processing webhook change', { 
        error: error.message,
        change 
      });
    }
  }

  /**
   * Process individual message
   */
  async processMessage(message, metadata) {
    try {
      logger.info('Processing WhatsApp message', {
        from: message.from,
        type: message.type,
        messageId: message.id
      });

      // Build webhook data in format expected by conversation service
      const webhookData = {
        entry: [{
          changes: [{
            value: {
              messages: [message],
              metadata
            }
          }]
        }]
      };

      // Process through permit conversation service
      await this.permitConversation.processMessage(webhookData);

    } catch (error) {
      logger.error('Error processing message', {
        error: error.message,
        messageId: message.id,
        from: message.from
      });

      // Send error message to user
      try {
        await this.whatsappClient.sendTextMessage(
          message.from,
          '❌ Lo siento, hubo un error procesando tu mensaje. Por favor intenta nuevamente.'
        );
      } catch (sendError) {
        logger.error('Error sending error message', { error: sendError.message });
      }
    }
  }

  /**
   * Process message status updates
   */
  async processStatusUpdate(status) {
    logger.info('Message status update', {
      messageId: status.id,
      status: status.status,
      recipientId: status.recipient_id,
      timestamp: status.timestamp
    });

    // You can implement additional logic here for tracking message delivery
    // For example, updating message status in database
  }

  /**
   * Send test message endpoint (for debugging)
   */
  async sendTestMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phoneNumber, message } = req.body;

      const result = await this.whatsappClient.sendTextMessage(phoneNumber, message);

      res.json({
        success: true,
        messageId: result.messages[0].id,
        status: result.messages[0].message_status
      });
    } catch (error) {
      logger.error('Error sending test message', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle payment confirmation webhook
   * Called by payment service when payment is confirmed
   */
  async handlePaymentConfirmation(req, res) {
    try {
      const { applicationId, paymentStatus, paymentDetails } = req.body;

      logger.info('Payment confirmation received for WhatsApp', {
        applicationId,
        paymentStatus
      });

      if (paymentStatus === 'succeeded' || paymentStatus === 'paid') {
        await this.permitConversation.handlePaymentConfirmation(
          applicationId,
          paymentStatus
        );
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Error handling payment confirmation', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle permit ready webhook
   * Called by permit service when permit is generated
   */
  async handlePermitReady(req, res) {
    try {
      const { applicationId, permitUrl, permitPath } = req.body;

      logger.info('Permit ready notification received for WhatsApp', {
        applicationId,
        permitUrl
      });

      await this.permitConversation.handlePermitReady(
        applicationId,
        permitUrl
      );

      res.json({ success: true });
    } catch (error) {
      logger.error('Error handling permit ready', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get conversation status endpoint
   */
  async getConversationStatus(req, res) {
    try {
      const { phoneNumber } = req.params;

      const conversationManager = require('../services/whatsapp/conversation-manager.service');
      const manager = new conversationManager();
      
      const conversation = await manager.getConversation(phoneNumber);
      const completion = await manager.checkCompletion(phoneNumber);
      const summary = await manager.getConversationSummary(phoneNumber);

      res.json({
        success: true,
        conversation: {
          state: conversation.state,
          startedAt: conversation.startedAt,
          lastMessageAt: conversation.lastMessageAt,
          completedFields: conversation.completedFields,
          completion,
          summary
        }
      });
    } catch (error) {
      logger.error('Error getting conversation status', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Clear conversation endpoint (admin use)
   */
  async clearConversation(req, res) {
    try {
      const { phoneNumber } = req.params;

      const conversationManager = require('../services/whatsapp/conversation-manager.service');
      const manager = new conversationManager();
      
      await manager.clearConversation(phoneNumber);

      res.json({
        success: true,
        message: 'Conversation cleared successfully'
      });
    } catch (error) {
      logger.error('Error clearing conversation', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new WhatsAppController();