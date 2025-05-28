// src/routes/index.js
const express = require('express');
const router = express.Router();
const ApiResponse = require('../utils/api-response');

const { isAuthenticated, isAdmin, isClient, isAdminPortal, auditRequest } = require('../middleware/auth.middleware');
const rateLimiters = require('../middleware/rate-limit.middleware');
const authRoutes = require('./auth.routes');
const passwordResetRoutes = require('./password-reset.routes');
const applicationRoutes = require('./applications.routes');
const adminRoutes = require('./admin.routes');
const userRoutes = require('./user.routes');
const paymentRoutes = require('./payment.routes');
const oxxoPaymentRoutes = require('./oxxo-payment.routes');
const notificationRoutes = require('./notification.routes');
// const tempDevRoutes = require('./DEPRECATED_dev.routes'); // Disabled for security

// Apply global rate limiter to all API routes
router.use(rateLimiters.api);

// Apply security audit logging to all API requests
router.use(auditRequest);

// Status route
router.get('/status', (req, res) => { ApiResponse.success(res, { status: 'API is running' }); });

// Mount route modules
// Apply stricter rate limiting to authentication routes
router.use('/auth', rateLimiters.auth, authRoutes);

// Password reset routes - also under /auth path but separate file for organization
router.use('/auth', rateLimiters.auth, passwordResetRoutes);

// Client routes - only for client account types
router.use('/applications', isAuthenticated, isClient, applicationRoutes);

// Admin routes - strictly for admin accounts with portal access
router.use('/admin', isAuthenticated, isAdminPortal, rateLimiters.admin, adminRoutes);

// User profile routes - requires authentication
router.use('/user', isAuthenticated, userRoutes);

// Payment routes - some require authentication, webhook doesn't
// Mount directly to /api since these routes are already prefixed with /applications
router.use('/', paymentRoutes);

// OXXO payment routes - requires authentication
router.use('/payments', isAuthenticated, isClient, oxxoPaymentRoutes);

// Notification routes - internal API, protected by API key
router.use('/notifications', notificationRoutes);

// Disable development routes completely for security
// if (process.env.NODE_ENV === 'development') {
//     console.log("--- Mounting Development Routes (/api/dev) ---");
//     router.use('/dev', tempDevRoutes);
// } else {
console.log('--- Production environment: Skipping Development Routes ---');
// }

module.exports = router;