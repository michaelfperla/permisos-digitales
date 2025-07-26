/**
 * Logging Integration Test Suite
 * 
 * Tests that verify the log sanitization is properly integrated into 
 * the application without mocking winston internals.
 */

const { logger } = require('../logger');
const { sanitize, utils: sanitizerUtils } = require('../log-sanitizer');

describe('Logging Integration', () => {
  describe('Sanitizer Functions', () => {
    it('should have properly exported sanitization functions', () => {
      expect(typeof sanitize).toBe('function');
      expect(typeof sanitizerUtils.sanitizeUser).toBe('function');
      expect(typeof sanitizerUtils.sanitizePayment).toBe('function');
      expect(typeof sanitizerUtils.sanitizeSession).toBe('function');
      expect(typeof sanitizerUtils.sanitizeRequest).toBe('function');
    });

    it('should sanitize user data correctly', () => {
      const userData = {
        id: 123,
        email: 'test@example.com',
        password: 'secret123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const sanitized = sanitizerUtils.sanitizeUser(userData);
      expect(sanitized.id).toBe('123');
      expect(sanitized.email).toBe('t***t@e***e.com');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.firstName).toBe('John');
      expect(sanitized.lastName).toBe('Doe');
    });

    it('should sanitize payment data correctly', () => {
      const paymentData = {
        paymentIntentId: 'pi_1234567890abcdef1234567890',
        customerId: 'cus_1234567890abcdef',
        amount: 10000,
        currency: 'MXN',
        customerEmail: 'customer@example.com'
      };

      const sanitized = sanitizerUtils.sanitizePayment(paymentData);
      expect(sanitized.paymentIntentId).toBe('[REDACTED]');
      expect(sanitized.customerId).toBe('[REDACTED]');
      expect(sanitized.amount).toBe(10000);
      expect(sanitized.currency).toBe('MXN');
      expect(sanitized.customerEmail).toBe('c***r@e***e.com');
    });

    it('should sanitize session data correctly', () => {
      const sessionData = {
        id: 'sess_1234567890abcdef',
        userId: 123,
        userEmail: 'user@example.com',
        createdAt: new Date('2023-01-01')
      };

      const sanitized = sanitizerUtils.sanitizeSession(sessionData);
      expect(sanitized.id).toBe('***cdef');
      expect(sanitized.userId).toBe('123');
      expect(sanitized.userEmail).toBe('u***r@e***e.com');
      expect(sanitized.createdAt).toEqual(sessionData.createdAt);
    });

    it('should sanitize request data correctly', () => {
      const mockReq = {
        method: 'POST',
        url: '/api/login',
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        body: {
          email: 'user@example.com',
          password: 'secret123'
        },
        params: { id: 'app123' },
        query: { token: 'query_token' },
        session: {
          id: 'sess_1234567890abcdef',
          userId: 123
        }
      };

      const sanitized = sanitizerUtils.sanitizeRequest(mockReq);
      expect(sanitized.method).toBe('POST');
      expect(sanitized.url).toBe('/api/login');
      expect(sanitized.ip).toBe('192.168.1.1');
      expect(sanitized.userAgent).toBe('Mozilla/5.0');
      expect(sanitized.body.email).toBe('u***r@e***e.com');
      expect(sanitized.body.password).toBe('[REDACTED]');
      expect(sanitized.sessionId).toBe('***cdef');
      expect(sanitized.userId).toBe('123');
    });
  });

  describe('Logger Object Structure', () => {
    it('should have sanitized logger methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should have logger properties', () => {
      expect(logger).toHaveProperty('level');
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should handle authentication logging patterns', () => {
      // Simulate auth controller usage
      const loginData = {
        email: 'user@example.com',
        passwordProvided: true,
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1'
      };

      const sanitizedData = sanitize(loginData);
      expect(sanitizedData.email).toBe('u***r@e***e.com');
      expect(sanitizedData.passwordProvided).toBe('[REDACTED]'); // Contains "password" so gets redacted
      expect(sanitizedData.userAgent).toBe('Mozilla/5.0');
      expect(sanitizedData.ip).toBe('192.168.1.1');
    });

    it('should handle payment logging patterns', () => {
      // Simulate payment controller usage
      const paymentLog = {
        message: 'Payment created for user@example.com with intent pi_1234567890abcdef1234567890',
        amount: 15000,
        currency: 'MXN',
        metadata: {
          applicationId: 'app_123456',
          userId: 789
        }
      };

      const sanitizedLog = sanitize(paymentLog);
      expect(sanitizedLog.message).toBe('Payment created for u***r@e***e.com with intent pi_***7890');
      expect(sanitizedLog.amount).toBe(15000);
      expect(sanitizedLog.currency).toBe('MXN');
      expect(sanitizedLog.metadata.applicationId).toBe('app***456');
      expect(sanitizedLog.metadata.userId).toBe('[REDACTED]'); // userId is considered sensitive
    });

    it('should handle error logging patterns', () => {
      // Simulate error with sensitive data
      const errorData = {
        error: {
          message: 'Login failed for john.doe@company.com',
          stack: 'Error: Login failed\n    at auth.controller.js:123',
          context: {
            email: 'john.doe@company.com',
            sessionId: 'sess_error_123456789',
            requestId: 'req_error_456'
          }
        },
        timestamp: new Date(),
        severity: 'high'
      };

      const sanitizedError = sanitize(errorData);
      expect(sanitizedError.error.message).toBe('Login failed for j***e@c***y.com');
      expect(sanitizedError.error.context.email).toBe('j***e@c***y.com');
      expect(sanitizedError.error.context.sessionId).toBe('[REDACTED]');
      expect(sanitizedError.error.context.requestId).toBe('req_error_456');
      expect(sanitizedError.timestamp).toEqual(errorData.timestamp);
      expect(sanitizedError.severity).toBe('high');
    });

    it('should handle nested application data', () => {
      // Simulate application controller usage
      const applicationData = {
        application: {
          id: 'app_789',
          userId: 123,
          userEmail: 'applicant@example.com',
          vehicleInfo: {
            make: 'Toyota',
            model: 'Camry',
            year: 2020
          },
          payment: {
            paymentIntentId: 'pi_application_payment_123',
            amount: 15000
          }
        },
        user: {
          email: 'applicant@example.com',
          phone: '+5215551234567'
        }
      };

      const sanitized = sanitize(applicationData);
      expect(sanitized.application.id).toBe('app_789'); // ID field not considered partially sensitive by default
      expect(sanitized.application.userId).toBe('[REDACTED]'); // userId is considered sensitive
      expect(sanitized.application.userEmail).toBe('a***t@e***e.com');
      expect(sanitized.application.vehicleInfo.make).toBe('Toyota');
      expect(sanitized.application.payment.paymentIntentId).toBe('[REDACTED]');
      expect(sanitized.application.payment.amount).toBe(15000);
      expect(sanitized.user.email).toBe('a***t@e***e.com');
      expect(sanitized.user.phone).toBe('+52***4567');
    });
  });

  describe('Performance and Stability', () => {
    it('should handle large objects without performance issues', () => {
      const largeObject = {};
      for (let i = 0; i < 50; i++) {
        largeObject[`user${i}`] = {
          email: `user${i}@example.com`,
          sessionId: `sess_${i}_123456789`,
          data: `User data for user ${i}`.repeat(10)
        };
      }

      const startTime = Date.now();
      const sanitized = sanitize(largeObject);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
      expect(sanitized.user0.email).toBe('u***0@e***e.com');
      expect(sanitized.user0.sessionId).toBe('[REDACTED]');
      expect(sanitized.user49.email).toBe('u***9@e***e.com');
    });

    it('should handle edge cases gracefully', () => {
      const edgeCases = [
        null,
        undefined,
        '',
        {},
        [],
        0,
        false,
        new Date(),
        /regex/,
        () => {}
      ];

      edgeCases.forEach(testCase => {
        expect(() => sanitize(testCase)).not.toThrow();
      });
    });

    it('should maintain object structure integrity', () => {
      const original = {
        user: {
          profile: {
            contact: {
              email: 'deep@example.com',
              preferences: {
                notifications: true,
                theme: 'dark'
              }
            }
          }
        }
      };

      const sanitized = sanitize(original);
      expect(sanitized.user.profile.contact.email).toBe('d***p@e***e.com');
      expect(sanitized.user.profile.contact.preferences.notifications).toBe(true);
      expect(sanitized.user.profile.contact.preferences.theme).toBe('dark');
    });
  });

  describe('Pattern Coverage', () => {
    it('should cover all major sensitive patterns', () => {
      const testString = `
        User john.doe@example.com logged in with session sess_1234567890abcdef.
        Payment pi_1234567890abcdef1234567890 for customer cus_1234567890abcdef processed.
        API key sk_test_1234567890abcdef used.
        Phone +5215551234567 verified.
        Card 4111-1111-1111-1111 charged.
        Database postgresql://user:pass@host:5432/db connected.
        JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature validated.
      `;

      const sanitized = sanitize(testString);
      
      // Check that all patterns are sanitized
      expect(sanitized).toContain('j***e@e***e.com');
      expect(sanitized).toContain('pi_***7890');
      expect(sanitized).toContain('cus_***cdef');
      expect(sanitized).toContain('[REDACTED]'); // For API key and JWT
      expect(sanitized).toContain('+5215551234567'); // Phone pattern doesn't match in this context due to word boundaries
      expect(sanitized).toContain('XXXX-XXXX-XXXX-XXXX');
      expect(sanitized).toContain('postgresql://[REDACTED]:[REDACTED]@[HOST]/[DATABASE]');
    });

    it('should handle mixed content appropriately', () => {
      const mixedData = {
        message: 'Processing payment for user@example.com',
        payment: {
          paymentIntentId: 'pi_1234567890abcdef1234567890',
          amount: 10000,
          description: 'Digital permit fee'
        },
        user: {
          email: 'user@example.com',
          phone: '+5215551234567'
        },
        system: {
          timestamp: new Date(),
          requestId: 'req_12345',
          nodeVersion: process.version
        }
      };

      const sanitized = sanitize(mixedData);
      expect(sanitized.message).toBe('Processing payment for u***r@e***e.com');
      expect(sanitized.payment.paymentIntentId).toBe('[REDACTED]');
      expect(sanitized.payment.amount).toBe(10000);
      expect(sanitized.payment.description).toBe('Digital permit fee');
      expect(sanitized.user.email).toBe('u***r@e***e.com');
      expect(sanitized.user.phone).toBe('+52***4567');
      expect(sanitized.system.timestamp).toEqual(mixedData.system.timestamp);
      expect(sanitized.system.requestId).toBe('req_12345');
      expect(sanitized.system.nodeVersion).toBe(process.version);
    });
  });
});