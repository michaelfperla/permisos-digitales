// src/routes/admin.routes.js
const express = require('express');
const adminController = require('../controllers/admin.controller');
const adminRemindersController = require('../controllers/admin-reminders.controller');
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');
const { csrfProtection } = require('../middleware/csrf.middleware');
const { uploadPDFs, handleUploadError } = require('../middleware/upload.middleware');
const userRoutes = require('./admin/user.routes');
const monitoringRoutes = require('./admin-monitoring.routes');
const bulkRoutes = require('./admin-bulk.routes');

const router = express.Router();

// Mount user management routes
router.use('/users', userRoutes);

// Mount system monitoring routes (temporarily disabled for development)
// router.use('/system', monitoringRoutes);

// Mount bulk operations routes (temporarily disabled for development)
// router.use('/bulk', bulkRoutes);

// Mount audit logging routes (temporarily disabled for development)
// const auditRoutes = require('./admin-audit-simple.routes');
// router.use('/', auditRoutes);

// Mount configuration management routes (temporarily disabled for development)
// const configurationRoutes = require('./configuration.routes');
// router.use('/config', configurationRoutes);

// [Refactor - Remove Manual Payment] Route for listing applications pending manual verification. Obsolete.
// router.get('/pending-verifications', isAuthenticated, isAdminPortal, adminController.getPendingVerifications);

// [Refactor - Remove Manual Payment] Route for retrieving manual payment proof files. Obsolete.
// router.get('/applications/:id/payment-proof', isAuthenticated, isAdminPortal, adminController.getPaymentProof);

// Temporary route handler for payment proof retrieval - returns 410 Gone status
router.get('/applications/:id/payment-proof', isAuthenticated, isAdminPortal, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.'
  });
});

// [Refactor - Remove Manual Payment] Route for approving manual payment proof. Obsolete.
// router.post('/applications/:id/verify-payment', isAuthenticated, isAdminPortal, csrfProtection, adminController.verifyPayment);

// Temporary route handler for payment verification - returns 410 Gone status
router.post('/applications/:id/verify-payment', isAuthenticated, isAdminPortal, csrfProtection, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.'
  });
});

// [Refactor - Remove Manual Payment] Route for rejecting manual payment proof. Obsolete.
// router.post('/applications/:id/reject-payment', isAuthenticated, isAdminPortal, csrfProtection, adminController.rejectPayment);

// Temporary route handler for payment rejection - returns 410 Gone status
router.post('/applications/:id/reject-payment', isAuthenticated, isAdminPortal, csrfProtection, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.'
  });
});

// [Refactor - Remove Manual Payment] Route for retrieving manual payment verification history. Obsolete.
// router.get('/verification-history', isAuthenticated, isAdminPortal, adminController.getVerificationHistory);

// Temporary route handler for verification history - returns empty list
router.get('/verification-history', isAuthenticated, isAdminPortal, (req, res) => {
  res.json({
    history: [],
    total: 0
  });
});

// Get admin dashboard stats
router.get('/dashboard-stats', isAuthenticated, isAdminPortal, adminController.getDashboardStats);

// Get all applications with filtering
router.get('/applications', isAuthenticated, isAdminPortal, adminController.getAllApplications);

// Export applications to CSV
router.get('/applications/export', isAuthenticated, isAdminPortal, adminController.exportApplications);

// Failed permit management routes - must come before :id route
router.get('/applications/failed', isAuthenticated, isAdminPortal, adminController.getFailedApplications);

// Email reminders and cleanup management routes
router.post('/reminders/trigger', isAuthenticated, isAdminPortal, csrfProtection, adminRemindersController.triggerEmailReminders);
router.post('/cleanup/trigger', isAuthenticated, isAdminPortal, csrfProtection, adminRemindersController.triggerCleanup);
router.get('/cleanup/stats', isAuthenticated, isAdminPortal, adminRemindersController.getCleanupStats);
router.get('/reminders/stats', isAuthenticated, isAdminPortal, adminRemindersController.getReminderStats);
router.post('/reminders/test', isAuthenticated, isAdminPortal, csrfProtection, adminRemindersController.testEmailReminder);

// Get application details - must come after specific routes
router.get('/applications/:id', isAuthenticated, isAdminPortal, adminController.getApplicationDetails);

// Download permit and recommendations files
router.get('/applications/:id/download-permit', isAuthenticated, isAdminPortal, adminController.downloadPermit);
router.get('/applications/:id/download-recommendations', isAuthenticated, isAdminPortal, adminController.downloadRecommendations);

// [Refactor - Remove Manual Payment] Route for retrieving manual payment proof details. Obsolete.
// router.get('/applications/:id/payment-proof-details', isAuthenticated, isAdminPortal, adminController.getPaymentProofDetails);

// Temporary route handler for payment proof details - returns 410 Gone status
router.get('/applications/:id/payment-proof-details', isAuthenticated, isAdminPortal, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.'
  });
});

// [Refactor - Remove Manual Payment] Route for serving manual payment proof files. Obsolete.
// router.get('/applications/:id/payment-proof-file', isAuthenticated, isAdminPortal, adminController.servePaymentProofFile);

// Temporary route handler for payment proof file - returns 410 Gone status
router.get('/applications/:id/payment-proof-file', isAuthenticated, isAdminPortal, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.'
  });
});

// Failed permit management routes
router.post('/applications/:id/retry-puppet', isAuthenticated, isAdminPortal, csrfProtection, adminController.retryPuppeteer);
router.patch('/applications/:id/resolve', isAuthenticated, isAdminPortal, csrfProtection, adminController.markApplicationResolved);
router.post('/applications/:id/upload-pdfs', isAuthenticated, isAdminPortal, csrfProtection, uploadPDFs, handleUploadError, adminController.uploadManualPDFs);
router.post('/applications/:id/generate-pdf', isAuthenticated, isAdminPortal, csrfProtection, adminController.triggerPdfGeneration);
router.patch('/applications/:id/status', isAuthenticated, isAdminPortal, csrfProtection, adminController.updateApplicationStatus);

// Get CSRF token for admin routes
router.get('/csrf-token', isAuthenticated, isAdminPortal, csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

module.exports = router;