#!/usr/bin/env node

/**
 * Permisos Digitales Main Server
 * 
 * Unified entry point using the new service container system
 * Integrates startup orchestrator for proper service initialization
 */

// Load environment variables in development only
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
  console.log('[Server] Environment variables loaded');
}

const { logger } = require('./utils/logger');
console.log('[Server] Logger loaded');
const { PermisosStartupOrchestrator } = require('./core/startup-orchestrator');
console.log('[Server] Startup orchestrator loaded');

// Inject audit service into controllers after a delay to ensure services are initialized
setTimeout(() => {
  require('./utils/inject-audit-service');
  console.log('[Server] Audit service injection attempted');
}, 5000);

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
    stack: reason instanceof Error ? reason.stack : null,
    promise
  });
  process.exit(1);
});

/**
 * Main application startup
 */
async function startApplication() {
  logger.info('=== Permisos Digitales Server Starting ===', {
    nodeVersion: process.version,
    platform: process.platform,
    env: process.env.NODE_ENV || 'development',
    pid: process.pid
  });

  try {
    // Create startup orchestrator
    const orchestrator = new PermisosStartupOrchestrator();
    
    // Start application
    const appResult = await orchestrator.startApplication();
    
    // Setup graceful shutdown
    setupGracefulShutdown(orchestrator);
    
    logger.info('=== Permisos Digitales Server Ready ===', {
      port: process.env.PORT || 3001,
      servicesReady: appResult.services.getReadyServices().length,
      uptime: process.uptime()
    });
    
    return appResult;
    
  } catch (error) {
    logger.error('Failed to start application:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(orchestrator) {
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      await orchestrator.shutdown();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle PM2 signals
  process.on('SIGUSR2', () => {
    logger.info('Received SIGUSR2 (PM2 reload)');
    shutdown('SIGUSR2');
  });
  
  // Handle process warnings
  process.on('warning', (warning) => {
    logger.warn('Process warning:', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });
}

/**
 * Production error handling for PM2
 */
if (process.env.NODE_ENV === 'production') {
  // Prevent process crash on warnings
  process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
      logger.warn('Max listeners exceeded warning suppressed in production');
      return;
    }
    logger.warn('Production warning:', warning);
  });

  // Handle memory warnings
  process.on('memoryUsage', () => {
    const usage = process.memoryUsage();
    const memoryUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    
    if (memoryUsedMB > 500) { // 500MB threshold
      logger.warn('High memory usage detected:', {
        heapUsed: `${memoryUsedMB}MB`,
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024)
      });
    }
  });
}

// Start the application
if (require.main === module) {
  startApplication().catch((error) => {
    logger.error('Fatal startup error:', error);
    process.exit(1);
  });
}

module.exports = { startApplication, setupGracefulShutdown };