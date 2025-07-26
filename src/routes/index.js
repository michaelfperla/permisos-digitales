// src/routes/index.js
const express = require('express');
const router = express.Router();
const ApiResponse = require('../utils/api-response');
const { logger } = require('../utils/logger');

const { isAuthenticated, isClient, isAdminPortal, auditRequest } = require('../middleware/auth.middleware');
const rateLimiters = require('../middleware/rate-limit.middleware');
const authRoutes = require('./auth.routes');
const passwordResetRoutes = require('./password-reset.routes');
const applicationRoutes = require('./applications.routes');
const adminRoutes = require('./admin.routes');
const userRoutes = require('./user.routes');
// const paymentRoutes = require('./payment.routes'); // Removed - consolidated into stripe-payment.routes
const stripePaymentRoutes = require('./stripe-payment.routes');
const oxxoPaymentRoutes = require('./oxxo-payment.routes');
const paymentHealthRoutes = require('./payment-health.routes');
const notificationRoutes = require('./notification.routes');
const queueRoutes = require('./queue.routes');
const sesWebhookRoutes = require('./ses-webhook.routes');
const logsRoutes = require('./logs.routes');
const whatsappRoutes = require('./whatsapp.routes');
// const tempDevRoutes = require('./DEPRECATED_dev.routes'); // Disabled for security

// Queue testing routes - only in development/staging
const queueTestRoutes = require('./queue-test.routes');

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

// Admin login routes - no authentication required for login endpoints
router.get('/admin/csrf-token', (req, res) => {
  const token = req.csrfToken ? req.csrfToken() : '';
  res.json({ csrfToken: token });
});

// Admin routes - strictly for admin accounts with portal access  
router.use('/admin', isAuthenticated, isAdminPortal, rateLimiters.admin, adminRoutes);

// User profile routes - requires authentication
router.use('/user', isAuthenticated, userRoutes);

// Payment routes - consolidated into stripe-payment.routes
// router.use('/', paymentRoutes); // Removed - using stripe-payment.routes instead

// Stripe payment routes - some require authentication, webhook doesn't
router.use('/', stripePaymentRoutes);

// OXXO payment routes - requires authentication
router.use('/payments', isAuthenticated, isClient, oxxoPaymentRoutes);

// Payment health and monitoring routes - admin only
router.use('/payment', paymentHealthRoutes);

// Notification routes - internal API, protected by API key
router.use('/notifications', notificationRoutes);

// Queue routes - requires authentication for status checks
router.use('/queue', queueRoutes);

// SES webhook routes - webhook endpoint doesn't require auth, admin endpoints do
router.use('/', sesWebhookRoutes);

// WhatsApp routes - webhook doesn't require auth, admin endpoints do
router.use('/whatsapp', whatsappRoutes);

// Log analysis routes - admin only for security
router.use('/logs', isAuthenticated, isAdminPortal, rateLimiters.admin, logsRoutes);

// Queue testing routes - only available in development/staging
if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_QUEUE_TESTING) {
    logger.debug('--- Mounting Queue Test Routes (/queue/test) ---');
    router.use('/queue', queueTestRoutes);
}

// Disable development routes completely for security
// if (process.env.NODE_ENV === 'development') {
//     logger.debug("--- Mounting Development Routes (/dev) ---");
//     router.use('/dev', tempDevRoutes);
// } else {
logger.debug('--- Production environment: Skipping Development Routes ---');
// }

module.exports = router;