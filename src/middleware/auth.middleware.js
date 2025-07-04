// src/middleware/auth.middleware.js
const { logger } = require('../utils/enhanced-logger');
const ApiResponse = require('../utils/api-response');
const { getCookieDomain, logDomainInfo } = require('../utils/domain-utils');

// This middleware checks if a user is authenticated by looking for session data.
exports.isAuthenticated = (req, res, next) => {
  // Log domain information for debugging
  logDomainInfo(req, 'auth');

  // Debug session data with domain information
  console.log('Auth middleware - Request session:', {
    hasSession: !!req.session,
    sessionId: req.session?.id,
    userId: req.session?.userId,
    path: req.path,
    method: req.method,
    host: req.get('host'),
    origin: req.get('origin'),
    cookieDomain: getCookieDomain(req),
    cookies: req.cookies ? Object.keys(req.cookies) : 'none',
    sessionCookie: req.cookies ? req.cookies['permisos.sid'] : 'none'
  });

  // Check if the session exists and if userId is stored in the session
  if (req.session && req.session.userId) {
    // User is authenticated, allow the request to proceed to the next handler
    console.log(`Auth middleware - Authentication successful for user ID: ${req.session.userId} on domain: ${req.get('host')}`);
    return next();
  } else {
    // User is not authenticated - log detailed information for debugging
    logger.warn('Authentication failed: No valid session found.', {
      host: req.get('host'),
      origin: req.get('origin'),
      cookieDomain: getCookieDomain(req),
      hasSession: !!req.session,
      sessionId: req.session?.id,
      cookies: req.cookies ? Object.keys(req.cookies) : 'none',
      path: req.path,
      method: req.method
    });
    // Send a 401 Unauthorized response
    return ApiResponse.unauthorized(res);
  }
};

// This middleware is deprecated - Use isAdminPortal instead
exports.isAdmin = (req, res, next) => {
  logger.warn(`Deprecated isAdmin middleware used for user ID: ${req.session?.userId || 'unknown'}, redirecting to isAdminPortal check`);
  return this.isAdminPortal(req, res, next);
};

// Enhanced security middleware to check for admin portal access
exports.isAdminPortal = (req, res, next) => {
  if (req.session &&
        req.session.userId &&
        req.session.accountType === 'admin' &&
        req.session.isAdminPortal === true) {
    // All checks passed
    logger.info(`Admin portal access granted for user ID: ${req.session.userId}`);
    return next();
  }

  // If any check failed, log the reason and deny access
  if (!req.session || !req.session.userId) {
    logger.warn('Admin portal access denied: No valid session');
    return ApiResponse.unauthorized(res);
  }
  if (req.session.accountType !== 'admin') {
    logger.warn(`Admin portal access denied: Not an admin account - UserId: ${req.session.userId}`);
    return ApiResponse.forbidden(res, 'Se requiere acceso de administrador');
  }
  if (req.session.isAdminPortal !== true) {
    logger.warn(`Admin portal access denied: Admin account missing portal flag - UserId: ${req.session.userId}`);
    return ApiResponse.forbidden(res, 'Acceso denegado. Por favor usa el portal de inicio de sesión correcto.');
  }
  // Fallback for unexpected cases
  logger.error('Admin portal check reached unexpected state.');
  return ApiResponse.forbidden(res, 'Acceso denegado.');
};

// Security middleware to verify client-only routes
// Allow admin accounts to access client routes for viewing purposes
exports.isClient = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    logger.warn('Client route access denied: No valid session');
    return ApiResponse.unauthorized(res);
  }

  // Allow admin accounts to access client routes
  if (req.session.accountType === 'admin') {
    logger.info(`Admin account ${req.session.userId} accessing client route: ${req.path}`);
    return next();
  }

  if (req.session.accountType === 'client') {
    return next();
  }

  // Unknown account type
  logger.warn(`Unknown account type: ${req.session.accountType}`);
  return ApiResponse.forbidden(res, 'Tipo de cuenta inválido');
};

// Logs general API access attempts for authenticated users to the main application log (e.g., console, application.log).
// This is primarily for debugging request flow.
// Specific security events (login, logout, password change, failed attempts, etc.) are logged explicitly
// to the security_audit_log database table via securityService.logActivity for a persistent audit trail.
exports.auditRequest = (req, res, next) => {
  if (req.session && req.session.userId) {
    // We'll implement the actual logging in the security.service.js
    const securityService = require('../services/security.service');

    // Capture relevant request data
    const requestData = {
      userId: req.session.userId,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };

    // Async log without blocking the request
    securityService.logActivity(
      req.session.userId,
      'api_access',
      req.ip,
      req.headers['user-agent'],
      requestData
    ).catch(err => {
      logger.error('Failed to log security audit:', err);
    });
  }

  next();
};
