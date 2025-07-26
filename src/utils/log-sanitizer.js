/**
 * Log Sanitization Utility
 * 
 * This utility sanitizes sensitive data from log messages and objects
 * to prevent exposure of confidential information in application logs.
 * 
 * Sensitive patterns detected and sanitized:
 * - Email addresses
 * - Session IDs  
 * - Payment data (payment intent IDs, customer IDs, tokens)
 * - Authentication tokens
 * - Passwords and secrets
 * - Personal information (phone numbers, names in some contexts)
 * - Database connection strings
 * - API keys and credentials
 */

const REDACTED_TEXT = '[REDACTED]';
const PARTIAL_REDACTED_TEXT = '[PARTIALLY_REDACTED]';

// Sensitive field patterns - these will be completely redacted
const SENSITIVE_FIELDS = [
  // Authentication & Security
  'password',
  'password_hash',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authToken',
  'apiKey',
  'api_key',
  'secret',
  'secretKey',
  'private_key',
  'privateKey',
  'verification_token',
  'verificationToken',
  'reset_token',
  'resetToken',
  'client_secret',
  'clientSecret',
  'webhook_secret',
  'webhookSecret',
  
  // Session & User Data
  'sessionId',
  'session_id',
  'userId',
  'user_id',
  'customerId',
  'customer_id',
  
  // Payment Data
  'paymentIntentId',
  'payment_intent_id',
  'paymentMethodId',
  'payment_method_id',
  'orderId',
  'order_id',
  'chargeId',
  'charge_id',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'securityCode',
  'cardToken',
  'stripeToken',
  'device_session_id',
  'deviceSessionId',
  
  // Database & Infrastructure
  'connectionString',
  'connection_string',
  'database_url',
  'databaseUrl',
  'redis_url',
  'redisUrl',
  
  // Personal Information (when in specific contexts)
  'ssn',
  'social_security_number',
  'taxpayer_id',
  'curp',
  'rfc'
];

// Partially sensitive fields - these will show partial information
const PARTIALLY_SENSITIVE_FIELDS = [
  'email',
  'emailAddress',
  'email_address',
  'phone',
  'phoneNumber',
  'phone_number',
  'referenceId',
  'reference_id',
  'applicationId',
  'application_id'
];

// Regex patterns for detecting sensitive data in strings
const SENSITIVE_PATTERNS = [
  // Email addresses
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: (match) => partiallyRedactEmail(match),
    description: 'email'
  },
  
  // Session IDs (typically long alphanumeric strings)
  {
    pattern: /\b[a-fA-F0-9]{32,}\b/g,
    replacement: (match) => {
      // Don't redact if it looks like a hash in expected places
      if (match.length === 32 || match.length === 40 || match.length === 64) {
        return `${match.substring(0, 4)}***${match.substring(match.length - 4)}`;
      }
      return REDACTED_TEXT;
    },
    description: 'session_id_or_hash'
  },
  
  // JWT tokens (three base64 parts separated by dots)
  {
    pattern: /\beyJ[a-zA-Z0-9+/=]*\.[a-zA-Z0-9+/=]*\.[a-zA-Z0-9+/=_-]*/g,
    replacement: REDACTED_TEXT,
    description: 'jwt_token'
  },
  
  // Stripe payment intent IDs
  {
    pattern: /\bpi_[a-zA-Z0-9]{24,}\b/g,
    replacement: (match) => `pi_***${match.substring(match.length - 4)}`,
    description: 'stripe_payment_intent'
  },
  
  // Stripe customer IDs
  {
    pattern: /\bcus_[a-zA-Z0-9]{14,}\b/g,
    replacement: (match) => `cus_***${match.substring(match.length - 4)}`,
    description: 'stripe_customer'
  },
  
  // Stripe charge IDs
  {
    pattern: /\bch_[a-zA-Z0-9]{24,}\b/g,
    replacement: (match) => `ch_***${match.substring(match.length - 4)}`,
    description: 'stripe_charge'
  },
  
  // API keys (various formats)
  {
    pattern: /\b(?:sk_|pk_|rk_)[a-zA-Z0-9_]{20,}\b/g,
    replacement: REDACTED_TEXT,
    description: 'api_key'
  },
  
  // Mexican phone numbers
  {
    pattern: /\b(?:\+52|52)?[1-9]\d{9}\b/g,
    replacement: (match) => partiallyRedactPhone(match),
    description: 'phone_number'
  },
  
  // Credit card numbers (basic pattern)
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: 'XXXX-XXXX-XXXX-XXXX',
    description: 'credit_card'
  },
  
  // Database connection strings
  {
    pattern: /postgresql:\/\/[^:]+:[^@]+@[^/]+\/\w+/g,
    replacement: 'postgresql://[REDACTED]:[REDACTED]@[HOST]/[DATABASE]',
    description: 'database_url'
  },
  
  // Redis connection strings
  {
    pattern: /redis:\/\/[^:]*:[^@]*@[^/]+/g,
    replacement: 'redis://[REDACTED]:[REDACTED]@[HOST]',
    description: 'redis_url'
  }
];

/**
 * Partially redact an email address
 * Example: john.doe@example.com -> j***e@e***e.com
 */
function partiallyRedactEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return REDACTED_TEXT;
  
  const redactedLocal = local.length > 2 
    ? `${local[0]}***${local[local.length - 1]}`
    : '***';
    
  const [domainName, ...tlds] = domain.split('.');
  const redactedDomain = domainName.length > 2
    ? `${domainName[0]}***${domainName[domainName.length - 1]}`
    : '***';
    
  return `${redactedLocal}@${redactedDomain}.${tlds.join('.')}`;
}

/**
 * Partially redact a phone number
 * Example: +5215551234567 -> +521***4567
 */
function partiallyRedactPhone(phone) {
  if (phone.length < 6) return REDACTED_TEXT;
  
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 6) return REDACTED_TEXT;
  
  const countryCode = phone.startsWith('+52') ? '+52' : '';
  const lastFour = digitsOnly.slice(-4);
  
  return `${countryCode}***${lastFour}`;
}

/**
 * Check if a field name indicates sensitive data
 */
function isSensitiveField(fieldName) {
  if (!fieldName || typeof fieldName !== 'string') return false;
  
  const lowerFieldName = fieldName.toLowerCase();
  
  return SENSITIVE_FIELDS.some(pattern => {
    return lowerFieldName === pattern.toLowerCase() || 
           lowerFieldName.includes(pattern.toLowerCase());
  });
}

/**
 * Check if a field name indicates partially sensitive data
 */
function isPartiallySensitiveField(fieldName) {
  if (!fieldName || typeof fieldName !== 'string') return false;
  
  const lowerFieldName = fieldName.toLowerCase();
  
  return PARTIALLY_SENSITIVE_FIELDS.some(pattern => {
    return lowerFieldName === pattern.toLowerCase() || 
           lowerFieldName.includes(pattern.toLowerCase());
  });
}

/**
 * Sanitize a string by replacing sensitive patterns
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  let sanitized = str;
  
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    if (typeof replacement === 'function') {
      sanitized = sanitized.replace(pattern, replacement);
    } else {
      sanitized = sanitized.replace(pattern, replacement);
    }
  }
  
  return sanitized;
}

/**
 * Deep sanitize an object, replacing sensitive field values
 */
function sanitizeObject(obj, maxDepth = 10, currentDepth = 0) {
  // Prevent infinite recursion
  if (currentDepth >= maxDepth) {
    return '[MAX_DEPTH_REACHED]';
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle primitives
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj;
  }
  
  // Handle Error objects
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: sanitizeString(obj.message),
      stack: sanitizeString(obj.stack || ''),
      code: obj.code
    };
  }
  
  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth, currentDepth + 1));
  }
  
  // Handle Objects
  if (typeof obj === 'object') {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveField(key)) {
        sanitized[key] = REDACTED_TEXT;
      } else if (isPartiallySensitiveField(key)) {
        if (typeof value === 'string') {
          if (key.toLowerCase().includes('email')) {
            sanitized[key] = partiallyRedactEmail(value);
          } else if (key.toLowerCase().includes('phone')) {
            sanitized[key] = partiallyRedactPhone(value);
          } else {
            // For IDs, show partial
            sanitized[key] = value.length > 6 
              ? `${value.substring(0, 3)}***${value.substring(value.length - 3)}`
              : PARTIAL_REDACTED_TEXT;
          }
        } else {
          sanitized[key] = sanitizeObject(value, maxDepth, currentDepth + 1);
        }
      } else {
        sanitized[key] = sanitizeObject(value, maxDepth, currentDepth + 1);
      }
    }
    
    return sanitized;
  }
  
  return obj;
}

/**
 * Main sanitization function that handles any input type
 */
function sanitize(input) {
  try {
    if (typeof input === 'string') {
      return sanitizeString(input);
    }
    
    if (typeof input === 'object' && input !== null) {
      return sanitizeObject(input);
    }
    
    return input;
  } catch (error) {
    // If sanitization fails, return a safe fallback
    return '[SANITIZATION_ERROR]';
  }
}

/**
 * Sanitize log arguments for logger functions
 * This handles the common case where loggers are called with (message, metadata)
 */
function sanitizeLogArgs(...args) {
  return args.map(arg => sanitize(arg));
}

/**
 * Create a sanitized logger wrapper
 * This wraps existing logger methods to automatically sanitize input
 */
function createSanitizedLogger(originalLogger) {
  const sanitizedLogger = {};
  
  // Common logger methods
  const logMethods = ['error', 'warn', 'info', 'debug', 'verbose', 'silly', 'log'];
  
  logMethods.forEach(method => {
    if (typeof originalLogger[method] === 'function') {
      sanitizedLogger[method] = (...args) => {
        const sanitizedArgs = sanitizeLogArgs(...args);
        return originalLogger[method](...sanitizedArgs);
      };
    }
  });
  
  // Preserve other properties and methods
  Object.keys(originalLogger).forEach(key => {
    if (!logMethods.includes(key) && typeof originalLogger[key] !== 'function') {
      sanitizedLogger[key] = originalLogger[key];
    } else if (typeof originalLogger[key] === 'function' && !logMethods.includes(key)) {
      // For other methods, pass them through without sanitization unless they're logging methods
      sanitizedLogger[key] = originalLogger[key].bind(originalLogger);
    }
  });
  
  return sanitizedLogger;
}

/**
 * Quick utilities for common sanitization needs
 */
const utils = {
  /**
   * Sanitize user data for logging
   */
  sanitizeUser(userData) {
    if (!userData) return userData;
    
    return {
      ...userData,
      email: userData.email ? partiallyRedactEmail(userData.email) : undefined,
      phone: userData.phone ? partiallyRedactPhone(userData.phone) : undefined,
      password: REDACTED_TEXT,
      password_hash: REDACTED_TEXT,
      id: userData.id ? String(userData.id) : undefined // IDs are generally safe to log
    };
  },
  
  /**
   * Sanitize payment data for logging
   */
  sanitizePayment(paymentData) {
    if (!paymentData) return paymentData;
    
    return sanitizeObject(paymentData);
  },
  
  /**
   * Sanitize session data for logging
   */
  sanitizeSession(sessionData) {
    if (!sessionData) return sessionData;
    
    return {
      ...sessionData,
      id: sessionData.id ? `***${sessionData.id.slice(-4)}` : undefined,
      userId: sessionData.userId ? String(sessionData.userId) : undefined,
      userEmail: sessionData.userEmail ? partiallyRedactEmail(sessionData.userEmail) : undefined
    };
  },
  
  /**
   * Sanitize request data for logging
   */
  sanitizeRequest(req) {
    if (!req) return req;
    
    return {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get ? req.get('user-agent') : req.headers?.['user-agent'],
      body: req.body ? sanitizeObject(req.body) : undefined,
      params: req.params ? sanitizeObject(req.params) : undefined,
      query: req.query ? sanitizeObject(req.query) : undefined,
      sessionId: req.session?.id ? `***${req.session.id.slice(-4)}` : undefined,
      userId: req.session?.userId ? String(req.session.userId) : undefined
    };
  }
};

module.exports = {
  sanitize,
  sanitizeLogArgs,
  sanitizeString,
  sanitizeObject,
  createSanitizedLogger,
  utils,
  
  // Export individual functions for specific use cases
  partiallyRedactEmail,
  partiallyRedactPhone,
  isSensitiveField,
  isPartiallySensitiveField,
  
  // Export constants for reference
  REDACTED_TEXT,
  PARTIAL_REDACTED_TEXT,
  SENSITIVE_FIELDS,
  PARTIALLY_SENSITIVE_FIELDS
};