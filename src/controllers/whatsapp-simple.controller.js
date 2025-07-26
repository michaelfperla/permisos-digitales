/**
 * Simple WhatsApp Controller
 * Handles webhooks with minimal complexity
 */

const SimpleWhatsAppService = require('../services/whatsapp/simple-whatsapp.service');
const { logger } = require('../utils/logger');

class WhatsAppSimpleController {
  constructor() {
    this.whatsappService = new SimpleWhatsAppService();
    this.serviceInitialized = false;
    this.initializeService();
  }

  /**
   * Initialize WhatsApp service with proper configuration and monitoring
   */
  async initializeService() {
    try {
      // Initialize configuration first
      await this.whatsappService.initializeConfig();
      
      // Initialize health monitoring
      this.whatsappService.initializeHealthMonitoring();
      
      this.serviceInitialized = true;
      logger.info('WhatsApp service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service', { error: error.message });
      // Continue with uninitialized service - will use fallbacks
    }
  }

  /**
   * Ensure service is initialized before processing
   */
  async ensureServiceInitialized() {
    if (!this.serviceInitialized) {
      logger.warn('WhatsApp service not fully initialized, attempting to initialize');
      await this.initializeService();
    }
  }

  /**
   * Webhook verification (GET)
   */
  async verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      logger.info('WhatsApp webhook verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }

  /**
   * Handle incoming webhook (POST)
   */
  async handleWebhook(req, res) {
    // Respond immediately
    res.sendStatus(200);

    try {
      // Ensure service is properly initialized
      await this.ensureServiceInitialized();

      logger.info('WhatsApp webhook received', { 
        body: JSON.stringify(req.body),
        headers: req.headers 
      });

      // Validate webhook signature in production
      if (process.env.NODE_ENV === 'production') {
        const signature = req.headers['x-hub-signature-256'];
        logger.info('Signature validation temporarily disabled for testing');
        // TODO: Re-enable after getting correct WHATSAPP_APP_SECRET
        // if (!this.validateWebhookSignature(signature, req.rawBody || JSON.stringify(req.body))) {
        //   logger.warn('Invalid WhatsApp webhook signature');
        //   return;
        // }
      }

      const { entry } = req.body;
      
      if (!entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        logger.info('No messages in webhook payload');
        return;
      }

      const message = entry[0].changes[0].value.messages[0];
      logger.info('Processing WhatsApp message', {
        from: message.from,
        type: message.type,
        text: message.text?.body
      });
      
      // Only process text messages
      if (message.type !== 'text') {
        logger.info('Non-text message received, sending response');
        await this.whatsappService.sendMessage(
          message.from,
          'Por favor envía solo mensajes de texto.'
        );
        return;
      }

      // Process the message
      logger.info('Processing text message');
      await this.whatsappService.processMessage(message.from, message.text.body);

    } catch (error) {
      logger.error('Error in WhatsApp webhook', { error: error.message });
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(signature, body) {
    if (!signature || !process.env.WHATSAPP_APP_SECRET) {
      return false;
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
      .update(body)
      .digest('hex');

    return signature === `sha256=${expectedSignature}`;
  }

  /**
   * Payment confirmation webhook (internal)
   */
  async handlePaymentConfirmation(req, res) {
    try {
      const { applicationId, phoneNumber } = req.body;
      
      await this.whatsappService.handlePaymentConfirmation(applicationId, phoneNumber);
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error handling payment confirmation', { error: error.message });
      res.status(500).json({ success: false });
    }
  }

  /**
   * Permit ready webhook (internal)
   */
  async handlePermitReady(req, res) {
    try {
      const { applicationId, permitUrl, phoneNumber } = req.body;
      
      await this.whatsappService.handlePermitReady(applicationId, permitUrl, phoneNumber);
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error handling permit ready', { error: error.message });
      res.status(500).json({ success: false });
    }
  }

  /**
   * Health check endpoint
   */
  async getHealthStatus(req, res) {
    try {
      await this.ensureServiceInitialized();
      
      const healthStatus = this.whatsappService.getHealthStatus();
      const memoryStats = this.whatsappService.getMemoryStats();
      
      res.json({
        status: healthStatus.status || 'unknown',
        timestamp: Date.now(),
        serviceInitialized: this.serviceInitialized,
        health: healthStatus,
        memory: memoryStats
      });
    } catch (error) {
      logger.error('Error getting health status', { error: error.message });
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Detailed health report endpoint
   */
  async getDetailedHealthReport(req, res) {
    try {
      await this.ensureServiceInitialized();
      
      const healthReport = this.whatsappService.getDetailedHealthReport();
      const configStatus = await this.whatsappService.getConfigValidationStatus();
      
      res.json({
        timestamp: Date.now(),
        serviceInitialized: this.serviceInitialized,
        healthReport,
        configValidation: configStatus
      });
    } catch (error) {
      logger.error('Error getting detailed health report', { error: error.message });
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }
}

module.exports = new WhatsAppSimpleController();