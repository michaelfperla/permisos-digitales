/**
 * Simple WhatsApp Routes
 */

const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp-simple.controller');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth.middleware');

// Public webhook endpoints
router.get('/webhook', whatsappController.verifyWebhook.bind(whatsappController));
router.post('/webhook', whatsappController.handleWebhook.bind(whatsappController));

// Internal webhooks (require auth)
router.post('/payment-confirmed', 
  authenticateJWT,
  authorizeRoles('system'),
  whatsappController.handlePaymentConfirmation.bind(whatsappController)
);

router.post('/permit-ready',
  authenticateJWT,
  authorizeRoles('system'),
  whatsappController.handlePermitReady.bind(whatsappController)
);

// Health check endpoints (require auth for security)
router.get('/health',
  authenticateJWT,
  authorizeRoles('admin', 'system'),
  whatsappController.getHealthStatus.bind(whatsappController)
);

router.get('/health/detailed',
  authenticateJWT,
  authorizeRoles('admin', 'system'),
  whatsappController.getDetailedHealthReport.bind(whatsappController)
);

module.exports = router;