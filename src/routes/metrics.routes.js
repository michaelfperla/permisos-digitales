/**
 * Metrics Routes
 * Exposes application metrics in Prometheus format
 */
const express = require('express');
const router = express.Router();
const { metricsEndpoint } = require('../utils/metrics');
const { logger } = require('../utils/enhanced-logger');

// Metrics endpoint
router.get('/', async (req, res) => {
  logger.debug('Metrics endpoint called');
  return metricsEndpoint(req, res);
});

module.exports = router;
