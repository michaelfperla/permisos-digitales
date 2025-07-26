// Mock config first to prevent database connection errors
jest.mock('../../config', () => ({
  database: {
    url: 'mock://database'
  },
  stripe: {
    privateKey: 'mock_stripe_key',
    publicKey: 'mock_public_key'
  },
  redis: {
    url: 'mock://redis'
  }
}));

jest.mock('../../db', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../../constants', () => ({
  ApplicationStatus: {
    AWAITING_PAYMENT: 'AWAITING_PAYMENT',
    AWAITING_OXXO_PAYMENT: 'AWAITING_OXXO_PAYMENT',
    PAID: 'PAID',
    PAYMENT_FAILED: 'PAYMENT_FAILED'
  }
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../repositories/payment.repository', () => ({
  logPaymentEvent: jest.fn().mockResolvedValue(true),
  updatePaymentOrder: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../services', () => ({
  stripePaymentService: {
    processOxxoPayment: jest.fn(),
    checkPaymentStatus: jest.fn()
  }
}));

const oxxoPaymentController = require('../oxxo-payment.controller');
const { stripePaymentService } = require('../../services');
const { logger } = require('../../utils/logger');

describe('OxxoPaymentController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {
        customerId: 'cus_123',
        amount: 197.00,
        referenceId: 'APP-123',
        description: 'Test payment'
      },
      params: {
        orderId: 'order_123'
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      render: jest.fn()
    };

    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('createOxxoPayment', () => {
    it('should create OXXO payment successfully', async () => {
      const mockPaymentResult = {
        success: true,
        orderId: 'order_123',
        status: 'pending_payment',
        oxxoReference: '123456789012',
        expiresAt: Math.floor(Date.now() / 1000) + (48 * 60 * 60),
        barcodeUrl: 'https://stripe.com/oxxo/voucher/123',
        amount: 197.00,
        currency: 'MXN'
      };

      stripePaymentService.processOxxoPayment.mockResolvedValue(mockPaymentResult);

      await oxxoPaymentController.createOxxoPayment(req, res);

      expect(stripePaymentService.processOxxoPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cus_123',
          amount: 197.00,
          referenceId: 'APP-123',
          description: 'Test payment'
        }),
        expect.objectContaining({
          expirationDays: 2
        })
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Referencia OXXO generada exitosamente',
          oxxoReference: '123456789012',
          paymentMethod: 'oxxo_cash'
        })
      );
    });

    it('should handle missing customerId', async () => {
      req.body.customerId = undefined;

      await oxxoPaymentController.createOxxoPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'El ID del cliente es requerido'
      });
    });

    it('should handle missing amount', async () => {
      req.body.amount = undefined;

      await oxxoPaymentController.createOxxoPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'El monto es requerido'
      });
    });

    it('should handle missing referenceId', async () => {
      req.body.referenceId = undefined;

      await oxxoPaymentController.createOxxoPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'El ID de referencia es requerido'
      });
    });

    it('should handle Stripe payment failure', async () => {
      stripePaymentService.processOxxoPayment.mockResolvedValue({
        success: false,
        failureMessage: 'Payment processing failed'
      });

      await oxxoPaymentController.createOxxoPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Payment processing failed'
      });
    });

    it('should use idempotency key for payments', async () => {
      const mockPaymentResult = {
        success: true,
        orderId: 'order_123',
        oxxoReference: '123456789012'
      };

      stripePaymentService.processOxxoPayment.mockResolvedValue(mockPaymentResult);

      await oxxoPaymentController.createOxxoPayment(req, res);

      expect(stripePaymentService.processOxxoPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'oxxo-APP-123-cust-cus_123'
        }),
        expect.any(Object)
      );
    });

    it('should handle Stripe service errors', async () => {
      stripePaymentService.processOxxoPayment.mockRejectedValue(new Error('Stripe error'));

      await oxxoPaymentController.createOxxoPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error al procesar la solicitud de pago OXXO. Por favor intente de nuevo más tarde.'
      });
    });

    it('should log payment events', async () => {
      const mockPaymentResult = {
        success: true,
        orderId: 'order_123',
        oxxoReference: '123456789012',
        amount: 197.00
      };

      stripePaymentService.processOxxoPayment.mockResolvedValue(mockPaymentResult);

      await oxxoPaymentController.createOxxoPayment(req, res);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Logged OXXO payment event')
      );
    });
  });

  describe('getOxxoReceipt', () => {
    const mockPaymentStatus = {
      paymentMethod: 'oxxo_cash',
      amount: 19700, // In centavos
      currency: 'MXN',
      status: 'pending',
      oxxoReference: '123456789012',
      expiresAt: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours from now
      orderId: 'order_123'
    };

    it('should render OXXO receipt successfully', async () => {
      const mockPaymentStatusWithDetails = {
        ...mockPaymentStatus,
        paymentDetails: {
          reference: '123456789012',
          barcodeUrl: 'https://stripe.com/oxxo/voucher/123',
          expiresAt: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        }
      };
      
      stripePaymentService.checkPaymentStatus.mockResolvedValue(mockPaymentStatusWithDetails);

      await oxxoPaymentController.getOxxoReceipt(req, res);

      expect(stripePaymentService.checkPaymentStatus).toHaveBeenCalledWith('order_123');
      expect(res.render).toHaveBeenCalledWith('oxxo-receipt', 
        expect.objectContaining({
          title: 'Ficha de Pago OXXO',
          oxxo: expect.objectContaining({
            reference: '123456789012',
            amount: 19700,
            currency: 'MXN'
          })
        })
      );
    });

    it('should handle missing orderId', async () => {
      req.params.orderId = undefined;

      await oxxoPaymentController.getOxxoReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'El ID de la orden es requerido'
      });
    });

    it('should handle non-OXXO payments', async () => {
      stripePaymentService.checkPaymentStatus.mockResolvedValue({
        ...mockPaymentStatus,
        paymentMethod: 'card'
      });

      await oxxoPaymentController.getOxxoReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'La orden no corresponde a un pago OXXO'
      });
    });

    it('should handle Stripe service errors', async () => {
      stripePaymentService.checkPaymentStatus.mockRejectedValue(new Error('Stripe error'));

      await oxxoPaymentController.getOxxoReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error al obtener la ficha de pago OXXO. Por favor intente de nuevo más tarde.'
      });
    });

    it('should format amount correctly', async () => {
      const testCases = [
        { amount: 50000, expected: 50000 },
        { amount: 19700, expected: 19700 },
        { amount: 123456, expected: 123456 }
      ];

      for (const testCase of testCases) {
        const mockPaymentStatusWithDetails = {
          ...mockPaymentStatus,
          amount: testCase.amount,
          paymentDetails: {
            reference: '123456789012',
            barcodeUrl: 'https://stripe.com/oxxo/voucher/123',
            expiresAt: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
          }
        };
        
        stripePaymentService.checkPaymentStatus.mockResolvedValue(mockPaymentStatusWithDetails);

        await oxxoPaymentController.getOxxoReceipt(req, res);

        expect(res.render).toHaveBeenCalledWith('oxxo-receipt',
          expect.objectContaining({
            oxxo: expect.objectContaining({
              amount: testCase.expected
            })
          })
        );
      }
    });

    it('should handle payment not found', async () => {
      stripePaymentService.checkPaymentStatus.mockRejectedValue(new Error('Payment not found'));

      await oxxoPaymentController.getOxxoReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error al obtener la ficha de pago OXXO. Por favor intente de nuevo más tarde.'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Force an unexpected error by removing required fields  
      req.body = {};

      await oxxoPaymentController.createOxxoPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'El ID del cliente es requerido'
      });
    });

    it('should log errors with proper context', async () => {
      stripePaymentService.processOxxoPayment.mockRejectedValue(new Error('Test error'));

      await oxxoPaymentController.createOxxoPayment(req, res);

      expect(logger.error).toHaveBeenCalledWith(
        'Error in createOxxoPayment controller:',
        expect.objectContaining({
          error: 'Test error',
          context: expect.objectContaining({
            customerId: 'cus_123',
            referenceId: 'APP-123',
            amount: 197.00
          })
        })
      );
    });
  });
});