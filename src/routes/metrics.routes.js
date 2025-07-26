/**
 * Metrics Routes
 * Exposes application metrics in Prometheus format
 */
const express = require('express');
const router = express.Router();
const { metricsEndpoint } = require('../utils/metrics');
const { logger } = require('../utils/logger');
const metricsCollector = require('../monitoring/metrics-collector');

// Prometheus metrics endpoint
router.get('/', async (req, res) => {
  logger.debug('Metrics endpoint called');
  return metricsEndpoint(req, res);
});

// Business metrics endpoint (JSON format)
router.get('/business', async (req, res) => {
  try {
    const metrics = metricsCollector.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get business metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message
    });
  }
});

// Metrics summary endpoint
router.get('/summary', async (req, res) => {
  try {
    const summary = metricsCollector.getSummary();
    res.json(summary);
  } catch (error) {
    logger.error('Failed to get metrics summary:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics summary',
      message: error.message
    });
  }
});

// Protected detailed metrics endpoint
router.get('/detailed', async (req, res) => {
  try {
    // Check internal API key
    const providedKey = req.headers['x-internal-api-key'] || req.query.key;
    const expectedKey = process.env.INTERNAL_API_KEY;
    
    if (expectedKey && providedKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const metrics = metricsCollector.getMetrics();
    const summary = metricsCollector.getSummary();
    
    res.json({
      timestamp: new Date().toISOString(),
      summary,
      detailed: metrics
    });
  } catch (error) {
    logger.error('Failed to get detailed metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve detailed metrics',
      message: error.message
    });
  }
});

module.exports = router;
