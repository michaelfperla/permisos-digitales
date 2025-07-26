#!/usr/bin/env node

/**
 * Development Server
 * Linear, sequential initialization with clear error handling
 * 
 * Startup sequence:
 * 1. Load environment variables
 * 2. Load configuration
 * 3. Initialize logger
 * 4. Connect to database
 * 5. Initialize Redis (or mock)
 * 6. Create Express app
 * 7. Setup middleware
 * 8. Mount routes
 * 9. Start HTTP server
 */

// Step 1: Load environment variables (only in development)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
  console.log('[Startup] Environment variables loaded from .env file');
}

// Step 2: Load configuration
console.log('[Startup] Loading configuration...');
const config = require('./config/dev-config');

// Step 3: Initialize logger
console.log('[Startup] Initializing logger...');
const { logger } = require('./utils/logger');

// Startup banner
logger.info('============================================');
logger.info('   Permisos Digitales Development Server    ');
logger.info('============================================');
logger.info(`Environment: ${config.env}`);
logger.info(`Node Version: ${process.version}`);
logger.info(`Process ID: ${process.pid}`);
logger.info('============================================');

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : null
  });
  process.exit(1);
});

// Main startup function
async function startServer() {
  const startTime = Date.now();
  
  try {
    // Step 4: Initialize database connection
    logger.info('[Startup] Connecting to database...');
    const db = await initializeDatabase();
    
    // Step 5: Initialize Redis
    logger.info('[Startup] Initializing Redis...');
    const redis = await initializeRedis();
    
    // Step 6: Create Express application
    logger.info('[Startup] Creating Express application...');
    const app = createExpressApp();
    
    // Step 7: Setup middleware
    logger.info('[Startup] Setting up middleware...');
    setupMiddleware(app);
    
    // Step 8: Mount routes
    logger.info('[Startup] Mounting routes...');
    mountRoutes(app);
    
    // Step 9: Setup error handling
    logger.info('[Startup] Setting up error handlers...');
    setupErrorHandlers(app);
    
    // Step 10: Start HTTP server
    logger.info('[Startup] Starting HTTP server...');
    const server = await startHttpServer(app);
    
    // Step 11: Initialize scheduled jobs (including PDF processor)
    logger.info('[Startup] Initializing scheduled jobs...');
    const { initScheduledJobs } = require('./jobs/scheduler');
    initScheduledJobs();
    
    // Startup complete
    const startupTime = Date.now() - startTime;
    logger.info('============================================');
    logger.info('   Server Started Successfully!             ');
    logger.info('============================================');
    logger.info(`Startup Time: ${startupTime}ms`);
    logger.info(`Server URL: ${config.server.url}`);
    logger.info(`API Status: ${config.server.url}/status`);
    logger.info(`Health Check: ${config.server.url}/health`);
    if (config.features.swagger) {
      logger.info(`API Docs: ${config.server.url}/api-docs`);
    }
    logger.info('============================================');
    
    // Setup graceful shutdown
    setupGracefulShutdown(server, db, redis);
    
    // Return for testing
    return { app, server, db, redis };
    
  } catch (error) {
    logger.error('Server startup failed:', error);
    logger.error('Startup sequence aborted');
    process.exit(1);
  }
}

// Database initialization with retry
async function initializeDatabase() {
  const db = require('./db/index-dev');
  const maxRetries = 5;
  const retryDelay = 2000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const isConnected = await db.testConnection();
      if (isConnected) {
        logger.info('✓ Database connected successfully');
        return db;
      }
    } catch (error) {
      logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries) {
        logger.info(`Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw new Error('Failed to connect to database after ' + maxRetries + ' attempts');
}

// Redis initialization with automatic fallback
async function initializeRedis() {
  const redisClient = require('./utils/redis-client-dev');
  
  if (!config.redis.enabled) {
    logger.info('✓ Redis disabled, using mock client');
    return redisClient;
  }
  
  try {
    // Test Redis connection
    const testKey = 'dev:startup:test';
    await redisClient.set(testKey, 'ok', 'EX', 10);
    const result = await redisClient.get(testKey);
    
    if (result === 'ok') {
      logger.info('✓ Redis connected successfully');
      return redisClient;
    }
  } catch (error) {
    logger.warn('Redis connection failed, falling back to mock client:', error.message);
  }
  
  return redisClient;
}

// Create Express application
function createExpressApp() {
  const express = require('express');
  const app = express();
  
  // Basic Express settings
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  
  logger.info('✓ Express application created');
  return app;
}

// Setup middleware in correct order
function setupMiddleware(app) {
  const express = require('express');
  const compression = require('compression');
  const cors = require('cors');
  const helmet = require('helmet');
  const cookieParser = require('cookie-parser');
  const session = require('express-session');
  
  // Request logging (before everything else)
  if (config.dev.debugRoutes) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.debug(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }
  
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
  }));
  
  // Compression
  app.use(compression());
  
  // CORS
  app.use(cors({
    origin: config.cors.origins,
    credentials: config.cors.credentials,
  }));
  
  // Special handling for Stripe webhook - needs raw body for signature verification
  app.use('/webhook/stripe', express.raw({ type: 'application/json' }));
  
  // Body parsing for all other routes
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Cookie parsing
  app.use(cookieParser());
  
  // Session management
  const MemoryStore = require('memorystore')(session);
  app.use(session({
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.session.secure,
      httpOnly: config.session.httpOnly,
      maxAge: config.session.maxAge,
      sameSite: config.session.sameSite,
    }
  }));
  
  // Custom middleware
  const requestIdMiddleware = require('./middleware/request-id.middleware');
  app.use(requestIdMiddleware);
  
  logger.info('✓ Middleware configured');
}

// Mount routes
function mountRoutes(app) {
  // Health check (before auth)
  const healthRoutes = require('./routes/health.routes');
  app.use('/health', healthRoutes);
  
  // API routes (mounted directly, no /api prefix)
  const apiRoutes = require('./routes');
  app.use('/', apiRoutes);
  
  // Swagger documentation
  if (config.features.swagger) {
    const { setupSwagger } = require('./utils/swagger');
    setupSwagger(app);
    logger.info('✓ Swagger documentation mounted');
  }
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        message: 'Route not found',
        path: req.path,
        method: req.method
      }
    });
  });
  
  logger.info('✓ Routes mounted');
}

// Setup error handlers
function setupErrorHandlers(app) {
  const errorHandler = require('./middleware/error-handler.middleware');
  app.use(errorHandler);
  
  logger.info('✓ Error handlers configured');
}

// Start HTTP server
async function startHttpServer(app) {
  const http = require('http');
  const server = http.createServer(app);
  
  return new Promise((resolve, reject) => {
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`Port ${config.server.port} is already in use`));
      } else if (error.code === 'EACCES') {
        reject(new Error(`Permission denied to bind to port ${config.server.port}`));
      } else {
        reject(error);
      }
    });
    
    server.listen(config.server.port, config.server.host, () => {
      logger.info(`✓ HTTP server listening on ${config.server.host}:${config.server.port}`);
      resolve(server);
    });
  });
}

// Graceful shutdown
function setupGracefulShutdown(server, db, redis) {
  let isShuttingDown = false;
  
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    logger.info(`\nReceived ${signal}, starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
      logger.info('✓ HTTP server closed');
    });
    
    // Close database connections
    try {
      await db.shutdown();
      logger.info('✓ Database connections closed');
    } catch (error) {
      logger.error('Error closing database:', error);
    }
    
    // Close Redis if using real connection
    if (config.redis.enabled && redis.disconnect) {
      try {
        await redis.disconnect();
        logger.info('✓ Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis:', error);
      }
    }
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  };
  
  // Listen for shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Memory usage monitoring
if (config.isDevelopment) {
  setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    
    if (heapUsedMB > 200) {
      logger.warn(`Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB`);
    }
  }, 30000); // Check every 30 seconds
}

// Check mode (for validation without starting server)
if (process.argv.includes('--check')) {
  logger.info('Running in check mode...');
  startServer()
    .then(() => {
      logger.info('✓ All checks passed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('✗ Check failed:', error);
      process.exit(1);
    });
} else {
  // Normal startup
  startServer().catch((error) => {
    logger.error('Fatal error during startup:', error);
    process.exit(1);
  });
}

module.exports = { startServer };