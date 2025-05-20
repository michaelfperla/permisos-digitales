// src/middleware/csrf.middleware.js
const csrf = require('@dr.pogodin/csurf');
const { logger } = require('../utils/enhanced-logger');
const ApiResponse = require('../utils/api-response');

// Configure CSRF protection middleware
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Use lax in development for cross-origin
    path: '/',
    maxAge: 3600 // 1 hour in seconds
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
    session: req.session ? 'exists' : 'none'
  });

  // For API requests, return JSON error
  if (req.xhr || req.originalUrl.startsWith('/api/') || req.get('Accept') === 'application/json') {
    return ApiResponse.forbidden(res, 'Invalid or missing CSRF token');
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
