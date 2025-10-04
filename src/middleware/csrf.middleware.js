// src/middleware/csrf.middleware.js
const csrf = require('@dr.pogodin/csurf');
const { logger } = require('../utils/logger');
const ApiResponse = require('../utils/api-response');
const { getCookieDomain, logDomainInfo } = require('../utils/domain-utils');

// Pre-create CSRF middleware for primary domain only
const isProduction = process.env.NODE_ENV === 'production';
// Single domain strategy to avoid cross-domain issues
const PRIMARY_DOMAIN = isProduction ? '.permisosdigitales.com.mx' : undefined;

// Create single CSRF middleware instance
const csrfMiddleware = csrf({
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 14400, // 4 hours in seconds (matches session TTL)
    domain: PRIMARY_DOMAIN
  },
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  value: (req) => {
    // Try header first (common for AJAX/API calls)
    const fromHeader = req.headers['x-csrf-token'];
    if (fromHeader) return fromHeader;

    // Fallback to body (for traditional forms)
    const fromBody = req.body && req.body._csrf;
    if (fromBody) return fromBody;

    // Fallback to query (less common, but possible)
    const fromQuery = req.query && req.query._csrf;
    if (fromQuery) return fromQuery;

    return null; // Indicate token not found
  }
});

logger.info('[CSRF] Created CSRF middleware for domain:', PRIMARY_DOMAIN || 'localhost');

// CSRF protection middleware that uses the correct pre-created instance
const csrfProtection = (req, res, next) => {
  const cookieDomain = getCookieDomain(req);

  // Check if domain detection returned null (invalid domain)
  if (cookieDomain === null) {
    logger.error('[CSRF] Security: Invalid domain detected', {
      host: req.get('host'),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return res.status(403).json({
      error: 'Invalid domain',
      message: 'This domain is not authorized to access this service'
    });
  }

  // In production, verify domain matches our expected primary domain
  if (isProduction && cookieDomain !== PRIMARY_DOMAIN) {
    logger.error('[CSRF] Security: Rejecting non-primary domain', {
      domain: cookieDomain,
      expectedDomain: PRIMARY_DOMAIN,
      host: req.get('host'),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    // Reject request for security - only allow primary domain
    return res.status(403).json({
      error: 'Domain not supported',
      message: 'This domain is not authorized to access this service'
    });
  }

  // Use the single CSRF middleware instance
  csrfMiddleware(req, res, next);
};

// Error handler for CSRF errors
const handleCsrfError = (err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }

  // Log the CSRF error with detailed information
  logger.warn(`CSRF error for ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
    csrfToken: req.headers['x-csrf-token'] || (req.body && req.body._csrf) || 'none',
    cookies: req.cookies ? 'exists' : 'none',
    session: req.session ? 'exists' : 'none',
    host: req.get('host'),
    origin: req.get('origin'),
    domain: getCookieDomain(req)
  });

  // For API requests (on api.domain.com), return JSON error
  if (req.xhr || req.get('Accept') === 'application/json') {
    return ApiResponse.forbidden(res, 'Token CSRF inválido o faltante');
  }

  // For regular requests, redirect to login page with error
  if (req.originalUrl.includes('admin')) {
    return res.redirect('/admin-login?error=csrf');
  } else {
    return res.redirect('/login?error=csrf');
  }
};

// Middleware to add CSRF token to response locals for templates
const addCsrfToken = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
};

module.exports = {
  csrfProtection,
  handleCsrfError,
  addCsrfToken
};
