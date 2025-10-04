/**
 * WhatsApp Routes
 * Defines all WhatsApp-related API endpoints
 */

const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp-simple.controller');
const { body, param } = require('express-validator');
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');
const { requireInternalApiKey } = require('../middleware/internal-auth.middleware');
const rateLimiter = require('../middleware/rate-limit.middleware');

// Health check endpoint
router.get('/health', whatsappController.getHealth.bind(whatsappController));

// Webhook endpoints (no auth required for WhatsApp)
router.get('/webhook', whatsappController.verifyWebhook.bind(whatsappController));
router.post('/webhook', whatsappController.handleWebhook.bind(whatsappController));

// Internal webhook endpoints (require internal API key)
// TODO: Implement these methods in simple controller
/*
router.post('/webhook/payment-confirmed',
  requireInternalApiKey,
  whatsappController.handlePaymentConfirmation.bind(whatsappController)
);

router.post('/webhook/permit-ready',
  requireInternalApiKey,
  whatsappController.handlePermitReady.bind(whatsappController)
);
*/

// Admin endpoints - commented out for simple controller
// TODO: Implement these in simple controller if needed
/*
router.post('/send-test',
  isAuthenticated,
  isAdminPortal,
  rateLimiter.createLimiter({ max: 10, windowMs: 60000 }), // 10 per minute
  [
    body('phoneNumber')
      .matches(/^\d{10,15}$/)
      .withMessage('Invalid phone number format'),
    body('message')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters')
  ],
  whatsappController.sendTestMessage.bind(whatsappController)
);

router.get('/conversation/:phoneNumber',
  isAuthenticated,
  isAdminPortal,
  [
    param('phoneNumber')
      .matches(/^\d{10,15}$/)
      .withMessage('Invalid phone number format')
  ],
  whatsappController.getConversationStatus.bind(whatsappController)
);

router.delete('/conversation/:phoneNumber',
  isAuthenticated,
  isAdminPortal,
  [
    param('phoneNumber')
      .matches(/^\d{10,15}$/)
      .withMessage('Invalid phone number format')
  ],
  whatsappController.clearConversation.bind(whatsappController)
);
*/

module.exports = router;