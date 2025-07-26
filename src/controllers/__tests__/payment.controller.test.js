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
    findById: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn()
  },
  paymentRepository: {
    create: jest.fn(),
    updatePaymentOrder: jest.fn(),
    getPaymentByApplicationId: jest.fn(),
    findByApplicationId: jest.fn()
  },
  userRepository: {
    findById: jest.fn()
  }
}));

jest.mock('../../services/stripe-payment.service', () => ({
  stripePaymentService: {
    createStripeCustomer: jest.fn(),
    createPaymentIntent: jest.fn(),
    processCardPayment: jest.fn(),
    processOxxoPayment: jest.fn(),
    getPaymentIntent: jest.fn(),
    confirmPayment: jest.fn()
  }
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
  notFound: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 404, body: { success: false, message } };
    return res;
  }),
  forbidden: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 403, body: { success: false, message } };
    return res;
  }),
  badRequest: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 400, body: { success: false, message } };
    return res;
  })
}));

const {
  createPaymentOrder,
  processCardPayment,
  processOxxoPayment,
  checkPaymentStatus
} = require('../payment.controller');
const { applicationRepository, paymentRepository, userRepository } = require('../../repositories');
const { stripePaymentService } = require('../../services/stripe-payment.service');
const ApiResponse = require('../../utils/api-response');
const { logger } = require('../../utils/logger');

describe('PaymentController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      user: { id: 1 },
      headers: {
        'x-forwarded-for': '192.168.1.1'
      },
      connection: { remoteAddress: '192.168.1.1' }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {}
    };

    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('createPaymentOrder', () => {
    const mockApplication = {
      id: 'app123',
      userId: 1,
      status: 'AWAITING_PAYMENT',
      applicationData: {
        personalInfo: {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        }
      }
    };

    const mockUser = {
      id: 1,
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe'
    };

    const mockStripeCustomer = {
      id: 'cus_123',
      email: 'test@example.com'
    };

    const mockPaymentOrder = {
      id: 'pay_123',
      applicationId: 'app123',
      amount: 1000,
      currency: 'MXN',
      status: 'pending'
    };

    beforeEach(() => {
      req.params = { applicationId: 'app123' };
    });

    it('should create payment order successfully', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      userRepository.findById.mockResolvedValue(mockUser);
      stripePaymentService.createStripeCustomer.mockResolvedValue(mockStripeCustomer);
      paymentRepository.create.mockResolvedValue(mockPaymentOrder);

      await createPaymentOrder(req, res);

      expect(applicationRepository.findById).toHaveBeenCalledWith('app123');
      expect(userRepository.findById).toHaveBeenCalledWith(1);
      expect(stripePaymentService.createStripeCustomer).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'John Doe'
      });
      expect(paymentRepository.create).toHaveBeenCalledWith({
        applicationId: 'app123',
        userId: 1,
        stripeCustomerId: 'cus_123',
        amount: expect.any(Number),
        currency: 'MXN',
        status: 'pending'
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        paymentOrder: mockPaymentOrder,
        customer: mockStripeCustomer
      }, 200, 'Orden de pago creada exitosamente');
    });

    it('should handle missing applicationId', async () => {
      req.params = {};

      await createPaymentOrder(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'ID de aplicación requerido');
      expect(applicationRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle non-existent application', async () => {
      applicationRepository.findById.mockResolvedValue(null);

      await createPaymentOrder(req, res);

      expect(ApiResponse.notFound).toHaveBeenCalledWith(res, 'Aplicación no encontrada');
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle unauthorized access', async () => {
      req.user.id = 999;
      applicationRepository.findById.mockResolvedValue(mockApplication);

      await createPaymentOrder(req, res);

      expect(ApiResponse.forbidden).toHaveBeenCalledWith(res, 'No tienes permiso para acceder a esta aplicación');
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle invalid application status', async () => {
      applicationRepository.findById.mockResolvedValue({
        ...mockApplication,
        status: 'PAID'
      });

      await createPaymentOrder(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'La aplicación no está en estado válido para crear orden de pago');
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle user not found', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      userRepository.findById.mockResolvedValue(null);

      await createPaymentOrder(req, res);

      expect(ApiResponse.notFound).toHaveBeenCalledWith(res, 'Usuario no encontrado');
      expect(stripePaymentService.createStripeCustomer).not.toHaveBeenCalled();
    });

    it('should handle Stripe customer creation failure', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      userRepository.findById.mockResolvedValue(mockUser);
      stripePaymentService.createStripeCustomer.mockRejectedValue(new Error('Stripe error'));

      await createPaymentOrder(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al crear cliente en Stripe', 500);
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it('should handle existing payment order', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentOrder);

      await createPaymentOrder(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        paymentOrder: mockPaymentOrder,
        message: 'Ya existe una orden de pago para esta aplicación'
      });
      expect(stripePaymentService.createStripeCustomer).not.toHaveBeenCalled();
    });
  });

  describe('processCardPayment', () => {
    const mockApplication = {
      id: 'app123',
      userId: 1,
      status: 'AWAITING_PAYMENT'
    };

    const mockPaymentOrder = {
      id: 'pay_123',
      applicationId: 'app123',
      stripeCustomerId: 'cus_123',
      amount: 1000,
      status: 'pending'
    };

    const mockPaymentResult = {
      success: true,
      paymentIntent: {
        id: 'pi_123',
        status: 'succeeded',
        amount: 100000
      },
      charge: {
        id: 'ch_123',
        receipt_url: 'https://stripe.com/receipt/123'
      }
    };

    beforeEach(() => {
      req.params = { applicationId: 'app123' };
      req.body = {
        paymentMethodId: 'pm_123',
        paymentIntentId: 'pi_123'
      };
    });

    it('should process card payment successfully', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentOrder);
      stripePaymentService.processCardPayment.mockResolvedValue(mockPaymentResult);
      paymentRepository.updatePaymentOrder.mockResolvedValue({ success: true });
      applicationRepository.updateStatus.mockResolvedValue({ success: true });

      await processCardPayment(req, res);

      expect(stripePaymentService.processCardPayment).toHaveBeenCalledWith({
        customerId: 'cus_123',
        paymentMethodId: 'pm_123',
        paymentIntentId: 'pi_123',
        amount: 1000
      });
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith('pay_123', {
        paymentIntentId: 'pi_123',
        status: 'completed',
        completedAt: expect.any(Date),
        receiptUrl: 'https://stripe.com/receipt/123'
      });
      expect(applicationRepository.updateStatus).toHaveBeenCalledWith('app123', 'PAID');
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        success: true,
        paymentIntent: mockPaymentResult.paymentIntent,
        receiptUrl: 'https://stripe.com/receipt/123'
      }, 200, 'Pago procesado exitosamente');
    });

    it('should handle missing payment method', async () => {
      req.body = { paymentIntentId: 'pi_123' };

      await processCardPayment(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'Método de pago requerido');
      expect(applicationRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle non-existent application', async () => {
      applicationRepository.findById.mockResolvedValue(null);

      await processCardPayment(req, res);

      expect(ApiResponse.notFound).toHaveBeenCalledWith(res, 'Aplicación no encontrada');
      expect(paymentRepository.getPaymentByApplicationId).not.toHaveBeenCalled();
    });

    it('should handle unauthorized access', async () => {
      req.user.id = 999;
      applicationRepository.findById.mockResolvedValue(mockApplication);

      await processCardPayment(req, res);

      expect(ApiResponse.forbidden).toHaveBeenCalledWith(res, 'No tienes permiso para procesar pagos en esta aplicación');
      expect(paymentRepository.getPaymentByApplicationId).not.toHaveBeenCalled();
    });

    it('should handle payment processing failure', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentOrder);
      stripePaymentService.processCardPayment.mockResolvedValue({
        success: false,
        error: 'Card declined'
      });

      await processCardPayment(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al procesar el pago: Card declined', 400);
      expect(paymentRepository.updatePaymentOrder).not.toHaveBeenCalled();
    });

    it('should handle payment intent requiring authentication', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentOrder);
      stripePaymentService.processCardPayment.mockResolvedValue({
        success: false,
        requiresAction: true,
        paymentIntent: {
          id: 'pi_123',
          status: 'requires_action',
          client_secret: 'pi_123_secret'
        }
      });

      await processCardPayment(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        requiresAction: true,
        paymentIntent: expect.objectContaining({
          status: 'requires_action'
        })
      }, 200, 'Autenticación adicional requerida');
    });
  });

  describe('processOxxoPayment', () => {
    const mockApplication = {
      id: 'app123',
      userId: 1,
      status: 'AWAITING_PAYMENT',
      applicationData: {
        personalInfo: {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        }
      }
    };

    const mockPaymentOrder = {
      id: 'pay_123',
      applicationId: 'app123',
      amount: 1000,
      status: 'pending'
    };

    const mockOxxoResult = {
      success: true,
      paymentIntent: {
        id: 'pi_123',
        status: 'requires_action',
        next_action: {
          type: 'oxxo_display_details',
          oxxo_display_details: {
            number: '123456789012',
            expires_after: 1234567890,
            hosted_voucher_url: 'https://stripe.com/oxxo/voucher/123'
          }
        }
      }
    };

    beforeEach(() => {
      req.params = { applicationId: 'app123' };
      req.body = {
        email: 'test@example.com',
        name: 'John Doe'
      };
    });

    it('should process OXXO payment successfully', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentOrder);
      stripePaymentService.processOxxoPayment.mockResolvedValue(mockOxxoResult);
      paymentRepository.updatePaymentOrder.mockResolvedValue({ success: true });
      applicationRepository.updateStatus.mockResolvedValue({ success: true });
      applicationRepository.update.mockResolvedValue({ success: true });

      await processOxxoPayment(req, res);

      expect(stripePaymentService.processOxxoPayment).toHaveBeenCalledWith({
        customerId: 'app123',
        amount: 1000,
        orderId: 'pay_123',
        email: 'test@example.com',
        name: 'John Doe'
      });
      expect(applicationRepository.updateStatus).toHaveBeenCalledWith('app123', 'AWAITING_OXXO_PAYMENT');
      expect(applicationRepository.update).toHaveBeenCalledWith('app123', {
        oxxoReference: '123456789012'
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        success: true,
        oxxoReference: '123456789012',
        expirationDate: expect.any(Date),
        voucherUrl: 'https://stripe.com/oxxo/voucher/123',
        amount: 1000
      }, 200, 'Referencia OXXO generada exitosamente');
    });

    it('should handle missing required fields', async () => {
      req.body = { email: 'test@example.com' };

      await processOxxoPayment(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'Email y nombre son requeridos');
      expect(applicationRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle OXXO processing failure', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentOrder);
      stripePaymentService.processOxxoPayment.mockResolvedValue({
        success: false,
        error: 'OXXO service unavailable'
      });

      await processOxxoPayment(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al procesar pago OXXO: OXXO service unavailable', 500);
      expect(applicationRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should handle missing OXXO details', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentOrder);
      stripePaymentService.processOxxoPayment.mockResolvedValue({
        success: true,
        paymentIntent: {
          id: 'pi_123',
          status: 'requires_action',
          next_action: null
        }
      });

      await processOxxoPayment(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'No se pudieron obtener los detalles de OXXO', 500);
    });
  });

  describe('checkPaymentStatus', () => {
    const mockApplication = {
      id: 'app123',
      userId: 1,
      status: 'AWAITING_PAYMENT'
    };

    const mockPaymentOrder = {
      id: 'pay_123',
      applicationId: 'app123',
      paymentIntentId: 'pi_123',
      status: 'pending'
    };

    const mockPaymentIntent = {
      id: 'pi_123',
      status: 'succeeded',
      amount: 100000,
      currency: 'mxn',
      charges: {
        data: [{
          id: 'ch_123',
          receipt_url: 'https://stripe.com/receipt/123'
        }]
      }
    };

    beforeEach(() => {
      req.params = { applicationId: 'app123' };
    });

    it('should check payment status successfully', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentOrder);
      stripePaymentService.getPaymentIntent.mockResolvedValue(mockPaymentIntent);

      await checkPaymentStatus(req, res);

      expect(stripePaymentService.getPaymentIntent).toHaveBeenCalledWith('pi_123');
      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        status: 'succeeded',
        amount: 1000,
        currency: 'MXN',
        receiptUrl: 'https://stripe.com/receipt/123',
        paymentOrder: mockPaymentOrder
      });
    });

    it('should handle non-existent application', async () => {
      applicationRepository.findById.mockResolvedValue(null);

      await checkPaymentStatus(req, res);

      expect(ApiResponse.notFound).toHaveBeenCalledWith(res, 'Aplicación no encontrada');
      expect(paymentRepository.getPaymentByApplicationId).not.toHaveBeenCalled();
    });

    it('should handle unauthorized access', async () => {
      req.user.id = 999;
      applicationRepository.findById.mockResolvedValue(mockApplication);

      await checkPaymentStatus(req, res);

      expect(ApiResponse.forbidden).toHaveBeenCalledWith(res, 'No tienes permiso para verificar el estado de pago de esta aplicación');
      expect(paymentRepository.getPaymentByApplicationId).not.toHaveBeenCalled();
    });

    it('should handle missing payment order', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(null);

      await checkPaymentStatus(req, res);

      expect(ApiResponse.notFound).toHaveBeenCalledWith(res, 'No se encontró orden de pago para esta aplicación');
      expect(stripePaymentService.getPaymentIntent).not.toHaveBeenCalled();
    });

    it('should handle missing payment intent ID', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue({
        ...mockPaymentOrder,
        paymentIntentId: null
      });

      await checkPaymentStatus(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'No se ha iniciado el proceso de pago para esta aplicación');
      expect(stripePaymentService.getPaymentIntent).not.toHaveBeenCalled();
    });

    it('should update application status when payment is completed', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentOrder);
      stripePaymentService.getPaymentIntent.mockResolvedValue(mockPaymentIntent);
      applicationRepository.updateStatus.mockResolvedValue({ success: true });
      paymentRepository.updatePaymentOrder.mockResolvedValue({ success: true });

      await checkPaymentStatus(req, res);

      expect(applicationRepository.updateStatus).toHaveBeenCalledWith('app123', 'PAID');
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith('pay_123', {
        status: 'completed',
        completedAt: expect.any(Date),
        receiptUrl: 'https://stripe.com/receipt/123'
      });
    });

    it('should handle different payment statuses', async () => {
      const testCases = [
        { status: 'requires_payment_method', expected: 'requires_payment_method' },
        { status: 'requires_confirmation', expected: 'requires_confirmation' },
        { status: 'requires_action', expected: 'requires_action' },
        { status: 'processing', expected: 'processing' },
        { status: 'canceled', expected: 'canceled' }
      ];

      for (const testCase of testCases) {
        applicationRepository.findById.mockResolvedValue(mockApplication);
        paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentOrder);
        stripePaymentService.getPaymentIntent.mockResolvedValue({
          ...mockPaymentIntent,
          status: testCase.status
        });

        await checkPaymentStatus(req, res);

        expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
          status: testCase.expected
        }));
      }
    });

    it('should handle Stripe service errors', async () => {
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentOrder);
      stripePaymentService.getPaymentIntent.mockRejectedValue(new Error('Stripe error'));

      await checkPaymentStatus(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al verificar el estado del pago', 500);
      expect(logger.error).toHaveBeenCalledWith('Error checking payment status', expect.any(Object));
    });
  });
});