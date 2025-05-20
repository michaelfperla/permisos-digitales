/**
 * Notification Routes
 * Routes for notification-related endpoints
 */
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');

/**
 * @route GET /api/notifications/oxxo-expiring
 * @description Process expiring OXXO payments and send notifications
 * @access Private (API key required)
 */
router.get('/oxxo-expiring', notificationController.processExpiringOxxoPayments);

module.exports = router;
