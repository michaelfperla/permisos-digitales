/**
 * Domain Utilities
 * Centralized domain handling for multi-domain authentication support
 */

const { logger } = require('./logger');

/**
 * Get the appropriate cookie domain based on the request host
 * Supports both permisosdigitales.com and permisosdigitales.com.mx
 *
 * @param {Object} req - Express request object
 * @returns {string|undefined} - Cookie domain or undefined for development
 */
const getCookieDomain = (req) => {
  if (process.env.NODE_ENV !== 'production') {
    return undefined; // No domain restriction in development
  }

  const host = (req.get('host') || req.headers.host || '').toLowerCase();

  // Remove port if present
  const hostname = host.replace(/:\d+$/, '');

  // Exact domain matching to prevent subdomain spoofing attacks
  // ONLY accept our exact known domains - NO wildcard matching
  const validMxDomains = [
    'permisosdigitales.com.mx',
    'www.permisosdigitales.com.mx',
    'api.permisosdigitales.com.mx',
    'admin.permisosdigitales.com.mx'
  ];

  const validComDomains = [
    'permisosdigitales.com',
    'www.permisosdigitales.com',
    'api.permisosdigitales.com',
    'admin.permisosdigitales.com'
  ];

  // Always use .com.mx domain to avoid cross-domain issues
  // .com domains should be redirected at infrastructure level
  if (validMxDomains.includes(hostname) || validComDomains.includes(hostname)) {
    return '.permisosdigitales.com.mx';
  }

  // Log suspicious hosts and reject them
  logger.warn('[Domain Utils] Suspicious host detected - rejecting:', {
    host: hostname,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Return null for invalid domains - let middleware handle rejection
  return null;
};

/**
 * Determine if the request is from a valid domain
 *
 * @param {Object} req - Express request object
 * @returns {boolean} - True if from valid domain
 */
const isValidDomain = (req) => {
  if (process.env.NODE_ENV !== 'production') {
    return true; // Allow all domains in development
  }

  const host = (req.get('host') || req.headers.host || '').toLowerCase();
  const hostname = host.replace(/:\d+$/, ''); // Remove port

  // List of all valid domains (both .com and .com.mx)
  const validDomains = [
    'permisosdigitales.com.mx',
    'www.permisosdigitales.com.mx',
    'api.permisosdigitales.com.mx',
    'admin.permisosdigitales.com.mx',
    'permisosdigitales.com',
    'www.permisosdigitales.com',
    'api.permisosdigitales.com',
    'admin.permisosdigitales.com'
  ];

  return validDomains.includes(hostname);
};

/**
 * Get the primary frontend domain for redirects
 * 
 * @param {Object} req - Express request object
 * @returns {string} - Primary domain for redirects
 */
const getPrimaryDomain = (req) => {
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3002';
  }
  
  const host = req.get('host') || req.headers.host || '';
  
  // Preserve the domain the user is on for better UX
  if (host.includes('permisosdigitales.com.mx')) {
    return 'https://permisosdigitales.com.mx';
  } else if (host.includes('permisosdigitales.com')) {
    return 'https://permisosdigitales.com';
  }
  
  // Default fallback
  return 'https://permisosdigitales.com.mx';
};

/**
 * Log domain-related debugging information
 * 
 * @param {Object} req - Express request object
 * @param {string} context - Context for logging (e.g., 'session', 'csrf')
 */
const logDomainInfo = (req, context = 'domain') => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`[${context.toUpperCase()}] Domain Info:`, {
      host: req.get('host'),
      origin: req.get('origin'),
      cookieDomain: getCookieDomain(req),
      isValid: isValidDomain(req),
      primaryDomain: getPrimaryDomain(req)
    });
  }
};

module.exports = {
  getCookieDomain,
  isValidDomain,
  getPrimaryDomain,
  logDomainInfo
};
