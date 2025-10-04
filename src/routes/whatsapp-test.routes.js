/**
 * WhatsApp Test Routes
 * Direct testing endpoints that bypass WhatsApp API for comprehensive testing
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { logger } = require('../utils/logger');

class WhatsAppTestController {
  constructor() {
    this.whatsappService = null;
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      const SimpleWhatsAppService = require('../services/whatsapp/simple-whatsapp.service');
      this.whatsappService = new SimpleWhatsAppService();
      await this.whatsappService.initialize();
      this.initialized = true;
      logger.info('WhatsApp test controller initialized');
    }
  }

  /**
   * Direct chat endpoint - simulates WhatsApp message without API
   */
  async chat(req, res) {
    try {
      await this.initialize();

      const { phoneNumber, message } = req.body;
      
      logger.info('Direct chat test', { phoneNumber, message });

      // Capture bot responses
      const responses = [];
      const originalSendMessage = this.whatsappService.sendMessage;
      
      // Mock sendMessage to capture responses
      this.whatsappService.sendMessage = async (to, msg) => {
        responses.push(msg);
        logger.info('Bot response captured', { to, messageLength: msg.length });
        return true;
      };

      // Process the message directly
      await this.whatsappService.processMessage(phoneNumber, message);

      // Restore original method
      this.whatsappService.sendMessage = originalSendMessage;

      // Get current state
      let currentState = null;
      try {
        currentState = await this.whatsappService.stateManager.getState(phoneNumber);
      } catch (error) {
        logger.warn('Could not retrieve state', { error: error.message });
      }

      // Return structured response
      res.json({
        success: true,
        input: {
          phoneNumber,
          message,
          timestamp: new Date().toISOString()
        },
        responses: responses,
        state: currentState ? {
          status: currentState.status,
          currentField: currentState.currentField,
          data: currentState.data ? Object.keys(currentState.data) : []
        } : null,
        meta: {
          responseCount: responses.length,
          totalResponseLength: responses.reduce((sum, r) => sum + r.length, 0)
        }
      });

    } catch (error) {
      logger.error('Error in direct chat test', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Get current state for a phone number
   */
  async getState(req, res) {
    try {
      await this.initialize();

      const { phoneNumber } = req.params;
      const state = await this.whatsappService.stateManager.getState(phoneNumber);

      res.json({
        success: true,
        phoneNumber,
        state: state || null,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting state', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Clear state for a phone number
   */
  async clearState(req, res) {
    try {
      await this.initialize();

      const { phoneNumber } = req.params;
      await this.whatsappService.stateManager.clearState(phoneNumber);

      res.json({
        success: true,
        phoneNumber,
        message: 'State cleared successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error clearing state', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Start a conversation flow for comprehensive testing
   */
  async startFlow(req, res) {
    try {
      await this.initialize();

      const { phoneNumber, flow } = req.body;
      
      // Define common conversation flows
      const flows = {
        greeting: ['hola'],
        newPermit: ['hola', '1'],
        renewal: ['hola', 'renovar'],
        status: ['hola', 'estado'],
        help: ['hola', 'ayuda'],
        complete: ['hola', '1', 'Juan Pérez', 'CURP123', 'juan@email.com', 'Toyota', 'Camry', 'Azul', '2020', 'VIN123', 'MOT123', 'Calle 123']
      };

      const selectedFlow = flows[flow] || flows.greeting;
      const results = [];

      // Process each message in the flow
      for (let i = 0; i < selectedFlow.length; i++) {
        const message = selectedFlow[i];
        
        // Capture responses for this message
        const responses = [];
        const originalSendMessage = this.whatsappService.sendMessage;
        
        this.whatsappService.sendMessage = async (to, msg) => {
          responses.push(msg);
          return true;
        };

        await this.whatsappService.processMessage(phoneNumber, message);
        this.whatsappService.sendMessage = originalSendMessage;

        // Get state after this message
        const state = await this.whatsappService.stateManager.getState(phoneNumber);

        results.push({
          step: i + 1,
          input: message,
          responses: [...responses],
          state: state ? {
            status: state.status,
            currentField: state.currentField
          } : null
        });

        // Small delay between messages
        if (i < selectedFlow.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      res.json({
        success: true,
        phoneNumber,
        flow,
        steps: results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in flow test', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

const testController = new WhatsAppTestController();

// Direct chat endpoint
router.post('/chat',
  [
    body('phoneNumber')
      .matches(/^\d{10,15}$/)
      .withMessage('Invalid phone number format'),
    body('message')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters')
  ],
  testController.chat.bind(testController)
);

// State management endpoints
router.get('/state/:phoneNumber',
  testController.getState.bind(testController)
);

router.delete('/state/:phoneNumber',
  testController.clearState.bind(testController)
);

// Flow testing endpoint
router.post('/flow',
  [
    body('phoneNumber')
      .matches(/^\d{10,15}$/)
      .withMessage('Invalid phone number format'),
    body('flow')
      .isIn(['greeting', 'newPermit', 'renewal', 'status', 'help', 'complete'])
      .withMessage('Invalid flow type')
  ],
  testController.startFlow.bind(testController)
);

// Health check for test endpoints
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp test endpoints are operational',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /whatsapp-test/chat - Direct chat simulation',
      'GET /whatsapp-test/state/:phoneNumber - Get current state',
      'DELETE /whatsapp-test/state/:phoneNumber - Clear state',
      'POST /whatsapp-test/flow - Run conversation flow',
      'GET /whatsapp-test/health - This endpoint'
    ]
  });
});

module.exports = router;