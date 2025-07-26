jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../services/payment-monitoring.service', () => ({
  getHealthStatus: jest.fn(),
  getDetailedMetrics: jest.fn(),
  reconcilePayment: jest.fn(),
  resetMetrics: jest.fn(),
  checkStripeConnectivity: jest.fn(),
  calculateHealthScore: jest.fn(),
  getCircuitBreakerStatus: jest.fn()
}));

jest.mock('../../utils/api-response', () => ({
  success: jest.fn().mockImplementation((res, data, status, message) => {
    res.locals = { statusCode: status || 200, body: { success: true, data, message } };
    return res;
  }),
  error: jest.fn().mockImplementation((res, message, status = 500) => {
    res.locals = { statusCode: status, body: { success: false, message } };
    return res;
  }),
  badRequest: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 400, body: { success: false, message } };
    return res;
  }),
  unauthorized: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 401, body: { success: false, message } };
    return res;
  })
}));

const {
  getPaymentHealth,
  getPaymentMetrics,
  reconcilePayment,
  resetMetrics
} = require('../payment-health.controller');
const paymentMonitoringService = require('../../services/payment-monitoring.service');
const ApiResponse = require('../../utils/api-response');
const { logger } = require('../../utils/logger');

describe('PaymentHealthController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      user: { id: 1, role: 'user' },
      headers: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {}
    };

    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getPaymentHealth', () => {
    const mockHealthData = {
      status: 'healthy',
      successRate: 0.95,
      averageProcessingTime: 1234,
      errorRate: 0.05,
      lastCheck: new Date(),
      recommendations: []
    };

    const mockMetrics = {
      totalPayments: 1000,
      successfulPayments: 950,
      failedPayments: 50,
      processingTimes: [1000, 1200, 1300, 1100, 1500]
    };

    const mockCircuitBreakerStatus = {
      stripe: { status: 'closed', failures: 0 },
      oxxo: { status: 'closed', failures: 1 }
    };

    it('should return payment health status successfully', async () => {
      paymentMonitoringService.checkStripeConnectivity.mockResolvedValue(true);
      paymentMonitoringService.getHealthStatus.mockResolvedValue(mockHealthData);
      paymentMonitoringService.getDetailedMetrics.mockResolvedValue(mockMetrics);
      paymentMonitoringService.calculateHealthScore.mockReturnValue(95);
      paymentMonitoringService.getCircuitBreakerStatus.mockResolvedValue(mockCircuitBreakerStatus);

      await getPaymentHealth(req, res);

      expect(paymentMonitoringService.checkStripeConnectivity).toHaveBeenCalled();
      expect(paymentMonitoringService.getHealthStatus).toHaveBeenCalled();
      expect(paymentMonitoringService.getDetailedMetrics).toHaveBeenCalled();
      expect(paymentMonitoringService.calculateHealthScore).toHaveBeenCalledWith({
        successRate: 0.95,
        processingTime: 1234,
        errorRate: 0.05
      });
      expect(paymentMonitoringService.getCircuitBreakerStatus).toHaveBeenCalled();

      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        overall: {
          status: 'healthy',
          score: 95,
          lastCheck: mockHealthData.lastCheck
        },
        stripe: {
          connected: true,
          status: 'operational'
        },
        metrics: {
          successRate: '95.00%',
          averageProcessingTime: '1.23s',
          errorRate: '5.00%',
          totalPayments: 1000
        },
        circuitBreakers: mockCircuitBreakerStatus,
        recommendations: []
      });
    });

    it('should handle degraded health status with recommendations', async () => {
      const degradedHealth = {
        ...mockHealthData,
        status: 'degraded',
        successRate: 0.85,
        errorRate: 0.15,
        recommendations: [
          'High error rate detected',
          'Consider checking payment provider status'
        ]
      };

      paymentMonitoringService.checkStripeConnectivity.mockResolvedValue(true);
      paymentMonitoringService.getHealthStatus.mockResolvedValue(degradedHealth);
      paymentMonitoringService.getDetailedMetrics.mockResolvedValue(mockMetrics);
      paymentMonitoringService.calculateHealthScore.mockReturnValue(70);
      paymentMonitoringService.getCircuitBreakerStatus.mockResolvedValue({
        stripe: { status: 'half-open', failures: 3 },
        oxxo: { status: 'closed', failures: 0 }
      });

      await getPaymentHealth(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        overall: expect.objectContaining({
          status: 'degraded',
          score: 70
        }),
        recommendations: degradedHealth.recommendations
      }));
    });

    it('should handle critical health status', async () => {
      const criticalHealth = {
        status: 'critical',
        successRate: 0.5,
        averageProcessingTime: 5000,
        errorRate: 0.5,
        recommendations: [
          'Critical: Payment system experiencing major issues',
          'Immediate investigation required'
        ]
      };

      paymentMonitoringService.checkStripeConnectivity.mockResolvedValue(false);
      paymentMonitoringService.getHealthStatus.mockResolvedValue(criticalHealth);
      paymentMonitoringService.getDetailedMetrics.mockResolvedValue({
        ...mockMetrics,
        successfulPayments: 500,
        failedPayments: 500
      });
      paymentMonitoringService.calculateHealthScore.mockReturnValue(25);
      paymentMonitoringService.getCircuitBreakerStatus.mockResolvedValue({
        stripe: { status: 'open', failures: 10 },
        oxxo: { status: 'open', failures: 8 }
      });

      await getPaymentHealth(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        overall: expect.objectContaining({
          status: 'critical',
          score: 25
        }),
        stripe: {
          connected: false,
          status: 'disconnected'
        }
      }));
    });

    it('should handle service errors gracefully', async () => {
      paymentMonitoringService.checkStripeConnectivity.mockRejectedValue(new Error('Connection failed'));

      await getPaymentHealth(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al obtener el estado de salud del sistema de pagos', 500);
      expect(logger.error).toHaveBeenCalledWith('Error getting payment health', expect.any(Object));
    });

    it('should format processing time correctly', async () => {
      const testCases = [
        { time: 500, expected: '0.50s' },
        { time: 1234, expected: '1.23s' },
        { time: 10567, expected: '10.57s' }
      ];

      for (const testCase of testCases) {
        paymentMonitoringService.checkStripeConnectivity.mockResolvedValue(true);
        paymentMonitoringService.getHealthStatus.mockResolvedValue({
          ...mockHealthData,
          averageProcessingTime: testCase.time
        });
        paymentMonitoringService.getDetailedMetrics.mockResolvedValue(mockMetrics);
        paymentMonitoringService.calculateHealthScore.mockReturnValue(95);
        paymentMonitoringService.getCircuitBreakerStatus.mockResolvedValue(mockCircuitBreakerStatus);

        await getPaymentHealth(req, res);

        expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
          metrics: expect.objectContaining({
            averageProcessingTime: testCase.expected
          })
        }));
      }
    });
  });

  describe('getPaymentMetrics', () => {
    const mockDetailedMetrics = {
      totalPayments: 5000,
      successfulPayments: 4750,
      failedPayments: 250,
      totalAmount: 50000000,
      averageAmount: 10000,
      paymentMethods: {
        card: 3000,
        oxxo: 2000
      },
      hourlyRate: 208,
      dailyRate: 5000,
      weeklyRate: 35000,
      lastUpdated: new Date()
    };

    it('should return detailed payment metrics successfully', async () => {
      paymentMonitoringService.getDetailedMetrics.mockResolvedValue(mockDetailedMetrics);

      await getPaymentMetrics(req, res);

      expect(paymentMonitoringService.getDetailedMetrics).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        summary: {
          total: 5000,
          successful: 4750,
          failed: 250,
          successRate: '95.00%'
        },
        financial: {
          totalProcessed: 'MXN 500,000.00',
          averageTransaction: 'MXN 100.00'
        },
        distribution: {
          card: {
            count: 3000,
            percentage: '60.00%'
          },
          oxxo: {
            count: 2000,
            percentage: '40.00%'
          }
        },
        rates: {
          hourly: 208,
          daily: 5000,
          weekly: 35000
        },
        lastUpdated: mockDetailedMetrics.lastUpdated
      });
    });

    it('should handle empty metrics gracefully', async () => {
      paymentMonitoringService.getDetailedMetrics.mockResolvedValue({
        totalPayments: 0,
        successfulPayments: 0,
        failedPayments: 0,
        totalAmount: 0,
        averageAmount: 0,
        paymentMethods: {},
        hourlyRate: 0,
        dailyRate: 0,
        weeklyRate: 0,
        lastUpdated: new Date()
      });

      await getPaymentMetrics(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          successRate: '0.00%'
        }
      }));
    });

    it('should format currency amounts correctly', async () => {
      paymentMonitoringService.getDetailedMetrics.mockResolvedValue({
        ...mockDetailedMetrics,
        totalAmount: 123456789,
        averageAmount: 98765
      });

      await getPaymentMetrics(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        financial: {
          totalProcessed: 'MXN 1,234,567.89',
          averageTransaction: 'MXN 987.65'
        }
      }));
    });

    it('should handle service errors', async () => {
      paymentMonitoringService.getDetailedMetrics.mockRejectedValue(new Error('Database error'));

      await getPaymentMetrics(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al obtener métricas de pago', 500);
      expect(logger.error).toHaveBeenCalledWith('Error getting payment metrics', expect.any(Object));
    });

    it('should calculate payment method percentages correctly', async () => {
      paymentMonitoringService.getDetailedMetrics.mockResolvedValue({
        ...mockDetailedMetrics,
        paymentMethods: {
          card: 750,
          oxxo: 200,
          bank_transfer: 50
        },
        totalPayments: 1000
      });

      await getPaymentMetrics(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        distribution: {
          card: {
            count: 750,
            percentage: '75.00%'
          },
          oxxo: {
            count: 200,
            percentage: '20.00%'
          },
          bank_transfer: {
            count: 50,
            percentage: '5.00%'
          }
        }
      }));
    });
  });

  describe('reconcilePayment', () => {
    beforeEach(() => {
      req.params = { applicationId: 'app123' };
    });

    it('should reconcile payment successfully', async () => {
      paymentMonitoringService.reconcilePayment.mockResolvedValue({
        success: true,
        status: 'completed',
        paymentId: 'pay_123',
        reconciliationDetails: {
          previousStatus: 'pending',
          newStatus: 'completed',
          updatedAt: new Date()
        }
      });

      await reconcilePayment(req, res);

      expect(paymentMonitoringService.reconcilePayment).toHaveBeenCalledWith('app123');
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        reconciled: true,
        status: 'completed',
        details: expect.any(Object)
      }, 200, 'Pago reconciliado exitosamente');
    });

    it('should handle missing applicationId', async () => {
      req.params = {};

      await reconcilePayment(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'ID de aplicación requerido');
      expect(paymentMonitoringService.reconcilePayment).not.toHaveBeenCalled();
    });

    it('should handle reconciliation failure', async () => {
      paymentMonitoringService.reconcilePayment.mockResolvedValue({
        success: false,
        error: 'Payment not found'
      });

      await reconcilePayment(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'No se pudo reconciliar el pago', 400);
    });

    it('should handle service errors', async () => {
      paymentMonitoringService.reconcilePayment.mockRejectedValue(new Error('Reconciliation error'));

      await reconcilePayment(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al reconciliar el pago', 500);
      expect(logger.error).toHaveBeenCalledWith('Error reconciling payment', expect.any(Object));
    });

    it('should handle no changes during reconciliation', async () => {
      paymentMonitoringService.reconcilePayment.mockResolvedValue({
        success: true,
        status: 'completed',
        noChanges: true,
        message: 'Payment already in correct state'
      });

      await reconcilePayment(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        reconciled: true,
        status: 'completed'
      }));
    });
  });

  describe('resetMetrics', () => {
    it('should reset metrics successfully for admin users', async () => {
      req.user.role = 'admin';
      paymentMonitoringService.resetMetrics.mockResolvedValue({
        success: true,
        message: 'Metrics reset successfully'
      });

      await resetMetrics(req, res);

      expect(paymentMonitoringService.resetMetrics).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        reset: true,
        message: 'Métricas de pago reiniciadas exitosamente'
      });
      expect(logger.warn).toHaveBeenCalledWith('Payment metrics reset by admin', { userId: 1 });
    });

    it('should deny access to non-admin users', async () => {
      req.user.role = 'user';

      await resetMetrics(req, res);

      expect(ApiResponse.unauthorized).toHaveBeenCalledWith(res, 'Acceso denegado. Se requieren permisos de administrador');
      expect(paymentMonitoringService.resetMetrics).not.toHaveBeenCalled();
    });

    it('should handle missing user role', async () => {
      delete req.user.role;

      await resetMetrics(req, res);

      expect(ApiResponse.unauthorized).toHaveBeenCalledWith(res, 'Acceso denegado. Se requieren permisos de administrador');
      expect(paymentMonitoringService.resetMetrics).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      req.user.role = 'admin';
      paymentMonitoringService.resetMetrics.mockRejectedValue(new Error('Reset failed'));

      await resetMetrics(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al reiniciar métricas', 500);
      expect(logger.error).toHaveBeenCalledWith('Error resetting payment metrics', expect.any(Object));
    });

    it('should handle partial reset failure', async () => {
      req.user.role = 'admin';
      paymentMonitoringService.resetMetrics.mockResolvedValue({
        success: false,
        error: 'Some metrics could not be reset'
      });

      await resetMetrics(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'No se pudieron reiniciar las métricas', 500);
    });
  });
});