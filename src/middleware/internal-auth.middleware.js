/**
 * Internal API Authentication Middleware
 * Used for service-to-service communication
 */

const { logger } = require('../utils/logger');

/**
 * Verify internal API key
 */
const requireInternalApiKey = (req, res, next) => {
  const providedKey = req.headers['x-internal-api-key'] || req.query.apiKey;
  const expectedKey = process.env.INTERNAL_API_KEY;
  
  if (!expectedKey) {
    logger.error('INTERNAL_API_KEY not configured');
    return res.status(500).json({ error: 'Internal server error' });
  }
  
  if (!providedKey || providedKey !== expectedKey) {
    logger.warn('Invalid internal API key attempt', {
      ip: req.ip,
      path: req.path,
      userAgent: req.headers['user-agent']
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Add flag to indicate internal service request
  req.isInternalService = true;
  next();
};

module.exports = {
  requireInternalApiKey
};