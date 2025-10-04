/**
 * Session Middleware Configuration
 * Configures express-session with ioredis store for production
 */

const session = require('express-session');
const { logger } = require('../utils/logger');
const { getCookieDomain, logDomainInfo } = require('../utils/domain-utils');

/**
 * Custom Redis Store for ioredis client
 * Compatible with the existing ioredis setup
 */
class IORedisStore extends session.Store {
  constructor(options = {}) {
    super(options);
    this.client = options.client;
    this.prefix = options.prefix || 'sess:';
    this.ttl = options.ttl || 3600; // 1 hour default
  }

  /**
   * Get session from Redis
   */
  async get(sid, callback) {
    try {
      if (!this.client) {
        return callback(null, null);
      }

      const key = this.prefix + sid;
      const data = await this.client.get(key);

      if (!data) {
        return callback(null, null);
      }

      const session = JSON.parse(data);
      callback(null, session);
    } catch (error) {
      logger.error('Session get error:', error);
      callback(error);
    }
  }

  /**
   * Set session in Redis
   */
  async set(sid, session, callback) {
    try {
      if (!this.client) {
        return callback && callback();
      }

      const key = this.prefix + sid;
      const data = JSON.stringify(session);

      await this.client.set(key, data, 'EX', this.ttl);
      callback && callback();
    } catch (error) {
      logger.error('Session set error:', error);
      // Return success to allow request to continue even if save failed
      callback && callback();
    }
  }

  /**
   * Destroy session in Redis
   */
  async destroy(sid, callback) {
    try {
      if (!this.client) {
        return callback && callback();
      }

      const key = this.prefix + sid;
      await this.client.del(key);
      callback && callback();
    } catch (error) {
      logger.error('Session destroy error:', error);
      // For destroy, continue without error (session should be destroyed regardless)
      callback && callback();
    }
  }

  /**
   * Touch session to reset TTL
   */
  async touch(sid, session, callback) {
    try {
      if (!this.client) {
        return callback && callback();
      }

      const key = this.prefix + sid;
      await this.client.expire(key, this.ttl);
      callback && callback();
    } catch (error) {
      logger.error('Session touch error:', error);
      // For touch, continue without error (non-critical operation)
      callback && callback();
    }
  }
}

/**
 * Create session middleware with Redis store
 * @param {Object} redisClient - ioredis client instance
 * @param {string} sessionSecret - Session secret from config
 * @returns {Function} Configured session middleware
 */
const createSessionMiddleware = (redisClient, sessionSecret) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Define session duration constants for consistency
  const SESSION_TTL_SECONDS = 14400; // 4 hours in seconds
  const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000; // 4 hours in milliseconds

  // In production, we only support ONE primary domain to avoid cross-domain issues
  // All .com traffic should be redirected to .com.mx at the infrastructure level
  const PRIMARY_DOMAIN = isProduction ? '.permisosdigitales.com.mx' : undefined;

  // Create single session middleware instance
  const sessionConfig = {
    store: redisClient ? new IORedisStore({
      client: redisClient,
      prefix: 'sess:',
      ttl: SESSION_TTL_SECONDS // 4 hours in seconds for Redis
    }) : undefined,
    secret: sessionSecret || process.env.SESSION_SECRET || 'your-secret-key-here-change-in-production',
    name: 'permisos.sid',
    resave: false,
    saveUninitialized: false,
    rolling: false, // Disable rolling to prevent race conditions
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: SESSION_TTL_MS,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      domain: PRIMARY_DOMAIN
    }
  };

  const sessionMiddleware = session(sessionConfig);

  logger.info('[SessionMiddleware] Created session middleware:', {
    domain: PRIMARY_DOMAIN || 'localhost',
    secure: sessionConfig.cookie.secure,
    sameSite: sessionConfig.cookie.sameSite,
    hasStore: !!sessionConfig.store
  });

  return (req, res, next) => {
    const cookieDomain = getCookieDomain(req);

    // Check if domain detection returned null (invalid domain)
    if (cookieDomain === null) {
      logger.error('[SessionMiddleware] Security: Invalid domain detected', {
        host: req.get('host'),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(403).json({
        error: 'Invalid domain',
        message: 'This domain is not authorized to access this service'
      });
    }

    // Check if the domain matches our expected primary domain
    if (isProduction && cookieDomain !== PRIMARY_DOMAIN) {
      logger.error('[SessionMiddleware] Security: Rejecting non-primary domain', {
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

    // Use the single session middleware
    sessionMiddleware(req, res, next);
  };
};

/**
 * Simple in-memory session middleware for development/testing
 * @param {string} sessionSecret - Session secret from config
 * @returns {Function} Session middleware
 */
const createMemorySessionMiddleware = (sessionSecret) => {
  return session({
    secret: sessionSecret || process.env.SESSION_SECRET || 'dev-secret-key',
    name: 'permisos.sid',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: false, // Allow HTTP in development
      httpOnly: true,
      maxAge: 3600000, // 1 hour
      sameSite: 'lax'
    }
  });
};

/**
 * Session health check
 * @param {Object} req - Express request object
 * @returns {Object} Session health status
 */
const getSessionHealth = (req) => {
  return {
    hasSession: !!req.session,
    sessionId: req.session?.id || null,
    sessionStore: req.session?.store?.constructor?.name || 'none',
    cookieSet: !!req.get('cookie')
  };
};

module.exports = {
  createSessionMiddleware,
  createMemorySessionMiddleware,
  getSessionHealth
};