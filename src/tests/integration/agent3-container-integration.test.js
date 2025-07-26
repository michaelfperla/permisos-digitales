/**
 * Agent 3: Container Integration Test
 * Tests that the complete integration works end-to-end
 */

const unifiedConfig = require('../../config/unified-config');
const { initializeContainer, resetContainer } = require('../../core/service-container-singleton');
const { registerPermisosServices } = require('../../core/service-registry');
const PermisosServiceContainer = require('../../core/service-container');

describe('Agent 3: Container Integration', () => {
  beforeEach(() => {
    // Reset everything
    if (unifiedConfig._reset) {
      unifiedConfig._reset();
    }
    resetContainer();
  });

  afterEach(async () => {
    try {
      const { shutdownContainer } = require('../../core/service-container-singleton');
      await shutdownContainer();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('Complete integration: Config → Service Registry → Container → Services', async () => {
    // Step 1: Initialize config (Agent 1's work)
    const config = await unifiedConfig.initialize();
    expect(config).toBeDefined();
    expect(config.env).toBeDefined();
    expect(unifiedConfig.isInitialized()).toBe(true);

    // Step 2: Create container and register services (Agent 3's work)
    const container = new PermisosServiceContainer();
    registerPermisosServices(container, config);

    // Should have services registered
    const registeredServices = container.getRegisteredServices();
    expect(registeredServices.length).toBeGreaterThan(0);
    expect(registeredServices).toContain('database');
    expect(registeredServices).toContain('stripePayment');
    expect(registeredServices).toContain('authService');

    // Step 3: Initialize container
    await container.initialize(config);

    // Should have services initialized
    expect(container.services.size).toBeGreaterThan(0);
    expect(container.hasService('database')).toBe(true);
  }, 30000);

  test('Service container singleton integration', async () => {
    // Should initialize through singleton
    const container = await initializeContainer();
    
    expect(container).toBeDefined();
    expect(container.getRegisteredServices().length).toBeGreaterThan(0);
    
    // Should have core services
    const services = container.getRegisteredServices();
    expect(services).toContain('database');
    expect(services).toContain('stripePayment');
    expect(services).toContain('authService');
  }, 30000);

  test('Agent 2 fixed services work with container', async () => {
    const container = await initializeContainer();
    
    // Services should be available (even if some fail in test environment)
    const registeredServices = container.getRegisteredServices();
    
    // Check that Agent 2's fixed services are registered
    expect(registeredServices).toContain('stripePayment'); // Fixed circular dependency
    expect(registeredServices).toContain('emailService'); // Fixed config race condition
    expect(registeredServices).toContain('paymentVelocity'); // Fixed config race condition
    expect(registeredServices).toContain('alertService'); // Fixed config race condition
  }, 30000);

  test('Agent 4 health monitoring integration', async () => {
    const container = await initializeContainer();
    
    // Import health monitor
    const PermisosHealthMonitor = require('../../monitoring/health-monitor');
    const healthMonitor = new PermisosHealthMonitor(container);
    
    // Should initialize without errors
    await healthMonitor.initialize();
    
    // Should have health checks registered
    expect(healthMonitor.healthCheckers.size).toBeGreaterThan(0);
    
    // Should be able to run health checks
    const healthResult = await healthMonitor.runAllHealthChecks();
    expect(healthResult).toBeDefined();
    expect(healthResult.timestamp).toBeDefined();
  }, 30000);
});