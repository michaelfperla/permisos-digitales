// src/routes/queue.routes.js
const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');
const pdfQueueController = require('../controllers/pdf-queue.controller');

// User endpoints
router.get('/status/:applicationId', isAuthenticated, pdfQueueController.getApplicationQueueStatus);

// Admin endpoints
router.get('/stats', isAuthenticated, isAdminPortal, pdfQueueController.getQueueStats);
router.get('/health', pdfQueueController.getQueueHealth); // No auth for health checks
router.get('/failed', isAuthenticated, isAdminPortal, pdfQueueController.getFailedJobs);
router.post('/retry/:applicationId', isAuthenticated, isAdminPortal, pdfQueueController.retryFailedJob);
router.post('/clean', isAuthenticated, isAdminPortal, pdfQueueController.cleanOldJobs);
router.post('/pause', isAuthenticated, isAdminPortal, pdfQueueController.pauseQueue);
router.post('/resume', isAuthenticated, isAdminPortal, pdfQueueController.resumeQueue);

module.exports = router;