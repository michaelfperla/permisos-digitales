/**
 * Debug Container Integration
 * Step-by-step debugging to find the issue
 */

const unifiedConfig = require('../../config/unified-config');
const { registerPermisosServices } = require('../../core/service-registry');
const PermisosServiceContainer = require('../../core/service-container');

describe('Debug Container Integration', () => {
  beforeEach(() => {
    if (unifiedConfig._reset) {
      unifiedConfig._reset();
    }
  });

  test('Config system works', async () => {
    const config = await unifiedConfig.initialize();
    expect(config).toBeDefined();
    expect(config.env).toBeDefined();
    console.log('✅ Config initialized:', { env: config.env });
  });

  test('Container can be created', () => {
    const container = new PermisosServiceContainer();
    expect(container).toBeDefined();
    expect(container.factories.size).toBe(0);
    console.log('✅ Container created');
  });

  test('Services can be registered', async () => {
    const config = await unifiedConfig.initialize();
    const container = new PermisosServiceContainer();
    
    console.log('🔧 Registering services...');
    registerPermisosServices(container, config);
    
    const registeredServices = container.getRegisteredServices();
    console.log('📋 Registered services:', registeredServices);
    
    expect(registeredServices.length).toBeGreaterThan(0);
    expect(container.factories.size).toBeGreaterThan(0);
  });

  test('Dependency resolution works', async () => {
    const config = await unifiedConfig.initialize();
    const container = new PermisosServiceContainer();
    
    registerPermisosServices(container, config);
    
    console.log('🔍 Getting initialization order...');
    try {
      const initOrder = container.getInitializationOrder();
      console.log('📊 Initialization order:', initOrder);
      expect(initOrder.length).toBeGreaterThan(0);
    } catch (error) {
      console.error('❌ Dependency resolution failed:', error.message);
      throw error;
    }
  });

  test('Single service initialization', async () => {
    const config = await unifiedConfig.initialize();
    const container = new PermisosServiceContainer();
    
    // Register just one simple service
    container.registerService('testService', async () => {
      return { name: 'test', initialized: true };
    }, {
      dependencies: [],
      priority: 1,
      optional: false,
      timeout: 5000
    });

    console.log('🔧 Initializing single test service...');
    
    try {
      await container.initialize(config);
      expect(container.hasService('testService')).toBe(true);
      console.log('✅ Single service initialization successful');
    } catch (error) {
      console.error('❌ Single service initialization failed:', error.message);
      throw error;
    }
  });
});