// Mock config first to prevent database connection errors
jest.mock('../../config', () => ({
  database: {
    url: 'mock://database'
  },
  stripe: {
    privateKey: 'mock_stripe_key',
    publicKey: 'mock_public_key'
  },
  redis: {
    url: 'mock://redis'
  }
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../services/alert.service', () => ({
  sendAlert: jest.fn().mockResolvedValue(true)
}));

jest.mock('express-rate-limit', () => {
  return jest.fn((options) => {
    return jest.fn((req, res, next) => {
      // Simple mock implementation
      const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
      const limit = typeof options.max === 'function' ? options.max(req) : options.max;
      
      // Store request count in a simple object
      if (!global.rateLimitStore) global.rateLimitStore = {};
      if (!global.rateLimitStore[key]) global.rateLimitStore[key] = 0;
      
      global.rateLimitStore[key]++;
      
      if (global.rateLimitStore[key] > limit) {
        if (options.onLimitReached) {
          options.onLimitReached(req, res, options);
        }
        return res.status(429).json(options.message);
      }
      
      next();
    });
  });
});

const { logger } = require('../../utils/logger');
const { sendAlert } = require('../../services/alert.service');

describe('Payment Rate Limiting Middleware', () => {
  let req, res, next;
  let paymentRateLimiter, strictPaymentRateLimiter, applicationPaymentRateLimiter, ipPaymentRateLimiter;

  beforeEach(() => {
    // Reset rate limit store
    global.rateLimitStore = {};
    
    // Mock Express request object with all needed methods
    req = {
      ip: '192.168.1.1',
      user: { 
        id: 'user123', 
        is_email_verified: true,
        phone_verified: true,
        email: 'test@example.com' 
      },
      params: { applicationId: 'app123' },
      path: '/api/payments/create',
      method: 'POST',
      get: jest.fn((header) => {
        const headers = {
          'User-Agent': 'Test Agent',
          'x-forwarded-for': '192.168.1.1'
        };
        return headers[header];
      }),
      headers: {
        'user-agent': 'Test Agent',
        'x-forwarded-for': '192.168.1.1'
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {}
    };

    next = jest.fn();
    
    jest.clearAllMocks();
    
    // Re-require the middleware to get fresh instances
    delete require.cache[require.resolve('../payment-rate-limiting')];
    const middleware = require('../payment-rate-limiting');
    paymentRateLimiter = middleware.paymentRateLimiter;
    strictPaymentRateLimiter = middleware.strictPaymentRateLimiter;
    applicationPaymentRateLimiter = middleware.applicationPaymentRateLimiter;
    ipPaymentRateLimiter = middleware.ipPaymentRateLimiter;
  });

  describe('paymentRateLimiter', () => {
    it('should allow requests within rate limit for verified users', async () => {
      req.user.is_email_verified = true;
      req.user.phone_verified = true;
      
      await paymentRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow requests within rate limit for unverified users', async () => {
      req.user.is_email_verified = false;
      req.user.phone_verified = false;
      
      await paymentRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding rate limit for verified users', async () => {
      req.user.is_email_verified = true;
      req.user.phone_verified = true;
      
      // Make requests up to limit (8 for verified users)
      for (let i = 0; i < 8; i++) {
        await paymentRateLimiter(req, res, next);
      }
      
      // 9th request should be blocked
      await paymentRateLimiter(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Demasiados intentos de pago')
        })
      );
    });

    it('should block requests exceeding rate limit for unverified users', async () => {
      req.user.is_email_verified = false;
      req.user.phone_verified = false;
      
      // Make requests up to limit (3 for unverified users)
      for (let i = 0; i < 3; i++) {
        await paymentRateLimiter(req, res, next);
      }
      
      // 4th request should be blocked
      await paymentRateLimiter(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Demasiados intentos de pago')
        })
      );
    });

    it('should track rate limits per user and IP combination', async () => {
      // First user makes maximum requests
      for (let i = 0; i < 8; i++) {
        await paymentRateLimiter(req, res, next);
      }
      
      // Different user from same IP should have separate limit
      req.user.id = 'user456';
      await paymentRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(9);
    });

    it('should send alert when rate limit is exceeded', async () => {
      req.user.is_email_verified = true;
      req.user.phone_verified = true;
      
      // Exceed rate limit
      for (let i = 0; i < 9; i++) {
        await paymentRateLimiter(req, res, next);
      }
      
      expect(logger.warn).toHaveBeenCalledWith('Payment rate limit exceeded:', expect.objectContaining({
        ip: '192.168.1.1',
        userId: 'user123',
        userAgent: 'Test Agent',
        endpoint: '/api/payments/create'
      }));
      
      expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Payment Rate Limit Exceeded',
        severity: 'MEDIUM'
      }));
    });

    it('should handle missing user gracefully', async () => {
      delete req.user;
      
      await paymentRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should handle different verification levels', async () => {
      // Email verified only
      req.user.is_email_verified = true;
      req.user.phone_verified = false;
      
      // Should get 5 attempts for email verified users
      for (let i = 0; i < 5; i++) {
        await paymentRateLimiter(req, res, next);
      }
      
      // 6th request should be blocked
      await paymentRateLimiter(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('strictPaymentRateLimiter', () => {
    it('should allow requests within strict rate limit', async () => {
      await strictPaymentRateLimiter(req, res, next);
      await strictPaymentRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding strict rate limit', async () => {
      // Strict limit is typically lower, let's assume 2 requests
      for (let i = 0; i < 2; i++) {
        await strictPaymentRateLimiter(req, res, next);
      }
      
      // 3rd request should be blocked
      await strictPaymentRateLimiter(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Demasiados intentos')
        })
      );
    });

    it('should send high severity alert for strict limit violations', async () => {
      // Exceed strict rate limit
      for (let i = 0; i < 3; i++) {
        await strictPaymentRateLimiter(req, res, next);
      }
      
      expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'HIGH'
      }));
    });
  });

  describe('applicationPaymentRateLimiter', () => {
    it('should allow requests within application rate limit', async () => {
      await applicationPaymentRateLimiter(req, res, next);
      await applicationPaymentRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding application rate limit', async () => {
      // Application limit is typically around 3-5 requests
      for (let i = 0; i < 3; i++) {
        await applicationPaymentRateLimiter(req, res, next);
      }
      
      // Next request should be blocked
      await applicationPaymentRateLimiter(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('solicitud')
        })
      );
    });

    it('should track rate limits per application', async () => {
      // First application makes maximum requests
      for (let i = 0; i < 3; i++) {
        await applicationPaymentRateLimiter(req, res, next);
      }
      
      // Different application should still be allowed
      req.params.applicationId = 'app456';
      await applicationPaymentRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(4);
    });

    it('should handle missing applicationId', async () => {
      delete req.params.applicationId;
      
      await applicationPaymentRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('ipPaymentRateLimiter', () => {
    it('should allow requests within IP rate limit', async () => {
      // Make several requests within IP limit
      for (let i = 0; i < 10; i++) {
        await ipPaymentRateLimiter(req, res, next);
      }
      
      expect(next).toHaveBeenCalledTimes(10);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding IP rate limit', async () => {
      // IP limit is typically higher, assume 20 requests
      for (let i = 0; i < 20; i++) {
        await ipPaymentRateLimiter(req, res, next);
      }
      
      // 21st request should be blocked
      await ipPaymentRateLimiter(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('IP')
        })
      );
    });

    it('should track rate limits per IP address', async () => {
      // First IP makes maximum requests
      for (let i = 0; i < 20; i++) {
        await ipPaymentRateLimiter(req, res, next);
      }
      
      // Different IP should still be allowed
      req.ip = '192.168.1.2';
      await ipPaymentRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(21);
    });

    it('should send critical alert for IP rate limit violations', async () => {
      // Exceed IP rate limit
      for (let i = 0; i < 21; i++) {
        await ipPaymentRateLimiter(req, res, next);
      }
      
      expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'CRITICAL'
      }));
    });
  });

  describe('Error Handling', () => {
    it('should handle alert service failures gracefully', async () => {
      sendAlert.mockRejectedValue(new Error('Alert service down'));
      
      // Exceed rate limit to trigger alert
      for (let i = 0; i < 9; i++) {
        await paymentRateLimiter(req, res, next);
      }
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to send'), expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should handle missing user information gracefully', async () => {
      req.user = null;
      
      await paymentRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle malformed request objects', async () => {
      req.params = {};
      req.user = null;
      req.ip = '127.0.0.1';
      
      await applicationPaymentRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should work with different middleware in sequence', async () => {
      // Test using multiple middleware together
      await paymentRateLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      
      await applicationPaymentRateLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(2);
      
      await ipPaymentRateLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(3);
    });

    it('should maintain separate counters for different middleware', async () => {
      // Each middleware should have its own rate limiting
      for (let i = 0; i < 2; i++) {
        await paymentRateLimiter(req, res, next);
        await applicationPaymentRateLimiter(req, res, next);
        await ipPaymentRateLimiter(req, res, next);
      }
      
      // Should have called next for all requests since we're within limits
      expect(next).toHaveBeenCalledTimes(6);
    });
  });
});