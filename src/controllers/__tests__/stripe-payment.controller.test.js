/**
 * Stripe Payment Controller Tests
 * Comprehensive test coverage for critical payment flows
 */

// Mock dependencies using Jest
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../constants', () => ({
  ApplicationStatus: {
    AWAITING_PAYMENT: 'awaiting_payment',
    PAYMENT_PROCESSING: 'payment_processing',
    PAYMENT_RECEIVED: 'payment_received',
    PAYMENT_FAILED: 'payment_failed',
    AWAITING_OXXO_PAYMENT: 'awaiting_oxxo_payment'
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
  badRequest: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 400, body: { success: false, message } };
    return res;
  }),
  forbidden: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 403, body: { success: false, message } };
    return res;
  }),
  notFound: jest.fn().mockImplementation((res, message) => {
    res.locals = { statusCode: 404, body: { success: false, message } };
    return res;
  })
}));

jest.mock('../../utils/error-helpers', () => ({
  handleControllerError: jest.fn().mockImplementation((error, method, req, res, next) => {
    next(error);
  })
}));

jest.mock('../../repositories', () => ({
  applicationRepository: {
    findById: jest.fn(),
    updateStatus: jest.fn(),
    update: jest.fn()
  },
  paymentRepository: {
    updatePaymentOrder: jest.fn(),
    getPaymentByApplicationId: jest.fn(),
    createPaymentEvent: jest.fn(),
    findWebhookEvent: jest.fn(),
    createWebhookEvent: jest.fn(),
    updateWebhookEventStatus: jest.fn(),
    findByOrderId: jest.fn()
  },
  userRepository: {
    findById: jest.fn()
  }
}));

jest.mock('../../services/stripe-payment.service', () => ({
  createCustomer: jest.fn(),
  createChargeWithToken: jest.fn(),
  processOxxoPayment: jest.fn(),
  retrievePaymentIntent: jest.fn(),
  constructWebhookEvent: jest.fn(),
  createPaymentIntentForCard: jest.fn(),
  confirmPaymentIntent: jest.fn(),
  capturePaymentIntent: jest.fn()
}));

jest.mock('../../services/webhook-retry.service', () => ({
  scheduleRetry: jest.fn()
}));

jest.mock('../../services/payment-recovery.service', () => ({
  attemptPaymentRecovery: jest.fn()
}));

jest.mock('../../services/alert.service', () => ({
  sendAlert: jest.fn()
}));

jest.mock('../../monitoring/metrics-collector', () => ({
  recordPaymentAttempt: jest.fn()
}));

jest.mock('../../utils/db-transaction', () => ({
  withTransaction: jest.fn().mockImplementation(async (callback) => {
    const mockClient = {};
    return await callback(mockClient);
  })
}));

// Import after mocking
const { ApplicationStatus } = require('../../constants');
const ApiResponse = require('../../utils/api-response');
const { handleControllerError } = require('../../utils/error-helpers');
const { applicationRepository, paymentRepository, userRepository } = require('../../repositories');
const stripePaymentService = require('../../services/stripe-payment.service');
const webhookRetryService = require('../../services/webhook-retry.service');
const paymentRecoveryService = require('../../services/payment-recovery.service');
const alertService = require('../../services/alert.service');
const metricsCollector = require('../../monitoring/metrics-collector');
const stripePaymentController = require('../stripe-payment.controller');

describe('Stripe Payment Controller', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      body: {},
      user: { id: 1 },
      headers: {
        'stripe-signature': 'test-signature',
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
  });

  describe('createPaymentOrder', () => {
    const mockApplication = {
      id: 1,
      user_id: 1,
      status: ApplicationStatus.AWAITING_PAYMENT,
      marca: 'Toyota',
      linea: 'Camry',
      ano_modelo: '2023',
      importe: 150
    };

    const mockUser = {
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone: '1234567890'
    };

    const mockCustomer = {
      id: 'cus_test123',
      email: 'john@example.com'
    };

    beforeEach(() => {
      req.params.applicationId = '1';
      applicationRepository.findById.mockResolvedValue(mockApplication);
      userRepository.findById.mockResolvedValue(mockUser);
      stripePaymentService.createCustomer.mockResolvedValue(mockCustomer);
      applicationRepository.updateStatus.mockResolvedValue({});
    });

    it('should create payment order successfully', async () => {
      await stripePaymentController.createPaymentOrder(req, res);

      expect(applicationRepository.findById).toHaveBeenCalledWith('1');
      expect(userRepository.findById).toHaveBeenCalledWith(1);
      expect(stripePaymentService.createCustomer).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890'
      });
      expect(applicationRepository.updateStatus).toHaveBeenCalledWith('1', ApplicationStatus.PAYMENT_PROCESSING);
      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        applicationId: 1,
        customerId: 'cus_test123',
        amount: 150,
        currency: 'MXN'
      }));
    });

    it('should return 404 if application not found', async () => {
      applicationRepository.findById.mockResolvedValue(null);

      await stripePaymentController.createPaymentOrder(req, res);

      expect(ApiResponse.notFound).toHaveBeenCalledWith(res, 'Solicitud no encontrada.');
    });

    it('should return 403 if user does not own application', async () => {
      const otherUserApplication = { ...mockApplication, user_id: 2 };
      applicationRepository.findById.mockResolvedValue(otherUserApplication);

      await stripePaymentController.createPaymentOrder(req, res);

      expect(ApiResponse.forbidden).toHaveBeenCalledWith(res, 'No tienes permiso para acceder a esta solicitud.');
    });

    it('should return 400 if application status is invalid for payment', async () => {
      const invalidStatusApplication = { ...mockApplication, status: ApplicationStatus.PAYMENT_RECEIVED };
      applicationRepository.findById.mockResolvedValue(invalidStatusApplication);

      await stripePaymentController.createPaymentOrder(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, expect.objectContaining({
        message: 'La solicitud no está en un estado válido para el pago.',
        currentStatus: ApplicationStatus.PAYMENT_RECEIVED
      }));
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      applicationRepository.findById.mockRejectedValue(error);

      await stripePaymentController.createPaymentOrder(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al crear la orden de pago');
    });
  });

  describe('processCardPayment', () => {
    const mockApplication = {
      id: 1,
      user_id: 1,
      marca: 'Toyota',
      linea: 'Camry',
      ano_modelo: '2023',
      importe: 150
    };

    const mockPaymentResult = {
      success: true,
      paymentIntentId: 'pi_test123',
      orderId: 'pi_test123',
      status: 'succeeded',
      paymentMethod: 'card',
      clientSecret: 'pi_test123_secret_test'
    };

    beforeEach(() => {
      req.params.applicationId = '1';
      req.body = {
        customerId: 'cus_test123',
        paymentMethodId: 'pm_test123',
        device_session_id: 'dev_test123'
      };
      applicationRepository.findById.mockResolvedValue(mockApplication);
      stripePaymentService.createChargeWithToken.mockResolvedValue(mockPaymentResult);
      paymentRepository.updatePaymentOrder.mockResolvedValue({});
    });

    it('should process card payment successfully', async () => {
      await stripePaymentController.processCardPayment(req, res);

      expect(stripePaymentService.createChargeWithToken).toHaveBeenCalledWith(expect.objectContaining({
        customerId: 'cus_test123',
        amount: 150,
        currency: 'MXN',
        paymentMethodId: 'pm_test123',
        applicationId: 1
      }));
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith(
        1,
        'pi_test123',
        'succeeded'
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        success: true,
        paymentIntentId: 'pi_test123'
      }));
    });

    it('should handle payment failure', async () => {
      const failedPaymentResult = {
        success: false,
        failureMessage: 'Card declined'
      };
      stripePaymentService.createChargeWithToken.mockResolvedValue(failedPaymentResult);

      await stripePaymentController.processCardPayment(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, {
        success: false,
        message: 'Card declined'
      });
    });

    it('should return 404 if application not found', async () => {
      applicationRepository.findById.mockResolvedValue(null);

      await stripePaymentController.processCardPayment(req, res);

      expect(ApiResponse.notFound).toHaveBeenCalledWith(res, 'Solicitud no encontrada.');
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Stripe error');
      stripePaymentService.createChargeWithToken.mockRejectedValue(error);

      await stripePaymentController.processCardPayment(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al procesar el pago con tarjeta');
    });
  });

  describe('processOxxoPayment', () => {
    const mockApplication = {
      id: 1,
      user_id: 1,
      marca: 'Toyota',
      linea: 'Camry',
      ano_modelo: '2023',
      importe: 150
    };

    const mockOxxoResult = {
      success: true,
      paymentIntentId: 'pi_oxxo_test123',
      orderId: 'pi_oxxo_test123',
      status: 'requires_action',
      paymentMethod: 'oxxo',
      clientSecret: 'pi_oxxo_test123_secret',
      oxxoReference: '12345678901234',
      hostedVoucherUrl: 'https://stripe.com/oxxo/voucher',
      amount: 150,
      expiresAt: '2024-01-01T00:00:00.000Z'
    };

    beforeEach(() => {
      req.params.applicationId = '1';
      req.body = {
        customerId: 'cus_test123',
        device_session_id: 'dev_test123'
      };
      applicationRepository.findById.mockResolvedValue(mockApplication);
      stripePaymentService.processOxxoPayment.mockResolvedValue(mockOxxoResult);
      paymentRepository.updatePaymentOrder.mockResolvedValue({});
      paymentRepository.createPaymentEvent.mockResolvedValue({});
    });

    it('should process OXXO payment successfully', async () => {
      await stripePaymentController.processOxxoPayment(req, res);

      expect(stripePaymentService.processOxxoPayment).toHaveBeenCalledWith(expect.objectContaining({
        customerId: 'cus_test123',
        amount: 150,
        currency: 'MXN',
        applicationId: 1
      }));
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith(
        1,
        'pi_oxxo_test123',
        ApplicationStatus.AWAITING_OXXO_PAYMENT,
        null,
        expect.any(Object)
      );
      expect(paymentRepository.createPaymentEvent).toHaveBeenCalledWith(
        1,
        'oxxo.payment.created',
        expect.objectContaining({
          oxxoReference: '12345678901234',
          hostedVoucherUrl: 'https://stripe.com/oxxo/voucher'
        }),
        'pi_oxxo_test123',
        expect.any(Object)
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        success: true,
        oxxoReference: '12345678901234'
      }));
    });

    it('should return 404 if application not found', async () => {
      applicationRepository.findById.mockResolvedValue(null);

      await stripePaymentController.processOxxoPayment(req, res);

      expect(ApiResponse.notFound).toHaveBeenCalledWith(res, 'Solicitud no encontrada.');
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('OXXO processing error');
      stripePaymentService.processOxxoPayment.mockRejectedValue(error);

      await stripePaymentController.processOxxoPayment(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al procesar el pago OXXO');
    });
  });

  describe('checkPaymentStatus', () => {
    const mockApplication = {
      id: 1,
      user_id: 1,
      status: ApplicationStatus.PAYMENT_PROCESSING,
      importe: 150,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T01:00:00.000Z'
    };

    const mockPaymentInfo = {
      status: 'processing',
      payment_method: 'card',
      order_id: 'pi_test123'
    };

    const mockStripePaymentDetails = {
      status: 'processing',
      last_payment_error: null
    };

    beforeEach(() => {
      req.params = { applicationId: '1', paymentIntentId: 'pi_test123' };
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(mockPaymentInfo);
      stripePaymentService.retrievePaymentIntent.mockResolvedValue(mockStripePaymentDetails);
    });

    it('should check payment status successfully', async () => {
      await stripePaymentController.checkPaymentStatus(req, res);

      expect(applicationRepository.findById).toHaveBeenCalledWith('1');
      expect(paymentRepository.getPaymentByApplicationId).toHaveBeenCalledWith('1');
      expect(stripePaymentService.retrievePaymentIntent).toHaveBeenCalledWith('pi_test123');
      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        applicationId: 1,
        status: ApplicationStatus.PAYMENT_PROCESSING,
        paymentStatus: 'processing',
        paymentMethod: 'card',
        amount: 150,
        stripeStatus: 'processing'
      }));
    });

    it('should handle missing payment intent gracefully', async () => {
      stripePaymentService.retrievePaymentIntent.mockRejectedValue(new Error('Payment intent not found'));

      await stripePaymentController.checkPaymentStatus(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        stripeStatus: null,
        lastError: null
      }));
    });

    it('should return 404 if application not found', async () => {
      applicationRepository.findById.mockResolvedValue(null);

      await stripePaymentController.checkPaymentStatus(req, res);

      expect(ApiResponse.notFound).toHaveBeenCalledWith(res, 'Solicitud no encontrada.');
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      applicationRepository.findById.mockRejectedValue(error);

      await stripePaymentController.checkPaymentStatus(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al verificar el estado del pago');
    });
  });

  describe('handleWebhook', () => {
    const mockWebhookEvent = {
      id: 'evt_test123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test123',
          metadata: { application_id: '1' },
          amount: 15000,
          currency: 'mxn',
          payment_method: { type: 'card' }
        }
      }
    };

    beforeEach(() => {
      req.body = Buffer.from(JSON.stringify(mockWebhookEvent));
      stripePaymentService.constructWebhookEvent.mockReturnValue(mockWebhookEvent);
      paymentRepository.findWebhookEvent.mockResolvedValue(null);
      paymentRepository.createWebhookEvent.mockResolvedValue({});
      paymentRepository.updateWebhookEventStatus.mockResolvedValue({});
    });

    it('should handle webhook successfully', async () => {
      await stripePaymentController.handleWebhook(req, res);

      expect(stripePaymentService.constructWebhookEvent).toHaveBeenCalledWith(
        req.body,
        'test-signature'
      );
      expect(paymentRepository.findWebhookEvent).toHaveBeenCalledWith('evt_test123');
      expect(paymentRepository.createWebhookEvent).toHaveBeenCalledWith(
        'evt_test123',
        'payment_intent.succeeded',
        mockWebhookEvent
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(res, { received: true });
    });

    it('should handle duplicate webhook events', async () => {
      const existingEvent = {
        id: 'evt_test123',
        processed_at: '2024-01-01T00:00:00.000Z'
      };
      paymentRepository.findWebhookEvent.mockResolvedValue(existingEvent);

      await stripePaymentController.handleWebhook(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(res, {
        received: true,
        processed: false,
        reason: 'already_processed'
      });
    });

    it('should handle webhook signature verification errors', async () => {
      const error = new Error('Invalid signature');
      stripePaymentService.constructWebhookEvent.mockImplementation(() => {
        throw error;
      });

      await stripePaymentController.handleWebhook(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'Webhook Error: Invalid signature');
    });
  });

  describe('createPaymentIntent', () => {
    const mockApplication = {
      id: 1,
      user_id: 1,
      importe: 150,
      marca: 'Toyota',
      linea: 'Camry'
    };

    const mockUser = {
      id: 1,
      email: 'john@example.com'
    };

    const mockPaymentIntent = {
      id: 'pi_test123',
      client_secret: 'pi_test123_secret_test',
      status: 'requires_payment_method',
      amount: 15000
    };

    beforeEach(() => {
      req.params.applicationId = '1';
      req.body.customerId = 'cus_test123';
      applicationRepository.findById.mockResolvedValue(mockApplication);
      userRepository.findById.mockResolvedValue(mockUser);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(null);
      stripePaymentService.createPaymentIntentForCard.mockResolvedValue(mockPaymentIntent);
      paymentRepository.updatePaymentOrder.mockResolvedValue({});
    });

    it('should create payment intent successfully', async () => {
      await stripePaymentController.createPaymentIntent(req, res);

      expect(stripePaymentService.createPaymentIntentForCard).toHaveBeenCalledWith(expect.objectContaining({
        customerId: 'cus_test123',
        amount: 150,
        description: 'Permiso de Circulación para Toyota Camry',
        applicationId: 1,
        userId: 1,
        email: 'john@example.com'
      }));
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith(
        1,
        'pi_test123',
        ApplicationStatus.PAYMENT_PROCESSING
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        success: true,
        clientSecret: 'pi_test123_secret_test',
        paymentIntentId: 'pi_test123'
      }));
    });

    it('should return existing payment intent if valid', async () => {
      const existingPayment = {
        order_id: 'pi_existing123',
        status: ApplicationStatus.PAYMENT_PROCESSING
      };
      const existingIntent = {
        id: 'pi_existing123',
        client_secret: 'pi_existing123_secret',
        status: 'requires_payment_method',
        amount: 15000
      };
      
      paymentRepository.getPaymentByApplicationId.mockResolvedValue(existingPayment);
      stripePaymentService.retrievePaymentIntent.mockResolvedValue(existingIntent);

      await stripePaymentController.createPaymentIntent(req, res);

      expect(stripePaymentService.createPaymentIntentForCard).not.toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        paymentIntentId: 'pi_existing123',
        clientSecret: 'pi_existing123_secret'
      }));
    });

    it('should handle missing applicationId or customerId', async () => {
      req.body.customerId = null;

      await stripePaymentController.createPaymentIntent(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'ID de aplicación y ID de cliente son requeridos.');
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Stripe error');
      stripePaymentService.createPaymentIntentForCard.mockRejectedValue(error);

      await stripePaymentController.createPaymentIntent(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error interno al crear la intención de pago.');
    });
  });

  describe('confirmPayment', () => {
    const mockApplication = {
      id: 1,
      user_id: 1
    };

    const mockPaymentIntent = {
      status: 'succeeded'
    };

    beforeEach(() => {
      req.params.applicationId = '1';
      req.body = {
        paymentIntentId: 'pi_test123',
        paymentMethod: 'card'
      };
      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentRepository.getPaymentByApplicationId.mockResolvedValue({ status: ApplicationStatus.PAYMENT_PROCESSING });
      stripePaymentService.retrievePaymentIntent.mockResolvedValue(mockPaymentIntent);
      paymentRepository.updatePaymentOrder.mockResolvedValue({});
      applicationRepository.update.mockResolvedValue({});
    });

    it('should confirm payment successfully', async () => {
      await stripePaymentController.confirmPayment(req, res);

      expect(stripePaymentService.retrievePaymentIntent).toHaveBeenCalledWith('pi_test123');
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith(
        1,
        'pi_test123',
        ApplicationStatus.PAYMENT_RECEIVED
      );
      expect(applicationRepository.update).toHaveBeenCalledWith(
        1,
        { status: ApplicationStatus.PAYMENT_RECEIVED }
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        success: true,
        paymentIntentId: 'pi_test123',
        status: ApplicationStatus.PAYMENT_RECEIVED
      }));
    });

    it('should handle already processed payments', async () => {
      paymentRepository.getPaymentByApplicationId.mockResolvedValue({
        status: ApplicationStatus.PAYMENT_RECEIVED
      });

      await stripePaymentController.confirmPayment(req, res);

      expect(ApiResponse.success).toHaveBeenCalledWith(res, expect.objectContaining({
        success: true,
        alreadyProcessed: true,
        message: 'Pago ya fue confirmado previamente.'
      }));
    });

    it('should handle payment not succeeded', async () => {
      const failedPaymentIntent = { status: 'requires_payment_method' };
      stripePaymentService.retrievePaymentIntent.mockResolvedValue(failedPaymentIntent);

      await stripePaymentController.confirmPayment(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'El pago no ha sido completado exitosamente.');
    });

    it('should handle missing required fields', async () => {
      req.body.paymentIntentId = null;

      await stripePaymentController.confirmPayment(req, res);

      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, 'ID de aplicación, ID de intención de pago y método de pago son requeridos.');
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      applicationRepository.findById.mockRejectedValue(error);

      await stripePaymentController.confirmPayment(req, res);

      expect(ApiResponse.error).toHaveBeenCalledWith(res, 'Error al confirmar el pago.');
    });
  });
});