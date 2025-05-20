/**
 * Payment Routes
 * Defines API routes for payment processing
 */
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { isAuthenticated, isClient } = require('../middleware/auth.middleware');
const { validateApplicationId } = require('../middleware/validation.middleware');

// OBSOLETE PAYMENT ENDPOINTS - PAYMENT NOW HANDLED DURING APPLICATION SUBMISSION
// These routes are commented out as payment is now integrated into the application submission process

/*
// Create a payment order
router.post(
  '/applications/:applicationId/payment',
  isAuthenticated,
  isClient,
  csrfProtection,
  validateApplicationId,
  paymentController.createPaymentOrder
);

// Process a card payment
router.post(
  '/applications/:applicationId/payment/card',
  isAuthenticated,
  isClient,
  csrfProtection,
  validateApplicationId,
  paymentController.processCardPayment
);

// Process a bank transfer payment (SPEI)
router.post(
  '/applications/:applicationId/payment/bank-transfer',
  isAuthenticated,
  isClient,
  csrfProtection,
  validateApplicationId,
  paymentController.processBankTransferPayment
);

// Process an OXXO cash payment
router.post(
  '/applications/:applicationId/payment/oxxo',
  isAuthenticated,
  isClient,
  csrfProtection,
  validateApplicationId,
  paymentController.processOxxoPayment
);
*/

// Check payment status - still useful for checking status of payments
router.get(
  '/applications/:applicationId/payment/status',
  isAuthenticated,
  isClient,
  validateApplicationId,
  paymentController.checkPaymentStatus
);

// Webhook endpoint (no authentication or CSRF protection)
// Use a dedicated route for Conekta webhooks
router.post(
  '/webhook/conekta',
  express.raw({ type: 'application/json' }), // Raw body parser for webhook signature verification
  paymentController.handleWebhook
);

module.exports = router;
