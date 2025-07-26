/**
 * Queue Test Routes
 * 
 * Routes for testing the PDF queue system
 * These routes should ONLY be available in development/staging
 */

const router = require('express').Router();
const { isAuthenticated } = require('../middleware/auth.middleware');
const queueTestController = require('../controllers/queue-test.controller');

// Middleware to ensure these routes are NOT available in production
const blockInProduction = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_QUEUE_TESTING) {
    return res.status(403).json({
      success: false,
      error: 'Queue testing is disabled in production'
    });
  }
  next();
};

// All routes require authentication and are blocked in production
router.use(isAuthenticated);
router.use(blockInProduction);

// Test single job addition
router.post('/test/single', queueTestController.testSingleQueueAdd);

// Test multiple concurrent job additions
router.post('/test/multiple', queueTestController.testMultipleQueueAdd);

// Get current queue status
router.get('/status', queueTestController.getQueueStatus);

// Clear test jobs (cleanup)
router.delete('/test/clear', queueTestController.clearTestJobs);

// Simulate a payment success to test the full flow
router.post('/test/simulate-payment', queueTestController.simulatePaymentToQueue);

module.exports = router;