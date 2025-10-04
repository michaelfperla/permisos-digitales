/**
 * Service Container Singleton
 * 
 * Provides a shared instance of the service container across the application
 * Ensures all parts of the app use the same container instance
 * 
 * Updated by Agent 3: Container Integrator
 * Integrates with Agent 1's config system and Agent 2's fixed services
 */

const PermisosServiceContainer = require('./service-container');
const { logger } = require('../utils/logger');
const unifiedConfig = require('../config/unified-config');

let containerInstance = null;
let isInitialized = false;

/**
 * Get the singleton service container instance
 * @returns {PermisosServiceContainer} The container instance
 */
function getServiceContainer() {
  if (!containerInstance) {
    containerInstance = new PermisosServiceContainer();
    logger.debug('[ServiceContainerSingleton] Created new container instance');
  }
  return containerInstance;
}

/**
 * Initialize the container with services (Agent 3 enhanced)
 * @param {Object} config - Application configuration (optional, will use unified config if not provided)
 * @returns {Promise<PermisosServiceContainer>}
 */
async function initializeContainer(config = null) {
  const container = getServiceContainer();
  
  if (isInitialized) {
    logger.warn('[ServiceContainerSingleton] Container already initialized');
    return container;
  }

  // Get config from unified config system if not provided
  let actualConfig = config;
  if (!actualConfig) {
    if (!unifiedConfig.isInitialized()) {
      logger.info('[ServiceContainerSingleton] Initializing unified config system...');
      actualConfig = await unifiedConfig.initialize();
    } else {
      actualConfig = unifiedConfig.getSync();
    }
  }

  // Only register services if they haven't been registered yet
  if (container.factories.size === 0) {
    const { registerPermisosServices } = require('./service-registry');
    registerPermisosServices(container, actualConfig);
    
    logger.info('[ServiceContainerSingleton] Services registered, initializing container...', {
      servicesRegistered: container.factories.size,
      environment: actualConfig.env
    });
  }

  // Initialize container only if not already initialized
  if (!container.initialized) {
    await container.initialize(actualConfig);
  }
  
  isInitialized = true;

  logger.info('[ServiceContainerSingleton] Container initialized successfully', {
    servicesInitialized: container.services.size
  });
  return container;
}

/**
 * Check if container is initialized
 * @returns {boolean}
 */
function isContainerInitialized() {
  return isInitialized;
}

/**
 * Get a service from the container
 * @param {string} serviceName - Name of the service
 * @returns {Object|null} Service instance or null
 */
function getService(serviceName) {
  const container = getServiceContainer();
  
  if (!isInitialized) {
    logger.warn(`[ServiceContainerSingleton] Attempting to get service ${serviceName} before initialization`);
    return null;
  }

  try {
    return container.getService(serviceName);
  } catch (error) {
    logger.error(`[ServiceContainerSingleton] Error getting service ${serviceName}:`, error.message);
    return null;
  }
}

/**
 * Check if a service is available
 * @param {string} serviceName - Name of the service
 * @returns {boolean}
 */
function hasService(serviceName) {
  const container = getServiceContainer();
  
  if (!isInitialized) {
    return false;
  }

  return container.hasService(serviceName);
}

/**
 * Reset the singleton (for testing)
 */
function resetContainer() {
  if (containerInstance) {
    containerInstance.reset();
  }
  containerInstance = null;
  isInitialized = false;
  logger.debug('[ServiceContainerSingleton] Container reset');
}

/**
 * Shutdown the container
 */
async function shutdownContainer() {
  if (containerInstance && isInitialized) {
    await containerInstance.shutdown();
    isInitialized = false;
    logger.info('[ServiceContainerSingleton] Container shut down');
  }
}

module.exports = {
  getServiceContainer,
  initializeContainer,
  isContainerInitialized,
  getService,
  hasService,
  resetContainer,
  shutdownContainer
};