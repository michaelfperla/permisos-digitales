// src/routes/oxxo-payment.routes.js
const express = require('express');
const router = express.Router();
const oxxoPaymentController = require('../controllers/oxxo-payment.controller');

/**
 * @route POST /payments/oxxo
 * @desc Create an OXXO payment reference
 * @access Private
 */
router.post('/oxxo', oxxoPaymentController.createOxxoPayment);

/**
 * @route GET /payments/oxxo/:orderId/receipt
 * @desc Get OXXO payment receipt
 * @access Private
 */
router.get('/oxxo/:orderId/receipt', oxxoPaymentController.getOxxoReceipt);

module.exports = router;
