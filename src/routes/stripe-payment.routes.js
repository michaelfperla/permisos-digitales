// src/routes/stripe-payment.routes.js
const express = require('express');
const router = express.Router();
const stripePaymentController = require('../controllers/stripe-payment.controller');
const { isAuthenticated, isClient } = require('../middleware/auth.middleware');
const { validateApplicationId } = require('../middleware/validation.middleware');

// Create payment order
router.post(
  '/applications/:applicationId/payment/order',
  isAuthenticated,
  isClient,
  validateApplicationId,
  stripePaymentController.createPaymentOrder
);

// Process card payment
router.post(
  '/applications/:applicationId/payment/card',
  isAuthenticated,
  isClient,
  validateApplicationId,
  stripePaymentController.processCardPayment
);

// Process OXXO payment
router.post(
  '/applications/:applicationId/payment/oxxo',
  isAuthenticated,
  isClient,
  validateApplicationId,
  stripePaymentController.processOxxoPayment
);

// Process SPEI payment
router.post(
  '/applications/:applicationId/payment/spei',
  isAuthenticated,
  isClient,
  validateApplicationId,
  stripePaymentController.processSpeiPayment
);

// Check payment status
router.get(
  '/applications/:applicationId/payment/status',
  isAuthenticated,
  isClient,
  validateApplicationId,
  stripePaymentController.checkPaymentStatus
);

// Webhook endpoint for Stripe payment notifications
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  stripePaymentController.handleWebhook
);

module.exports = router;
