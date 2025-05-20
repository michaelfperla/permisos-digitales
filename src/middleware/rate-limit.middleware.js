/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and DoS attacks
 */
const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/enhanced-logger');
const { RateLimitError } = require('../utils/errors');

/**
 * Creates a rate limiter with the specified configuration
 *
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of requests in the time window
 * @param {string} options.message - Message to send when rate limit is exceeded
 * @param {string} options.name - Name of the rate limiter for logging
 * @returns {Function} Express middleware function
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // Default: 15 minutes
    max = 100,                 // Default: 100 requests per windowMs
    message = 'Too many requests, please try again later.',
    name = 'API'               // Default name for logging
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: { message },
    standardHeaders: true,     // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,      // Disable the `X-RateLimit-*` headers
    // Handler called when rate limit is exceeded
    handler: (req, res, next) => {
      const error = new RateLimitError(
        message,
        'RATE_LIMIT_EXCEEDED'
      );

      logger.warn(`Rate limit exceeded for ${name}`, {
        ip: req.ip,
        path: req.originalUrl,
        method: req.method,
        userAgent: req.headers['user-agent'],
        userId: req.session?.userId || 'anonymous',
        limiter: name
      });

      next(error);
    }
  });
}

// Create different rate limiters for different endpoints
const limiters = {
  // Global API rate limiter (applied to all API routes)
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 3000,                 // Increased for testing
    message: 'Too many requests from this IP, please try again later.',
    name: 'Global API'
  }),

  // Authentication rate limiter (more strict)
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 1000,                // Increased for testing
    message: 'Too many authentication attempts, please try again later.',
    name: 'Authentication'
  }),

  // Admin API rate limiter
  admin: createRateLimiter({
    windowMs: 5 * 60 * 1000,   // 5 minutes
    max: 500,                  // Increased for testing
    message: 'Too many admin API requests, please try again later.',
    name: 'Admin API'
  }),

  // File upload rate limiter
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 1000,                 // Increased for testing
    message: 'Too many file uploads, please try again later.',
    name: 'File Upload'
  })
};

module.exports = limiters;
