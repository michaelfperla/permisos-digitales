/**
 * WhatsApp Direct Test Routes
 * Captures bot responses directly without sending to WhatsApp
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { logger } = require('../utils/logger');

class WhatsAppDirectTestController {
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
      logger.info('WhatsApp direct test controller initialized');
    }
  }

  /**
   * Direct test endpoint - processes message and returns bot response
   */
  async testMessage(req, res) {
    try {
      await this.initialize();

      const { phone, message } = req.body;
      
      logger.info('Direct test message', { phone, message });

      // Capture all bot responses
      const responses = [];
      const originalSendMessage = this.whatsappService.sendMessage;
      
      // Mock sendMessage to capture responses instead of sending
      this.whatsappService.sendMessage = async (to, msg) => {
        responses.push(msg);
        logger.info('Bot response captured for test', { 
          to, 
          messageLength: msg.length,
          preview: msg.substring(0, 100) + (msg.length > 100 ? '...' : '')
        });
        return true;
      };

      // Process the message through the bot
      await this.whatsappService.processMessage(phone, message);

      // Restore original method
      this.whatsappService.sendMessage = originalSendMessage;

      // Get current state
      let currentState = null;
      try {
        currentState = await this.whatsappService.stateManager.getState(phone);
      } catch (error) {
        logger.warn('Could not retrieve state in test', { error: error.message });
      }

      // Enhanced state info if available
      let enhancedState = null;
      try {
        if (this.whatsappService.migrationAdapter) {
          enhancedState = await this.whatsappService.migrationAdapter.enhancedStateManager.getState(phone);
        }
      } catch (error) {
        // Enhanced state might not exist, that's ok
      }

      // Return clean response for testing
      res.json({
        success: true,
        input: {
          phone,
          message,
          timestamp: new Date().toISOString()
        },
        responses: responses,
        state: {
          legacy: currentState ? {
            status: currentState.status,
            currentField: currentState.currentField,
            dataKeys: currentState.data ? Object.keys(currentState.data) : []
          } : null,
          enhanced: enhancedState ? {
            type: enhancedState.type,
            context: enhancedState.context,
            stateKey: enhancedState.stateKey,
            breadcrumb: enhancedState.breadcrumb
          } : null
        },
        meta: {
          responseCount: responses.length,
          totalLength: responses.reduce((sum, r) => sum + r.length, 0),
          hasMultipleResponses: responses.length > 1
        }
      });

    } catch (error) {
      logger.error('Error in direct test', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Get current state for a phone number
   */
  async getState(req, res) {
    try {
      await this.initialize();

      const { phone } = req.params;
      
      const legacyState = await this.whatsappService.stateManager.getState(phone);
      
      let enhancedState = null;
      try {
        if (this.whatsappService.migrationAdapter) {
          enhancedState = await this.whatsappService.migrationAdapter.enhancedStateManager.getState(phone);
        }
      } catch (error) {
        // Enhanced state might not exist
      }

      res.json({
        success: true,
        phone,
        state: {
          legacy: legacyState,
          enhanced: enhancedState
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting test state', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Clear state for testing
   */
  async clearState(req, res) {
    try {
      await this.initialize();

      const { phone } = req.params;
      
      // Clear both legacy and enhanced states
      await this.whatsappService.stateManager.clearState(phone);
      
      if (this.whatsappService.migrationAdapter) {
        try {
          await this.whatsappService.migrationAdapter.enhancedStateManager.clearState(phone);
        } catch (error) {
          // Enhanced state clear might fail, that's ok
        }
      }

      res.json({
        success: true,
        phone,
        message: 'All states cleared',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error clearing test state', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Health check for test endpoint
   */
  async health(req, res) {
    try {
      await this.initialize();

      res.json({
        success: true,
        message: 'WhatsApp direct test endpoint is operational',
        endpoints: {
          'POST /test': 'Send message and get bot response',
          'GET /state/:phone': 'Get current state',
          'DELETE /state/:phone': 'Clear state',
          'GET /health': 'This endpoint'
        },
        features: {
          responseCapture: true,
          stateInspection: true,
          enhancedStateSupport: !!this.whatsappService.migrationAdapter,
          stateClear: true
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Test endpoint not properly initialized',
        details: error.message
      });
    }
  }
}

const testController = new WhatsAppDirectTestController();

// Main test endpoint - send message, get response
router.post('/test',
  [
    body('phone')
      .matches(/^\d{10,15}$/)
      .withMessage('Invalid phone number format'),
    body('message')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters')
  ],
  testController.testMessage.bind(testController)
);

// State inspection endpoints
router.get('/state/:phone',
  testController.getState.bind(testController)
);

router.delete('/state/:phone',
  testController.clearState.bind(testController)
);

// Health check
router.get('/health',
  testController.health.bind(testController)
);

module.exports = router;