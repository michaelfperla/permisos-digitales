/**
 * Permisos Digitales Configuration System
 * Minimal configuration loader for service container integration
 */

const { logger } = require('../utils/logger');

/**
 * Get bootstrap configuration for initial startup
 * @returns {Object} Bootstrap configuration
 */
function getBootstrapConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.PORT || '3001', 10);
  const host = process.env.HOST || '0.0.0.0';

  logger.info('[Config] Loading bootstrap configuration', {
    nodeEnv,
    port,
    host
  });

  return {
    config: {
      nodeEnv,
      port,
      host
    }
  };
}

/**
 * Initialize full configuration using UnifiedConfig
 * @returns {Promise<Object>} Full configuration
 */
async function initializeFullConfig() {
  logger.info('[Config] Initializing full configuration using UnifiedConfig...');
  
  // Use the unified config system that handles AWS secrets
  const unifiedConfig = require('./unified-config');
  
  // Initialize the unified config (this loads AWS secrets in production)
  const config = await unifiedConfig.initialize();
  
  logger.info('[Config] Full configuration loaded successfully', {
    environment: config.env,
    hasDatabase: !!config.database.url,
    hasRedis: !!config.redis.host,
    hasStripe: !!config.stripe.privateKey,
    hasSecrets: !!config.security?.sessionSecret && config.security.sessionSecret !== 'default-session-secret',
    isInitialized: unifiedConfig.isInitialized()
  });

  return config;
}

module.exports = {
  getBootstrapConfig,
  initializeFullConfig
};