/**
 * Log Sanitizer Test Suite
 * 
 * Comprehensive tests for the log sanitization utility to ensure
 * sensitive data is properly redacted from logs while maintaining
 * functionality and debuggability.
 */

const {
  sanitize,
  sanitizeLogArgs,
  sanitizeString,
  sanitizeObject,
  createSanitizedLogger,
  utils,
  partiallyRedactEmail,
  partiallyRedactPhone,
  isSensitiveField,
  isPartiallySensitiveField,
  REDACTED_TEXT,
  PARTIAL_REDACTED_TEXT,
  SENSITIVE_FIELDS,
  PARTIALLY_SENSITIVE_FIELDS
} = require('../log-sanitizer');

describe('Log Sanitizer', () => {
  
  describe('Email Redaction', () => {
    it('should partially redact email addresses', () => {
      const email = 'john.doe@example.com';
      const result = partiallyRedactEmail(email);
      expect(result).toBe('j***e@e***e.com');
    });

    it('should handle short email addresses', () => {
      const email = 'a@b.com';
      const result = partiallyRedactEmail(email);
      expect(result).toBe('***@***.com');
    });

    it('should handle complex email addresses', () => {
      const email = 'user.name+tag@subdomain.example.com';
      const result = partiallyRedactEmail(email);
      expect(result).toBe('u***g@s***n.example.com');
    });

    it('should handle malformed email addresses', () => {
      const malformed = 'notanemail';
      const result = partiallyRedactEmail(malformed);
      expect(result).toBe(REDACTED_TEXT);
    });
  });

  describe('Phone Number Redaction', () => {
    it('should partially redact Mexican phone numbers', () => {
      const phone = '+5215551234567';
      const result = partiallyRedactPhone(phone);
      expect(result).toBe('+52***4567');
    });

    it('should handle phone numbers without country code', () => {
      const phone = '5551234567';
      const result = partiallyRedactPhone(phone);
      expect(result).toBe('***4567');
    });

    it('should handle short phone numbers', () => {
      const phone = '12345';
      const result = partiallyRedactPhone(phone);
      expect(result).toBe(REDACTED_TEXT);
    });

    it('should handle phone numbers with formatting', () => {
      const phone = '+52 (555) 123-4567';
      const result = partiallyRedactPhone(phone);
      expect(result).toBe('+52***4567');
    });
  });

  describe('Sensitive Field Detection', () => {
    it('should detect sensitive fields', () => {
      const sensitiveFields = [
        'password',
        'token',
        'apiKey',
        'secretKey',
        'sessionId',
        'paymentIntentId'
      ];

      sensitiveFields.forEach(field => {
        expect(isSensitiveField(field)).toBe(true);
      });
    });

    it('should detect partially sensitive fields', () => {
      const partiallyFields = [
        'email',
        'phone',
        'applicationId',
        'referenceId'
      ];

      partiallyFields.forEach(field => {
        expect(isPartiallySensitiveField(field)).toBe(true);
      });
    });

    it('should not detect safe fields as sensitive', () => {
      const safeFields = [
        'name',
        'status',
        'createdAt',
        'amount',
        'currency'
      ];

      safeFields.forEach(field => {
        expect(isSensitiveField(field)).toBe(false);
        expect(isPartiallySensitiveField(field)).toBe(false);
      });
    });

    it('should handle case insensitive field detection', () => {
      expect(isSensitiveField('PASSWORD')).toBe(true);
      expect(isSensitiveField('Password')).toBe(true);
      expect(isPartiallySensitiveField('EMAIL')).toBe(true);
      expect(isPartiallySensitiveField('Email')).toBe(true);
    });
  });

  describe('String Sanitization', () => {
    it('should sanitize email addresses in strings', () => {
      const text = 'User john.doe@example.com logged in';
      const result = sanitizeString(text);
      expect(result).toBe('User j***e@e***e.com logged in');
    });

    it('should sanitize payment intent IDs', () => {
      const text = 'Payment intent pi_1234567890abcdef1234567890 created';
      const result = sanitizeString(text);
      expect(result).toBe('Payment intent pi_***7890 created');
    });

    it('should sanitize customer IDs', () => {
      const text = 'Customer cus_1234567890abcdef created';
      const result = sanitizeString(text);
      expect(result).toBe('Customer cus_***cdef created');
    });

    it('should sanitize JWT tokens', () => {
      const text = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = sanitizeString(text);
      expect(result).toBe('Token: [REDACTED]');
    });

    it('should sanitize API keys', () => {
      const text = 'Using API key sk_test_1234567890abcdef1234567890';
      const result = sanitizeString(text);
      expect(result).toBe('Using API key [REDACTED]');
    });

    it('should sanitize credit card numbers', () => {
      const text = 'Card number: 4111 1111 1111 1111';
      const result = sanitizeString(text);
      expect(result).toBe('Card number: XXXX-XXXX-XXXX-XXXX');
    });

    it('should sanitize database connection strings', () => {
      const text = 'Connecting to postgresql://user:password@localhost:5432/database';
      const result = sanitizeString(text);
      expect(result).toBe('Connecting to postgresql://[REDACTED]:[REDACTED]@[HOST]/[DATABASE]');
    });

    it('should handle multiple sensitive patterns in one string', () => {
      const text = 'User john@example.com paid with pi_1234567890abcdef1234567890 using card 4111-1111-1111-1111';
      const result = sanitizeString(text);
      expect(result).toContain('j***n@e***e.com');
      expect(result).toContain('pi_***7890');
      expect(result).toContain('XXXX-XXXX-XXXX-XXXX');
    });
  });

  describe('Object Sanitization', () => {
    it('should sanitize sensitive fields in objects', () => {
      const obj = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        token: 'abc123token',
        amount: 100
      };

      const result = sanitizeObject(obj);
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('j***n@e***e.com');
      expect(result.password).toBe(REDACTED_TEXT);
      expect(result.token).toBe(REDACTED_TEXT);
      expect(result.amount).toBe(100);
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          credentials: {
            password: 'secret123',
            apiKey: 'sk_test_123456'
          }
        },
        payment: {
          paymentIntentId: 'pi_1234567890abcdef',
          amount: 100
        }
      };

      const result = sanitizeObject(obj);
      expect(result.user.name).toBe('John Doe');
      expect(result.user.email).toBe('j***n@e***e.com');
      expect(result.user.credentials.password).toBe(REDACTED_TEXT);
      expect(result.user.credentials.apiKey).toBe(REDACTED_TEXT);
      expect(result.payment.paymentIntentId).toBe(REDACTED_TEXT);
      expect(result.payment.amount).toBe(100);
    });

    it('should handle arrays', () => {
      const obj = {
        users: [
          { name: 'John', email: 'john@example.com', password: 'secret' },
          { name: 'Jane', email: 'jane@example.com', password: 'secret2' }
        ]
      };

      const result = sanitizeObject(obj);
      expect(result.users[0].name).toBe('John');
      expect(result.users[0].email).toBe('j***n@e***e.com');
      expect(result.users[0].password).toBe(REDACTED_TEXT);
      expect(result.users[1].name).toBe('Jane');
      expect(result.users[1].email).toBe('j***e@e***e.com');
      expect(result.users[1].password).toBe(REDACTED_TEXT);
    });

    it('should handle Error objects', () => {
      const error = new Error('Database connection failed');
      error.code = 'ECONNREFUSED';

      const result = sanitizeObject({ error });
      expect(result.error.name).toBe('Error');
      expect(result.error.message).toBe('Database connection failed');
      expect(result.error.code).toBe('ECONNREFUSED');
      expect(result.error.stack).toBeDefined();
    });

    it('should handle Date objects', () => {
      const date = new Date('2023-01-01');
      const obj = { createdAt: date, name: 'test' };

      const result = sanitizeObject(obj);
      expect(result.createdAt).toBe(date);
      expect(result.name).toBe('test');
    });

    it('should prevent infinite recursion', () => {
      const obj = { name: 'test' };
      obj.self = obj; // Circular reference

      const result = sanitizeObject(obj);
      expect(result.name).toBe('test');
      // Circular references are handled by max depth, so we check for nested structure
      expect(result.self.name).toBe('test');
      expect(typeof result.self.self).toBe('object');
      // The deepest level should hit max depth
      let current = result;
      let depth = 0;
      while(current.self && typeof current.self === 'object' && current.self.name !== '[MAX_DEPTH_REACHED]') {
        current = current.self;
        depth++;
      }
      expect(depth).toBeGreaterThan(5); // Should have several levels before hitting max depth
    });

    it('should handle null and undefined values', () => {
      const obj = {
        name: 'John',
        email: null,
        phone: undefined,
        password: 'secret'
      };

      const result = sanitizeObject(obj);
      expect(result.name).toBe('John');
      expect(result.email).toBe(null);
      expect(result.phone).toBe(undefined);
      expect(result.password).toBe(REDACTED_TEXT);
    });
  });

  describe('Payment Data Sanitization', () => {
    it('should sanitize payment-related data', () => {
      const paymentData = {
        paymentIntentId: 'pi_1234567890abcdef',
        customerId: 'cus_1234567890abcdef',
        amount: 10000,
        currency: 'MXN',
        customerEmail: 'customer@example.com',
        cardNumber: '4111111111111111',
        description: 'Payment for digital permit'
      };

      const result = sanitizeObject(paymentData);
      expect(result.paymentIntentId).toBe(REDACTED_TEXT);
      expect(result.customerId).toBe(REDACTED_TEXT);
      expect(result.amount).toBe(10000);
      expect(result.currency).toBe('MXN');
      expect(result.customerEmail).toBe('c***r@e***e.com');
      expect(result.description).toBe('Payment for digital permit');
    });
  });

  describe('User Data Sanitization', () => {
    it('should sanitize user data appropriately', () => {
      const userData = {
        id: 123,
        email: 'user@example.com',
        phone: '+5215551234567',
        password: 'secret123',
        firstName: 'John',
        lastName: 'Doe',
        sessionId: 'sess_1234567890abcdef'
      };

      const result = utils.sanitizeUser(userData);
      expect(result.id).toBe('123');
      expect(result.email).toBe('u***r@e***e.com');
      expect(result.phone).toBe('+52***4567');
      expect(result.password).toBe(REDACTED_TEXT);
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });
  });

  describe('Session Data Sanitization', () => {
    it('should sanitize session data', () => {
      const sessionData = {
        id: 'sess_1234567890abcdef',
        userId: 123,
        userEmail: 'user@example.com',
        createdAt: new Date()
      };

      const result = utils.sanitizeSession(sessionData);
      expect(result.id).toBe('***cdef');
      expect(result.userId).toBe('123');
      expect(result.userEmail).toBe('u***r@e***e.com');
      expect(result.createdAt).toBe(sessionData.createdAt);
    });
  });

  describe('Request Data Sanitization', () => {
    it('should sanitize request data', () => {
      const mockReq = {
        method: 'POST',
        url: '/api/login',
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        body: {
          email: 'user@example.com',
          password: 'secret123'
        },
        params: { id: 'user123' },
        query: { token: 'abc123' },
        session: {
          id: 'sess_1234567890abcdef',
          userId: 123
        }
      };

      const result = utils.sanitizeRequest(mockReq);
      expect(result.method).toBe('POST');
      expect(result.url).toBe('/api/login');
      expect(result.ip).toBe('192.168.1.1');
      expect(result.userAgent).toBe('Mozilla/5.0');
      expect(result.body.email).toBe('u***r@e***e.com');
      expect(result.body.password).toBe(REDACTED_TEXT);
      expect(result.sessionId).toBe('***cdef');
      expect(result.userId).toBe('123');
    });
  });

  describe('Logger Wrapper', () => {
    it('should create a sanitized logger wrapper', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        level: 'info'
      };

      const sanitizedLogger = createSanitizedLogger(mockLogger);
      
      // Test that methods exist
      expect(typeof sanitizedLogger.info).toBe('function');
      expect(typeof sanitizedLogger.error).toBe('function');
      expect(typeof sanitizedLogger.warn).toBe('function');
      expect(typeof sanitizedLogger.debug).toBe('function');
      
      // Test that non-logging properties are preserved
      expect(sanitizedLogger.level).toBe('info');
    });

    it('should sanitize log arguments', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn()
      };

      const sanitizedLogger = createSanitizedLogger(mockLogger);
      
      const logData = {
        email: 'user@example.com',
        password: 'secret123',
        message: 'User login attempt'
      };

      sanitizedLogger.info('User login', logData);
      
      expect(mockLogger.info).toHaveBeenCalled();
      const [message, data] = mockLogger.info.mock.calls[0];
      expect(message).toBe('User login');
      expect(data.email).toBe('u***r@e***e.com');
      expect(data.password).toBe(REDACTED_TEXT);
      expect(data.message).toBe('User login attempt');
    });
  });

  describe('Main Sanitize Function', () => {
    it('should handle different input types', () => {
      // String input
      const stringResult = sanitize('Email: user@example.com');
      expect(stringResult).toBe('Email: u***r@e***e.com');

      // Object input
      const objectResult = sanitize({
        email: 'user@example.com',
        password: 'secret'
      });
      expect(objectResult.email).toBe('u***r@e***e.com');
      expect(objectResult.password).toBe(REDACTED_TEXT);

      // Primitive input
      const numberResult = sanitize(123);
      expect(numberResult).toBe(123);

      const booleanResult = sanitize(true);
      expect(booleanResult).toBe(true);

      const nullResult = sanitize(null);
      expect(nullResult).toBe(null);
    });

    it('should handle sanitization errors gracefully', () => {
      // Mock a situation where sanitization might fail
      const problematicInput = {};
      Object.defineProperty(problematicInput, 'badProperty', {
        get: () => { throw new Error('Access denied'); },
        enumerable: true
      });

      const result = sanitize(problematicInput);
      expect(result).toBe('[SANITIZATION_ERROR]');
    });
  });

  describe('Log Arguments Sanitization', () => {
    it('should sanitize multiple log arguments', () => {
      const args = [
        'Login attempt',
        { email: 'user@example.com', password: 'secret' },
        { sessionId: 'sess_1234567890abcdef' }
      ];

      const result = sanitizeLogArgs(...args);
      expect(result[0]).toBe('Login attempt');
      expect(result[1].email).toBe('u***r@e***e.com');
      expect(result[1].password).toBe(REDACTED_TEXT);
      expect(result[2].sessionId).toBe(REDACTED_TEXT);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000) + ' user@example.com ' + 'b'.repeat(1000);
      const result = sanitizeString(longString);
      expect(result).toContain('u***r@e***e.com');
    });

    it('should handle deeply nested objects', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  email: 'deep@example.com',
                  password: 'secret'
                }
              }
            }
          }
        }
      };

      const result = sanitizeObject(deepObject);
      expect(result.level1.level2.level3.level4.level5.email).toBe('d***p@e***e.com');
      expect(result.level1.level2.level3.level4.level5.password).toBe(REDACTED_TEXT);
    });

    it('should handle objects with many properties', () => {
      const largeObject = {};
      for (let i = 0; i < 100; i++) {
        largeObject[`field${i}`] = `value${i}`;
        largeObject[`email${i}`] = `user${i}@example.com`;
        largeObject[`password${i}`] = `secret${i}`;
      }

      const result = sanitizeObject(largeObject);
      expect(result.field0).toBe('value0');
      expect(result.email0).toBe('u***0@e***e.com');
      expect(result.password0).toBe(REDACTED_TEXT);
    });

    it('should handle empty inputs', () => {
      expect(sanitize('')).toBe('');
      expect(sanitize({})).toEqual({});
      expect(sanitize([])).toEqual([]);
    });

    it('should handle special characters in sensitive data', () => {
      const obj = {
        email: 'user+tag@example.com',
        password: 'p@ssw0rd!',
        token: 'token-with-dashes_and_underscores'
      };

      const result = sanitizeObject(obj);
      expect(result.email).toBe('u***g@e***e.com');
      expect(result.password).toBe(REDACTED_TEXT);
      expect(result.token).toBe(REDACTED_TEXT);
    });
  });

  describe('Performance', () => {
    it('should sanitize large datasets efficiently', () => {
      const largeDataset = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          id: i,
          email: `user${i}@example.com`,
          password: `password${i}`,
          data: `some data ${i}`
        });
      }

      const start = Date.now();
      const result = sanitizeObject(largeDataset);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.length).toBe(1000);
      expect(result[0].email).toBe('u***0@e***e.com');
      expect(result[0].password).toBe(REDACTED_TEXT);
    });
  });

  describe('Constants', () => {
    it('should export expected constants', () => {
      expect(REDACTED_TEXT).toBe('[REDACTED]');
      expect(PARTIAL_REDACTED_TEXT).toBe('[PARTIALLY_REDACTED]');
      expect(Array.isArray(SENSITIVE_FIELDS)).toBe(true);
      expect(Array.isArray(PARTIALLY_SENSITIVE_FIELDS)).toBe(true);
      expect(SENSITIVE_FIELDS.length).toBeGreaterThan(0);
      expect(PARTIALLY_SENSITIVE_FIELDS.length).toBeGreaterThan(0);
    });
  });
});