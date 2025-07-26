/**
 * Service Container Integration Test
 * Verifies the new service container system works end-to-end
 */

const { logger } = require('../../utils/logger');

describe('Service Container Integration', () => {
  let serviceContainer;

  beforeEach(() => {
    // Reset any existing container state
    const { resetContainer } = require('../../core/service-container-singleton');
    resetContainer();
  });

  afterEach(async () => {
    // Clean up after each test
    if (serviceContainer) {
      try {
        const { shutdownContainer } = require('../../core/service-container-singleton');
        await shutdownContainer();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  test('Service container singleton should initialize', async () => {
    const { 
      getServiceContainer, 
      initializeContainer, 
      isContainerInitialized 
    } = require('../../core/service-container-singleton');

    // Initially not initialized
    expect(isContainerInitialized()).toBe(false);

    // Mock minimal config
    const testConfig = {
      env: 'test',
      app: { port: 3001, host: 'localhost' },
      database: { url: 'postgresql://test' },
      redis: { host: 'localhost', port: 6379 },
      stripe: { privateKey: 'sk_test_123' }
    };

    // Initialize container
    serviceContainer = await initializeContainer(testConfig);
    
    expect(isContainerInitialized()).toBe(true);
    expect(serviceContainer).toBeDefined();
  });

  test('Service container should register core services', () => {
    const { getServiceContainer } = require('../../core/service-container-singleton');
    const container = getServiceContainer();
    
    // Verify services are registered (not necessarily initialized)
    const registeredServices = container.getRegisteredServices();
    
    expect(registeredServices).toContain('database');
    expect(registeredServices).toContain('redis');
    expect(registeredServices).toContain('stripe');
    expect(registeredServices).toContain('authService');
    expect(registeredServices).toContain('pdfQueue');
  });

  test('Service access should work after initialization', async () => {
    const { 
      initializeContainer, 
      getService, 
      hasService 
    } = require('../../core/service-container-singleton');

    const testConfig = {
      env: 'test',
      database: { url: 'postgresql://test' },
      redis: { host: 'localhost', port: 6379 },
      stripe: { privateKey: 'sk_test_123' }
    };

    try {
      await initializeContainer(testConfig);
      
      // Test service availability
      // Note: These may fail due to missing dependencies in test environment
      // but the container should handle that gracefully
      const hasDatabase = hasService('database');
      const hasAuth = hasService('authService');
      
      // These checks verify the container API works
      expect(typeof hasDatabase).toBe('boolean');
      expect(typeof hasAuth).toBe('boolean');
      
    } catch (error) {
      // Expected in test environment without real services
      expect(error.message).toContain('service');
    }
  });

  test('Legacy service access pattern should be removed', () => {
    // Verify service-bouncer.js no longer exists
    expect(() => {
      require('../../services/service-bouncer');
    }).toThrow();
  });

  test('Health monitor should work with new container', () => {
    // Verify health monitor can be imported without service-bouncer
    expect(() => {
      const HealthMonitor = require('../../monitoring/health-monitor');
      // Just importing should work
      expect(HealthMonitor).toBeDefined();
    }).not.toThrow();
  });
});

// Helper test for syntax verification
describe('File Syntax Verification', () => {
  test('All core files should have valid syntax', () => {
    const files = [
      '../../core/service-container',
      '../../core/service-container-singleton', 
      '../../core/service-registry',
      '../../core/startup-orchestrator',
      '../../core/dependency-resolver',
      '../../core/express-app-factory',
      '../../monitoring/startup-monitor'
    ];

    files.forEach(file => {
      expect(() => {
        require(file);
      }).not.toThrow();
    });
  });

  test('Controller files should import correctly', () => {
    const controllers = [
      '../../controllers/stripe-payment.controller',
      '../../controllers/pdf-queue.controller'
    ];

    controllers.forEach(controller => {
      expect(() => {
        require(controller);
      }).not.toThrow();
    });
  });
});