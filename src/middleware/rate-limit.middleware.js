const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/enhanced-logger');
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
    max: 1000,
    message: 'Too many authentication attempts, please try again later.',
    name: 'Authentication'
  }),

  admin: createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 500,
    message: 'Too many admin API requests, please try again later.',
    name: 'Admin API'
  }),

  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 1000,
    message: 'Too many file uploads, please try again later.',
    name: 'File Upload'
  })
};

module.exports = limiters;
