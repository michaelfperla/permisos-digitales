/**
 * Permisos Digitales Express App Factory
 * Creates and configures the Express application with all middleware and routes
 */

const express = require('express');
const { logger } = require('../utils/logger');

class PermisosExpressAppFactory {
  constructor(serviceContainer, healthMonitor) {
    this.serviceContainer = serviceContainer;
    this.healthMonitor = healthMonitor;
  }

  /**
   * Create and configure the Express application
   * @param {Object} config - Application configuration
   * @returns {Object} Configured Express app
   */
  createApplication(config) {
    logger.info('[ExpressAppFactory] Creating Express application...');

    const app = express();

    // Configure trust proxy for production environments
    if (process.env.NODE_ENV === 'production') {
      app.set('trust proxy', true);
      logger.info('[ExpressAppFactory] Trust proxy enabled for production');
    }

    // Configure middleware
    this.configureMiddleware(app, config);

    // Configure routes
    this.configureRoutes(app, config);

    // Configure error handling
    this.configureErrorHandling(app);

    logger.info('[ExpressAppFactory] Express application created successfully');
    return app;
  }

  /**
   * Configure middleware stack
   * @private
   */
  configureMiddleware(app, config) {
    // Domain redirect middleware - MUST be first to ensure correct domain
    const domainRedirectMiddleware = require('../middleware/domain-redirect.middleware');
    app.use(domainRedirectMiddleware);

    // Security middleware
    const corsMiddleware = require('../middleware/cors.middleware');
    const securityMiddleware = require('../middleware/security.middleware');
    const { performanceMonitoring } = require('../middleware/monitoring.middleware');

    app.use(corsMiddleware);
    app.use(securityMiddleware);
    
    // Performance monitoring middleware
    app.use(performanceMonitoring);

    // Cookie parsing (required for sessions)
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // Session middleware - MUST come before CSRF protection
    const { createSessionMiddleware, createMemorySessionMiddleware } = require('../middleware/session.middleware');
    
    try {
      // Get session secret from config
      const sessionSecret = config.security?.sessionSecret || process.env.SESSION_SECRET;
      
      if (!sessionSecret || sessionSecret === 'default-session-secret') {
        logger.warn('[ExpressAppFactory] No session secret configured, using default (NOT SECURE)');
      }
      
      // Try to get Redis service from service container
      const redisService = this.serviceContainer && this.serviceContainer.getService('redis');
      const redisClient = redisService?.client;
      
      if (redisClient && process.env.NODE_ENV === 'production') {
        logger.info('[ExpressAppFactory] Configuring Redis-based sessions', {
          hasSecret: !!sessionSecret && sessionSecret !== 'default-session-secret',
          redisConnected: redisService?.getHealth?.()?.healthy || false
        });
        app.use(createSessionMiddleware(redisClient, sessionSecret));
      } else {
        logger.info('[ExpressAppFactory] Configuring memory-based sessions (development mode)');
        app.use(createMemorySessionMiddleware(sessionSecret));
      }
    } catch (error) {
      logger.warn('[ExpressAppFactory] Failed to configure Redis sessions, falling back to memory sessions:', error.message);
      const sessionSecret = config.security?.sessionSecret || process.env.SESSION_SECRET;
      app.use(createMemorySessionMiddleware(sessionSecret));
    }

    // Body parsing - handle webhook routes separately
    app.use((req, res, next) => {
      if (req.path === '/webhook/stripe' || req.path === '/api/whatsapp/webhook') {
        // Use raw body parser for webhooks that require signature validation
        express.raw({ 
          type: 'application/json',
          verify: (req, res, buf) => {
            req.rawBody = buf.toString('utf8');
          }
        })(req, res, next);
      } else {
        express.json({ limit: '10mb' })(req, res, next);
      }
    });
    
    app.use((req, res, next) => {
      if (req.path === '/webhook/stripe' || req.path === '/api/whatsapp/webhook') {
        // Skip URL encoding for webhooks
        next();
      } else {
        express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
      }
    });

    // Request logging
    const requestIdMiddleware = require('../middleware/request-id.middleware');
    app.use(requestIdMiddleware);

    // Rate limiting
    const rateLimiters = require('../middleware/rate-limit.middleware');
    // Use the global API rate limiter for all routes
    app.use(rateLimiters.api);

    logger.debug('[ExpressAppFactory] Middleware configured');
  }

  /**
   * Configure application routes
   * @private
   */
  configureRoutes(app, config) {
    const routes = require('../routes');
    
    // Mount API routes first (they have priority)
    app.use('/', routes);

    // Health check route
    app.get('/health', async (req, res) => {
      try {
        const health = this.healthMonitor ? 
          this.healthMonitor.getOverallHealth() : 
          { status: 'ok', timestamp: new Date().toISOString() };
        
        res.json(health);
      } catch (error) {
        res.status(503).json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Service status route
    app.get('/status/services', (req, res) => {
      if (this.serviceContainer && typeof this.serviceContainer.getServiceHealth === 'function') {
        const serviceHealth = this.serviceContainer.getServiceHealth();
        res.json(serviceHealth);
      } else {
        res.json({
          container: { initialized: false },
          services: {}
        });
      }
    });

    // Root route
    app.get('/', (req, res) => {
      res.json({
        service: 'Permisos Digitales API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });

    logger.debug('[ExpressAppFactory] Routes configured');
  }

  /**
   * Configure error handling
   * @private
   */
  configureErrorHandling(app) {
    const errorHandler = require('../middleware/error-handler.middleware');
    
    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl
      });
    });

    // Global error handler
    app.use(errorHandler);

    logger.debug('[ExpressAppFactory] Error handling configured');
  }
}

module.exports = { PermisosExpressAppFactory };