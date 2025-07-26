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
  
  const host = req.get('host') || req.headers.host || '';
  
  // Support both .com and .com.mx domains
  if (host.includes('permisosdigitales.com.mx')) {
    return '.permisosdigitales.com.mx';
  } else if (host.includes('permisosdigitales.com')) {
    return '.permisosdigitales.com';
  }
  
  // Fallback to .com.mx for unknown hosts (backwards compatibility)
  return '.permisosdigitales.com.mx';
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
  
  const host = req.get('host') || req.headers.host || '';
  
  return host.includes('permisosdigitales.com.mx') || 
         host.includes('permisosdigitales.com') ||
         host.includes('api.permisosdigitales.com.mx');
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
