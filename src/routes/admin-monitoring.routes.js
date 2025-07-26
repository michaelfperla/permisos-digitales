// src/routes/admin-monitoring.routes.js
const express = require('express');
const adminMonitoringController = require('../controllers/admin-monitoring.controller');
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');
const { csrfProtection } = require('../middleware/csrf.middleware');

const router = express.Router();

// All monitoring routes require admin authentication
router.use(isAuthenticated, isAdminPortal);

// System monitoring endpoints
router.get('/health', adminMonitoringController.getSystemHealth);
router.get('/queues', adminMonitoringController.getQueueStatus);
router.get('/metrics', adminMonitoringController.getSystemMetrics);
router.get('/errors', adminMonitoringController.getErrorStats);

// Component-specific statistics
router.get('/stats/email', adminMonitoringController.getEmailStats);
router.get('/stats/pdf', adminMonitoringController.getPdfStats);
router.get('/stats/database', adminMonitoringController.getDatabaseStats);
router.get('/stats/payments', adminMonitoringController.getPaymentMetrics);

// Real-time monitoring
router.get('/realtime', adminMonitoringController.getRealtimeStatus);

// Dashboard data (aggregated metrics)
router.get('/dashboard', adminMonitoringController.getDashboardData);

// Utility endpoints
router.post('/cache/clear', csrfProtection, adminMonitoringController.clearCache);
router.post('/alert/test', csrfProtection, adminMonitoringController.testAlert);

module.exports = router;