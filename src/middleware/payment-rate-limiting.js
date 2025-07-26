// src/middleware/payment-rate-limiting.js
const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const { getConfig } = require('../utils/config');
const config = getConfig();

/**
 * Payment-specific rate limiting middleware
 * More restrictive than general API rate limiting
 */

// Basic payment rate limiter
const paymentRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: (req) => {
    // Adaptive rate limiting based on user verification status
    if (req.user?.is_email_verified && req.user?.phone_verified) {
      return 8; // Verified users get more attempts
    } else if (req.user?.is_email_verified) {
      return 5; // Email verified users get moderate attempts
    }
    return 3; // Unverified users get limited attempts
  },
  keyGenerator: (req) => {
    // Use both IP and user ID for rate limiting
    const userId = req.user?.id || 'anonymous';
    return `payment:${req.ip}:${userId}`;
  },
  message: {
    success: false,
    message: 'Demasiados intentos de pago. Por favor, espera antes de intentar nuevamente.',
    retryAfter: '10 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: async (req, res, options) => {
    logger.warn('Payment rate limit exceeded:', {
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method
    });

    // Send alert for suspicious activity
    try {
      const alertService = require('../services/alert.service');
      await alertService.sendAlert({
        title: 'Payment Rate Limit Exceeded',
        message: `User exceeded payment rate limit`,
        severity: 'MEDIUM',
        details: {
          ip: req.ip,
          userId: req.user?.id,
          endpoint: req.path,
          userAgent: req.get('User-Agent')
        }
      });
    } catch (alertError) {
      logger.error('Failed to send rate limit alert:', alertError);
    }
  }
});

// Strict rate limiter for sensitive operations
const strictPaymentRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 2, // Only 2 attempts per 5 minutes
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous';
    return `strict_payment:${req.ip}:${userId}`;
  },
  message: {
    success: false,
    message: 'Demasiados intentos en operaciones sensibles. Por favor, espera antes de intentar nuevamente.',
    retryAfter: '5 minutos'
  },
  onLimitReached: async (req, res, options) => {
    logger.error('Strict payment rate limit exceeded - potential abuse:', {
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });

    // Send high priority alert
    try {
      const alertService = require('../services/alert.service');
      await alertService.sendAlert({
        title: 'STRICT Payment Rate Limit Exceeded',
        message: `Potential payment abuse detected`,
        severity: 'HIGH',
        details: {
          ip: req.ip,
          userId: req.user?.id,
          endpoint: req.path,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        }
      });
    } catch (alertError) {
      logger.error('Failed to send strict rate limit alert:', alertError);
    }
  }
});

// Per-application rate limiter (prevents rapid payment attempts on same application)
const applicationPaymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Only 3 payment attempts per application per 15 minutes
  keyGenerator: (req) => {
    const applicationId = req.params.applicationId || req.params.id;
    const userId = req.user?.id || 'anonymous';
    return `app_payment:${applicationId}:${userId}`;
  },
  message: {
    success: false,
    message: 'Demasiados intentos de pago para esta solicitud. Por favor, espera antes de intentar nuevamente.',
    retryAfter: '15 minutos'
  },
  onLimitReached: async (req, res, options) => {
    const applicationId = req.params.applicationId || req.params.id;
    logger.warn('Application payment rate limit exceeded:', {
      applicationId,
      ip: req.ip,
      userId: req.user?.id,
      endpoint: req.path
    });
  }
});

// IP-based rate limiter for additional protection
const ipPaymentRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Max 20 payment attempts per IP per hour
  keyGenerator: (req) => `ip_payment:${req.ip}`,
  message: {
    success: false,
    message: 'Demasiados intentos de pago desde esta dirección IP. Por favor, contacta soporte si necesitas ayuda.',
    retryAfter: '1 hora'
  },
  onLimitReached: async (req, res, options) => {
    logger.error('IP payment rate limit exceeded - potential attack:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });

    // Send critical alert
    try {
      const alertService = require('../services/alert.service');
      await alertService.sendAlert({
        title: 'IP Payment Rate Limit Exceeded',
        message: `Potential payment attack from IP: ${req.ip}`,
        severity: 'CRITICAL',
        details: {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          timestamp: new Date().toISOString()
        }
      });
    } catch (alertError) {
      logger.error('Failed to send IP rate limit alert:', alertError);
    }
  }
});

module.exports = {
  paymentRateLimiter,
  strictPaymentRateLimiter,
  applicationPaymentRateLimiter,
  ipPaymentRateLimiter
};