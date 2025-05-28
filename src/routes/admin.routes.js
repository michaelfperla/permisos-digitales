// src/routes/admin.routes.js
const express = require('express');
const adminController = require('../controllers/admin.controller');
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');
const { csrfProtection } = require('../middleware/csrf.middleware');
const userRoutes = require('./admin/user.routes');

const router = express.Router();

// Mount user management routes
router.use('/users', userRoutes);

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

// Get application details
router.get('/applications/:id', isAuthenticated, isAdminPortal, adminController.getApplicationDetails);

// Get all applications with filtering
router.get('/applications', isAuthenticated, isAdminPortal, adminController.getAllApplications);

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

// Get CSRF token for admin routes
router.get('/csrf-token', isAuthenticated, isAdminPortal, csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

module.exports = router;