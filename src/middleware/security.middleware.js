/**
 * Security Middleware
 * Basic security functions for API protection
 */

const { logger } = require('../utils/logger');

/**
 * Validate internal API key for certain endpoints
 */
function validateApiKey(req, res, next) {
  // Skip API key validation for public endpoints
  const publicPaths = ['/health', '/ready', '/auth/login', '/auth/register', '/webhook/stripe'];
  
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Check for API key in headers
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  const validApiKey = process.env.API_SECRET_KEY;
  
  // If API key is configured, enforce validation
  if (validApiKey) {
    if (!apiKey) {
      logger.warn('API key missing for protected endpoint', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(401).json({ 
        error: 'API key required for this endpoint' 
      });
    }
    
    // Validate API key using secure comparison
    if (!secureCompare(apiKey.replace('Bearer ', ''), validApiKey)) {
      logger.warn('Invalid API key attempt', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(401).json({ 
        error: 'Invalid API key' 
      });
    }
  }
  
  next();
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function secureCompare(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Enhanced input sanitization and XSS protection
 */
function sanitizeInput(req, res, next) {
  // Enhanced XSS patterns to detect
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /<form[^>]*>/gi,
    /data:text\/html/gi,
    /expression\s*\(/gi
  ];

  function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    
    let sanitized = str;
    let detected = false;
    
    // Check for XSS patterns
    for (const pattern of xssPatterns) {
      if (pattern.test(sanitized)) {
        detected = true;
        sanitized = sanitized.replace(pattern, '');
      }
    }
    
    // Only remove potentially dangerous tags, preserve legitimate angle brackets
    sanitized = sanitized
      .replace(/&lt;script/gi, '') // Remove encoded script tags
      .replace(/&gt;/gi, '') // Remove encoded >
      .trim();
    
    // Only remove HTML tags if XSS patterns were detected
    if (detected) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }
    
    return { sanitized, detected };
  }

  function recursiveSanitize(obj, path = '') {
    let hasXss = false;
    
    if (typeof obj === 'string') {
      const result = sanitizeString(obj);
      if (result.detected) {
        hasXss = true;
        logger.warn('XSS attempt detected and sanitized', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          field: path,
          originalValue: obj.substring(0, 100) // Log first 100 chars only
        });
      }
      return { value: result.sanitized, hasXss };
    }
    
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const result = recursiveSanitize(obj[i], `${path}[${i}]`);
        obj[i] = result.value;
        if (result.hasXss) hasXss = true;
      }
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        const result = recursiveSanitize(obj[key], path ? `${path}.${key}` : key);
        obj[key] = result.value;
        if (result.hasXss) hasXss = true;
      }
    }
    
    return { value: obj, hasXss };
  }

  // Sanitize query parameters
  if (req.query) {
    const result = recursiveSanitize(req.query, 'query');
    req.query = result.value;
  }
  
  // Sanitize request body
  if (req.body) {
    const result = recursiveSanitize(req.body, 'body');
    req.body = result.value;
  }
  
  // Sanitize URL parameters
  if (req.params) {
    const result = recursiveSanitize(req.params, 'params');
    req.params = result.value;
  }
  
  next();
}

/**
 * Main security middleware that applies appropriate security measures
 * Only applies API key validation to specific internal API endpoints
 */
function securityMiddleware(req, res, next) {
  // Always apply input sanitization for XSS protection
  sanitizeInput(req, res, () => {
    // Only apply API key validation for specific internal API endpoints
    const internalApiPaths = ['/api/internal/', '/api/admin/bulk', '/api/system/'];
    const requiresApiKey = internalApiPaths.some(path => req.path.startsWith(path));
    
    if (requiresApiKey) {
      return validateApiKey(req, res, next);
    }
    
    // For all other endpoints, just continue (they use session auth)
    next();
  });
}

module.exports = securityMiddleware;

// Export individual functions for specific use cases
module.exports.validateApiKey = validateApiKey;
module.exports.sanitizeInput = sanitizeInput;