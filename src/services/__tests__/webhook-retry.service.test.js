/**
 * Webhook Retry Service Tests
 * Comprehensive test coverage for webhook retry mechanisms
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

jest.mock('../../repositories/payment.repository', () => ({
  updateWebhookEventStatus: jest.fn()
}));

jest.mock('../../utils/db-transaction', () => ({
  withTransaction: jest.fn().mockImplementation(async (callback) => {
    const mockClient = {};
    return await callback(mockClient);
  })
}));

jest.mock('../alert.service', () => ({
  sendAlert: jest.fn()
}));

// Import after mocking
const paymentRepository = require('../../repositories/payment.repository');
const alertService = require('../alert.service');

// Mock timer functions for testing
jest.useFakeTimers();

// Spy on timer functions
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;

beforeAll(() => {
  global.setTimeout = jest.fn(originalSetTimeout);
  global.clearTimeout = jest.fn(originalClearTimeout);
});

afterAll(() => {
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
});

describe('WebhookRetryService', () => {
  let webhookRetryService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.resetModules();
    
    // Import fresh instance
    webhookRetryService = require('../webhook-retry.service');
    
    // Reset default mocks
    paymentRepository.updateWebhookEventStatus.mockResolvedValue({});
    alertService.sendAlert.mockResolvedValue({});
  });

  afterEach(() => {
    // Clear all scheduled retries
    webhookRetryService.clearAllRetries();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('scheduleRetry', () => {
    const mockEventId = 'evt_test123';
    const mockEventData = { id: mockEventId, type: 'payment_intent.succeeded' };
    const mockProcessFunction = jest.fn().mockResolvedValue();

    it('should schedule retry with correct delay', () => {
      webhookRetryService.scheduleRetry(mockEventId, 0, mockProcessFunction, mockEventData);

      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000); // 1 minute
      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(1);
    });

    it('should schedule retry with increasing delays', () => {
      // First retry
      webhookRetryService.scheduleRetry(mockEventId, 0, mockProcessFunction, mockEventData);
      expect(global.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 60000); // 1 minute

      // Second retry
      webhookRetryService.scheduleRetry(mockEventId + '_2', 1, mockProcessFunction, mockEventData);
      expect(global.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 300000); // 5 minutes

      // Third retry
      webhookRetryService.scheduleRetry(mockEventId + '_3', 2, mockProcessFunction, mockEventData);
      expect(global.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 900000); // 15 minutes
    });

    it('should use maximum delay for high retry counts', () => {
      webhookRetryService.scheduleRetry(mockEventId, 5, mockProcessFunction, mockEventData);
      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 900000); // Max delay
    });

    it('should mark as failed when max retries reached', async () => {
      const markAsFailedSpy = jest.spyOn(webhookRetryService, 'markAsFailed').mockResolvedValue();

      webhookRetryService.scheduleRetry(mockEventId, 3, mockProcessFunction, mockEventData);

      expect(markAsFailedSpy).toHaveBeenCalledWith(mockEventId, 'Max retries exceeded');
      expect(global.setTimeout).not.toHaveBeenCalled();
    });

    it('should schedule retry and track in retry map', () => {
      webhookRetryService.scheduleRetry(mockEventId, 0, mockProcessFunction, mockEventData);

      // Verify setTimeout was called with correct delay
      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000);
      
      // Verify retry is tracked
      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(1);
    });

    it('should handle max retries by calling markAsFailed', () => {
      const markAsFailedSpy = jest.spyOn(webhookRetryService, 'markAsFailed');
      
      // Try to schedule with max retries already reached
      webhookRetryService.scheduleRetry(mockEventId, 3, mockProcessFunction, mockEventData);

      expect(markAsFailedSpy).toHaveBeenCalledWith(mockEventId, 'Max retries exceeded');
      expect(global.setTimeout).not.toHaveBeenCalled();
    });

    it('should remove timeout after successful processing', async () => {
      webhookRetryService.scheduleRetry(mockEventId, 0, mockProcessFunction, mockEventData);

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(1);

      // Fast-forward timer to trigger retry
      jest.advanceTimersByTime(60000);

      await Promise.resolve(); // Allow async operations to complete

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(0);
    });
  });

  describe('cancelRetry', () => {
    const mockEventId = 'evt_test123';
    const mockEventData = { id: mockEventId, type: 'payment_intent.succeeded' };
    const mockProcessFunction = jest.fn();

    it('should cancel scheduled retry', () => {
      webhookRetryService.scheduleRetry(mockEventId, 0, mockProcessFunction, mockEventData);
      
      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(1);

      webhookRetryService.cancelRetry(mockEventId);

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(0);
      expect(global.clearTimeout).toHaveBeenCalled();
    });

    it('should handle canceling non-existent retry', () => {
      webhookRetryService.cancelRetry('non_existent_event');

      // Should not throw error
      expect(global.clearTimeout).not.toHaveBeenCalled();
    });

    it('should prevent cancelled retry from executing', () => {
      webhookRetryService.scheduleRetry(mockEventId, 0, mockProcessFunction, mockEventData);
      webhookRetryService.cancelRetry(mockEventId);

      // Fast-forward timer
      jest.advanceTimersByTime(60000);

      expect(mockProcessFunction).not.toHaveBeenCalled();
    });
  });

  describe('markAsFailed', () => {
    const mockEventId = 'evt_test123';
    const mockReason = 'Max retries exceeded';

    it('should mark webhook as permanently failed', async () => {
      await webhookRetryService.markAsFailed(mockEventId, mockReason);

      expect(paymentRepository.updateWebhookEventStatus).toHaveBeenCalledWith(
        mockEventId,
        'failed_permanent',
        mockReason
      );
    });

    it('should send alert for permanently failed webhook', async () => {
      await webhookRetryService.markAsFailed(mockEventId, mockReason);

      expect(alertService.sendAlert).toHaveBeenCalledWith({
        title: 'Webhook Processing Failed Permanently',
        message: `Webhook ${mockEventId} failed after ${webhookRetryService.maxRetries} retries`,
        severity: 'HIGH',
        details: {
          eventId: mockEventId,
          reason: mockReason,
          maxRetries: webhookRetryService.maxRetries
        }
      });
    });

    it('should handle errors when marking as failed', async () => {
      paymentRepository.updateWebhookEventStatus.mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(webhookRetryService.markAsFailed(mockEventId, mockReason)).resolves.toBeUndefined();
    });

    it('should handle errors when sending alert', async () => {
      alertService.sendAlert.mockRejectedValue(new Error('Alert service error'));

      // Should not throw error
      await expect(webhookRetryService.markAsFailed(mockEventId, mockReason)).resolves.toBeUndefined();
    });
  });

  describe('getRetryStats', () => {
    it('should return current retry statistics', () => {
      const stats = webhookRetryService.getRetryStats();

      expect(stats).toEqual({
        pendingRetries: 0,
        maxRetries: 3,
        retryDelays: [60000, 300000, 900000]
      });
    });

    it('should reflect pending retries count', () => {
      const mockProcessFunction = jest.fn();
      const mockEventData = { id: 'evt_1', type: 'payment_intent.succeeded' };

      webhookRetryService.scheduleRetry('evt_1', 0, mockProcessFunction, mockEventData);
      webhookRetryService.scheduleRetry('evt_2', 0, mockProcessFunction, mockEventData);

      const stats = webhookRetryService.getRetryStats();
      expect(stats.pendingRetries).toBe(2);
    });
  });

  describe('clearAllRetries', () => {
    it('should clear all pending retries', () => {
      const mockProcessFunction = jest.fn();
      const mockEventData = { id: 'evt_1', type: 'payment_intent.succeeded' };

      webhookRetryService.scheduleRetry('evt_1', 0, mockProcessFunction, mockEventData);
      webhookRetryService.scheduleRetry('evt_2', 0, mockProcessFunction, mockEventData);
      webhookRetryService.scheduleRetry('evt_3', 0, mockProcessFunction, mockEventData);

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(3);

      webhookRetryService.clearAllRetries();

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(0);
      expect(global.clearTimeout).toHaveBeenCalledTimes(3);
    });

    it('should handle clearing when no retries are pending', () => {
      webhookRetryService.clearAllRetries();

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(0);
      expect(global.clearTimeout).not.toHaveBeenCalled();
    });
  });

  describe('process integration', () => {
    it('should handle SIGTERM signal for graceful shutdown', () => {
      const mockProcessFunction = jest.fn();
      const mockEventData = { id: 'evt_1', type: 'payment_intent.succeeded' };

      webhookRetryService.scheduleRetry('evt_1', 0, mockProcessFunction, mockEventData);
      webhookRetryService.scheduleRetry('evt_2', 0, mockProcessFunction, mockEventData);

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(2);

      // Simulate SIGTERM
      process.emit('SIGTERM');

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(0);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle transaction errors during retry processing', async () => {
      const mockProcessFunction = jest.fn().mockResolvedValue();
      const mockEventData = { id: 'evt_test', type: 'payment_intent.succeeded' };
      
      // Mock transaction to fail
      const { withTransaction } = require('../../utils/db-transaction');
      withTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

      webhookRetryService.scheduleRetry('evt_test', 0, mockProcessFunction, mockEventData);

      // Fast-forward timer to trigger retry
      jest.advanceTimersByTime(60000);

      await Promise.resolve(); // Allow async operations to complete

      expect(paymentRepository.updateWebhookEventStatus).toHaveBeenCalledWith(
        'evt_test',
        'failed',
        'Transaction failed'
      );
    });

    it('should handle processing function that throws synchronously', async () => {
      const mockProcessFunction = jest.fn().mockImplementation(() => {
        throw new Error('Synchronous error');
      });
      const mockEventData = { id: 'evt_test', type: 'payment_intent.succeeded' };

      webhookRetryService.scheduleRetry('evt_test', 0, mockProcessFunction, mockEventData);

      // Fast-forward timer to trigger retry
      jest.advanceTimersByTime(60000);

      await Promise.resolve(); // Allow async operations to complete

      expect(paymentRepository.updateWebhookEventStatus).toHaveBeenCalledWith(
        'evt_test',
        'failed',
        'Synchronous error'
      );
    });

    it('should handle memory cleanup for large numbers of retries', () => {
      const mockProcessFunction = jest.fn();
      const mockEventData = { id: 'evt_test', type: 'payment_intent.succeeded' };

      // Schedule many retries
      for (let i = 0; i < 1000; i++) {
        webhookRetryService.scheduleRetry(`evt_${i}`, 0, mockProcessFunction, mockEventData);
      }

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(1000);

      // Clear all should handle large numbers efficiently
      const startTime = Date.now();
      webhookRetryService.clearAllRetries();
      const endTime = Date.now();

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(0);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should prevent retry loops for the same event', () => {
      const mockProcessFunction = jest.fn().mockRejectedValue(new Error('Always fails'));
      const mockEventData = { id: 'evt_test', type: 'payment_intent.succeeded' };

      // Schedule initial retry
      webhookRetryService.scheduleRetry('evt_test', 0, mockProcessFunction, mockEventData);

      // Fast-forward through all retries
      for (let i = 0; i < 4; i++) {
        jest.advanceTimersByTime(900000); // Max delay
        jest.runOnlyPendingTimers();
      }

      // Should not exceed max retries
      expect(mockProcessFunction).toHaveBeenCalledTimes(3); // Max retries
      expect(paymentRepository.updateWebhookEventStatus).toHaveBeenLastCalledWith(
        'evt_test',
        'failed_permanent',
        'Max retries exceeded'
      );
    });

    it('should handle concurrent retry operations safely', async () => {
      const mockProcessFunction = jest.fn().mockResolvedValue();
      const mockEventData = { id: 'evt_test', type: 'payment_intent.succeeded' };

      // Schedule multiple retries concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            webhookRetryService.scheduleRetry(`evt_${i}`, 0, mockProcessFunction, mockEventData);
          })
        );
      }

      await Promise.all(promises);

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(10);

      // Cancel all concurrently
      const cancelPromises = [];
      for (let i = 0; i < 10; i++) {
        cancelPromises.push(
          Promise.resolve().then(() => {
            webhookRetryService.cancelRetry(`evt_${i}`);
          })
        );
      }

      await Promise.all(cancelPromises);

      expect(webhookRetryService.getRetryStats().pendingRetries).toBe(0);
    });
  });
});