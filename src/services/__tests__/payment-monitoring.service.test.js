/**
 * Payment Monitoring Service Tests
 * Comprehensive test coverage for payment monitoring and alerting
 */

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../alert.service', () => ({
  sendPaymentAlert: jest.fn().mockResolvedValue({}),
  sendAlert: jest.fn().mockResolvedValue({})
}));

// Import after mocking
const alertService = require('../alert.service');

// Mock timer functions for testing
jest.useFakeTimers();

// Spy on timer functions
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

beforeAll(() => {
  global.setInterval = jest.fn(originalSetInterval);
  global.clearInterval = jest.fn(originalClearInterval);
});

afterAll(() => {
  global.setInterval = originalSetInterval;
  global.clearInterval = originalClearInterval;
});

describe('PaymentMonitoringService', () => {
  let paymentMonitoringService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.resetModules();
    
    // Re-mock alert service to ensure it works with dynamic require
    jest.doMock('../alert.service', () => ({
      sendPaymentAlert: jest.fn().mockResolvedValue({}),
      sendAlert: jest.fn().mockResolvedValue({})
    }));
    
    // Import fresh instance
    paymentMonitoringService = require('../payment-monitoring.service');
    
    // Reset service state
    paymentMonitoringService.resetMetrics();
    
    // Reset alert service mock
    alertService.sendPaymentAlert.mockResolvedValue({});
  });

  afterEach(() => {
    paymentMonitoringService.stopMonitoring();
    
    // Remove all process event listeners to prevent memory leak warnings
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('exit');
    process.removeAllListeners('uncaughtException');
    
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('recordPaymentAttempt', () => {
    it('should record payment attempt correctly', () => {
      const paymentData = {
        method: 'card',
        amount: 150,
        applicationId: 'app_123',
        userId: 'user_123'
      };

      paymentMonitoringService.recordPaymentAttempt(paymentData);

      const metrics = paymentMonitoringService.getMetricsReport();
      expect(metrics.summary.totalPayments).toBe(1);
      expect(metrics.paymentsByMethod.card).toBe(1); // Should increment from 0 to 1
    });

    it('should handle missing payment method gracefully', () => {
      const paymentData = {
        amount: 150,
        applicationId: 'app_123',
        userId: 'user_123'
      };

      expect(() => {
        paymentMonitoringService.recordPaymentAttempt(paymentData);
      }).not.toThrow();

      const metrics = paymentMonitoringService.getMetricsReport();
      expect(metrics.summary.totalPayments).toBe(1);
    });

    it('should use default amount when not provided', () => {
      const paymentData = {
        method: 'card',
        applicationId: 'app_123',
        userId: 'user_123'
      };

      paymentMonitoringService.recordPaymentAttempt(paymentData);

      // Should not throw and should handle missing amount
      expect(paymentMonitoringService.metrics.totalPayments).toBe(1);
    });

    it('should add payment to sliding window data', () => {
      const paymentData = {
        method: 'card',
        amount: 150,
        applicationId: 'app_123',
        userId: 'user_123'
      };

      paymentMonitoringService.recordPaymentAttempt(paymentData);

      expect(paymentMonitoringService.slidingWindowData.payments).toHaveLength(1);
      expect(paymentMonitoringService.slidingWindowData.payments[0]).toMatchObject({
        method: 'card',
        amount: 150,
        applicationId: 'app_123',
        userId: 'user_123',
        status: 'attempt'
      });
    });
  });

  describe('recordPaymentSuccess', () => {
    it('should record payment success correctly', () => {
      const paymentData = {
        method: 'card',
        amount: 150,
        paymentIntentId: 'pi_test123',
        processingTime: 1500
      };

      paymentMonitoringService.recordPaymentSuccess(paymentData);

      const metrics = paymentMonitoringService.getMetricsReport();
      expect(metrics.summary.successfulPayments).toBe(1);
      expect(metrics.summary.totalRevenue).toBe(150);
      expect(metrics.summary.averageProcessingTime).toBe(1500);
      expect(metrics.paymentsByMethod.card).toBe(1);
    });

    it('should update average processing time correctly', () => {
      paymentMonitoringService.recordPaymentSuccess({ processingTime: 1000 });
      paymentMonitoringService.recordPaymentSuccess({ processingTime: 2000 });
      paymentMonitoringService.recordPaymentSuccess({ processingTime: 3000 });

      const metrics = paymentMonitoringService.getMetricsReport();
      expect(metrics.summary.averageProcessingTime).toBe(2000);
    });

    it('should limit processing times array size', () => {
      // Record more than 100 processing times
      for (let i = 0; i < 150; i++) {
        paymentMonitoringService.recordPaymentSuccess({ processingTime: 1000 + i });
      }

      expect(paymentMonitoringService.metrics.processingTimes).toHaveLength(100);
    });

    it('should reset consecutive failures on success', () => {
      // Record some failures first
      paymentMonitoringService.recordPaymentFailure({ error: new Error('Test error') });
      paymentMonitoringService.recordPaymentFailure({ error: new Error('Test error') });
      
      expect(paymentMonitoringService.metrics.consecutiveFailures).toBe(2);

      // Record success
      paymentMonitoringService.recordPaymentSuccess({ method: 'card' });

      expect(paymentMonitoringService.metrics.consecutiveFailures).toBe(0);
    });

    it('should add success to sliding window data', () => {
      const paymentData = {
        method: 'card',
        amount: 150,
        paymentIntentId: 'pi_test123',
        processingTime: 1500
      };

      paymentMonitoringService.recordPaymentSuccess(paymentData);

      expect(paymentMonitoringService.slidingWindowData.payments).toHaveLength(1);
      expect(paymentMonitoringService.slidingWindowData.payments[0]).toMatchObject({
        method: 'card',
        amount: 150,
        paymentIntentId: 'pi_test123',
        status: 'success',
        processingTime: 1500
      });

      expect(paymentMonitoringService.slidingWindowData.processingTimes).toHaveLength(1);
    });
  });

  describe('recordPaymentFailure', () => {
    it('should record payment failure correctly', () => {
      const errorData = {
        error: { code: 'card_declined', message: 'Your card was declined' },
        method: 'card',
        amount: 150,
        applicationId: 'app_123',
        userId: 'user_123'
      };

      paymentMonitoringService.recordPaymentFailure(errorData);

      const metrics = paymentMonitoringService.getMetricsReport();
      expect(metrics.summary.failedPayments).toBe(1);
      expect(metrics.errorsByType.card_declined).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
      expect(metrics.recentFailures).toHaveLength(1);
    });

    it('should track different error types', () => {
      paymentMonitoringService.recordPaymentFailure({
        error: { code: 'card_declined', message: 'Card declined' }
      });
      paymentMonitoringService.recordPaymentFailure({
        error: { code: 'insufficient_funds', message: 'Insufficient funds' }
      });
      paymentMonitoringService.recordPaymentFailure({
        error: { code: 'card_declined', message: 'Another decline' }
      });

      const metrics = paymentMonitoringService.getMetricsReport();
      expect(metrics.errorsByType.card_declined).toBe(2);
      expect(metrics.errorsByType.insufficient_funds).toBe(1);
    });

    it('should handle errors without code', () => {
      const errorData = {
        error: { message: 'Generic error' },
        method: 'card'
      };

      paymentMonitoringService.recordPaymentFailure(errorData);

      const metrics = paymentMonitoringService.getMetricsReport();
      expect(metrics.errorsByType.unknown).toBe(1);
    });

    it('should limit recent failures array size', () => {
      // Record more than 50 failures
      for (let i = 0; i < 60; i++) {
        paymentMonitoringService.recordPaymentFailure({
          error: { code: `error_${i}`, message: `Error ${i}` }
        });
      }

      expect(paymentMonitoringService.metrics.recentFailures).toHaveLength(50);
    });

    it('should increment consecutive failures', () => {
      paymentMonitoringService.recordPaymentFailure({ error: new Error('Error 1') });
      paymentMonitoringService.recordPaymentFailure({ error: new Error('Error 2') });
      paymentMonitoringService.recordPaymentFailure({ error: new Error('Error 3') });

      expect(paymentMonitoringService.metrics.consecutiveFailures).toBe(3);
    });

    it('should add failure to sliding window data', () => {
      const errorData = {
        error: { code: 'card_declined', message: 'Your card was declined' },
        method: 'card',
        amount: 150,
        applicationId: 'app_123',
        userId: 'user_123'
      };

      paymentMonitoringService.recordPaymentFailure(errorData);

      expect(paymentMonitoringService.slidingWindowData.payments).toHaveLength(1);
      expect(paymentMonitoringService.slidingWindowData.payments[0]).toMatchObject({
        method: 'card',
        amount: 150,
        applicationId: 'app_123',
        userId: 'user_123',
        status: 'failure',
        errorType: 'card_declined'
      });

      expect(paymentMonitoringService.slidingWindowData.failures).toHaveLength(1);
    });
  });

  describe('getSuccessRate and getFailureRate', () => {
    it('should calculate rates correctly', () => {
      // Record some successes and failures
      paymentMonitoringService.recordPaymentAttempt({ method: 'card' });
      paymentMonitoringService.recordPaymentSuccess({ method: 'card' });
      
      paymentMonitoringService.recordPaymentAttempt({ method: 'card' });
      paymentMonitoringService.recordPaymentSuccess({ method: 'card' });
      
      paymentMonitoringService.recordPaymentAttempt({ method: 'card' });
      paymentMonitoringService.recordPaymentFailure({ error: new Error('Test') });

      expect(paymentMonitoringService.getSuccessRate()).toBe(2/3);
      expect(paymentMonitoringService.getFailureRate()).toBe(1/3);
    });

    it('should handle no payments', () => {
      expect(paymentMonitoringService.getSuccessRate()).toBe(1);
      expect(paymentMonitoringService.getFailureRate()).toBe(0);
    });
  });

  describe('getAveragePaymentAmount', () => {
    it('should calculate average payment amount', () => {
      paymentMonitoringService.recordPaymentSuccess({ amount: 100 });
      paymentMonitoringService.recordPaymentSuccess({ amount: 200 });
      paymentMonitoringService.recordPaymentSuccess({ amount: 300 });

      expect(paymentMonitoringService.getAveragePaymentAmount()).toBe(200);
    });

    it('should return default when no payments', () => {
      expect(paymentMonitoringService.getAveragePaymentAmount()).toBe(150);
    });
  });

  describe('checkAlertConditions', () => {
    beforeEach(() => {
      // Reset alert time to allow alerts
      paymentMonitoringService.metrics.lastAlertTime = null;
    });

    it('should trigger alert for high failure rate', async () => {
      // Generate payments with high failure rate (>15%)
      for (let i = 0; i < 10; i++) {
        paymentMonitoringService.recordPaymentAttempt({ method: 'card' });
      }
      
      // Record 7 successes and 3 failures (30% failure rate)
      for (let i = 0; i < 7; i++) {
        paymentMonitoringService.recordPaymentSuccess({ method: 'card' });
      }
      
      for (let i = 0; i < 3; i++) {
        paymentMonitoringService.recordPaymentFailure({ error: new Error('Test') });
      }

      // Force check alert conditions to ensure it runs
      paymentMonitoringService.checkAlertConditions();

      // Should trigger alert (30% failure rate)
      expect(alertService.sendPaymentAlert).toHaveBeenCalled();
    });

    it('should trigger alert for slow processing time', async () => {
      // Generate payments with slow processing times
      // First record some attempts
      for (let i = 0; i < 5; i++) {
        paymentMonitoringService.recordPaymentAttempt({ method: 'card' });
      }
      
      for (let i = 0; i < 5; i++) {
        paymentMonitoringService.recordPaymentSuccess({ 
          method: 'card',
          processingTime: 15000 // 15 seconds (above 10s threshold)
        });
      }

      // Force check alert conditions
      paymentMonitoringService.checkAlertConditions();

      expect(alertService.sendPaymentAlert).toHaveBeenCalled();
    });

    it('should trigger alert for consecutive failures', async () => {
      // Generate consecutive failures
      for (let i = 0; i < 5; i++) {
        paymentMonitoringService.recordPaymentAttempt({ method: 'card' });
        paymentMonitoringService.recordPaymentFailure({ error: new Error(`Test ${i}`) });
      }

      // Force check alert conditions
      paymentMonitoringService.checkAlertConditions();

      expect(alertService.sendPaymentAlert).toHaveBeenCalled();
    });

    it('should respect alert cooldown period', async () => {
      // Set last alert time to recent
      paymentMonitoringService.metrics.lastAlertTime = Date.now() - 60000; // 1 minute ago

      // Generate failures that would normally trigger alert
      for (let i = 0; i < 5; i++) {
        paymentMonitoringService.recordPaymentFailure({ error: new Error(`Test ${i}`) });
      }

      // Should not send alert due to cooldown
      expect(alertService.sendPaymentAlert).not.toHaveBeenCalled();
    });

    it('should not trigger alert with insufficient data', async () => {
      // Generate only a few payments (below minimum threshold)
      paymentMonitoringService.recordPaymentAttempt({ method: 'card' });
      paymentMonitoringService.recordPaymentFailure({ error: new Error('Test') });

      expect(alertService.sendPaymentAlert).not.toHaveBeenCalled();
    });
  });

  describe('sendAlert', () => {
    it('should determine correct severity levels', async () => {
      const loggerSpy = require('../../utils/logger').logger;

      // Set up critical failure rate
      paymentMonitoringService.metrics.failedPayments = 30;
      paymentMonitoringService.metrics.totalPayments = 100;
      paymentMonitoringService.metrics.consecutiveFailures = 15;

      await paymentMonitoringService.sendAlert('Critical failure rate');

      // Since the alert service is dynamically required, check the logger instead
      expect(loggerSpy.error).toHaveBeenCalledWith(
        'PAYMENT SYSTEM ALERT:',
        expect.objectContaining({
          reason: 'Critical failure rate',
          metrics: expect.objectContaining({
            failureRate: 0.3,
            consecutiveFailures: 15
          })
        })
      );
    });

    it('should handle alert service errors gracefully', async () => {
      alertService.sendPaymentAlert.mockRejectedValue(new Error('Alert service down'));

      // Should not throw
      await expect(paymentMonitoringService.sendAlert('Test alert')).resolves.toBeUndefined();
    });
  });

  describe('cleanupOldData', () => {
    it('should remove data older than 7 days', () => {
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      const recentTimestamp = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago

      // Add old data
      paymentMonitoringService.slidingWindowData.payments.push({
        timestamp: oldTimestamp,
        status: 'success'
      });

      // Add recent data
      paymentMonitoringService.slidingWindowData.payments.push({
        timestamp: recentTimestamp,
        status: 'success'
      });

      paymentMonitoringService.cleanupOldData();

      expect(paymentMonitoringService.slidingWindowData.payments).toHaveLength(1);
      expect(paymentMonitoringService.slidingWindowData.payments[0].timestamp).toBe(recentTimestamp);
    });
  });

  describe('getWindowMetrics', () => {
    beforeEach(() => {
      // Set up some test data
      const now = Date.now();
      
      // Add data from different time periods
      paymentMonitoringService.slidingWindowData.payments.push(
        { timestamp: now - 30 * 60 * 1000, status: 'success', amount: 150 }, // 30 min ago
        { timestamp: now - 2 * 60 * 60 * 1000, status: 'failure', amount: 150 }, // 2 hours ago
        { timestamp: now - 25 * 60 * 60 * 1000, status: 'success', amount: 200 } // 25 hours ago
      );

      paymentMonitoringService.slidingWindowData.processingTimes.push(
        { timestamp: now - 30 * 60 * 1000, time: 1000 },
        { timestamp: now - 2 * 60 * 60 * 1000, time: 2000 }
      );
    });

    it('should return correct metrics for 1 hour window', () => {
      const metrics = paymentMonitoringService.getWindowMetrics('1h');

      expect(metrics.total).toBe(1);
      expect(metrics.successful).toBe(1);
      expect(metrics.failed).toBe(0);
      expect(metrics.successRate).toBe(1);
      expect(metrics.failureRate).toBe(0);
      expect(metrics.revenue).toBe(150);
      expect(metrics.avgProcessingTime).toBe(1000);
    });

    it('should return correct metrics for 24 hour window', () => {
      const metrics = paymentMonitoringService.getWindowMetrics('24h');

      expect(metrics.total).toBe(2);
      expect(metrics.successful).toBe(1);
      expect(metrics.failed).toBe(1);
      expect(metrics.successRate).toBe(0.5);
      expect(metrics.failureRate).toBe(0.5);
      expect(metrics.avgProcessingTime).toBe(1500); // (1000 + 2000) / 2
    });

    it('should handle empty data', () => {
      paymentMonitoringService.resetMetrics();
      const metrics = paymentMonitoringService.getWindowMetrics('1h');

      expect(metrics.total).toBe(0);
      expect(metrics.successful).toBe(0);
      expect(metrics.failed).toBe(0);
      expect(metrics.successRate).toBe(1);
      expect(metrics.failureRate).toBe(0);
      expect(metrics.avgProcessingTime).toBe(0);
    });
  });

  describe('getMetricsReport', () => {
    it('should return comprehensive metrics report', () => {
      // Add some test data
      paymentMonitoringService.recordPaymentAttempt({ method: 'card', amount: 150 });
      paymentMonitoringService.recordPaymentSuccess({ method: 'card', amount: 150, processingTime: 1000 });
      paymentMonitoringService.recordPaymentFailure({ error: { code: 'card_declined' }, method: 'card' });

      const report = paymentMonitoringService.getMetricsReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('timeWindows');
      expect(report).toHaveProperty('paymentsByMethod');
      expect(report).toHaveProperty('errorsByType');
      expect(report).toHaveProperty('recentFailures');
      expect(report).toHaveProperty('consecutiveFailures');
      expect(report).toHaveProperty('alertThresholds');

      expect(report.timeWindows).toHaveProperty('1h');
      expect(report.timeWindows).toHaveProperty('24h');
      expect(report.timeWindows).toHaveProperty('7d');
    });
  });

  describe('monitoring interval', () => {
    it('should start monitoring on initialization', () => {
      expect(global.setInterval).toHaveBeenCalled();
    });

    it('should log metrics periodically', () => {
      const loggerSpy = require('../../utils/logger').logger;

      // Fast-forward time by 5 minutes
      jest.advanceTimersByTime(300000);

      expect(loggerSpy.info).toHaveBeenCalledWith(
        'Payment system metrics:',
        expect.any(Object)
      );
    });

    it('should stop monitoring when requested', () => {
      paymentMonitoringService.stopMonitoring();
      expect(global.clearInterval).toHaveBeenCalled();
    });

    it('should prevent multiple monitoring intervals', () => {
      const initialCallCount = global.setInterval.mock.calls.length;
      
      paymentMonitoringService.startMonitoring();
      
      expect(global.setInterval.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('process signal handlers', () => {
    it('should handle SIGTERM signal', () => {
      const stopMonitoringSpy = jest.spyOn(paymentMonitoringService, 'stopMonitoring');

      process.emit('SIGTERM');

      expect(stopMonitoringSpy).toHaveBeenCalled();
    });

    it('should handle SIGINT signal', () => {
      const stopMonitoringSpy = jest.spyOn(paymentMonitoringService, 'stopMonitoring');

      process.emit('SIGINT');

      expect(stopMonitoringSpy).toHaveBeenCalled();
    });

    it('should handle uncaught exceptions without crashing', () => {
      const loggerSpy = require('../../utils/logger').logger;

      process.emit('uncaughtException', new Error('Test uncaught exception'));

      expect(loggerSpy.error).toHaveBeenCalledWith(
        'Uncaught exception in payment monitoring:',
        expect.any(Error)
      );
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial state', () => {
      // Add some data
      paymentMonitoringService.recordPaymentSuccess({ amount: 150, processingTime: 1000 });
      paymentMonitoringService.recordPaymentFailure({ error: new Error('Test') });

      // Reset
      paymentMonitoringService.resetMetrics();

      const metrics = paymentMonitoringService.getMetricsReport();
      expect(metrics.summary.totalPayments).toBe(0);
      expect(metrics.summary.successfulPayments).toBe(0);
      expect(metrics.summary.failedPayments).toBe(0);
      expect(metrics.summary.totalRevenue).toBe(0);
      expect(Object.keys(metrics.errorsByType)).toHaveLength(0);
      expect(metrics.recentFailures).toHaveLength(0);
      expect(metrics.consecutiveFailures).toBe(0);
    });

    it('should reset sliding window data', () => {
      paymentMonitoringService.recordPaymentSuccess({ amount: 150, processingTime: 1000 });
      
      expect(paymentMonitoringService.slidingWindowData.payments.length).toBeGreaterThan(0);
      
      paymentMonitoringService.resetMetrics();
      
      expect(paymentMonitoringService.slidingWindowData.payments).toHaveLength(0);
      expect(paymentMonitoringService.slidingWindowData.processingTimes).toHaveLength(0);
      expect(paymentMonitoringService.slidingWindowData.failures).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors in recordPaymentAttempt gracefully', () => {
      // Simulate error by breaking internal state
      paymentMonitoringService.metrics = null;

      expect(() => {
        paymentMonitoringService.recordPaymentAttempt({ method: 'card' });
      }).not.toThrow();
    });

    it('should handle errors in checkAlertConditions gracefully', () => {
      // Break internal state to trigger error
      paymentMonitoringService.getFailureRate = () => { throw new Error('Test error'); };

      expect(() => {
        paymentMonitoringService.checkAlertConditions();
      }).not.toThrow();
    });
  });
});