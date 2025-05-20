/**
 * Unit Tests for Payment Service
 */
const { ApplicationStatus } = require('../constants');

// Mock dependencies
jest.mock('../config/conekta', () => {
  return {
    Customer: {
      create: jest.fn(),
      find: jest.fn(),
      update: jest.fn()
    },
    Order: {
      create: jest.fn(),
      find: jest.fn()
    }
  };
});

jest.mock('../utils/enhanced-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Import dependencies after mocking
const Conekta = require('../config/conekta');
const { logger } = require('../utils/enhanced-logger');
const paymentService = require('./payment.service');

describe('Payment Service', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_URL = 'http://test-app.com';
  });

  describe('createCustomer', () => {
    it('should create a customer in Conekta', async () => {
      // Arrange
      const customerData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890'
      };

      const mockCustomer = {
        id: 'cus_2qnvwvnvKzsKzsDER',
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone
      };

      Conekta.Customer.create.mockResolvedValue(mockCustomer);

      // Act
      const result = await paymentService.createCustomer(customerData);

      // Assert
      expect(Conekta.Customer.create).toHaveBeenCalledWith({
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone
      });
      expect(result).toEqual(mockCustomer);
      expect(logger.debug).toHaveBeenCalledWith('Creating Conekta customer:', customerData.email);
    });

    it('should handle missing phone number', async () => {
      // Arrange
      const customerData = {
        name: 'Test User',
        email: 'test@example.com'
        // No phone provided
      };

      const mockCustomer = {
        id: 'cus_2qnvwvnvKzsKzsDER',
        name: customerData.name,
        email: customerData.email,
        phone: ''
      };

      Conekta.Customer.create.mockResolvedValue(mockCustomer);

      // Act
      const result = await paymentService.createCustomer(customerData);

      // Assert
      expect(Conekta.Customer.create).toHaveBeenCalledWith({
        name: customerData.name,
        email: customerData.email,
        phone: '' // Empty string should be used when phone is not provided
      });
      expect(result).toEqual(mockCustomer);
    });

    it('should handle Conekta errors', async () => {
      // Arrange
      const customerData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890'
      };

      const mockError = {
        type: 'parameter_validation_error',
        details: [{ message: 'Invalid email format' }]
      };

      Conekta.Customer.create.mockRejectedValue(mockError);

      // Act & Assert
      await expect(paymentService.createCustomer(customerData)).rejects.toThrow('Payment provider error: Invalid email format');
      expect(logger.error).toHaveBeenCalledWith('Failed to create Conekta customer:', mockError);
    });
  });

  describe('createOrder', () => {
    it('should create an order in Conekta', async () => {
      // Arrange
      const orderData = {
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        currency: 'MXN',
        amount: 197.00,
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123',
        paymentMethod: {
          type: 'card',
          token_id: 'tok_test_visa_4242'
        }
      };

      const mockOrder = {
        id: 'ord_2tYvtxUTgcPWzKDER',
        currency: 'MXN',
        amount: 19700, // In cents
        customer_info: {
          customer_id: orderData.customerId
        },
        line_items: [{
          name: 'Permiso de Circulación',
          unit_price: 19700,
          quantity: 1
        }],
        charges: [{
          id: 'chr_2tYvwKBp9IeGMKDER',
          payment_method: {
            type: 'card',
            last4: '4242'
          },
          status: 'pending_payment'
        }]
      };

      Conekta.Order.create.mockResolvedValue(mockOrder);

      // Act
      const result = await paymentService.createOrder(orderData);

      // Assert
      expect(Conekta.Order.create).toHaveBeenCalledWith({
        currency: orderData.currency,
        customer_info: {
          customer_id: orderData.customerId
        },
        line_items: [{
          name: 'Permiso de Circulación',
          unit_price: 19700, // Converted to cents
          quantity: 1
        }],
        metadata: {
          reference_id: orderData.referenceId,
          description: orderData.description
        },
        charges: [{
          payment_method: orderData.paymentMethod
        }]
      });
      expect(result).toEqual(mockOrder);
      expect(logger.debug).toHaveBeenCalledWith('Creating Conekta order:', orderData.referenceId);
      expect(logger.info).toHaveBeenCalledWith(`Conekta order created: ${mockOrder.id} for application ${orderData.referenceId}`);
    });

    it('should handle Conekta errors', async () => {
      // Arrange
      const orderData = {
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        currency: 'MXN',
        amount: 197.00,
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123',
        paymentMethod: {
          type: 'card',
          token_id: 'tok_test_visa_4242'
        }
      };

      const mockError = {
        type: 'processing_error',
        details: [{ message: 'Insufficient funds' }]
      };

      Conekta.Order.create.mockRejectedValue(mockError);

      // Act & Assert
      await expect(paymentService.createOrder(orderData)).rejects.toThrow('Payment provider error: Insufficient funds');
      expect(logger.error).toHaveBeenCalledWith('Failed to create Conekta order:', mockError);
    });
  });

  describe('processCardPayment', () => {
    it('should process a card payment successfully', async () => {
      // Arrange
      const paymentData = {
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        amount: 197.00,
        currency: 'MXN',
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123',
        card: {
          token: 'tok_test_visa_4242'
        }
      };

      // Mock the createOrder method
      const mockOrder = {
        id: 'ord_2tYvtxUTgcPWzKDER',
        amount: 19700, // In cents
        currency: 'MXN',
        charges: [{
          id: 'chr_2tYvwKBp9IeGMKDER',
          status: 'paid',
          payment_method: {
            type: 'card',
            last4: '4242'
          }
        }]
      };

      // Spy on the createOrder method
      jest.spyOn(paymentService, 'createOrder').mockResolvedValue(mockOrder);

      // Act
      const result = await paymentService.processCardPayment(paymentData);

      // Assert
      expect(paymentService.createOrder).toHaveBeenCalledWith({
        customerId: paymentData.customerId,
        currency: paymentData.currency,
        amount: paymentData.amount,
        description: paymentData.description,
        referenceId: paymentData.referenceId,
        paymentMethod: {
          type: 'card',
          token_id: paymentData.card.token,
          success_url: expect.stringContaining('/payment/success'),
          error_url: expect.stringContaining('/payment/error')
        }
      });

      expect(result).toMatchObject({
        orderId: mockOrder.id,
        paymentStatus: ApplicationStatus.PAYMENT_RECEIVED, // Since status is 'paid'
        paymentId: mockOrder.charges[0].id,
        paymentMethod: 'card',
        amount: paymentData.amount,
        currency: paymentData.currency,
        status: mockOrder.charges[0].status,
        checkoutUrl: expect.stringContaining('/payment/success')
      });
    });

    it('should handle pending card payment', async () => {
      // Arrange
      const paymentData = {
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        amount: 197.00,
        currency: 'MXN',
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123',
        card: {
          token: 'tok_test_visa_4242'
        }
      };

      // Mock the createOrder method
      const mockOrder = {
        id: 'ord_2tYvtxUTgcPWzKDER',
        amount: 19700, // In cents
        currency: 'MXN',
        charges: [{
          id: 'chr_2tYvwKBp9IeGMKDER',
          status: 'pending_payment',
          payment_method: {
            type: 'card',
            last4: '4242'
          }
        }]
      };

      // Spy on the createOrder method
      jest.spyOn(paymentService, 'createOrder').mockResolvedValue(mockOrder);

      // Act
      const result = await paymentService.processCardPayment(paymentData);

      // Assert
      expect(result).toMatchObject({
        orderId: mockOrder.id,
        paymentId: mockOrder.charges[0].id,
        paymentMethod: 'card',
        amount: paymentData.amount,
        currency: paymentData.currency,
        status: mockOrder.charges[0].status,
        checkoutUrl: expect.stringContaining('/checkout?order_id=')
      });
    });

    it('should handle errors in card payment processing', async () => {
      // Arrange
      const paymentData = {
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        amount: 197.00,
        currency: 'MXN',
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123',
        card: {
          token: 'tok_test_visa_4242'
        }
      };

      const mockError = new Error('Card declined');
      jest.spyOn(paymentService, 'createOrder').mockRejectedValue(mockError);

      // Act & Assert
      await expect(paymentService.processCardPayment(paymentData)).rejects.toThrow('Card declined');
      expect(logger.error).toHaveBeenCalledWith('Card payment processing failed:', mockError);
    });
  });

  describe('processBankTransferPayment', () => {
    it('should process a bank transfer payment successfully', async () => {
      // Arrange
      const paymentData = {
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        amount: 197.00,
        currency: 'MXN',
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123'
      };

      // Mock the createOrder method
      const mockOrder = {
        id: 'ord_2tYvtxUTgcPWzKDER',
        amount: 19700, // In cents
        currency: 'MXN',
        charges: [{
          id: 'chr_2tYvwKBp9IeGMKDER',
          status: 'pending_payment',
          payment_method: {
            type: 'spei',
            receiving_account_number: '646180111812345678',
            expires_at: 1619395200
          }
        }]
      };

      // Spy on the createOrder method
      jest.spyOn(paymentService, 'createOrder').mockResolvedValue(mockOrder);

      // Act
      const result = await paymentService.processBankTransferPayment(paymentData);

      // Assert
      expect(paymentService.createOrder).toHaveBeenCalledWith({
        customerId: paymentData.customerId,
        currency: paymentData.currency,
        amount: paymentData.amount,
        description: paymentData.description,
        referenceId: paymentData.referenceId,
        paymentMethod: {
          type: 'spei',
          success_url: expect.stringContaining('/payment/success'),
          error_url: expect.stringContaining('/payment/error')
        }
      });

      expect(result).toMatchObject({
        orderId: mockOrder.id,
        paymentStatus: ApplicationStatus.PAYMENT_PENDING,
        paymentId: mockOrder.charges[0].id,
        paymentMethod: 'spei',
        amount: paymentData.amount,
        currency: paymentData.currency,
        status: mockOrder.charges[0].status,
        speiReference: '646180111812345678',
        expiresAt: 1619395200,
        checkoutUrl: expect.stringContaining('/checkout?order_id=')
      });
    });

    it('should handle errors in bank transfer payment processing', async () => {
      // Arrange
      const paymentData = {
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        amount: 197.00,
        currency: 'MXN',
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123'
      };

      const mockError = new Error('Bank transfer processing error');
      jest.spyOn(paymentService, 'createOrder').mockRejectedValue(mockError);

      // Act & Assert
      await expect(paymentService.processBankTransferPayment(paymentData)).rejects.toThrow('Bank transfer processing error');
      expect(logger.error).toHaveBeenCalledWith('Bank transfer payment processing failed:', mockError);
    });
  });

  describe('processOxxoPayment', () => {
    it('should process an OXXO payment successfully', async () => {
      // Arrange
      const paymentData = {
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        amount: 197.00,
        currency: 'MXN',
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123'
      };

      // Mock the createOrder method
      const mockOrder = {
        id: 'ord_2tYvtxUTgcPWzKDER',
        amount: 19700, // In cents
        currency: 'MXN',
        charges: [{
          id: 'chr_2tYvwKBp9IeGMKDER',
          status: 'pending_payment',
          payment_method: {
            type: 'oxxo_cash',
            reference: '93345678901234',
            expires_at: 1619395200
          }
        }]
      };

      // Spy on the createOrder method
      jest.spyOn(paymentService, 'createOrder').mockResolvedValue(mockOrder);

      // Act
      const result = await paymentService.processOxxoPayment(paymentData);

      // Assert
      expect(paymentService.createOrder).toHaveBeenCalledWith({
        customerId: paymentData.customerId,
        currency: paymentData.currency,
        amount: paymentData.amount,
        description: paymentData.description,
        referenceId: paymentData.referenceId,
        paymentMethod: {
          type: 'oxxo_cash',
          success_url: expect.stringContaining('/payment/success'),
          error_url: expect.stringContaining('/payment/error')
        }
      });

      expect(result).toMatchObject({
        orderId: mockOrder.id,
        paymentStatus: ApplicationStatus.PAYMENT_PENDING,
        paymentId: mockOrder.charges[0].id,
        paymentMethod: 'oxxo_cash',
        amount: paymentData.amount,
        currency: paymentData.currency,
        status: mockOrder.charges[0].status,
        oxxoReference: '93345678901234',
        expiresAt: 1619395200,
        checkoutUrl: expect.stringContaining('/checkout?order_id=')
      });
    });

    it('should handle errors in OXXO payment processing', async () => {
      // Arrange
      const paymentData = {
        customerId: 'cus_2qnvwvnvKzsKzsDER',
        amount: 197.00,
        currency: 'MXN',
        description: 'Permiso de Circulación - Toyota Corolla 2023',
        referenceId: 'APP-123'
      };

      const mockError = new Error('OXXO payment processing error');
      jest.spyOn(paymentService, 'createOrder').mockRejectedValue(mockError);

      // Act & Assert
      await expect(paymentService.processOxxoPayment(paymentData)).rejects.toThrow('OXXO payment processing error');
      expect(logger.error).toHaveBeenCalledWith('OXXO payment processing failed:', mockError);
    });
  });

  describe('getOrder', () => {
    it('should retrieve an order from Conekta', async () => {
      // Arrange
      const orderId = 'ord_2tYvtxUTgcPWzKDER';
      const mockOrder = {
        id: orderId,
        amount: 19700,
        currency: 'MXN',
        charges: [{
          id: 'chr_2tYvwKBp9IeGMKDER',
          status: 'paid'
        }]
      };

      Conekta.Order.find.mockResolvedValue(mockOrder);

      // Act
      const result = await paymentService.getOrder(orderId);

      // Assert
      expect(Conekta.Order.find).toHaveBeenCalledWith(orderId);
      expect(result).toEqual(mockOrder);
    });

    it('should handle errors when retrieving an order', async () => {
      // Arrange
      const orderId = 'ord_2tYvtxUTgcPWzKDER';
      const mockError = new Error('Order not found');
      Conekta.Order.find.mockRejectedValue(mockError);

      // Act & Assert
      await expect(paymentService.getOrder(orderId)).rejects.toThrow('Order not found');
      expect(logger.error).toHaveBeenCalledWith(`Failed to retrieve Conekta order ${orderId}:`, mockError);
    });
  });

  describe('checkPaymentStatus', () => {
    it('should check payment status for a paid order', async () => {
      // Arrange
      const orderId = 'ord_2tYvtxUTgcPWzKDER';
      const mockOrder = {
        id: orderId,
        amount: 19700,
        currency: 'MXN',
        created_at: 1619308800, // Unix timestamp
        updated_at: 1619309800, // Unix timestamp
        charges: [{
          id: 'chr_2tYvwKBp9IeGMKDER',
          status: 'paid',
          payment_method: {
            type: 'card'
          }
        }]
      };

      // Spy on the getOrder method
      jest.spyOn(paymentService, 'getOrder').mockResolvedValue(mockOrder);

      // Act
      const result = await paymentService.checkPaymentStatus(orderId);

      // Assert
      expect(paymentService.getOrder).toHaveBeenCalledWith(orderId);
      expect(result).toEqual({
        orderId: mockOrder.id,
        paymentId: mockOrder.charges[0].id,
        status: 'paid',
        applicationStatus: ApplicationStatus.PAYMENT_RECEIVED,
        amount: 197.00, // Converted from cents
        currency: 'MXN',
        paymentMethod: 'card',
        createdAt: new Date(1619308800 * 1000),
        updatedAt: new Date(1619309800 * 1000)
      });
    });

    it('should check payment status for a pending order', async () => {
      // Arrange
      const orderId = 'ord_2tYvtxUTgcPWzKDER';
      const mockOrder = {
        id: orderId,
        amount: 19700,
        currency: 'MXN',
        created_at: 1619308800,
        updated_at: 1619309800,
        charges: [{
          id: 'chr_2tYvwKBp9IeGMKDER',
          status: 'pending_payment',
          payment_method: {
            type: 'oxxo_cash'
          }
        }]
      };

      // Spy on the getOrder method
      jest.spyOn(paymentService, 'getOrder').mockResolvedValue(mockOrder);

      // Act
      const result = await paymentService.checkPaymentStatus(orderId);

      // Assert
      expect(result.applicationStatus).toBe(ApplicationStatus.PAYMENT_PENDING);
    });

    it('should check payment status for a failed order', async () => {
      // Arrange
      const orderId = 'ord_2tYvtxUTgcPWzKDER';
      const mockOrder = {
        id: orderId,
        amount: 19700,
        currency: 'MXN',
        created_at: 1619308800,
        updated_at: 1619309800,
        charges: [{
          id: 'chr_2tYvwKBp9IeGMKDER',
          status: 'declined',
          payment_method: {
            type: 'card'
          }
        }]
      };

      // Spy on the getOrder method
      jest.spyOn(paymentService, 'getOrder').mockResolvedValue(mockOrder);

      // Act
      const result = await paymentService.checkPaymentStatus(orderId);

      // Assert
      expect(result.applicationStatus).toBe(ApplicationStatus.PAYMENT_FAILED);
    });

    it('should handle errors when checking payment status', async () => {
      // Arrange
      const orderId = 'ord_2tYvtxUTgcPWzKDER';
      const mockError = new Error('Failed to retrieve order');
      jest.spyOn(paymentService, 'getOrder').mockRejectedValue(mockError);

      // Act & Assert
      await expect(paymentService.checkPaymentStatus(orderId)).rejects.toThrow('Payment provider error: Failed to retrieve order');
      expect(logger.error).toHaveBeenCalledWith(`Failed to check payment status for order ${orderId}:`, mockError);
    });
  });
});
