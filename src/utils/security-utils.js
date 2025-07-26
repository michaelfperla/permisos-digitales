/**
 * Security utilities for data sanitization and protection
 */

/**
 * Sanitize data for logging to prevent exposure of sensitive information
 * @param {any} data - Data to sanitize
 * @returns {any} - Sanitized data
 */
function sanitizeForLogging(data) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLogging(item));
  }

  const sanitized = {};
  const sensitiveFields = [
    'password', 'password_hash', 'token', 'secret', 'key', 'authorization',
    'auth', 'cookie', 'session', 'credit_card', 'card_number', 'cvv', 'ssn',
    'social_security', 'bank_account', 'routing_number', 'api_key'
  ];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize user data for logging
 * @param {object} user - User object
 * @returns {object} - Sanitized user data
 */
function sanitizeUser(user) {
  if (!user || typeof user !== 'object') {
    return user;
  }

  return {
    ...user,
    password: user.password ? '[REDACTED]' : undefined,
    password_hash: user.password_hash ? '[REDACTED]' : undefined,
    email_verification_token: user.email_verification_token ? '[REDACTED]' : undefined,
    session_id: user.session_id ? '[REDACTED]' : undefined
  };
}

/**
 * Mask sensitive parts of strings (like email addresses, phone numbers)
 * @param {string} str - String to mask
 * @param {string} type - Type of masking ('email', 'phone', 'card')
 * @returns {string} - Masked string
 */
function maskSensitiveString(str, type = 'auto') {
  if (!str || typeof str !== 'string') {
    return str;
  }

  if (type === 'email' || (type === 'auto' && str.includes('@'))) {
    const [local, domain] = str.split('@');
    if (local.length <= 2) {
      return `${local}***@${domain}`;
    }
    return `${local.substring(0, 2)}***@${domain}`;
  }

  if (type === 'phone' || (type === 'auto' && /^\+?[\d\s\-\(\)]+$/.test(str))) {
    const cleaned = str.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      return str.replace(/\d(?=\d{4})/g, '*');
    }
    return str;
  }

  if (type === 'card') {
    return str.replace(/\d(?=\d{4})/g, '*');
  }

  // Default: mask middle portion
  if (str.length <= 4) {
    return '*'.repeat(str.length);
  }
  
  const start = str.substring(0, 2);
  const end = str.substring(str.length - 2);
  const middle = '*'.repeat(str.length - 4);
  
  return start + middle + end;
}

/**
 * Remove or mask sensitive data from request objects
 * @param {object} req - Express request object
 * @returns {object} - Sanitized request data
 */
function sanitizeRequest(req) {
  const sanitized = {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    params: req.params,
    headers: sanitizeHeaders(req.headers),
    body: sanitizeForLogging(req.body),
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };

  return sanitized;
}

/**
 * Sanitize HTTP headers
 * @param {object} headers - HTTP headers object
 * @returns {object} - Sanitized headers
 */
function sanitizeHeaders(headers) {
  const sensitiveHeaders = [
    'authorization', 'cookie', 'x-auth-token', 'x-api-key',
    'x-access-token', 'x-csrf-token'
  ];

  const sanitized = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveHeaders.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

module.exports = {
  sanitizeForLogging,
  sanitizeUser,
  maskSensitiveString,
  sanitizeRequest,
  sanitizeHeaders
};