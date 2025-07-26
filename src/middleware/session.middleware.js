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
      callback && callback(error);
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
      callback && callback(error);
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
      callback && callback(error);
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
  
  // Create the session configuration once
  const sessionConfig = {
    store: redisClient ? new IORedisStore({ 
      client: redisClient,
      prefix: 'sess:',
      ttl: 3600 // 1 hour
    }) : undefined,
    secret: sessionSecret || process.env.SESSION_SECRET || 'your-secret-key-here-change-in-production',
    name: 'permisos.sid', // Custom session name
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on each request
    cookie: {
      secure: isProduction, // Require HTTPS in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 3600000, // 1 hour in milliseconds
      sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-subdomain with secure
      path: '/',
      domain: isProduction ? '.permisosdigitales.com.mx' : undefined // Allow cross-subdomain in production
    }
  };

  // Log the session configuration (without secret)
  logger.info('[SessionMiddleware] Session configuration:', {
    hasStore: !!sessionConfig.store,
    storeType: redisClient ? 'Redis' : 'MemoryStore',
    hasSecret: !!sessionConfig.secret && sessionConfig.secret !== 'your-secret-key-here-change-in-production',
    cookieSecure: sessionConfig.cookie.secure,
    cookieSameSite: sessionConfig.cookie.sameSite
  });

  // Create the middleware once
  const sessionMiddleware = session(sessionConfig);
  
  // Return a wrapper that sets domain dynamically
  return (req, res, next) => {
    // Log domain information for debugging
    logDomainInfo(req, 'session');

    // Get cookie domain for this request
    const cookieDomain = getCookieDomain(req);
    
    // Override cookie domain for this request
    if (req.session && req.session.cookie) {
      req.session.cookie.domain = cookieDomain;
    }
    
    // Apply the session middleware
    sessionMiddleware(req, res, (err) => {
      if (err) {
        logger.error('Session middleware error:', {
          error: err.message,
          stack: err.stack,
          host: req.get('host'),
          userAgent: req.get('User-Agent')
        });
      }
      next(err);
    });
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