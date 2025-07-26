/**
 * Permisos Digitales Startup Orchestrator
 * Manages the complete application startup sequence with proper timing and error handling
 * 
 * Updated by Agent 3: Container Integrator
 * Integrates Agent 1's config system, Agent 2's fixed services, and Agent 4's health monitoring
 */

const { logger } = require('../utils/logger');
const { PermisosStartupMonitor } = require('../monitoring/startup-monitor');
const PermisosHealthMonitor = require('../monitoring/health-monitor');
const PermisosServiceContainer = require('./service-container');
const { PermisosExpressAppFactory } = require('./express-app-factory');
const unifiedConfig = require('../config/unified-config');
const { registerPermisosServices } = require('./service-registry');

class PermisosStartupOrchestrator {
  constructor() {
    this.startupMonitor = new PermisosStartupMonitor();
    this.healthMonitor = null;
    this.serviceContainer = null; // Will be set during initialization
    this.expressApp = null;
    this.httpServer = null;
    this.shutdownInProgress = false;
  }

  async startApplication() {
    try {
      logger.info('=== Permisos Digitales Application Startup (Agent 3 Integration) ===');
      
      // Phase 1: Initialize Unified Config System (Agent 1's work)
      this.startupMonitor.recordPhaseStart('configuration_loading');
      logger.info('[Startup] Phase 1: Initializing unified config system...');
      
      const fullConfig = await unifiedConfig.initialize({
        skipSecrets: process.env.NODE_ENV !== 'production' // Skip AWS secrets in dev/test
      });
      
      this.startupMonitor.recordPhaseComplete('configuration_loading', {
        environment: fullConfig.env,
        configSource: 'unified-production-config',
        hasSecrets: unifiedConfig.getHealthStatus().hasSecrets,
        initTime: unifiedConfig.getHealthStatus().initTime
      });
      
      // Phase 2: Service Container & Registration
      this.startupMonitor.recordPhaseStart('service_registration');
      logger.info('[Startup] Phase 2: Creating service container and registering services...');
      
      this.serviceContainer = new PermisosServiceContainer();
      
      // Register all fixed services from Agent 2
      registerPermisosServices(this.serviceContainer, fullConfig);
      
      this.startupMonitor.recordPhaseComplete('service_registration', {
        totalServicesRegistered: this.serviceContainer.factories.size,
        serviceNames: Array.from(this.serviceContainer.factories.keys())
      });
      
      // Phase 3: Service Initialization (Dependency-ordered)
      this.startupMonitor.recordPhaseStart('service_initialization');
      logger.info('[Startup] Phase 3: Initializing services in dependency order...');
      
      await this.serviceContainer.initialize(fullConfig);
      
      this.startupMonitor.recordPhaseComplete('service_initialization', {
        servicesInitialized: this.serviceContainer.services.size,
        initializationOrder: this.serviceContainer.getInitializationOrder()
      });
      
      // Phase 4: Health Monitoring Setup (Agent 4's enhanced monitoring)
      this.startupMonitor.recordPhaseStart('health_monitoring_setup');
      logger.info('[Startup] Phase 4: Setting up enhanced health monitoring...');
      
      this.healthMonitor = new PermisosHealthMonitor(this.serviceContainer);
      await this.healthMonitor.initialize();
      
      this.startupMonitor.recordPhaseComplete('health_monitoring_setup', {
        healthChecksRegistered: Array.from(this.healthMonitor.healthCheckers.keys()).length,
        alertingEnabled: this.healthMonitor.alertingEnabled
      });
      
      // Phase 5: Express Application Setup
      this.startupMonitor.recordPhaseStart('express_setup');
      logger.info('[Startup] Phase 5: Creating Express application...');
      
      this.expressApp = this.createExpressApplication(fullConfig);
      this.startupMonitor.recordPhaseComplete('express_setup');
      
      // Phase 6: HTTP Server Startup
      this.startupMonitor.recordPhaseStart('server_listening');
      logger.info('[Startup] Phase 6: Starting HTTP server...');
      
      await this.startHttpServer(fullConfig);
      this.startupMonitor.recordPhaseComplete('server_listening', {
        port: fullConfig.app.port,
        host: fullConfig.app.host
      });
      
      // Phase 7: Start Scheduled Jobs
      this.startupMonitor.recordPhaseStart('scheduled_jobs');
      logger.info('[Startup] Phase 7: Starting scheduled jobs and background processors...');
      
      try {
        const { initScheduledJobs } = require('../jobs/scheduler');
        initScheduledJobs();
        this.startupMonitor.recordPhaseComplete('scheduled_jobs');
      } catch (error) {
        logger.error('Failed to start scheduled jobs:', error);
        // Don't fail startup, but log the error
        this.startupMonitor.recordPhaseComplete('scheduled_jobs', { error: error.message });
      }
      
      // Signal PM2 that we're ready
      this.signalReadiness();
      
      const totalStartupTime = this.startupMonitor.getTotalTime();
      logger.info('=== Application Startup Completed Successfully ===', {
        totalTime: `${totalStartupTime}ms`,
        phases: this.startupMonitor.getCompletedPhases()
      });
      
      return {
        server: this.httpServer,
        app: this.expressApp,
        services: this.serviceContainer
      };
      
    } catch (error) {
      const currentPhase = this.startupMonitor.currentPhase?.name || 'unknown';
      this.startupMonitor.recordPhaseError(currentPhase, error);
      
      logger.error('Application startup failed:', {
        phase: currentPhase,
        error: error.message,
        stack: error.stack
      });
      
      // Attempt cleanup before exit
      await this.emergencyShutdown();
      
      process.exit(1);
    }
  }

  async initializeBootstrapConfig() {
    const { getBootstrapConfig } = require('../config');
    const bootstrap = getBootstrapConfig();
    
    logger.info('Bootstrap configuration loaded:', {
      environment: bootstrap.config.nodeEnv,
      port: bootstrap.config.port
    });
    
    return bootstrap;
  }

  async initializeFullConfiguration() {
    const { initializeFullConfig } = require('../config');
    
    // Add timeout for AWS Secrets Manager
    const configPromise = initializeFullConfig();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Configuration timeout after 25 seconds')), 25000)
    );
    
    const fullConfig = await Promise.race([configPromise, timeoutPromise]);
    
    logger.info('Full configuration loaded successfully:', {
      hasSecrets: !!fullConfig.services?.stripe?.privateKey,
      hasDatabaseUrl: !!fullConfig.database?.url,
      hasRedisHost: !!fullConfig.redis?.host
    });
    
    return fullConfig;
  }

  registerAllServices() {
    const { registerPermisosServices } = require('./service-registry');
    registerPermisosServices(this.serviceContainer);
    
    logger.info('All services registered with container:', {
      totalServices: this.serviceContainer.factories.size
    });
  }

  createExpressApplication(config) {
    const appFactory = new PermisosExpressAppFactory(this.serviceContainer, this.healthMonitor);
    return appFactory.createApplication(config);
  }

  async startHttpServer(config) {
    const http = require('http');
    
    this.httpServer = http.createServer(this.expressApp);
    
    return new Promise((resolve, reject) => {
      const errorHandler = (error) => {
        this.httpServer.removeListener('error', errorHandler);
        reject(error);
      };
      
      this.httpServer.once('error', errorHandler);
      
      this.httpServer.listen(config.app.port, config.app.host, () => {
        this.httpServer.removeListener('error', errorHandler);
        logger.info(`HTTP server listening on http://${config.app.host}:${config.app.port}`);
        resolve();
      });
    });
  }

  signalReadiness() {
    if (process.send) {
      process.send('ready');
      logger.info('Sent ready signal to PM2');
    }
  }

  async shutdown() {
    if (this.shutdownInProgress) {
      logger.warn('Shutdown already in progress');
      return;
    }
    
    this.shutdownInProgress = true;
    logger.info('Starting graceful shutdown...');
    
    const shutdownTasks = [];
    
    // Stop accepting new connections
    if (this.httpServer) {
      shutdownTasks.push(
        new Promise((resolve) => {
          this.httpServer.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        })
      );
    }
    
    // Stop health monitor
    if (this.healthMonitor) {
      shutdownTasks.push(this.healthMonitor.shutdown());
    }
    
    // Stop scheduled jobs
    try {
      const { shutdownScheduledJobs } = require('../jobs/scheduler');
      shutdownTasks.push(shutdownScheduledJobs());
    } catch (error) {
      logger.error('Error shutting down scheduled jobs:', error);
    }
    
    // Shutdown all services in reverse order
    if (this.serviceContainer) {
      shutdownTasks.push(this.serviceContainer.shutdown());
    }
    
    // Wait for all shutdown tasks with timeout
    const shutdownTimeout = 30000; // 30 seconds
    await Promise.race([
      Promise.all(shutdownTasks),
      new Promise((resolve) => setTimeout(resolve, shutdownTimeout))
    ]);
    
    logger.info('Graceful shutdown completed');
  }

  async emergencyShutdown() {
    logger.warn('Performing emergency shutdown...');
    
    try {
      if (this.httpServer) {
        this.httpServer.close();
      }
      
      if (this.serviceContainer) {
        await this.serviceContainer.emergencyShutdown();
      }
    } catch (error) {
      logger.error('Error during emergency shutdown:', error);
    }
  }
}

module.exports = { PermisosStartupOrchestrator };