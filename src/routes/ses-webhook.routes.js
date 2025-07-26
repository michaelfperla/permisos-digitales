/**
 * SES Webhook Routes
 * 
 * Handles AWS SES event notifications and email management endpoints
 */

const express = require('express');
const router = express.Router();
const sesWebhookController = require('../controllers/ses-webhook.controller');
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');

// SES webhook endpoint (no auth required - validated by SNS)
router.post('/webhook/ses', 
  express.raw({ type: 'text/plain' }), // SNS sends text/plain
  sesWebhookController.handleSesWebhook
);

// Email statistics (admin only)
router.get('/email/stats',
  isAuthenticated,
  isAdminPortal,
  sesWebhookController.getEmailStats
);

// Blacklist management (admin only)
router.get('/email/blacklist',
  isAuthenticated,
  isAdminPortal,
  sesWebhookController.getBlacklist
);

router.delete('/email/blacklist/:email',
  isAuthenticated,
  isAdminPortal,
  sesWebhookController.removeFromBlacklist
);

module.exports = router;