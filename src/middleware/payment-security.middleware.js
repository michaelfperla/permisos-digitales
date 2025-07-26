// src/middleware/payment-security.middleware.js
const { logger } = require('../utils/logger');
const securityService = require('../services/security.service');
const ApiResponse = require('../utils/api-response');
// Configuration compatibility layer for dev/prod environments
function getConfig() {
  try {
    // Try unified config first (production)
    const unifiedConfig = require('../config/unified-config');
    if (unifiedConfig.isInitialized && unifiedConfig.isInitialized()) {
      return unifiedConfig.getSync();
    }
  } catch (error) {
    // Unified config not available or not initialized
  }
  
  try {
    // Fall back to dev config (development)
    return require('../config/dev-config');
  } catch (error) {
    // Neither config available
    logger.error('No configuration system available');
    throw new Error('Configuration system not available');
  }
}
// Get config lazily to avoid race conditions
let config = null;
function getConfigInstance() {
  if (!config) {
    config = getConfig();
  }
  return config;
}

/**
 * Enhanced payment security middleware
 */
const paymentSecurityMiddleware = {
  /**
   * Rate limiting specifically for payment operations
   */
  paymentRateLimit: async (req, res, next) => {
    try {
      const { applicationId } = req.params;
      const userId = req.user?.id;
      const ipAddress = req.ip;

      // Check IP-based rate limiting (more restrictive for payments)
      const isIpLimited = await securityService.isRateLimitExceeded(
        ipAddress,
        'payment_attempt',
        10, // 10 attempts
        60  // per hour
      );

      if (isIpLimited) {
        await securityService.logActivity(
          userId,
          'payment_rate_limited_ip',
          ipAddress,
          req.headers['user-agent'],
          { applicationId, method: req.method, path: req.path }
        );
        return ApiResponse.tooManyRequests(res, 'Demasiados intentos de pago desde esta dirección IP. Por favor, espere antes de intentar nuevamente.');
      }

      // Check user-based rate limiting
      // For user-based limiting, we'll use the IP address but check by user action type
      if (userId) {
        const isUserLimited = await securityService.isRateLimitExceeded(
          ipAddress,
          `payment_attempt_user_${userId}`,
          15, // 15 attempts
          60  // per hour
        );

        if (isUserLimited) {
          await securityService.logActivity(
            userId,
            'payment_rate_limited_user',
            ipAddress,
            req.headers['user-agent'],
            { applicationId, method: req.method, path: req.path }
          );
          return ApiResponse.tooManyRequests(res, 'Demasiados intentos de pago. Por favor, espere antes de intentar nuevamente.');
        }
      }

      next();
    } catch (error) {
      logger.error('Error in payment rate limiting middleware:', error);
      // Don't block on middleware errors
      next();
    }
  },

  /**
   * Validate payment amounts and prevent suspicious transactions
   */
  validatePaymentAmount: (req, res, next) => {
    try {
      const { amount } = req.body;
      const { applicationId } = req.params;

      // Basic amount validation
      if (amount && (typeof amount !== 'number' || amount <= 0)) {
        return ApiResponse.badRequest(res, 'Monto de pago inválido.');
      }

      // Check for suspiciously high amounts using configurable threshold
      const maxAmount = getConfigInstance().payment?.maxAmount || 10000;
      if (amount && amount > maxAmount) {
        logger.warn('Suspicious high payment amount detected:', {
          amount,
          maxAllowed: maxAmount,
          applicationId,
          userId: req.user?.id,
          ip: req.ip
        });

        // Send alert if enabled
        if (getConfigInstance().payment?.suspiciousAlertEnabled) {
          const alertService = require('../services/alert.service');
          alertService.sendSecurityAlert(
            'Suspicious Payment Amount',
            `Payment attempt of $${amount} MXN exceeds limit of $${maxAmount} MXN`,
            {
              amount,
              maxAllowed: maxAmount,
              applicationId,
              userId: req.user?.id,
              userEmail: req.user?.email,
              ip: req.ip,
              userAgent: req.headers['user-agent']
            },
            'HIGH'
          ).catch(err => logger.error('Error sending payment alert:', err));
        }

        // Log but don't block - might be legitimate
        securityService.logActivity(
          req.user?.id,
          'suspicious_payment_amount',
          req.ip,
          req.headers['user-agent'],
          { amount, applicationId, maxAllowed: maxAmount }
        ).catch(err => logger.error('Error logging suspicious payment:', err));
      }

      next();
    } catch (error) {
      logger.error('Error in payment amount validation middleware:', error);
      next();
    }
  },

  /**
   * Enhanced webhook security with raw body capture
   */
  webhookSecurity: (req, res, next) => {
    try {
      const signature = req.headers['stripe-signature'];
      const userAgent = req.headers['user-agent'];

      // Basic webhook validation
      if (!signature) {
        logger.warn('Webhook request without signature:', {
          ip: req.ip,
          userAgent,
          path: req.path
        });
        return ApiResponse.badRequest(res, 'Missing webhook signature');
      }

      // Log webhook attempts for monitoring
      logger.info('Webhook request received:', {
        ip: req.ip,
        userAgent,
        hasSignature: !!signature,
        contentLength: req.headers['content-length']
      });

      next();
    } catch (error) {
      logger.error('Error in webhook security middleware:', error);
      return ApiResponse.error(res, 'Webhook security error', 500);
    }
  }
};

module.exports = paymentSecurityMiddleware;
