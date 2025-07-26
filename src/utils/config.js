/**
 * Configuration Utility
 * 
 * Provides a unified interface for accessing configuration
 * across different environments (dev/prod)
 */

const { logger } = require('./logger');

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
  
  // Only try dev-config in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    try {
      // Fall back to dev config (development)
      return require('../config/dev-config');
    } catch (error) {
      // Dev config not available
    }
  }
  
  // Neither config available or in production without initialized unified config
  logger.error('No configuration system available');
  throw new Error('Configuration system not available - ensure unified config is initialized');
}

// Cache config instance to avoid repeated loads
let configCache = null;

function getConfigCached() {
  if (!configCache) {
    configCache = getConfig();
  }
  return configCache;
}

// Reset cache (useful for tests)
function resetConfigCache() {
  configCache = null;
}

module.exports = {
  getConfig,
  getConfigCached,
  resetConfigCache
};