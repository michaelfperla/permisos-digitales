jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../repositories', () => ({
  applicationRepository: {
    findByStatus: jest.fn(),
    updateStatus: jest.fn(),
    update: jest.fn()
  },
  paymentRepository: {
    findPendingPayments: jest.fn(),
    updatePaymentOrder: jest.fn(),
    findByApplicationId: jest.fn()
  }
}));

jest.mock('../../services/stripe-payment.service', () => ({
  stripePaymentService: {
    getPaymentIntent: jest.fn(),
    getCustomer: jest.fn()
  }
}));

jest.mock('../../services/alert.service', () => ({
  sendAlert: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../services/notification.service', () => ({
  sendPaymentConfirmation: jest.fn().mockResolvedValue(true),
  sendPaymentFailureNotification: jest.fn().mockResolvedValue(true)
}));

const PaymentReconciliationJob = require('../payment-reconciliation');
const { applicationRepository, paymentRepository } = require('../../repositories');
const { stripePaymentService } = require('../../services/stripe-payment.service');
const { sendAlert } = require('../../services/alert.service');
const { sendPaymentConfirmation, sendPaymentFailureNotification } = require('../../services/notification.service');
const { logger } = require('../../utils/logger');

describe('PaymentReconciliationJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('run', () => {
    const mockPendingPayments = [
      {
        id: 'pay_123',
        applicationId: 'app_123',
        paymentIntentId: 'pi_123',
        status: 'pending',
        amount: 10000,
        createdAt: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
      },
      {
        id: 'pay_456',
        applicationId: 'app_456',
        paymentIntentId: 'pi_456',
        status: 'awaiting_oxxo_payment',
        amount: 20000,
        createdAt: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
      }
    ];

    const mockApplications = [
      {
        id: 'app_123',
        userId: 'user_123',
        status: 'AWAITING_PAYMENT',
        applicationData: {
          personalInfo: { email: 'user1@test.com' }
        }
      },
      {
        id: 'app_456',
        userId: 'user_456', 
        status: 'AWAITING_OXXO_PAYMENT',
        applicationData: {
          personalInfo: { email: 'user2@test.com' }
        }
      }
    ];

    it('should reconcile successful payments', async () => {
      paymentRepository.findPendingPayments.mockResolvedValue(mockPendingPayments);
      applicationRepository.findByStatus.mockResolvedValue(mockApplications);
      
      stripePaymentService.getPaymentIntent.mockImplementation((paymentIntentId) => {
        if (paymentIntentId === 'pi_123') {
          return Promise.resolve({
            id: 'pi_123',
            status: 'succeeded',
            amount: 10000,
            charges: {
              data: [{ 
                id: 'ch_123',
                receipt_url: 'https://stripe.com/receipt/123'
              }]
            }
          });
        }
        if (paymentIntentId === 'pi_456') {
          return Promise.resolve({
            id: 'pi_456',
            status: 'requires_action',
            amount: 20000
          });
        }
      });

      paymentRepository.updatePaymentOrder.mockResolvedValue({ success: true });
      applicationRepository.updateStatus.mockResolvedValue({ success: true });
      sendPaymentConfirmation.mockResolvedValue(true);

      const result = await PaymentReconciliationJob.run();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.reconciled).toBe(1);
      expect(result.failed).toBe(0);

      // Verify successful payment was updated
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith('pay_123', {
        status: 'completed',
        completedAt: expect.any(Date),
        receiptUrl: 'https://stripe.com/receipt/123'
      });

      expect(applicationRepository.updateStatus).toHaveBeenCalledWith('app_123', 'PAID');
      expect(sendPaymentConfirmation).toHaveBeenCalledWith('user_123', {
        applicationId: 'app_123',
        amount: 10000,
        receiptUrl: 'https://stripe.com/receipt/123'
      });

      expect(logger.info).toHaveBeenCalledWith('Payment reconciliation completed', expect.objectContaining({
        processed: 2,
        reconciled: 1,
        failed: 0
      }));
    });

    it('should handle failed payments', async () => {
      const failedPayment = {
        id: 'pay_789',
        applicationId: 'app_789',
        paymentIntentId: 'pi_789',
        status: 'pending',
        amount: 15000,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24) // 24 hours ago
      };

      const failedApplication = {
        id: 'app_789',
        userId: 'user_789',
        status: 'AWAITING_PAYMENT',
        applicationData: {
          personalInfo: { email: 'user3@test.com' }
        }
      };

      paymentRepository.findPendingPayments.mockResolvedValue([failedPayment]);
      applicationRepository.findByStatus.mockResolvedValue([failedApplication]);
      
      stripePaymentService.getPaymentIntent.mockResolvedValue({
        id: 'pi_789',
        status: 'canceled',
        amount: 15000,
        cancellation_reason: 'abandoned'
      });

      paymentRepository.updatePaymentOrder.mockResolvedValue({ success: true });
      applicationRepository.updateStatus.mockResolvedValue({ success: true });
      sendPaymentFailureNotification.mockResolvedValue(true);

      const result = await PaymentReconciliationJob.run();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.reconciled).toBe(1);
      expect(result.failed).toBe(0);

      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith('pay_789', {
        status: 'failed',
        failedAt: expect.any(Date),
        failureReason: 'abandoned'
      });

      expect(applicationRepository.updateStatus).toHaveBeenCalledWith('app_789', 'PAYMENT_FAILED');
      expect(sendPaymentFailureNotification).toHaveBeenCalledWith('user_789', {
        applicationId: 'app_789',
        reason: 'abandoned'
      });
    });

    it('should handle expired OXXO payments', async () => {
      const expiredOxxoPayment = {
        id: 'pay_oxxo',
        applicationId: 'app_oxxo',
        paymentIntentId: 'pi_oxxo',
        status: 'awaiting_oxxo_payment',
        amount: 25000,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4), // 4 days ago
        oxxoDetails: {
          expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24) // Expired 1 day ago
        }
      };

      const oxxoApplication = {
        id: 'app_oxxo',
        userId: 'user_oxxo',
        status: 'AWAITING_OXXO_PAYMENT',
        applicationData: {
          personalInfo: { email: 'oxxo@test.com' }
        }
      };

      paymentRepository.findPendingPayments.mockResolvedValue([expiredOxxoPayment]);
      applicationRepository.findByStatus.mockResolvedValue([oxxoApplication]);
      
      stripePaymentService.getPaymentIntent.mockResolvedValue({
        id: 'pi_oxxo',
        status: 'requires_action',
        amount: 25000
      });

      const result = await PaymentReconciliationJob.run();

      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith('pay_oxxo', {
        status: 'expired',
        expiredAt: expect.any(Date),
        failureReason: 'oxxo_expired'
      });

      expect(applicationRepository.updateStatus).toHaveBeenCalledWith('app_oxxo', 'PAYMENT_EXPIRED');
      expect(sendAlert).toHaveBeenCalledWith({
        type: 'OXXO_PAYMENT_EXPIRED',
        severity: 'medium',
        message: 'OXXO payment expired',
        metadata: {
          applicationId: 'app_oxxo',
          paymentId: 'pay_oxxo',
          userId: 'user_oxxo'
        }
      });
    });

    it('should handle Stripe API errors gracefully', async () => {
      const paymentWithError = {
        id: 'pay_error',
        applicationId: 'app_error',
        paymentIntentId: 'pi_error',
        status: 'pending',
        amount: 30000,
        createdAt: new Date(Date.now() - 1000 * 60 * 60)
      };

      paymentRepository.findPendingPayments.mockResolvedValue([paymentWithError]);
      applicationRepository.findByStatus.mockResolvedValue([]);
      
      stripePaymentService.getPaymentIntent.mockRejectedValue(new Error('Stripe API error'));

      const result = await PaymentReconciliationJob.run();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.reconciled).toBe(0);
      expect(result.failed).toBe(1);

      expect(logger.error).toHaveBeenCalledWith('Error reconciling payment', expect.objectContaining({
        paymentId: 'pay_error',
        error: expect.any(Error)
      }));

      expect(sendAlert).toHaveBeenCalledWith({
        type: 'PAYMENT_RECONCILIATION_ERROR',
        severity: 'high',
        message: 'Payment reconciliation failed',
        metadata: {
          paymentId: 'pay_error',
          error: 'Stripe API error'
        }
      });
    });

    it('should handle database update failures', async () => {
      paymentRepository.findPendingPayments.mockResolvedValue([mockPendingPayments[0]]);
      applicationRepository.findByStatus.mockResolvedValue([mockApplications[0]]);
      
      stripePaymentService.getPaymentIntent.mockResolvedValue({
        id: 'pi_123',
        status: 'succeeded',
        amount: 10000,
        charges: { data: [{ id: 'ch_123', receipt_url: 'https://stripe.com/receipt/123' }] }
      });

      paymentRepository.updatePaymentOrder.mockRejectedValue(new Error('Database error'));

      const result = await PaymentReconciliationJob.run();

      expect(result.failed).toBe(1);
      expect(logger.error).toHaveBeenCalledWith('Error reconciling payment', expect.objectContaining({
        paymentId: 'pay_123',
        error: expect.any(Error)
      }));
    });

    it('should skip payments without payment intent ID', async () => {
      const paymentWithoutIntent = {
        id: 'pay_no_intent',
        applicationId: 'app_no_intent',
        paymentIntentId: null,
        status: 'pending',
        amount: 5000,
        createdAt: new Date()
      };

      paymentRepository.findPendingPayments.mockResolvedValue([paymentWithoutIntent]);
      applicationRepository.findByStatus.mockResolvedValue([]);

      const result = await PaymentReconciliationJob.run();

      expect(result.processed).toBe(1);
      expect(result.reconciled).toBe(0);
      expect(result.skipped).toBe(1);

      expect(stripePaymentService.getPaymentIntent).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Skipping payment without payment intent ID', {
        paymentId: 'pay_no_intent'
      });
    });

    it('should handle notification service failures gracefully', async () => {
      paymentRepository.findPendingPayments.mockResolvedValue([mockPendingPayments[0]]);
      applicationRepository.findByStatus.mockResolvedValue([mockApplications[0]]);
      
      stripePaymentService.getPaymentIntent.mockResolvedValue({
        id: 'pi_123',
        status: 'succeeded',
        amount: 10000,
        charges: { data: [{ id: 'ch_123', receipt_url: 'https://stripe.com/receipt/123' }] }
      });

      paymentRepository.updatePaymentOrder.mockResolvedValue({ success: true });
      applicationRepository.updateStatus.mockResolvedValue({ success: true });
      sendPaymentConfirmation.mockRejectedValue(new Error('Email service down'));

      const result = await PaymentReconciliationJob.run();

      expect(result.reconciled).toBe(1);
      expect(logger.error).toHaveBeenCalledWith('Failed to send payment confirmation', expect.objectContaining({
        userId: 'user_123',
        error: expect.any(Error)
      }));
    });

    it('should process payments in batches for performance', async () => {
      const largeBatch = Array(100).fill().map((_, i) => ({
        id: `pay_${i}`,
        applicationId: `app_${i}`,
        paymentIntentId: `pi_${i}`,
        status: 'pending',
        amount: 10000,
        createdAt: new Date()
      }));

      paymentRepository.findPendingPayments.mockResolvedValue(largeBatch);
      applicationRepository.findByStatus.mockResolvedValue([]);
      
      stripePaymentService.getPaymentIntent.mockResolvedValue({
        status: 'succeeded',
        amount: 10000,
        charges: { data: [{ id: 'ch_123', receipt_url: 'https://stripe.com/receipt/123' }] }
      });

      paymentRepository.updatePaymentOrder.mockResolvedValue({ success: true });

      const result = await PaymentReconciliationJob.run();

      expect(result.processed).toBe(100);
      expect(stripePaymentService.getPaymentIntent).toHaveBeenCalledTimes(100);
    });

    it('should handle mixed payment statuses correctly', async () => {
      const mixedPayments = [
        { ...mockPendingPayments[0], status: 'pending' },
        { ...mockPendingPayments[1], status: 'awaiting_oxxo_payment' },
        { 
          id: 'pay_processing',
          applicationId: 'app_processing',
          paymentIntentId: 'pi_processing',
          status: 'processing',
          amount: 12000,
          createdAt: new Date()
        }
      ];

      paymentRepository.findPendingPayments.mockResolvedValue(mixedPayments);
      applicationRepository.findByStatus.mockResolvedValue(mockApplications);
      
      stripePaymentService.getPaymentIntent.mockImplementation((paymentIntentId) => {
        const statusMap = {
          'pi_123': 'succeeded',
          'pi_456': 'requires_action', 
          'pi_processing': 'processing'
        };
        
        return Promise.resolve({
          id: paymentIntentId,
          status: statusMap[paymentIntentId] || 'requires_payment_method',
          amount: 10000,
          charges: { data: [{ id: 'ch_123', receipt_url: 'https://stripe.com/receipt/123' }] }
        });
      });

      paymentRepository.updatePaymentOrder.mockResolvedValue({ success: true });
      applicationRepository.updateStatus.mockResolvedValue({ success: true });

      const result = await PaymentReconciliationJob.run();

      expect(result.processed).toBe(3);
      expect(result.reconciled).toBeGreaterThan(0);
    });
  });

  describe('scheduleReconciliation', () => {
    it('should schedule periodic reconciliation', () => {
      const intervalSpy = jest.spyOn(global, 'setInterval');
      
      PaymentReconciliationJob.scheduleReconciliation();
      
      expect(intervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        15 * 60 * 1000 // 15 minutes
      );
      
      intervalSpy.mockRestore();
    });

    it('should handle reconciliation errors in scheduled runs', async () => {
      const mockInterval = jest.fn();
      jest.spyOn(global, 'setInterval').mockImplementation((callback) => {
        mockInterval.mockImplementation(callback);
        return 'interval-id';
      });

      paymentRepository.findPendingPayments.mockRejectedValue(new Error('Database down'));

      PaymentReconciliationJob.scheduleReconciliation();
      
      await mockInterval();

      expect(logger.error).toHaveBeenCalledWith('Payment reconciliation job failed', expect.any(Object));
      expect(sendAlert).toHaveBeenCalledWith({
        type: 'RECONCILIATION_JOB_FAILED',
        severity: 'critical',
        message: 'Payment reconciliation job encountered an error',
        metadata: { error: 'Database down' }
      });
    });
  });

  describe('stopReconciliation', () => {
    it('should stop scheduled reconciliation', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      PaymentReconciliationJob.reconciliationInterval = 'test-interval-id';
      PaymentReconciliationJob.stopReconciliation();
      
      expect(clearIntervalSpy).toHaveBeenCalledWith('test-interval-id');
      expect(PaymentReconciliationJob.reconciliationInterval).toBeNull();
      
      clearIntervalSpy.mockRestore();
    });

    it('should handle stopping when no interval is active', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      PaymentReconciliationJob.reconciliationInterval = null;
      PaymentReconciliationJob.stopReconciliation();
      
      expect(clearIntervalSpy).not.toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });

  describe('getReconciliationStats', () => {
    it('should return reconciliation statistics', async () => {
      paymentRepository.findPendingPayments.mockResolvedValue([
        { status: 'pending', createdAt: new Date(Date.now() - 1000 * 60 * 30) },
        { status: 'awaiting_oxxo_payment', createdAt: new Date(Date.now() - 1000 * 60 * 60) },
        { status: 'processing', createdAt: new Date(Date.now() - 1000 * 60 * 10) }
      ]);

      const stats = await PaymentReconciliationJob.getReconciliationStats();

      expect(stats).toEqual({
        pendingPayments: 3,
        oldestPendingAge: expect.any(Number),
        averageAge: expect.any(Number),
        statusDistribution: {
          pending: 1,
          awaiting_oxxo_payment: 1,
          processing: 1
        }
      });

      expect(stats.oldestPendingAge).toBeGreaterThan(50); // At least 50 minutes
    });

    it('should handle empty pending payments', async () => {
      paymentRepository.findPendingPayments.mockResolvedValue([]);

      const stats = await PaymentReconciliationJob.getReconciliationStats();

      expect(stats).toEqual({
        pendingPayments: 0,
        oldestPendingAge: 0,
        averageAge: 0,
        statusDistribution: {}
      });
    });
  });
});