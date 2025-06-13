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



module.exports = router;
