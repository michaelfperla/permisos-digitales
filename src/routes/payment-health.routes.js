// src/routes/payment-health.routes.js
const express = require('express');
const router = express.Router();
const paymentHealthController = require('../controllers/payment-health.controller');
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');
const { validateApplicationId } = require('../middleware/validation.middleware');

// Payment system health check (admin only)
router.get(
  '/health',
  isAuthenticated,
  isAdminPortal,
  paymentHealthController.getPaymentHealth
);

// Payment metrics (admin only)
router.get(
  '/metrics',
  isAuthenticated,
  isAdminPortal,
  paymentHealthController.getPaymentMetrics
);

// Reconcile payment for specific application (admin only)
router.post(
  '/applications/:applicationId/reconcile',
  isAuthenticated,
  isAdminPortal,
  validateApplicationId,
  paymentHealthController.reconcilePayment
);

// Reset payment metrics (admin only)
router.post(
  '/metrics/reset',
  isAuthenticated,
  isAdminPortal,
  paymentHealthController.resetMetrics
);

module.exports = router;
