/**
 * Permisos Digitales Service Container
 * 
 * A robust dependency injection container that replaces the service-bouncer pattern
 * Provides clean dependency management, graceful degradation, and service lifecycle control
 * 
 * @module PermisosServiceContainer
 */

const { logger } = require('../utils/logger');
const PermisosDependencyResolver = require('./dependency-resolver');

// Service status constants
const SERVICE_STATUS = {
  PENDING: 'SERVICE_STATUS_PENDING',
  INITIALIZING: 'SERVICE_STATUS_INITIALIZING',
  READY: 'SERVICE_STATUS_READY',
  FAILED: 'SERVICE_STATUS_FAILED',
  DEGRADED: 'SERVICE_STATUS_DEGRADED',
  STOPPED: 'SERVICE_STATUS_STOPPED'
};

// Service initialization constants
const SERVICE_INIT_TIMEOUT = 30000; // 30 seconds default
const DEPENDENCY_RESOLUTION_MAX_DEPTH = 10;

class PermisosServiceContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.serviceConfigs = new Map();
    this.dependencyResolver = new PermisosDependencyResolver();
    this.initialized = false;
    this.initializationPromise = null;
    this.shutdownHandlers = new Map();
    this.healthChecks = new Map();
  }

  /**
   * Register a service with the container
   * @param {string} serviceName - Unique service identifier
   * @param {Function} factory - Factory function that creates the service
   * @param {Object} options - Service configuration options
   */
  registerService(serviceName, factory, options = {}) {
    if (this.initialized) {
      throw new Error(`Cannot register service ${serviceName} after initialization`);
    }

    if (typeof factory !== 'function') {
      throw new Error(`Factory for service ${serviceName} must be a function`);
    }

    const serviceDefinition = {
      factory,
      dependencies: options.dependencies || [],
      optional: options.optional || false,
      singleton: options.singleton !== false,
      timeout: options.timeout || SERVICE_INIT_TIMEOUT,
      healthCheck: options.healthCheck || null,
      shutdownHandler: options.shutdownHandler || null,
      retryAttempts: options.retryAttempts || (options.optional ? 3 : 1),
      retryDelay: options.retryDelay || 1000
    };

    // Validate dependencies
    this.validateDependencies(serviceName, serviceDefinition.dependencies);

    this.factories.set(serviceName, serviceDefinition);

    // Register health check if provided
    if (serviceDefinition.healthCheck) {
      this.healthChecks.set(serviceName, serviceDefinition.healthCheck);
    }

    // Register shutdown handler if provided
    if (serviceDefinition.shutdownHandler) {
      this.shutdownHandlers.set(serviceName, serviceDefinition.shutdownHandler);
    }

    logger.debug(`Container: Registered service ${serviceName}`, {
      dependencies: serviceDefinition.dependencies,
      optional: serviceDefinition.optional,
      timeout: serviceDefinition.timeout
    });
  }

  /**
   * Initialize all registered services
   * @param {Object} fullConfig - Complete application configuration
   */
  async initialize(fullConfig) {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization(fullConfig);
    return this.initializationPromise;
  }

  /**
   * Perform the actual initialization of services
   * @private
   */
  async performInitialization(fullConfig) {
    const startTime = Date.now();
    logger.info('Container: Starting service initialization...');
    
    try {
      // Store the configuration for services to access
      this.serviceConfigs.set('_global', fullConfig);

      // Prepare service definitions for dependency resolver
      const serviceDefinitions = new Map();
      for (const [serviceName, definition] of this.factories) {
        serviceDefinitions.set(serviceName, {
          name: serviceName,
          dependencies: definition.dependencies,
          priority: definition.priority || 0,
          optional: definition.optional
        });
      }

      // Resolve service initialization order
      const initializationOrder = this.dependencyResolver.resolveInitializationOrder(
        serviceDefinitions
      );

      logger.info('Container: Service initialization order resolved', {
        order: initializationOrder
      });

      // Initialize services in dependency order
      const initPromises = [];
      const initialized = new Set();

      for (const serviceName of initializationOrder) {
        // Wait for dependencies to be initialized
        await this.waitForDependencies(serviceName, initialized);
        
        // Initialize service (may be async)
        const initPromise = this.initializeService(serviceName, fullConfig)
          .then(() => {
            initialized.add(serviceName);
          });

        initPromises.push(initPromise);
      }

      // Wait for all services to complete initialization
      await Promise.all(initPromises);

      this.initialized = true;
      const duration = Date.now() - startTime;

      logger.info('Container: Service initialization completed', {
        duration: `${duration}ms`,
        servicesInitialized: this.services.size,
        totalRegistered: this.factories.size,
        failedOptional: this.getFailedOptionalServices().length
      });

      return {
        success: true,
        duration,
        servicesReady: this.getReadyServices().length,
        servicesFailed: this.getFailedServices().length
      };

    } catch (error) {
      logger.error('Container: Service initialization failed', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Initialize a single service
   * @private
   */
  async initializeService(serviceName, fullConfig) {
    const serviceDefinition = this.factories.get(serviceName);
    if (!serviceDefinition) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    // Mark service as initializing
    this.services.set(serviceName, {
      instance: null,
      status: SERVICE_STATUS.INITIALIZING,
      optional: serviceDefinition.optional,
      dependencies: serviceDefinition.dependencies,
      startTime: Date.now()
    });

    let attempts = 0;
    let lastError = null;

    while (attempts < serviceDefinition.retryAttempts) {
      attempts++;

      try {
        logger.info(`Container: Initializing ${serviceName}... (attempt ${attempts}/${serviceDefinition.retryAttempts})`);
        
        // Extract service-specific configuration
        const serviceConfig = this.extractServiceConfig(serviceName, fullConfig);
        
        // Resolve dependencies
        const dependencies = await this.resolveDependencies(serviceDefinition.dependencies);
        
        // Create service instance with timeout
        const serviceInstance = await Promise.race([
          this.createServiceInstance(serviceDefinition, dependencies, serviceConfig),
          this.createTimeoutPromise(serviceDefinition.timeout, serviceName)
        ]);

        // Initialize service if it has initialize method
        if (serviceInstance && typeof serviceInstance.initialize === 'function') {
          await Promise.race([
            serviceInstance.initialize(),
            this.createTimeoutPromise(serviceDefinition.timeout, serviceName)
          ]);
        }

        // Store successful service instance
        this.services.set(serviceName, {
          instance: serviceInstance,
          status: SERVICE_STATUS.READY,
          optional: serviceDefinition.optional,
          dependencies: serviceDefinition.dependencies,
          initializedAt: Date.now(),
          attempts
        });

        logger.info(`Container: ✓ ${serviceName} initialized successfully`);
        return serviceInstance;

      } catch (error) {
        lastError = error;
        logger.warn(`Container: Failed to initialize ${serviceName} (attempt ${attempts}/${serviceDefinition.retryAttempts})`, {
          error: error.message
        });

        if (attempts < serviceDefinition.retryAttempts) {
          await this.delay(serviceDefinition.retryDelay * attempts);
        }
      }
    }

    // All attempts failed
    if (serviceDefinition.optional) {
      logger.warn(`Container: ⚠ Optional service ${serviceName} failed (continuing):`, lastError.message);
      this.services.set(serviceName, {
        instance: null,
        status: SERVICE_STATUS.FAILED,
        optional: true,
        error: lastError.message,
        failedAt: Date.now(),
        attempts
      });
    } else {
      logger.error(`Container: ✗ Critical service ${serviceName} failed:`, lastError);
      this.services.set(serviceName, {
        instance: null,
        status: SERVICE_STATUS.FAILED,
        optional: false,
        error: lastError.message,
        failedAt: Date.now(),
        attempts
      });
      throw new Error(`Critical service initialization failed: ${serviceName} - ${lastError.message}`);
    }
  }

  /**
   * Create service instance using factory
   * @private
   */
  async createServiceInstance(serviceDefinition, dependencies, serviceConfig) {
    try {
      const instance = await serviceDefinition.factory(dependencies, serviceConfig);
      
      if (!instance) {
        throw new Error('Service factory returned null or undefined');
      }
      
      return instance;
    } catch (error) {
      throw new Error(`Service factory error: ${error.message}`);
    }
  }

  /**
   * Create a timeout promise
   * @private
   */
  createTimeoutPromise(timeout, serviceName) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Service ${serviceName} initialization timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Wait for service dependencies to be ready
   * @private
   */
  async waitForDependencies(serviceName, initialized) {
    const serviceDefinition = this.factories.get(serviceName);
    if (!serviceDefinition) return;

    for (const dep of serviceDefinition.dependencies) {
      if (!initialized.has(dep)) {
        // Wait for dependency to be registered in services map
        await this.waitForServiceStatus(dep, [SERVICE_STATUS.READY, SERVICE_STATUS.FAILED]);
      }
    }
  }

  /**
   * Wait for a service to reach a specific status
   * @private
   */
  async waitForServiceStatus(serviceName, acceptableStatuses, timeout = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const service = this.services.get(serviceName);
      if (service && acceptableStatuses.includes(service.status)) {
        return;
      }
      await this.delay(100);
    }
    
    throw new Error(`Timeout waiting for service ${serviceName} to be ready`);
  }

  /**
   * Extract service-specific configuration
   * @private
   */
  extractServiceConfig(serviceName, fullConfig) {
    // Extract service-specific config based on naming convention
    const configMap = {
      permisosDatabase: fullConfig.database,
      permisosRedis: fullConfig.redis,
      permisosEmailQueue: fullConfig.services?.email,
      permisosPdfQueue: fullConfig.services?.storage,
      permisosAuthService: fullConfig.security,
      permisosPaymentService: fullConfig.stripe,
      permisosNotificationService: fullConfig.services?.notification
    };

    return configMap[serviceName] || fullConfig;
  }

  /**
   * Resolve service dependencies
   * @private
   */
  async resolveDependencies(dependencyNames) {
    const dependencies = {};

    for (const depName of dependencyNames) {
      const service = this.services.get(depName);
      
      if (!service) {
        throw new Error(`Dependency ${depName} not found`);
      }

      if (service.status === SERVICE_STATUS.READY) {
        dependencies[depName] = service.instance;
      } else if (service.status === SERVICE_STATUS.FAILED && service.optional) {
        dependencies[depName] = null; // Graceful degradation
        logger.debug(`Optional dependency ${depName} is not available`);
      } else {
        throw new Error(`Required dependency ${depName} is not ready: ${service.status}`);
      }
    }

    return dependencies;
  }

  /**
   * Validate service dependencies
   * @private
   */
  validateDependencies(serviceName, dependencies) {
    // Check for self-dependency
    if (dependencies.includes(serviceName)) {
      throw new Error(`Service ${serviceName} cannot depend on itself`);
    }

    // Check dependency depth
    const depth = this.calculateDependencyDepth(serviceName, dependencies);
    if (depth > DEPENDENCY_RESOLUTION_MAX_DEPTH) {
      throw new Error(`Service ${serviceName} exceeds maximum dependency depth of ${DEPENDENCY_RESOLUTION_MAX_DEPTH}`);
    }
  }

  /**
   * Calculate dependency depth for a service
   * @private
   */
  calculateDependencyDepth(serviceName, dependencies, visited = new Set()) {
    if (visited.has(serviceName)) {
      return 0; // Already visited, avoid infinite recursion
    }

    visited.add(serviceName);
    let maxDepth = 0;

    for (const dep of dependencies) {
      const depService = this.factories.get(dep);
      if (depService) {
        const depDepth = 1 + this.calculateDependencyDepth(
          dep, 
          depService.dependencies, 
          visited
        );
        maxDepth = Math.max(maxDepth, depDepth);
      }
    }

    return maxDepth;
  }

  /**
   * Get a service instance
   * @param {string} serviceName - Service to retrieve
   * @returns {Object|null} Service instance or null if optional and failed
   */
  getService(serviceName) {
    if (!this.initialized) {
      throw new Error('Service container not initialized');
    }

    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    if (service.status !== SERVICE_STATUS.READY) {
      if (service.optional) {
        logger.debug(`Optional service ${serviceName} requested but not available`);
        return null; // Graceful degradation
      } else {
        throw new Error(`Critical service ${serviceName} is not ready: ${service.status}`);
      }
    }

    return service.instance;
  }

  /**
   * Check if a service is available and ready
   * @param {string} serviceName - Service to check
   * @returns {boolean} True if service is ready
   */
  hasService(serviceName) {
    const service = this.services.get(serviceName);
    return service && service.status === SERVICE_STATUS.READY;
  }

  /**
   * Get all registered service names
   * @returns {string[]} Array of service names
   */
  getRegisteredServices() {
    return Array.from(this.factories.keys());
  }

  /**
   * Get initialization order of services
   * @returns {string[]} Array of service names in initialization order
   */
  getInitializationOrder() {
    const serviceDefinitions = new Map();
    for (const [serviceName, definition] of this.factories) {
      serviceDefinitions.set(serviceName, {
        name: serviceName,
        dependencies: definition.dependencies,
        priority: definition.priority || 0,
        optional: definition.optional
      });
    }

    return this.dependencyResolver.resolveInitializationOrder(serviceDefinitions);
  }

  /**
   * Get ready services
   * @returns {string[]} Array of ready service names
   */
  getReadyServices() {
    return Array.from(this.services.entries())
      .filter(([_, service]) => service.status === SERVICE_STATUS.READY)
      .map(([name, _]) => name);
  }

  /**
   * Get failed services
   * @returns {string[]} Array of failed service names
   */
  getFailedServices() {
    return Array.from(this.services.entries())
      .filter(([_, service]) => service.status === SERVICE_STATUS.FAILED)
      .map(([name, _]) => name);
  }

  /**
   * Get failed optional services
   * @returns {string[]} Array of failed optional service names
   */
  getFailedOptionalServices() {
    return Array.from(this.services.entries())
      .filter(([_, service]) => service.status === SERVICE_STATUS.FAILED && service.optional)
      .map(([name, _]) => name);
  }

  /**
   * Get comprehensive service health information
   * @returns {Object} Health status of all services
   */
  getServiceHealth() {
    const health = {
      container: {
        initialized: this.initialized,
        totalServices: this.services.size,
        readyServices: 0,
        failedServices: 0,
        degradedServices: 0,
        optionalFailures: 0
      },
      services: {}
    };

    for (const [name, service] of this.services) {
      const serviceHealth = {
        status: service.status,
        optional: service.optional,
        error: service.error || null,
        dependencies: service.dependencies,
        initializedAt: service.initializedAt || null,
        failedAt: service.failedAt || null,
        attempts: service.attempts || 0
      };

      // Run health check if available
      if (service.status === SERVICE_STATUS.READY && this.healthChecks.has(name)) {
        try {
          const healthCheck = this.healthChecks.get(name);
          const checkResult = healthCheck(service.instance);
          serviceHealth.health = checkResult;
        } catch (error) {
          serviceHealth.health = { healthy: false, error: error.message };
        }
      }

      health.services[name] = serviceHealth;

      // Update counters
      switch (service.status) {
        case SERVICE_STATUS.READY:
          health.container.readyServices++;
          break;
        case SERVICE_STATUS.FAILED:
          health.container.failedServices++;
          if (service.optional) {
            health.container.optionalFailures++;
          }
          break;
        case SERVICE_STATUS.DEGRADED:
          health.container.degradedServices++;
          break;
      }
    }

    return health;
  }

  /**
   * Attempt to restart a failed optional service
   * @param {string} serviceName - Service to restart
   */
  async restartService(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    if (!service.optional) {
      throw new Error(`Cannot restart critical service ${serviceName}`);
    }

    if (service.status === SERVICE_STATUS.READY) {
      throw new Error(`Service ${serviceName} is already running`);
    }

    logger.info(`Container: Attempting to restart service ${serviceName}`);
    
    const fullConfig = this.serviceConfigs.get('_global');
    await this.initializeService(serviceName, fullConfig);
  }

  /**
   * Gracefully shutdown all services
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info('Container: Starting graceful shutdown...');

    // Get services in reverse initialization order
    const shutdownOrder = this.dependencyResolver.resolveInitializationOrder(this.factories).reverse();

    for (const serviceName of shutdownOrder) {
      const service = this.services.get(serviceName);
      if (service && service.status === SERVICE_STATUS.READY) {
        try {
          logger.info(`Container: Shutting down ${serviceName}...`);

          // Call shutdown handler if available
          const shutdownHandler = this.shutdownHandlers.get(serviceName);
          if (shutdownHandler) {
            await shutdownHandler(service.instance);
          }

          // Call service's own shutdown method if available
          if (service.instance && typeof service.instance.shutdown === 'function') {
            await service.instance.shutdown();
          }

          service.status = SERVICE_STATUS.STOPPED;
          logger.info(`Container: ✓ ${serviceName} shut down successfully`);

        } catch (error) {
          logger.error(`Container: Error shutting down ${serviceName}:`, error);
        }
      }
    }

    this.initialized = false;
    logger.info('Container: Graceful shutdown completed');
  }

  /**
   * Emergency shutdown - faster, less graceful shutdown for critical errors
   * @returns {Promise<void>}
   */
  async emergencyShutdown() {
    logger.warn('Container: Starting emergency shutdown...');

    try {
      // Set a timeout for emergency shutdown
      const shutdownPromise = this.performEmergencyShutdown();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Emergency shutdown timeout')), 5000);
      });

      await Promise.race([shutdownPromise, timeoutPromise]);

    } catch (error) {
      logger.error('Container: Emergency shutdown failed:', error);
      // Force exit if emergency shutdown fails
      process.exit(1);
    }
  }

  /**
   * Perform the actual emergency shutdown
   * @private
   */
  async performEmergencyShutdown() {
    const services = Array.from(this.services.entries());

    // Shutdown all services in parallel for speed
    const shutdownPromises = services.map(async ([serviceName, service]) => {
      if (service && service.status === SERVICE_STATUS.READY) {
        try {
          logger.info(`Container: Emergency shutdown of ${serviceName}...`);

          // Try shutdown handler first (faster)
          const shutdownHandler = this.shutdownHandlers.get(serviceName);
          if (shutdownHandler) {
            await Promise.race([
              shutdownHandler(service.instance),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Handler timeout')), 1000))
            ]);
          }

          // Try service's own shutdown method
          if (service.instance && typeof service.instance.shutdown === 'function') {
            await Promise.race([
              service.instance.shutdown(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Service timeout')), 1000))
            ]);
          }

          service.status = SERVICE_STATUS.STOPPED;
          logger.info(`Container: ✓ ${serviceName} emergency shutdown completed`);

        } catch (error) {
          logger.warn(`Container: Emergency shutdown of ${serviceName} failed:`, error.message);
          // Continue with other services
        }
      }
    });

    // Wait for all shutdowns to complete or timeout
    await Promise.allSettled(shutdownPromises);

    this.initialized = false;
    logger.warn('Container: Emergency shutdown completed');
  }

  /**
   * Utility delay function
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset container (mainly for testing)
   */
  reset() {
    this.services.clear();
    this.factories.clear();
    this.serviceConfigs.clear();
    this.shutdownHandlers.clear();
    this.healthChecks.clear();
    this.initialized = false;
    this.initializationPromise = null;
  }
}

// Export constants and class
module.exports = PermisosServiceContainer;
module.exports.SERVICE_STATUS = SERVICE_STATUS;
module.exports.SERVICE_INIT_TIMEOUT = SERVICE_INIT_TIMEOUT;