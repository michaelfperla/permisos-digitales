/**
 * Audit Middleware
 * Logs API requests for security auditing
 */
const { logger } = require('../utils/enhanced-logger');

/**
 * Middleware to log API requests for security auditing
 */
const auditRequest = (req, res, next) => {
  // Get user info if available
  const userId = req.session?.userId || 'unauthenticated';
  const userEmail = req.session?.userEmail || 'unknown';
  
  // Log the request
  logger.info(`API Request: ${req.method} ${req.originalUrl}`, {
    userId,
    userEmail,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Continue with the request
  next();
};

module.exports = {
  auditRequest
};
