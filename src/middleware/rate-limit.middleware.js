const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const { RateLimitError } = require('../utils/errors');

function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later.',
    name = 'API'
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: { message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    // Fix for trust proxy warning in production
    // Use a custom key generator that properly handles proxy headers
    keyGenerator: (req) => {
      // In production, use X-Forwarded-For header from trusted proxy
      // Otherwise use req.ip directly
      if (process.env.NODE_ENV === 'production') {
        // Get the first IP from X-Forwarded-For header (client IP)
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
          const ips = forwarded.split(',').map(ip => ip.trim());
          return ips[0] || req.ip;
        }
      }
      return req.ip;
    },
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

const limiters = {
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 3000,
    message: 'Too many requests from this IP, please try again later.',
    name: 'Global API'
  }),

  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 2000, // Increased from 1000 to 2000
    message: 'Too many authentication attempts, please try again later.',
    name: 'Authentication'
  }),

  admin: createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 1000, // Increased from 500 to 1000
    message: 'Too many admin API requests, please try again later.',
    name: 'Admin API'
  }),

  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 1000,
    message: 'Too many file uploads, please try again later.',
    name: 'File Upload'
  }),

  // Sensitive data operations
  dataExport: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Only 5 exports per hour
    message: 'Too many data export requests. Please wait before trying again.',
    name: 'Data Export'
  }),

  accountDeletion: createRateLimiter({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 3, // Only 3 deletion attempts per day
    message: 'Too many account deletion attempts. Please contact support if you need assistance.',
    name: 'Account Deletion'
  }),

  whatsappToggle: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 changes per hour
    message: 'Too many WhatsApp preference changes. Please wait before trying again.',
    name: 'WhatsApp Toggle'
  })
};

module.exports = limiters;
