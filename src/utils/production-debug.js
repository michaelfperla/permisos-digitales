// src/utils/production-debug.js
const { logger } = require('./logger');

/**
 * Development debugging utility for CSRF and authentication issues
 * WARNING: This should NEVER log in production due to sensitive data exposure
 */
class ProductionDebugger {
  /**
   * Log detailed request information for debugging CSRF issues
   * @param {Object} req - Express request object
   * @param {string} context - Context of the request (e.g., 'registration', 'login')
   */
  static logRequestDetails(req, context = 'unknown') {
    if (process.env.NODE_ENV === 'production') {
      return; // NEVER log sensitive data in production
    }

    const requestInfo = {
      context,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      host: req.get('Host'),
      headers: {
        'x-csrf-token': req.headers['x-csrf-token'] ? 'present' : 'missing',
        'content-type': req.headers['content-type'],
        'accept': req.headers['accept'],
        'cookie': req.headers.cookie ? 'present' : 'missing',
      },
      session: {
        exists: !!req.session,
        id: req.session?.id || 'none',
        userId: req.session?.userId || 'none',
      },
      cookies: {
        count: Object.keys(req.cookies || {}).length,
        names: Object.keys(req.cookies || {}),
      },
      body: {
        hasEmail: !!(req.body && req.body.email),
        hasPassword: !!(req.body && req.body.password),
        hasFirstName: !!(req.body && req.body.first_name),
        hasLastName: !!(req.body && req.body.last_name),
      }
    };

    logger.info(`[PROD-DEBUG] ${context.toUpperCase()} Request Details`, requestInfo);
  }

  /**
   * Log CSRF token validation details
   * @param {Object} req - Express request object
   * @param {string} token - CSRF token being validated
   * @param {boolean} isValid - Whether the token is valid
   */
  static logCsrfValidation(req, token, isValid) {
    if (process.env.NODE_ENV === 'production') {
      return; // NEVER log sensitive data in production
    }

    const csrfInfo = {
      tokenPresent: !!token,
      tokenLength: token ? token.length : 0,
      tokenSource: this.getCsrfTokenSource(req),
      isValid,
      sessionId: req.session?.id || 'none',
      origin: req.get('Origin'),
      referer: req.get('Referer'),
    };

    logger.info('[PROD-DEBUG] CSRF Token Validation', csrfInfo);
  }

  /**
   * Determine where the CSRF token came from
   * @param {Object} req - Express request object
   * @returns {string} Source of the CSRF token
   */
  static getCsrfTokenSource(req) {
    if (req.headers['x-csrf-token']) return 'header';
    if (req.body && req.body._csrf) return 'body';
    if (req.query && req.query._csrf) return 'query';
    return 'none';
  }

  /**
   * Log registration attempt details
   * @param {Object} req - Express request object
   * @param {Object} userData - User data being registered
   */
  static logRegistrationAttempt(req, userData) {
    if (process.env.NODE_ENV === 'production') {
      return; // NEVER log sensitive data in production
    }

    const registrationInfo = {
      email: userData.email,
      hasFirstName: !!userData.first_name,
      hasLastName: !!userData.last_name,
      hasPassword: !!userData.password,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      origin: req.get('Origin'),
      sessionExists: !!req.session,
      csrfTokenPresent: !!(req.headers['x-csrf-token'] || (req.body && req.body._csrf)),
    };

    logger.info('[PROD-DEBUG] Registration Attempt', registrationInfo);
  }

  /**
   * Log database operation results
   * @param {string} operation - Database operation (e.g., 'user_insert', 'user_check')
   * @param {boolean} success - Whether the operation was successful
   * @param {Object} details - Additional details about the operation
   */
  static logDatabaseOperation(operation, success, details = {}) {
    if (process.env.NODE_ENV === 'production') {
      return; // NEVER log sensitive data in production
    }

    const dbInfo = {
      operation,
      success,
      timestamp: new Date().toISOString(),
      ...details
    };

    logger.info('[PROD-DEBUG] Database Operation', dbInfo);
  }

  /**
   * Log session management details
   * @param {Object} req - Express request object
   * @param {string} action - Session action (e.g., 'create', 'regenerate', 'destroy')
   * @param {Object} details - Additional session details
   */
  static logSessionAction(req, action, details = {}) {
    if (process.env.NODE_ENV === 'production') {
      return; // NEVER log sensitive data in production
    }

    const sessionInfo = {
      action,
      sessionId: req.session?.id || 'none',
      userId: req.session?.userId || 'none',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      ...details
    };

    logger.info('[PROD-DEBUG] Session Action', sessionInfo);
  }

  /**
   * Log error details with context
   * @param {Error} error - Error object
   * @param {string} context - Context where the error occurred
   * @param {Object} req - Express request object
   */
  static logError(error, context, req) {
    if (process.env.NODE_ENV === 'production') {
      return; // NEVER log sensitive data in production
    }

    const errorInfo = {
      context,
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
      url: req?.originalUrl,
      method: req?.method,
      ip: req?.ip,
      sessionId: req?.session?.id || 'none',
      timestamp: new Date().toISOString(),
    };

    logger.error('[PROD-DEBUG] Error Details', errorInfo);
  }
}

module.exports = ProductionDebugger;
