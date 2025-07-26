// src/routes/stripe-payment.routes.js
const express = require('express');
const router = express.Router();
const stripePaymentController = require('../controllers/stripe-payment.controller');
const { isAuthenticated, isClient } = require('../middleware/auth.middleware');
const { validateApplicationId } = require('../middleware/validation.middleware');
const paymentSecurity = require('../middleware/payment-security.middleware');

// Create payment order
router.post(
  '/applications/:applicationId/payment/order',
  isAuthenticated,
  isClient,
  validateApplicationId,
  paymentSecurity.paymentRateLimit,
  paymentSecurity.validatePaymentAmount,
  stripePaymentController.createPaymentOrder
);

// Process card payment
router.post(
  '/applications/:applicationId/payment/card',
  isAuthenticated,
  isClient,
  validateApplicationId,
  paymentSecurity.paymentRateLimit,
  paymentSecurity.validatePaymentAmount,
  stripePaymentController.processCardPayment
);

// Process OXXO payment
router.post(
  '/applications/:applicationId/payment/oxxo',
  isAuthenticated,
  isClient,
  validateApplicationId,
  paymentSecurity.paymentRateLimit,
  paymentSecurity.validatePaymentAmount,
  stripePaymentController.processOxxoPayment
);


// Create payment intent for secure card processing
router.post(
  '/applications/:applicationId/payment/create-intent',
  isAuthenticated,
  isClient,
  validateApplicationId,
  paymentSecurity.paymentRateLimit,
  paymentSecurity.validatePaymentAmount,
  stripePaymentController.createPaymentIntent
);

// Confirm payment after successful processing
router.post(
  '/applications/:applicationId/payment/confirm',
  isAuthenticated,
  isClient,
  validateApplicationId,
  paymentSecurity.paymentRateLimit,
  stripePaymentController.confirmPayment
);

// Check payment status
router.get(
  '/applications/:applicationId/payment/status',
  isAuthenticated,
  isClient,
  validateApplicationId,
  stripePaymentController.checkPaymentStatus
);

// Get payment status by payment intent ID
router.get(
  '/applications/:applicationId/payment/status/:paymentIntentId',
  isAuthenticated,
  isClient,
  validateApplicationId,
  stripePaymentController.checkPaymentStatus
);

// Webhook endpoint for Stripe payment notifications
router.post(
  '/webhook/stripe',
  paymentSecurity.webhookSecurity,
  stripePaymentController.handleWebhook
);

module.exports = router;
