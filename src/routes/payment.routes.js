const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { isAuthenticated, isClient } = require('../middleware/auth.middleware');
const { validateApplicationId } = require('../middleware/validation.middleware');

router.get(
  '/applications/:applicationId/payment/status',
  isAuthenticated,
  isClient,
  validateApplicationId,
  paymentController.checkPaymentStatus
);

// Webhook endpoint for Conekta payment notifications
router.post(
  '/webhook/conekta',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

module.exports = router;
