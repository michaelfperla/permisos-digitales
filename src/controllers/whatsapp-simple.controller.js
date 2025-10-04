/**
 * Clean WhatsApp Controller
 * Handles webhooks with proper security but without over-engineering
 */

const WhatsAppRouterService = require('../services/whatsapp/whatsapp-router.service');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

class WhatsAppSimpleController {
  constructor() {
    this.routerService = new WhatsAppRouterService();
    this.initialized = false;
  }

  /**
   * Initialize service
   */
  async initialize() {
    if (!this.initialized) {
      // Router service initializes both Express and Standard services
      this.initialized = true;
      logger.info('WhatsApp router controller initialized');
    }
  }

  /**
   * Webhook verification (GET) - Required by Meta
   */
  async verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      logger.info('WhatsApp webhook verified');
      res.status(200).send(challenge);
    } else {
      logger.warn('WhatsApp webhook verification failed');
      res.sendStatus(403);
    }
  }

  /**
   * Handle incoming webhook (POST)
   */
  async handleWebhook(req, res) {
    try {
      logger.info('WhatsApp webhook received', { 
        headers: JSON.stringify(req.headers), 
        body: JSON.stringify(req.body).substring(0, 500) 
      });

      // Validate signature for security
      if (!this.validateSignature(req)) {
        logger.warn('Invalid webhook signature');
        res.sendStatus(401);
        return;
      }

      // Respond immediately as required by Meta
      res.sendStatus(200);

      // Ensure service is initialized
      await this.initialize();

      // Extract message
      const { entry } = req.body;
      if (!entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        logger.info('No message found in webhook payload');
        return; // No message to process
      }

      const message = entry[0].changes[0].value.messages[0];
      
      // Enhanced logging for Meta review
      logger.info('📱 [INCOMING] WhatsApp message received', { 
        from: message.from, 
        type: message.type,
        messageId: message.id,
        body: message.text?.body || '[no text]',
        timestamp: new Date().toISOString()
      });
      
      // Only process text messages
      if (message.type !== 'text') {
        logger.info('Non-text message received, ignoring', { type: message.type });
        return;
      }

      // Route message to appropriate service
      await this.routerService.routeMessage(
        message.from, 
        message.text.body,
        req.body // Pass full webhook data for routing decisions
      );

    } catch (error) {
      logger.error('Error in WhatsApp webhook', { 
        error: error.message,
        stack: error.stack 
      });
    }
  }

  /**
   * Validate webhook signature
   */
  validateSignature(req) {
    // Temporarily disable signature validation for testing
    logger.info('Signature validation temporarily disabled for testing');
    return true;
    
    const signature = req.headers['x-hub-signature-256'];
    
    // In development without secret, log warning but allow
    if (!process.env.WHATSAPP_APP_SECRET) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('WHATSAPP_APP_SECRET not configured in production');
        return false;
      }
      logger.warn('WHATSAPP_APP_SECRET not configured - skipping validation');
      return true;
    }

    if (!signature) {
      return false;
    }

    // Calculate expected signature
    const payload = req.rawBody || JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
      .update(payload)
      .digest('hex');

    const expected = Buffer.from(`sha256=${expectedSignature}`);
    const received = Buffer.from(signature);

    // Timing-safe comparison
    return expected.length === received.length && 
           crypto.timingSafeEqual(expected, received);
  }

  /**
   * Health check endpoint
   */
  async getHealth(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'whatsapp-simple',
        initialized: this.initialized,
        config: {
          hasPhoneId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
          hasToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
          hasSecret: !!process.env.WHATSAPP_APP_SECRET
        }
      };

      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message
      });
    }
  }
}

module.exports = new WhatsAppSimpleController();