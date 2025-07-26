// src/routes/debug.routes.js
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const ApiResponse = require('../utils/api-response');
const { csrfProtection } = require('../middleware/csrf.middleware');

/**
 * Production debugging endpoints
 * These endpoints help diagnose CSRF and authentication issues in production
 */

// GET /debug/csrf-test - Test CSRF token generation and validation
router.get('/csrf-test', csrfProtection, (req, res) => {
  try {
    const csrfToken = req.csrfToken();
    const debugInfo = {
      csrfToken,
      tokenLength: csrfToken.length,
      cookies: {
        count: Object.keys(req.cookies || {}).length,
        names: Object.keys(req.cookies || {}),
        hasSessionCookie: !!(req.cookies && req.cookies['permisos.sid']),
      },
      session: {
        exists: !!req.session,
        id: req.session?.id || 'none',
        userId: req.session?.userId || 'none',
      },
      headers: {
        origin: req.get('Origin') || 'none',
        referer: req.get('Referer') || 'none',
        host: req.get('Host') || 'none',
        userAgent: req.get('User-Agent') || 'none',
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    logger.info('[DEBUG] CSRF Test Endpoint Called', debugInfo);
    ApiResponse.success(res, debugInfo, 200, 'CSRF test successful');
  } catch (error) {
    logger.error('[DEBUG] CSRF Test Error', error);
    ApiResponse.error(res, 'CSRF test failed', 500);
  }
});

// POST /debug/csrf-validate - Test CSRF token validation
router.post('/csrf-validate', csrfProtection, (req, res) => {
  try {
    const debugInfo = {
      message: 'CSRF validation successful',
      receivedToken: req.headers['x-csrf-token'] || req.body._csrf || 'none',
      tokenSource: req.headers['x-csrf-token'] ? 'header' : req.body._csrf ? 'body' : 'none',
      cookies: {
        count: Object.keys(req.cookies || {}).length,
        hasSessionCookie: !!(req.cookies && req.cookies['permisos.sid']),
      },
      session: {
        exists: !!req.session,
        id: req.session?.id || 'none',
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    logger.info('[DEBUG] CSRF Validation Test Successful', debugInfo);
    ApiResponse.success(res, debugInfo, 200, 'CSRF validation successful');
  } catch (error) {
    logger.error('[DEBUG] CSRF Validation Test Error', error);
    ApiResponse.error(res, 'CSRF validation failed', 500);
  }
});

// GET /debug/session-info - Get session information
router.get('/session-info', (req, res) => {
  try {
    const sessionInfo = {
      session: {
        exists: !!req.session,
        id: req.session?.id || 'none',
        userId: req.session?.userId || 'none',
        userEmail: req.session?.userEmail || 'none',
        accountType: req.session?.accountType || 'none',
        isAdminPortal: req.session?.isAdminPortal || false,
      },
      cookies: {
        count: Object.keys(req.cookies || {}).length,
        names: Object.keys(req.cookies || {}),
        sessionCookie: req.cookies?.['permisos.sid'] ? 'present' : 'missing',
      },
      headers: {
        origin: req.get('Origin') || 'none',
        referer: req.get('Referer') || 'none',
        host: req.get('Host') || 'none',
        userAgent: req.get('User-Agent') || 'none',
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    logger.info('[DEBUG] Session Info Request', sessionInfo);
    ApiResponse.success(res, sessionInfo, 200, 'Session info retrieved');
  } catch (error) {
    logger.error('[DEBUG] Session Info Error', error);
    ApiResponse.error(res, 'Failed to get session info', 500);
  }
});

// GET /debug/cors-test - Test CORS configuration
router.get('/cors-test', (req, res) => {
  try {
    const corsInfo = {
      origin: req.get('Origin') || 'none',
      referer: req.get('Referer') || 'none',
      host: req.get('Host') || 'none',
      method: req.method,
      headers: {
        'access-control-allow-origin': res.get('Access-Control-Allow-Origin') || 'none',
        'access-control-allow-credentials': res.get('Access-Control-Allow-Credentials') || 'none',
        'access-control-allow-methods': res.get('Access-Control-Allow-Methods') || 'none',
        'access-control-allow-headers': res.get('Access-Control-Allow-Headers') || 'none',
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    logger.info('[DEBUG] CORS Test Request', corsInfo);
    ApiResponse.success(res, corsInfo, 200, 'CORS test successful');
  } catch (error) {
    logger.error('[DEBUG] CORS Test Error', error);
    ApiResponse.error(res, 'CORS test failed', 500);
  }
});

// GET /debug/environment - Get environment information (limited for security)
router.get('/environment', (req, res) => {
  try {
    const envInfo = {
      nodeEnv: process.env.NODE_ENV,
      hasAppUrl: !!process.env.APP_URL,
      hasApiUrl: !!process.env.API_URL,
      hasFrontendUrl: !!process.env.FRONTEND_URL,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      hasCookieSecret: !!process.env.COOKIE_SECRET,
      hasRedisHost: !!process.env.REDIS_HOST,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      port: process.env.PORT || 'not set',
      timestamp: new Date().toISOString(),
    };

    logger.info('[DEBUG] Environment Info Request', envInfo);
    ApiResponse.success(res, envInfo, 200, 'Environment info retrieved');
  } catch (error) {
    logger.error('[DEBUG] Environment Info Error', error);
    ApiResponse.error(res, 'Failed to get environment info', 500);
  }
});

// Only enable debug routes in development environment for security
if (process.env.NODE_ENV === 'development') {
  logger.warn('⚠️  Debug routes enabled - DEVELOPMENT MODE ONLY');
  module.exports = router;
} else {
  // In production, disable all debug routes for security
  const secureRouter = express.Router();
  secureRouter.all('*', (req, res) => {
    logger.warn(`Attempted access to debug route in production: ${req.method} ${req.path}`);
    ApiResponse.error(res, 'Debug routes are disabled in production', 404);
  });
  module.exports = secureRouter;
}
