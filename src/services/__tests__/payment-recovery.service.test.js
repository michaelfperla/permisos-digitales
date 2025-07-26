const paymentRecoveryService = require('../payment-recovery.service');
const stripePaymentService = require('../stripe-payment.service');
const applicationRepository = require('../../repositories/application.repository');
const paymentRepository = require('../../repositories/payment.repository');
const paymentRecoveryRepository = require('../../repositories/payment-recovery.repository');
const redisClient = require('../../utils/redis-client');
const { ApplicationStatus } = require('../../constants');

// Mock all dependencies
jest.mock('../stripe-payment.service');
jest.mock('../../repositories/application.repository');
jest.mock('../../repositories/payment.repository');
jest.mock('../../repositories/payment-recovery.repository');
jest.mock('../../utils/redis-client');
jest.mock('../../services/alert.service');

describe('PaymentRecoveryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    paymentRecoveryService.metrics = {
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      circuitBreakerTrips: 0
    };
  });

  describe('attemptPaymentRecovery', () => {
    const mockApplicationId = 123;
    const mockPaymentIntentId = 'pi_test_123';

    it('should return cached result if idempotency key exists', async () => {
      const cachedResult = { success: true, reason: 'payment_succeeded' };
      redisClient.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await paymentRecoveryService.attemptPaymentRecovery(
        mockApplicationId,
        mockPaymentIntentId,
        { message: 'test' }
      );

      expect(result).toEqual(cachedResult);
      expect(redisClient.get).toHaveBeenCalledWith(`recovery_${mockApplicationId}_${mockPaymentIntentId}`);
      expect(stripePaymentService.retrievePaymentIntent).not.toHaveBeenCalled();
    });

    it('should handle max recovery attempts', async () => {
      redisClient.get.mockResolvedValue(null);
      paymentRecoveryRepository.getRecoveryAttempt.mockResolvedValue({
        attempt_count: 3
      });

      const result = await paymentRecoveryService.attemptPaymentRecovery(
        mockApplicationId,
        mockPaymentIntentId,
        { message: 'test' }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('max_attempts_reached');
      expect(paymentRecoveryRepository.updateRecoveryStatus).toHaveBeenCalledWith(
        mockApplicationId,
        mockPaymentIntentId,
        'max_attempts_reached'
      );
    });

    it('should handle succeeded payment intent', async () => {
      redisClient.get.mockResolvedValue(null);
      paymentRecoveryRepository.getRecoveryAttempt.mockResolvedValue(null);
      stripePaymentService.retrievePaymentIntent.mockResolvedValue({
        id: mockPaymentIntentId,
        status: 'succeeded',
        amount: 15000
      });
      paymentRepository.updatePaymentOrder.mockResolvedValue({});
      applicationRepository.update.mockResolvedValue({});

      const result = await paymentRecoveryService.attemptPaymentRecovery(
        mockApplicationId,
        mockPaymentIntentId,
        { message: 'test' }
      );

      expect(result.success).toBe(true);
      expect(result.reason).toBe('payment_succeeded');
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith(
        mockApplicationId,
        mockPaymentIntentId,
        'SUCCEEDED'
      );
      expect(applicationRepository.update).toHaveBeenCalledWith(
        mockApplicationId,
        { status: ApplicationStatus.PAYMENT_PROCESSING }
      );
    });

    it('should handle requires_capture status with auto-capture', async () => {
      redisClient.get.mockResolvedValue(null);
      paymentRecoveryRepository.getRecoveryAttempt.mockResolvedValue(null);
      stripePaymentService.retrievePaymentIntent.mockResolvedValue({
        id: mockPaymentIntentId,
        status: 'requires_capture',
        amount: 15000
      });
      applicationRepository.findById.mockResolvedValue({
        id: mockApplicationId,
        status: ApplicationStatus.APPROVED
      });
      stripePaymentService.capturePaymentIntent.mockResolvedValue({
        id: mockPaymentIntentId,
        status: 'succeeded',
        amount: 15000
      });

      const result = await paymentRecoveryService.attemptPaymentRecovery(
        mockApplicationId,
        mockPaymentIntentId,
        { message: 'test' }
      );

      expect(stripePaymentService.capturePaymentIntent).toHaveBeenCalledWith(mockPaymentIntentId);
      expect(result.success).toBe(true);
      expect(result.reason).toBe('payment_succeeded');
    });

    it('should handle processing status with scheduled retry', async () => {
      jest.useFakeTimers();
      redisClient.get.mockResolvedValue(null);
      paymentRecoveryRepository.getRecoveryAttempt.mockResolvedValue({ attempt_count: 1 });
      stripePaymentService.retrievePaymentIntent.mockResolvedValue({
        id: mockPaymentIntentId,
        status: 'processing'
      });

      const result = await paymentRecoveryService.attemptPaymentRecovery(
        mockApplicationId,
        mockPaymentIntentId,
        { message: 'test' }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('still_processing');
      expect(result.nextCheckIn).toBe(60); // 60 seconds for second attempt

      // Verify retry is scheduled
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000);
      
      jest.useRealTimers();
    });

    it('should handle circuit breaker open state', async () => {
      // Force circuit breaker to open by simulating multiple failures
      paymentRecoveryService.circuitBreaker.recordFailure();
      paymentRecoveryService.circuitBreaker.recordFailure();
      paymentRecoveryService.circuitBreaker.recordFailure();
      paymentRecoveryService.circuitBreaker.recordFailure();
      paymentRecoveryService.circuitBreaker.recordFailure();

      const result = await paymentRecoveryService.attemptPaymentRecovery(
        mockApplicationId,
        mockPaymentIntentId,
        { message: 'test' }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('circuit_breaker_open');
      expect(paymentRecoveryService.metrics.circuitBreakerTrips).toBe(1);
    });
  });

  describe('reconcilePaymentStatus', () => {
    const mockApplicationId = 123;
    const mockPaymentIntentId = 'pi_test_123';

    it('should update status when out of sync', async () => {
      applicationRepository.findById.mockResolvedValue({
        id: mockApplicationId,
        status: ApplicationStatus.PAYMENT_PROCESSING
      });
      paymentRepository.findByApplicationId.mockResolvedValue({
        stripe_payment_intent_id: mockPaymentIntentId,
        status: 'PROCESSING'
      });
      stripePaymentService.retrievePaymentIntent.mockResolvedValue({
        id: mockPaymentIntentId,
        status: 'succeeded'
      });

      const result = await paymentRecoveryService.reconcilePaymentStatus(mockApplicationId);

      expect(result.success).toBe(true);
      expect(result.reason).toBe('status_updated');
      expect(result.oldStatus).toBe('PROCESSING');
      expect(result.newStatus).toBe('succeeded');
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith(
        mockApplicationId,
        mockPaymentIntentId,
        'succeeded'
      );
    });

    it('should handle missing payment order', async () => {
      applicationRepository.findById.mockResolvedValue({
        id: mockApplicationId
      });
      paymentRepository.findByApplicationId.mockResolvedValue(null);

      const result = await paymentRecoveryService.reconcilePaymentStatus(mockApplicationId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_payment_order');
    });

    it('should handle missing application', async () => {
      applicationRepository.findById.mockResolvedValue(null);

      const result = await paymentRecoveryService.reconcilePaymentStatus(mockApplicationId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('reconciliation_error');
      expect(result.error).toContain('Application not found');
    });
  });

  describe('getRecoveryStatus', () => {
    it('should return status for existing recovery attempt', async () => {
      const mockAttempt = {
        attempt_count: 2,
        last_attempt_time: new Date(),
        recovery_status: 'recovering',
        last_error: 'Network timeout'
      };
      paymentRecoveryRepository.getRecoveryAttempt.mockResolvedValue(mockAttempt);

      const status = await paymentRecoveryService.getRecoveryStatus(123, 'pi_test');

      expect(status.attempts).toBe(2);
      expect(status.maxAttempts).toBe(3);
      expect(status.canRetry).toBe(true);
      expect(status.status).toBe('recovering');
      expect(status.lastError).toBe('Network timeout');
      expect(status.nextAttemptDelay).toBe(120000); // Third attempt delay
    });

    it('should return default status for non-existent attempt', async () => {
      paymentRecoveryRepository.getRecoveryAttempt.mockResolvedValue(null);

      const status = await paymentRecoveryService.getRecoveryStatus(123, 'pi_test');

      expect(status.attempts).toBe(0);
      expect(status.canRetry).toBe(true);
      expect(status.status).toBe('not_attempted');
      expect(status.nextAttemptDelay).toBe(30000); // First attempt delay
    });

    it('should indicate cannot retry when max attempts reached', async () => {
      const mockAttempt = {
        attempt_count: 3,
        recovery_status: 'failed',
        last_attempt_time: new Date()
      };
      paymentRecoveryRepository.getRecoveryAttempt.mockResolvedValue(mockAttempt);

      const status = await paymentRecoveryService.getRecoveryStatus(123, 'pi_test');

      expect(status.canRetry).toBe(false);
      expect(status.attempts).toBe(3);
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics', () => {
      const metrics = paymentRecoveryService.getMetrics();

      expect(metrics).toHaveProperty('recoveryAttempts');
      expect(metrics).toHaveProperty('successfulRecoveries');
      expect(metrics).toHaveProperty('failedRecoveries');
      expect(metrics).toHaveProperty('circuitBreakerTrips');
      expect(metrics).toHaveProperty('circuitBreakerState');
      expect(metrics).toHaveProperty('timestamp');
    });
  });

  describe('getRecoveryStats', () => {
    it('should return stats from repository', async () => {
      const mockStats = {
        totalRecoveries: 10,
        successfulRecoveries: 7,
        failedRecoveries: 3
      };
      paymentRecoveryRepository.getRecoveryStats.mockResolvedValue(mockStats);

      const stats = await paymentRecoveryService.getRecoveryStats(24);

      expect(paymentRecoveryRepository.getRecoveryStats).toHaveBeenCalledWith(24);
      expect(stats).toEqual(mockStats);
    });
  });

  describe('error handling', () => {
    it('should handle Stripe service errors gracefully', async () => {
      redisClient.get.mockResolvedValue(null);
      paymentRecoveryRepository.getRecoveryAttempt.mockResolvedValue(null);
      stripePaymentService.retrievePaymentIntent.mockRejectedValue(new Error('Stripe API error'));

      const result = await paymentRecoveryService.attemptPaymentRecovery(123, 'pi_test', {});

      expect(result.success).toBe(false);
      expect(result.reason).toBe('recovery_error');
      expect(result.error).toBe('Stripe API error');
    });

    it('should handle database errors during recovery', async () => {
      redisClient.get.mockResolvedValue(null);
      paymentRecoveryRepository.getRecoveryAttempt.mockRejectedValue(new Error('Database error'));

      const result = await paymentRecoveryService.attemptPaymentRecovery(123, 'pi_test', {});

      expect(result.success).toBe(false);
      expect(result.reason).toBe('recovery_error');
    });
  });
});