/**
 * Service Race Condition Fix Validation
 * Tests that Agent 2 fixes for circular dependencies and config race conditions work
 */

const unifiedConfig = require('../../config/unified-config');

describe('Service Race Condition Fixes (Agent 2)', () => {
  beforeEach(() => {
    // Reset config for each test
    if (unifiedConfig._reset) {
      unifiedConfig._reset();
    }
  });

  test('Services can be imported before config initialization', () => {
    // This should not throw - services should be importable before config is ready
    expect(() => {
      const stripePayment = require('../../services/stripe-payment.service');
      const paymentRecovery = require('../../services/payment-recovery.service');
      const email = require('../../services/email.service');
      const paymentVelocity = require('../../services/payment-velocity.service');
      
      expect(stripePayment).toBeDefined();
      expect(paymentRecovery).toBeDefined();
      expect(email).toBeDefined();
      expect(paymentVelocity).toBeDefined();
    }).not.toThrow();
  });

  test('Circular dependency between stripe-payment and payment-recovery is broken', () => {
    // These should import without deadlock
    expect(() => {
      const stripePayment = require('../../services/stripe-payment.service');
      const paymentRecovery = require('../../services/payment-recovery.service');
      
      // Should be able to create instances
      expect(stripePayment).toBeDefined();
      expect(paymentRecovery).toBeDefined();
    }).not.toThrow();
  });

  test('Services work after config initialization', async () => {
    // Initialize config first
    await unifiedConfig.initialize();
    
    // Services should be able to access config now
    const EmailService = require('../../services/email.service');
    const emailService = new EmailService();
    
    // Should be able to access config through lazy loading
    expect(() => {
      const useQueue = emailService.useQueue; // This triggers lazy config loading
      expect(typeof useQueue).toBe('boolean');
    }).not.toThrow();
  });

  test('Lazy loading patterns work correctly', async () => {
    // Initialize config
    await unifiedConfig.initialize();
    
    const EmailService = require('../../services/email.service');
    const emailService = new EmailService();
    
    // Test lazy config loading
    const config1 = emailService._getConfig();
    const config2 = emailService._getConfig();
    
    // Should return the same instance (cached)
    expect(config1).toBe(config2);
    expect(config1).toBeDefined();
  });
});

describe('Config Integration Validation', () => {
  test('New unified config system works', async () => {
    // Should be able to initialize config
    expect(unifiedConfig.isInitialized()).toBe(false);
    
    const config = await unifiedConfig.initialize();
    
    expect(unifiedConfig.isInitialized()).toBe(true);
    expect(config).toBeDefined();
    expect(config.env).toBeDefined();
  });

  test('Config health status is available', async () => {
    await unifiedConfig.initialize();
    
    const health = unifiedConfig.getHealthStatus();
    
    expect(health).toBeDefined();
    expect(health.initialized).toBe(true);
    expect(health.environment).toBeDefined();
  });
});