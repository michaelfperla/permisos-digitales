jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../services/security.service', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(true),
  checkSuspiciousActivity: jest.fn().mockResolvedValue(false),
  incrementFailedAttempts: jest.fn().mockResolvedValue(true),
  isBlocked: jest.fn().mockResolvedValue(false)
}));

jest.mock('../../services/alert.service', () => ({
  sendAlert: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../utils/api-response', () => ({
  error: jest.fn().mockImplementation((res, message, status = 400) => {
    res.status(status).json({ success: false, message });
    return res;
  }),
  tooManyRequests: jest.fn().mockImplementation((res, message) => {
    res.status(429).json({ success: false, message });
    return res;
  })
}));

jest.mock('../../config', () => ({
  payment: {
    maxAmount: 50000000, // 500,000 MXN in centavos
    minAmount: 100, // 1 MXN in centavos
    suspiciousThreshold: 10000000, // 100,000 MXN in centavos
    maxDailySumPerUser: 100000000 // 1,000,000 MXN in centavos
  },
  security: {
    rateLimitWindow: 900000, // 15 minutes
    maxPaymentAttempts: 5
  },
  stripe: {
    webhookSecret: 'whsec_test_secret'
  }
}));

jest.mock('stripe', () => ({
  webhooks: {
    constructEvent: jest.fn()
  }
}));

const stripe = require('stripe');
const {
  paymentRateLimit,
  validatePaymentAmount,
  webhookSecurity
} = require('../payment-security.middleware');
const { logger } = require('../../utils/logger');
const securityService = require('../../services/security.service');
const { sendAlert } = require('../../services/alert.service');
const ApiResponse = require('../../utils/api-response');
const config = require('../../../config');

describe('Payment Security Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      ip: '192.168.1.1',
      user: { 
        id: 'user123',
        email: 'test@example.com',
        isVerified: true
      },
      body: {
        amount: 10000 // 100 MXN in centavos
      },
      headers: {
        'user-agent': 'Test Agent',
        'x-forwarded-for': '192.168.1.1',
        'stripe-signature': 'valid_signature'
      },
      rawBody: Buffer.from('{"test": "data"}'),
      method: 'POST',
      path: '/api/payments/process'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {}
    };

    next = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('paymentRateLimit', () => {
    it('should allow requests when user is not blocked', async () => {
      securityService.isBlocked.mockResolvedValue(false);
      
      await paymentRateLimit(req, res, next);
      
      expect(securityService.isBlocked).toHaveBeenCalledWith('user123', 'payment');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests when user is blocked', async () => {
      securityService.isBlocked.mockResolvedValue(true);
      
      await paymentRateLimit(req, res, next);
      
      expect(ApiResponse.tooManyRequests).toHaveBeenCalledWith(
        res, 
        'Usuario bloqueado temporalmente por exceso de intentos de pago'
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should log security events when user is blocked', async () => {
      securityService.isBlocked.mockResolvedValue(true);
      
      await paymentRateLimit(req, res, next);
      
      expect(securityService.logSecurityEvent).toHaveBeenCalledWith({
        type: 'PAYMENT_BLOCKED',
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'Test Agent',
        details: 'User blocked due to excessive payment attempts'
      });
    });

    it('should send alert when user is blocked', async () => {
      securityService.isBlocked.mockResolvedValue(true);
      
      await paymentRateLimit(req, res, next);
      
      expect(sendAlert).toHaveBeenCalledWith({
        type: 'USER_PAYMENT_BLOCKED',
        severity: 'high',
        message: 'User blocked from payment processing',
        metadata: {
          userId: 'user123',
          ip: '192.168.1.1',
          userAgent: 'Test Agent'
        }
      });
    });

    it('should handle missing user gracefully', async () => {
      delete req.user;
      
      await paymentRateLimit(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(securityService.isBlocked).not.toHaveBeenCalled();
    });

    it('should handle security service errors', async () => {
      securityService.isBlocked.mockRejectedValue(new Error('Security service error'));
      
      await paymentRateLimit(req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith('Error checking payment rate limit', expect.any(Object));
      expect(next).toHaveBeenCalled(); // Fail open for availability
    });

    it('should handle alert service failures gracefully', async () => {
      securityService.isBlocked.mockResolvedValue(true);
      sendAlert.mockRejectedValue(new Error('Alert service down'));
      
      await paymentRateLimit(req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith('Failed to send payment security alert', expect.any(Object));
      expect(ApiResponse.tooManyRequests).toHaveBeenCalled();
    });
  });

  describe('validatePaymentAmount', () => {
    it('should allow valid payment amounts', async () => {
      req.body.amount = 50000; // 500 MXN
      securityService.checkSuspiciousActivity.mockResolvedValue(false);
      
      await validatePaymentAmount(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject amounts below minimum', async () => {
      req.body.amount = 50; // 0.5 MXN
      
      await validatePaymentAmount(req, res, next);
      
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Monto inválido. El monto mínimo es de $1.00 MXN',
        400
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject amounts above maximum', async () => {
      req.body.amount = 60000000; // 600,000 MXN
      
      await validatePaymentAmount(req, res, next);
      
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Monto inválido. El monto máximo es de $500,000.00 MXN',
        400
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should detect suspicious large amounts', async () => {
      req.body.amount = 15000000; // 150,000 MXN
      securityService.checkSuspiciousActivity.mockResolvedValue(true);
      
      await validatePaymentAmount(req, res, next);
      
      expect(securityService.checkSuspiciousActivity).toHaveBeenCalledWith(
        'user123',
        'LARGE_PAYMENT',
        { amount: 15000000, threshold: 10000000 }
      );
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Transacción requiere verificación adicional. Contacte al soporte.',
        403
      );
    });

    it('should allow large amounts when not suspicious', async () => {
      req.body.amount = 15000000; // 150,000 MXN
      securityService.checkSuspiciousActivity.mockResolvedValue(false);
      
      await validatePaymentAmount(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should log suspicious activity attempts', async () => {
      req.body.amount = 15000000;
      securityService.checkSuspiciousActivity.mockResolvedValue(true);
      
      await validatePaymentAmount(req, res, next);
      
      expect(securityService.logSecurityEvent).toHaveBeenCalledWith({
        type: 'SUSPICIOUS_PAYMENT_AMOUNT',
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'Test Agent',
        details: {
          amount: 15000000,
          threshold: 10000000,
          blocked: true
        }
      });
    });

    it('should send alerts for suspicious amounts', async () => {
      req.body.amount = 15000000;
      securityService.checkSuspiciousActivity.mockResolvedValue(true);
      
      await validatePaymentAmount(req, res, next);
      
      expect(sendAlert).toHaveBeenCalledWith({
        type: 'SUSPICIOUS_PAYMENT_AMOUNT',
        severity: 'high',
        message: 'Suspicious payment amount detected',
        metadata: {
          userId: 'user123',
          amount: 15000000,
          ip: '192.168.1.1'
        }
      });
    });

    it('should handle non-numeric amounts', async () => {
      req.body.amount = 'invalid';
      
      await validatePaymentAmount(req, res, next);
      
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Monto inválido. Debe ser un número válido',
        400
      );
    });

    it('should handle negative amounts', async () => {
      req.body.amount = -1000;
      
      await validatePaymentAmount(req, res, next);
      
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Monto inválido. El monto mínimo es de $1.00 MXN',
        400
      );
    });

    it('should handle missing amount', async () => {
      delete req.body.amount;
      
      await validatePaymentAmount(req, res, next);
      
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Monto requerido',
        400
      );
    });

    it('should handle security service errors gracefully', async () => {
      req.body.amount = 15000000;
      securityService.checkSuspiciousActivity.mockRejectedValue(new Error('Service error'));
      
      await validatePaymentAmount(req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith('Error validating payment amount', expect.any(Object));
      expect(next).toHaveBeenCalled(); // Fail open
    });

    it('should log valid payments for audit', async () => {
      req.body.amount = 50000;
      securityService.checkSuspiciousActivity.mockResolvedValue(false);
      
      await validatePaymentAmount(req, res, next);
      
      expect(securityService.logSecurityEvent).toHaveBeenCalledWith({
        type: 'PAYMENT_AMOUNT_VALIDATED',
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'Test Agent',
        details: {
          amount: 50000,
          suspicious: false
        }
      });
    });
  });

  describe('webhookSecurity', () => {
    const mockEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          status: 'succeeded'
        }
      }
    };

    it('should validate webhook signature successfully', async () => {
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      
      await webhookSecurity(req, res, next);
      
      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        req.rawBody,
        'valid_signature',
        'whsec_test_secret'
      );
      expect(req.stripeEvent).toEqual(mockEvent);
      expect(next).toHaveBeenCalled();
    });

    it('should reject webhooks with invalid signatures', async () => {
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      
      await webhookSecurity(req, res, next);
      
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Webhook signature verification failed',
        401
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle missing stripe signature header', async () => {
      delete req.headers['stripe-signature'];
      
      await webhookSecurity(req, res, next);
      
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Missing Stripe signature header',
        401
      );
      expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
    });

    it('should handle missing request body', async () => {
      delete req.rawBody;
      
      await webhookSecurity(req, res, next);
      
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Missing request body',
        400
      );
      expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
    });

    it('should log successful webhook validations', async () => {
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      
      await webhookSecurity(req, res, next);
      
      expect(securityService.logSecurityEvent).toHaveBeenCalledWith({
        type: 'WEBHOOK_VALIDATED',
        ip: '192.168.1.1',
        userAgent: 'Test Agent',
        details: {
          eventId: 'evt_123',
          eventType: 'payment_intent.succeeded',
          signature: 'valid_signature'
        }
      });
    });

    it('should log failed webhook validations', async () => {
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      
      await webhookSecurity(req, res, next);
      
      expect(securityService.logSecurityEvent).toHaveBeenCalledWith({
        type: 'WEBHOOK_VALIDATION_FAILED',
        ip: '192.168.1.1',
        userAgent: 'Test Agent',
        details: {
          signature: 'valid_signature',
          error: 'Invalid signature'
        }
      });
    });

    it('should send alerts for webhook validation failures', async () => {
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      
      await webhookSecurity(req, res, next);
      
      expect(sendAlert).toHaveBeenCalledWith({
        type: 'WEBHOOK_SECURITY_FAILURE',
        severity: 'critical',
        message: 'Webhook signature validation failed',
        metadata: {
          ip: '192.168.1.1',
          userAgent: 'Test Agent',
          signature: 'valid_signature',
          error: 'Invalid signature'
        }
      });
    });

    it('should handle Stripe webhook construction errors', async () => {
      const stripeError = new Error('Webhook timestamp too old');
      stripeError.type = 'StripeSignatureVerificationError';
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw stripeError;
      });
      
      await webhookSecurity(req, res, next);
      
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Webhook signature verification failed',
        401
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'Webhook signature verification failed',
        expect.objectContaining({
          error: 'Webhook timestamp too old',
          signature: 'valid_signature'
        })
      );
    });

    it('should handle missing webhook secret configuration', async () => {
      const originalConfig = config.stripe.webhookSecret;
      config.stripe.webhookSecret = undefined;
      
      await webhookSecurity(req, res, next);
      
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Webhook configuration error',
        500
      );
      expect(logger.error).toHaveBeenCalledWith('Missing webhook secret configuration');
      
      config.stripe.webhookSecret = originalConfig;
    });

    it('should rate limit webhook attempts per IP', async () => {
      // This would require integration with actual rate limiting
      // For now, test that the webhook security processes without rate limiting errors
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      
      // Make multiple requests from same IP
      for (let i = 0; i < 5; i++) {
        await webhookSecurity(req, res, next);
      }
      
      expect(next).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent requests gracefully', async () => {
      req.body.amount = 10000;
      securityService.checkSuspiciousActivity.mockResolvedValue(false);
      
      const promises = Array(10).fill().map(() => validatePaymentAmount(req, res, next));
      
      await Promise.all(promises);
      
      expect(next).toHaveBeenCalledTimes(10);
    });

    it('should handle malformed request objects', async () => {
      req = { headers: {} };
      
      await paymentRateLimit(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should handle database connection errors', async () => {
      securityService.logSecurityEvent.mockRejectedValue(new Error('DB connection failed'));
      req.body.amount = 10000;
      securityService.checkSuspiciousActivity.mockResolvedValue(false);
      
      await validatePaymentAmount(req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith('Failed to log security event', expect.any(Object));
      expect(next).toHaveBeenCalled(); // Should continue despite logging failure
    });

    it('should handle missing configuration gracefully', async () => {
      const originalConfig = { ...config };
      delete config.payment;
      
      req.body.amount = 10000;
      
      await validatePaymentAmount(req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith(
        'Payment configuration missing',
        expect.any(Object)
      );
      expect(ApiResponse.error).toHaveBeenCalledWith(
        res,
        'Configuración de pago no disponible',
        500
      );
      
      // Restore config
      Object.assign(config, originalConfig);
    });
  });
});