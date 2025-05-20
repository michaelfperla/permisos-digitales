/**
 * Unit Tests for Payment Controller
 */
const { ApplicationStatus } = require('../constants');

// Mock dependencies
jest.mock('../utils/enhanced-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../utils/error-helpers', () => ({
  handleControllerError: jest.fn(),
  createError: jest.fn()
}));

jest.mock('../utils/api-response', () => ({
  success: jest.fn(),
  error: jest.fn(),
  badRequest: jest.fn(),
  unauthorized: jest.fn(),
  forbidden: jest.fn(),
  notFound: jest.fn(),
  serverError: jest.fn()
}));

jest.mock('../services/payment.service', () => ({
  createCustomer: jest.fn(),
  processCardPayment: jest.fn(),
  processBankTransferPayment: jest.fn(),
  processOxxoPayment: jest.fn(),
  checkPaymentStatus: jest.fn()
}));

jest.mock('../repositories/payment.repository', () => ({
  updatePaymentOrder: jest.fn(),
  updatePaymentStatus: jest.fn(),
  findByOrderId: jest.fn(),
  logPaymentEvent: jest.fn(),
  isEventProcessed: jest.fn(),
  markEventAsProcessed: jest.fn(),
  tryRecordEvent: jest.fn()
}));

jest.mock('../repositories/application.repository', () => ({
  findById: jest.fn()
}));

jest.mock('../config', () => ({
  conektaWebhookSecret: 'test_webhook_secret'
}));

// Import dependencies after mocking
const { logger } = require('../utils/enhanced-logger');
const { handleControllerError } = require('../utils/error-helpers');
const ApiResponse = require('../utils/api-response');
const paymentService = require('../services/payment.service');
const paymentRepository = require('../repositories/payment.repository');
const applicationRepository = require('../repositories/application.repository');
const paymentController = require('./payment.controller');
const crypto = require('crypto');

describe('Payment Controller', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentOrder', () => {
    it('should create a payment order successfully', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        session: {
          userId: 456
        },
        userRepository: {
          findById: jest.fn().mockResolvedValue({
            id: 456,
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            phone: '1234567890'
          })
        }
      };

      const res = {};

      const mockApplication = {
        id: 123,
        user_id: 456,
        status: ApplicationStatus.PENDING_PAYMENT,
        importe: 197.00,
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: 2023
      };

      const mockCustomer = {
        id: 'cus_2qnvwvnvKzsKzsDER',
        name: 'Test User',
        email: 'test@example.com'
      };

      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentService.createCustomer.mockResolvedValue(mockCustomer);

      // Act
      await paymentController.createPaymentOrder(req, res);

      // Assert
      expect(applicationRepository.findById).toHaveBeenCalledWith('123');
      expect(req.userRepository.findById).toHaveBeenCalledWith(456);
      expect(paymentService.createCustomer).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890'
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(res, null, {
        applicationId: 123,
        customerId: mockCustomer.id,
        amount: 197.00,
        currency: 'MXN',
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123'
      });
    });

    it('should return 404 if application not found', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      applicationRepository.findById.mockResolvedValue(null);

      // Act
      await paymentController.createPaymentOrder(req, res);

      // Assert
      expect(applicationRepository.findById).toHaveBeenCalledWith('123');
      expect(ApiResponse.notFound).toHaveBeenCalledWith(res, null, { message: 'Application not found' });
      expect(paymentService.createCustomer).not.toHaveBeenCalled();
    });

    it('should return 403 if application does not belong to user', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      const mockApplication = {
        id: 123,
        user_id: 789, // Different user ID
        status: ApplicationStatus.PENDING_PAYMENT
      };

      applicationRepository.findById.mockResolvedValue(mockApplication);

      // Act
      await paymentController.createPaymentOrder(req, res);

      // Assert
      expect(ApiResponse.forbidden).toHaveBeenCalledWith(res, null, { message: 'You do not have permission to access this application' });
      expect(paymentService.createCustomer).not.toHaveBeenCalled();
    });

    it('should return 400 if application is not in a valid state for payment', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      const mockApplication = {
        id: 123,
        user_id: 456,
        status: ApplicationStatus.PAYMENT_RECEIVED // Already paid
      };

      applicationRepository.findById.mockResolvedValue(mockApplication);

      // Act
      await paymentController.createPaymentOrder(req, res);

      // Assert
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, null, {
        message: 'Application is not in a valid state for payment',
        currentStatus: ApplicationStatus.PAYMENT_RECEIVED
      });
      expect(paymentService.createCustomer).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      const mockError = new Error('Test error');
      applicationRepository.findById.mockRejectedValue(mockError);

      // Act
      await paymentController.createPaymentOrder(req, res);

      // Assert
      expect(handleControllerError).toHaveBeenCalledWith(mockError, req, res, 'Error creating payment order');
    });
  });

  describe('processCardPayment', () => {
    it('should process a card payment successfully', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        body: {
          customerId: 'cus_2qnvwvnvKzsKzsDER',
          token: 'tok_test_visa_4242'
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      const mockApplication = {
        id: 123,
        user_id: 456,
        status: ApplicationStatus.PENDING_PAYMENT,
        importe: 197.00,
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: 2023
      };

      const mockPaymentResult = {
        success: true,
        orderId: 'ord_2tYvtxUTgcPWzKDER',
        paymentStatus: ApplicationStatus.PAYMENT_PENDING,
        paymentId: 'chr_2tYvwKBp9IeGMKDER',
        paymentMethod: 'card',
        amount: 197.00,
        currency: 'MXN',
        status: 'pending_payment',
        checkoutUrl: 'http://test-app.com/checkout?order_id=ord_2tYvtxUTgcPWzKDER&method=card'
      };

      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentService.processCardPayment.mockResolvedValue(mockPaymentResult);
      paymentRepository.updatePaymentOrder.mockResolvedValue({ ...mockApplication, payment_processor_order_id: mockPaymentResult.orderId });

      // Act
      await paymentController.processCardPayment(req, res);

      // Assert
      expect(applicationRepository.findById).toHaveBeenCalledWith('123');
      expect(paymentService.processCardPayment).toHaveBeenCalledWith({
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        amount: 197.00,
        currency: 'MXN',
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123',
        card: {
          token: 'tok_test_visa_4242'
        }
      });
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith(
        123,
        mockPaymentResult.orderId,
        mockPaymentResult.paymentStatus
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(res, null, expect.objectContaining({
        orderId: mockPaymentResult.orderId,
        paymentMethod: mockPaymentResult.paymentMethod,
        status: mockPaymentResult.status,
        success: true
      }));
    });

    it('should return 400 if required fields are missing', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        body: {
          // Missing customerId and token
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      // Act
      await paymentController.processCardPayment(req, res);

      // Assert
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, null, { message: expect.stringContaining('Missing required fields') });
      expect(applicationRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        body: {
          customerId: 'cus_2qnvwvnvKzsKzsDER',
          token: 'tok_test_visa_4242'
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      const mockError = new Error('Test error');
      applicationRepository.findById.mockRejectedValue(mockError);

      // Act
      await paymentController.processCardPayment(req, res);

      // Assert
      expect(handleControllerError).toHaveBeenCalledWith(mockError, req, res, 'Error processing card payment');
    });
  });

  describe('processBankTransferPayment', () => {
    it('should process a bank transfer payment successfully', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        body: {
          customerId: 'cus_2qnvwvnvKzsKzsDER'
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      const mockApplication = {
        id: 123,
        user_id: 456,
        status: ApplicationStatus.PENDING_PAYMENT,
        importe: 197.00,
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: 2023
      };

      const mockPaymentResult = {
        success: true,
        orderId: 'ord_2tYvtxUTgcPWzKDER',
        paymentStatus: ApplicationStatus.PAYMENT_PENDING,
        paymentId: 'chr_2tYvwKBp9IeGMKDER',
        paymentMethod: 'spei',
        amount: 197.00,
        currency: 'MXN',
        status: 'pending_payment',
        speiReference: '646180111812345678',
        expiresAt: 1619395200,
        checkoutUrl: 'http://test-app.com/checkout?order_id=ord_2tYvtxUTgcPWzKDER&method=spei&reference=646180111812345678'
      };

      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentService.processBankTransferPayment.mockResolvedValue(mockPaymentResult);
      paymentRepository.updatePaymentOrder.mockResolvedValue({ ...mockApplication, payment_processor_order_id: mockPaymentResult.orderId });

      // Act
      await paymentController.processBankTransferPayment(req, res);

      // Assert
      expect(applicationRepository.findById).toHaveBeenCalledWith('123');
      expect(paymentService.processBankTransferPayment).toHaveBeenCalledWith({
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        amount: 197.00,
        currency: 'MXN',
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123'
      });
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith(
        123,
        mockPaymentResult.orderId,
        mockPaymentResult.paymentStatus
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(res, null, expect.objectContaining({
        orderId: mockPaymentResult.orderId,
        paymentMethod: mockPaymentResult.paymentMethod,
        status: mockPaymentResult.status,
        success: true
      }));
    });
  });

  describe('processOxxoPayment', () => {
    it('should process an OXXO payment successfully', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        body: {
          customerId: 'cus_2qnvwvnvKzsKzsDER'
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      const mockApplication = {
        id: 123,
        user_id: 456,
        status: ApplicationStatus.PENDING_PAYMENT,
        importe: 197.00,
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: 2023
      };

      const mockPaymentResult = {
        success: true,
        orderId: 'ord_2tYvtxUTgcPWzKDER',
        paymentStatus: ApplicationStatus.PAYMENT_PENDING,
        paymentId: 'chr_2tYvwKBp9IeGMKDER',
        paymentMethod: 'oxxo_cash',
        amount: 197.00,
        currency: 'MXN',
        status: 'pending_payment',
        oxxoReference: '93345678901234',
        expiresAt: 1619395200,
        checkoutUrl: 'http://test-app.com/checkout?order_id=ord_2tYvtxUTgcPWzKDER&method=oxxo&reference=93345678901234'
      };

      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentService.processOxxoPayment.mockResolvedValue(mockPaymentResult);
      paymentRepository.updatePaymentOrder.mockResolvedValue({ ...mockApplication, payment_processor_order_id: mockPaymentResult.orderId });

      // Act
      await paymentController.processOxxoPayment(req, res);

      // Assert
      expect(applicationRepository.findById).toHaveBeenCalledWith('123');
      expect(paymentService.processOxxoPayment).toHaveBeenCalledWith({
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        amount: 197.00,
        currency: 'MXN',
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123'
      });
      expect(paymentRepository.updatePaymentOrder).toHaveBeenCalledWith(
        123,
        mockPaymentResult.orderId,
        mockPaymentResult.paymentStatus
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(res, null, expect.objectContaining({
        orderId: mockPaymentResult.orderId,
        paymentMethod: mockPaymentResult.paymentMethod,
        status: mockPaymentResult.status,
        success: true
      }));
    });
  });

  describe('checkPaymentStatus', () => {
    it('should check payment status successfully', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      const mockApplication = {
        id: 123,
        user_id: 456,
        status: ApplicationStatus.PAYMENT_PENDING,
        payment_processor_order_id: 'ord_2tYvtxUTgcPWzKDER'
      };

      const mockPaymentStatus = {
        orderId: 'ord_2tYvtxUTgcPWzKDER',
        paymentId: 'chr_2tYvwKBp9IeGMKDER',
        status: 'paid',
        applicationStatus: ApplicationStatus.PAYMENT_RECEIVED,
        amount: 197.00,
        currency: 'MXN',
        paymentMethod: 'card',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentService.checkPaymentStatus.mockResolvedValue(mockPaymentStatus);

      // Act
      await paymentController.checkPaymentStatus(req, res);

      // Assert
      expect(applicationRepository.findById).toHaveBeenCalledWith('123');
      expect(paymentService.checkPaymentStatus).toHaveBeenCalledWith('ord_2tYvtxUTgcPWzKDER');
      expect(paymentRepository.updatePaymentStatus).toHaveBeenCalledWith(
        123,
        ApplicationStatus.PAYMENT_RECEIVED
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(res, null, mockPaymentStatus);
    });

    it('should not update application status if it has not changed', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      const mockApplication = {
        id: 123,
        user_id: 456,
        status: ApplicationStatus.PAYMENT_PENDING,
        payment_processor_order_id: 'ord_2tYvtxUTgcPWzKDER'
      };

      const mockPaymentStatus = {
        orderId: 'ord_2tYvtxUTgcPWzKDER',
        paymentId: 'chr_2tYvwKBp9IeGMKDER',
        status: 'pending_payment',
        applicationStatus: ApplicationStatus.PAYMENT_PENDING, // Same as current status
        amount: 197.00,
        currency: 'MXN',
        paymentMethod: 'oxxo_cash',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      applicationRepository.findById.mockResolvedValue(mockApplication);
      paymentService.checkPaymentStatus.mockResolvedValue(mockPaymentStatus);

      // Act
      await paymentController.checkPaymentStatus(req, res);

      // Assert
      expect(paymentRepository.updatePaymentStatus).not.toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(res, null, mockPaymentStatus);
    });

    it('should return 400 if application has no payment order', async () => {
      // Arrange
      const req = {
        params: {
          applicationId: '123'
        },
        session: {
          userId: 456
        }
      };

      const res = {};

      const mockApplication = {
        id: 123,
        user_id: 456,
        status: ApplicationStatus.PENDING_PAYMENT,
        payment_processor_order_id: null // No payment order
      };

      applicationRepository.findById.mockResolvedValue(mockApplication);

      // Act
      await paymentController.checkPaymentStatus(req, res);

      // Assert
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, null, { message: 'No payment order found for this application' });
      expect(paymentService.checkPaymentStatus).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('should process a valid webhook for order.paid event', async () => {
      // Arrange
      const mockEvent = {
        type: 'order.paid',
        data: {
          object: {
            id: 'ord_2tYvtxUTgcPWzKDER',
            status: 'paid'
          }
        }
      };

      const rawBody = JSON.stringify(mockEvent);

      // Create a valid signature
      const hmac = crypto.createHmac('sha256', 'test_webhook_secret');
      hmac.update(rawBody);
      const signature = `signature=${hmac.digest('hex')}`;

      const req = {
        headers: {
          'conekta-signature': signature
        },
        body: Buffer.from(rawBody, 'utf8')
      };

      const res = {};

      const mockApplication = {
        id: 123,
        status: ApplicationStatus.PAYMENT_PENDING
      };

      paymentRepository.findByOrderId.mockResolvedValue(mockApplication);

      // Mock the crypto.timingSafeEqual function
      const originalTimingSafeEqual = crypto.timingSafeEqual;
      crypto.timingSafeEqual = jest.fn().mockReturnValue(true);

      // Act
      await paymentController.handleWebhook(req, res);

      // Assert
      expect(paymentRepository.findByOrderId).toHaveBeenCalledWith('ord_2tYvtxUTgcPWzKDER');
      expect(paymentRepository.updatePaymentStatus).toHaveBeenCalledWith(
        123,
        ApplicationStatus.PAYMENT_RECEIVED
      );
      expect(paymentRepository.logPaymentEvent).toHaveBeenCalledWith({
        applicationId: 123,
        orderId: 'ord_2tYvtxUTgcPWzKDER',
        eventType: 'order.paid',
        eventData: mockEvent.data
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(res, null, { received: true });

      // Restore the original function
      crypto.timingSafeEqual = originalTimingSafeEqual;
    });

    it('should return 400 if Conekta-Signature header is missing', async () => {
      // Arrange
      const req = {
        headers: {
          // Missing Conekta-Signature header
        },
        body: Buffer.from('{}', 'utf8')
      };

      const res = {};

      // Act
      await paymentController.handleWebhook(req, res);

      // Assert
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, null, {
        message: 'Missing Conekta-Signature header'
      });
    });

    it('should return 400 if signature is invalid', async () => {
      // Arrange
      const mockEvent = {
        type: 'order.paid',
        data: {
          object: {
            id: 'ord_2tYvtxUTgcPWzKDER'
          }
        }
      };

      const rawBody = JSON.stringify(mockEvent);

      const req = {
        headers: {
          'conekta-signature': 'invalid_signature'
        },
        body: Buffer.from(rawBody, 'utf8')
      };

      const res = {};

      // Mock the crypto.timingSafeEqual function to return false (invalid signature)
      const originalTimingSafeEqual = crypto.timingSafeEqual;
      crypto.timingSafeEqual = jest.fn().mockReturnValue(false);

      // Act
      await paymentController.handleWebhook(req, res);

      // Assert
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, null, {
        message: 'Invalid webhook signature'
      });

      // Restore the original function
      crypto.timingSafeEqual = originalTimingSafeEqual;
    });

    it('should handle webhook verification errors gracefully', async () => {
      // Arrange
      const mockEvent = {
        type: 'order.paid',
        data: {
          object: {
            id: 'ord_2tYvtxUTgcPWzKDER'
          }
        }
      };

      const rawBody = JSON.stringify(mockEvent);

      const req = {
        headers: {
          'conekta-signature': 'signature=abc123'
        },
        body: Buffer.from(rawBody, 'utf8')
      };

      const res = {};

      // Mock the crypto.createHmac function to throw an error
      const originalCreateHmac = crypto.createHmac;
      crypto.createHmac = jest.fn().mockImplementation(() => {
        throw new Error('Crypto error');
      });

      // Act
      await paymentController.handleWebhook(req, res);

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Error verifying webhook signature:', expect.any(Error));
      expect(ApiResponse.badRequest).toHaveBeenCalledWith(res, null, {
        message: 'Invalid webhook signature'
      });

      // Restore the original function
      crypto.createHmac = originalCreateHmac;
    });

    it('should handle errors during webhook processing but still return 200', async () => {
      // Arrange
      const mockEvent = {
        type: 'order.paid',
        data: {
          object: {
            id: 'ord_2tYvtxUTgcPWzKDER'
          }
        }
      };

      const rawBody = JSON.stringify(mockEvent);

      // Create a valid signature
      const hmac = crypto.createHmac('sha256', 'test_webhook_secret');
      hmac.update(rawBody);
      const signature = `signature=${hmac.digest('hex')}`;

      const req = {
        headers: {
          'conekta-signature': signature
        },
        body: Buffer.from(rawBody, 'utf8')
      };

      const res = {};

      // Mock the crypto.timingSafeEqual function
      const originalTimingSafeEqual = crypto.timingSafeEqual;
      crypto.timingSafeEqual = jest.fn().mockReturnValue(true);

      // Mock an error during processing
      const mockError = new Error('Processing error');
      paymentRepository.findByOrderId.mockRejectedValue(mockError);

      // Mock tryRecordEvent to return true (new event)
      paymentRepository.tryRecordEvent.mockResolvedValue(true);

      // Act
      await paymentController.handleWebhook(req, res);

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Error handling order.paid event for order ord_2tYvtxUTgcPWzKDER:', mockError);
      // Should still return 200 to prevent Conekta from retrying
      expect(ApiResponse.success).toHaveBeenCalledWith(res, null, expect.objectContaining({
        received: true
      }));

      // Restore the original function
      crypto.timingSafeEqual = originalTimingSafeEqual;
    });

    it('should skip processing for duplicate webhook events', async () => {
      // Arrange
      const mockEvent = {
        id: 'evt_123456789',
        type: 'order.paid',
        data: {
          object: {
            id: 'ord_2tYvtxUTgcPWzKDER'
          }
        }
      };

      const rawBody = JSON.stringify(mockEvent);

      // Create a valid signature
      const hmac = crypto.createHmac('sha256', 'test_webhook_secret');
      hmac.update(rawBody);
      const signature = `t=1234567890,v1=${hmac.digest('hex')}`;

      const req = {
        headers: {
          'conekta-signature': signature
        },
        body: Buffer.from(rawBody, 'utf8')
      };

      const res = {};

      // Mock the crypto.timingSafeEqual function
      const originalTimingSafeEqual = crypto.timingSafeEqual;
      crypto.timingSafeEqual = jest.fn().mockReturnValue(true);

      // Mock tryRecordEvent to return false (duplicate event)
      paymentRepository.tryRecordEvent.mockResolvedValue(false);

      // Act
      await paymentController.handleWebhook(req, res);

      // Assert
      expect(ApiResponse.success).toHaveBeenCalledWith(res, null, {
        received: true,
        event_type: 'order.paid',
        event_id: 'evt_123456789'
      });

      // Verify that tryRecordEvent was called
      expect(paymentRepository.tryRecordEvent).toHaveBeenCalledWith('evt_123456789', 'order.paid');

      // Verify that no event processing occurred
      expect(paymentController.handleOrderPaid).not.toHaveBeenCalled();
      expect(paymentRepository.findByOrderId).not.toHaveBeenCalled();
      expect(paymentRepository.updatePaymentStatus).not.toHaveBeenCalled();
      expect(paymentRepository.logPaymentEvent).not.toHaveBeenCalled();

      // Verify that the duplicate event was logged
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Skipping duplicate webhook event'), expect.any(String));

      // Restore the original function
      crypto.timingSafeEqual = originalTimingSafeEqual;
    });
  });
});
