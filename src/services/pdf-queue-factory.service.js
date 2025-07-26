// src/services/pdf-queue-factory.service.js
// Factory that chooses between dev and production queue services

const { logger } = require('../utils/logger');

// Configuration compatibility layer for dev/prod environments
function getConfig() {
  try {
    // Try unified config first (production)
    const unifiedConfig = require('../config/unified-config');
    if (unifiedConfig.isInitialized && unifiedConfig.isInitialized()) {
      return unifiedConfig.getSync();
    }
  } catch (error) {
    // Unified config not available or not initialized
  }
  
  try {
    // Fall back to dev config (development)
    return require('../config/dev-config');
  } catch (error) {
    // Neither config available
    logger.error('No configuration system available');
    throw new Error('Configuration system not available');
  }
}

function createPdfQueueService() {
  const config = getConfig();
  const isDevelopment = config.nodeEnv === 'development' || 
                       (!process.env.REDIS_HOST && config.nodeEnv !== 'production');
  
  logger.info('Queue service selection criteria:', {
    nodeEnv: config.nodeEnv,
    redisHost: process.env.REDIS_HOST ? 'available' : 'missing',
    platform: process.platform,
    isDevelopment
  });
  
  // FIX: Handle Redis availability check
  if (isDevelopment) {
    logger.info('Using development PDF queue service (in-memory)');
    return require('./pdf-queue-dev.service').getInstance();
  } else {
    logger.info('Using production PDF queue service (Bull + Redis)');
    try {
      const bullService = require('./pdf-queue-bull.service').getInstance();
      
      // FIX: Test if Redis is actually available before returning
      // This is a quick check, actual initialization happens later
      const redisClient = require('../utils/redis-client');
      if (!redisClient || !redisClient.ping) {
        throw new Error('Redis client not available');
      }
      
      return bullService;
    } catch (error) {
      logger.error('[PDFQueueFactory] Failed to create Bull service, falling back to dev service:', error);
      logger.warn('[PDFQueueFactory] Using in-memory queue service as fallback');
      return require('./pdf-queue-dev.service').getInstance();
    }
  }
}

let queueInstance = null;

async function initializePDFQueue() {
  if (!queueInstance) {
    queueInstance = createPdfQueueService();
    if (queueInstance.initialize) {
      // FIX: Add error handling for initialization
      try {
        await queueInstance.initialize();
        logger.info('[PDFQueueFactory] PDF queue service initialized successfully');
      } catch (error) {
        logger.error('[PDFQueueFactory] Failed to initialize PDF queue service:', error);
        
        // FIX: If production service fails, try fallback
        if (queueInstance.constructor.name !== 'PdfQueueDevService') {
          logger.warn('[PDFQueueFactory] Attempting fallback to dev service');
          queueInstance = require('./pdf-queue-dev.service').getInstance();
          if (queueInstance.initialize) {
            await queueInstance.initialize();
          }
        } else {
          throw error; // Re-throw if already using dev service
        }
      }
    }
  }
  return queueInstance;
}

module.exports = {
  getInstance: () => {
    if (!queueInstance) {
      queueInstance = createPdfQueueService();
    }
    return queueInstance;
  },
  initializePDFQueue
};