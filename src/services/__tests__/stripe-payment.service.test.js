/**
 * Stripe Payment Service Tests
 * Comprehensive test coverage for critical payment service methods
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

jest.mock('../../constants', () => ({
  ApplicationStatus: {
    AWAITING_PAYMENT: 'awaiting_payment',
    PAYMENT_PROCESSING: 'payment_processing',
    PAYMENT_RECEIVED: 'payment_received',
    PAYMENT_FAILED: 'payment_failed',
    AWAITING_OXXO_PAYMENT: 'awaiting_oxxo_payment'
  }
}));

jest.mock('../../config/unified-config', () => ({
  getSync: () => ({
  nodeEnv: 'test',
  stripeWebhookSecret: 'test_webhook_secret',
  payment: {
    velocityEnabled: true
  }
  })
}));

jest.mock('../config/stripe', () => ({
  getInstance: jest.fn()
}));

jest.mock('../../utils/circuit-breaker', () => ({
  CircuitBreaker: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockImplementation(async (fn) => await fn()),
    getState: jest.fn().mockReturnValue({ state: 'CLOSED' })
  }))
}));

jest.mock('../payment-monitoring.service', () => ({
  recordPaymentAttempt: jest.fn(),
  recordPaymentSuccess: jest.fn(),
  recordPaymentFailure: jest.fn()
}));

jest.mock('../payment-recovery.service', () => ({
  attemptPaymentRecovery: jest.fn()
}));

jest.mock('../payment-velocity.service', () => ({
  checkPaymentVelocity: jest.fn()
}));

// Import after mocking
const { ApplicationStatus } = require('../../constants');
const stripeConfig = require('../config/stripe');
const paymentMonitoring = require('../payment-monitoring.service');
const paymentVelocityService = require('../payment-velocity.service');

// Mock Stripe SDK
const mockStripe = {
  createCustomer: jest.fn(),
  findCustomerByEmail: jest.fn(),
  createPaymentIntentWithCard: jest.fn(),
  createPaymentIntentWithOxxo: jest.fn(),
  paymentIntents: {
    retrieve: jest.fn(),
    confirm: jest.fn(),
    capture: jest.fn()
  },
  webhooks: {
    constructEvent: jest.fn()
  }
};

// Setup Stripe mock
stripeConfig.getInstance.mockReturnValue(mockStripe);

// Import service after mocking
const StripePaymentService = require('../stripe-payment.service');

describe('StripePaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset velocity check to allow by default
    paymentVelocityService.checkPaymentVelocity.mockResolvedValue({
      allowed: true,
      riskScore: 0,
      violations: []
    });
  });

  describe('createCustomer', () => {
    const customerData = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890'
    };

    const mockStripeCustomer = {
      id: 'cus_test123',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890',
      created: 1640995200 // 2022-01-01 00:00:00 UTC
    };

    it('should create customer successfully', async () => {
      mockStripe.findCustomerByEmail.mockResolvedValue(null);
      mockStripe.createCustomer.mockResolvedValue(mockStripeCustomer);

      const result = await StripePaymentService.createCustomer(customerData);

      expect(mockStripe.findCustomerByEmail).toHaveBeenCalledWith('john@example.com');
      expect(mockStripe.createCustomer).toHaveBeenCalledWith(
        {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '1234567890'
        },
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(/customer-john@example\.com/)
        })
      );
      expect(result).toEqual({
        id: 'cus_test123',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        created_at: '2022-01-01T00:00:00.000Z'
      });
    });

    it('should return existing customer if found', async () => {
      mockStripe.findCustomerByEmail.mockResolvedValue(mockStripeCustomer);

      const result = await StripePaymentService.createCustomer(customerData);

      expect(mockStripe.findCustomerByEmail).toHaveBeenCalledWith('john@example.com');
      expect(mockStripe.createCustomer).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        id: 'cus_test123',
        existing: true
      }));
    });

    it('should handle duplicate customer error gracefully', async () => {
      const duplicateError = new Error('Customer already exists');
      duplicateError.code = 'resource_already_exists';
      
      mockStripe.findCustomerByEmail.mockResolvedValueOnce(null);
      mockStripe.createCustomer.mockRejectedValueOnce(duplicateError);
      mockStripe.findCustomerByEmail.mockResolvedValueOnce(mockStripeCustomer);

      const result = await StripePaymentService.createCustomer(customerData);

      expect(mockStripe.findCustomerByEmail).toHaveBeenCalledTimes(2);
      expect(result).toEqual(expect.objectContaining({
        id: 'cus_test123',
        existing: true
      }));
    });

    it('should validate required fields', async () => {
      await expect(StripePaymentService.createCustomer({ email: 'john@example.com' }))
        .rejects
        .toThrow('Customer name is required');

      await expect(StripePaymentService.createCustomer({ name: 'John Doe' }))
        .rejects
        .toThrow('Customer email is required');
    });

    it('should retry on retryable errors', async () => {
      const networkError = new Error('Connection timeout');
      networkError.code = 'ETIMEDOUT';
      
      mockStripe.findCustomerByEmail.mockResolvedValue(null);
      mockStripe.createCustomer
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockStripeCustomer);

      const result = await StripePaymentService.createCustomer(customerData);

      expect(mockStripe.createCustomer).toHaveBeenCalledTimes(2);
      expect(result.id).toBe('cus_test123');
    });
  });

  describe('createPaymentIntentForCard', () => {
    const paymentData = {
      customerId: 'cus_test123',
      amount: 150,
      currency: 'MXN',
      description: 'Test payment',
      applicationId: '1',
      userId: '1',
      email: 'john@example.com',
      ipAddress: '192.168.1.1'
    };

    const mockPaymentIntent = {
      id: 'pi_test123',
      amount: 15000,
      currency: 'mxn',
      status: 'requires_payment_method',
      client_secret: 'pi_test123_secret_test',
      created: 1640995200,
      metadata: { application_id: '1' }
    };

    beforeEach(() => {
      mockStripe.createPaymentIntentWithCard.mockResolvedValue(mockPaymentIntent);
    });

    it('should create payment intent successfully', async () => {
      const result = await StripePaymentService.createPaymentIntentForCard(paymentData);

      expect(paymentVelocityService.checkPaymentVelocity).toHaveBeenCalledWith({
        userId: '1',
        email: 'john@example.com',
        ipAddress: '192.168.1.1',
        amount: 150,
        cardLast4: undefined,
        cardFingerprint: undefined
      });
      
      expect(paymentMonitoring.recordPaymentAttempt).toHaveBeenCalledWith({
        method: 'card',
        amount: 150,
        applicationId: '1',
        userId: '1'
      });

      expect(mockStripe.createPaymentIntentWithCard).toHaveBeenCalledWith(
        {
          customerId: 'cus_test123',
          amount: 150,
          currency: 'mxn',
          description: 'Test payment',
          applicationId: '1',
          referenceId: undefined
        },
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(/card-intent-app-1-cust-cus_test123/)
        })
      );

      expect(paymentMonitoring.recordPaymentSuccess).toHaveBeenCalledWith({
        method: 'card',
        amount: 150,
        paymentIntentId: 'pi_test123',
        processingTime: expect.any(Number)
      });

      expect(result).toBe(mockPaymentIntent);
    });

    it('should block payment when velocity check fails', async () => {
      paymentVelocityService.checkPaymentVelocity.mockResolvedValue({
        allowed: false,
        riskScore: 100,
        violations: ['too_many_attempts']
      });

      await expect(StripePaymentService.createPaymentIntentForCard(paymentData))
        .rejects
        .toThrow('Su pago ha sido rechazado por motivos de seguridad');

      expect(paymentMonitoring.recordPaymentFailure).toHaveBeenCalledWith({
        error: expect.any(Error),
        method: 'card',
        amount: 150,
        applicationId: '1',
        userId: '1',
        reason: 'velocity_check_failed',
        violations: ['too_many_attempts']
      });

      expect(mockStripe.createPaymentIntentWithCard).not.toHaveBeenCalled();
    });

    it('should handle Stripe errors and record failure', async () => {
      const stripeError = new Error('Card declined');
      stripeError.code = 'card_declined';
      mockStripe.createPaymentIntentWithCard.mockRejectedValue(stripeError);

      await expect(StripePaymentService.createPaymentIntentForCard(paymentData))
        .rejects
        .toThrow('Card declined');

      expect(paymentMonitoring.recordPaymentFailure).toHaveBeenCalledWith({
        error: stripeError,
        method: 'card',
        amount: 150,
        applicationId: '1',
        userId: '1'
      });
    });

    it('should handle timeout errors', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Payment processing timeout')), 100);
      });
      
      mockStripe.createPaymentIntentWithCard.mockReturnValue(timeoutPromise);

      await expect(StripePaymentService.createPaymentIntentForCard(paymentData))
        .rejects
        .toThrow();
    });
  });

  describe('processOxxoPayment', () => {
    const paymentData = {
      customerId: 'cus_test123',
      amount: 150,
      currency: 'MXN',
      description: 'Test OXXO payment',
      applicationId: '1',
      userId: '1',
      email: 'john@example.com',
      ipAddress: '192.168.1.1'
    };

    const mockOxxoPaymentIntent = {
      id: 'pi_oxxo_test123',
      amount: 15000,
      currency: 'mxn',
      status: 'requires_action',
      client_secret: 'pi_oxxo_test123_secret',
      created: 1640995200,
      metadata: { application_id: '1' },
      next_action: {
        type: 'oxxo_display_details',
        oxxo_display_details: {
          number: '12345678901234',
          hosted_voucher_url: 'https://payments.stripe.com/oxxo/voucher',
          expires_after: 1640995200
        }
      }
    };

    beforeEach(() => {
      mockStripe.createPaymentIntentWithOxxo.mockResolvedValue(mockOxxoPaymentIntent);
    });

    it('should process OXXO payment successfully', async () => {
      const result = await StripePaymentService.processOxxoPayment(paymentData);

      expect(paymentVelocityService.checkPaymentVelocity).toHaveBeenCalled();
      expect(paymentMonitoring.recordPaymentAttempt).toHaveBeenCalledWith({
        method: 'oxxo',
        amount: 150,
        applicationId: '1',
        userId: '1'
      });

      expect(mockStripe.createPaymentIntentWithOxxo).toHaveBeenCalledWith(
        {
          customerId: 'cus_test123',
          amount: 150,
          currency: 'mxn',
          description: 'Test OXXO payment',
          applicationId: '1',
          referenceId: undefined
        },
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(/oxxo-1/)
        })
      );

      expect(result).toEqual({
        success: true,
        orderId: 'pi_oxxo_test123',
        paymentIntentId: 'pi_oxxo_test123',
        status: 'requires_action',
        paymentMethod: 'oxxo',
        amount: 150,
        currency: 'MXN',
        clientSecret: 'pi_oxxo_test123_secret',
        paymentStatus: ApplicationStatus.AWAITING_PAYMENT,
        created: '2022-01-01T00:00:00.000Z',
        metadata: { application_id: '1' },
        oxxoReference: '12345678901234',
        hostedVoucherUrl: 'https://payments.stripe.com/oxxo/voucher',
        barcodeUrl: 'https://payments.stripe.com/oxxo/voucher',
        expiresAt: expect.any(String)
      });
    });

    it('should block OXXO payment when velocity check fails', async () => {
      paymentVelocityService.checkPaymentVelocity.mockResolvedValue({
        allowed: false,
        riskScore: 80,
        violations: ['suspicious_ip']
      });

      await expect(StripePaymentService.processOxxoPayment(paymentData))
        .rejects
        .toThrow('Su pago ha sido rechazado por motivos de seguridad');

      expect(paymentMonitoring.recordPaymentFailure).toHaveBeenCalledWith({
        error: expect.any(Error),
        method: 'oxxo',
        amount: 150,
        applicationId: '1',
        userId: '1',
        reason: 'velocity_check_failed',
        violations: ['suspicious_ip']
      });
    });

    it('should handle missing OXXO details in payment intent', async () => {
      const invalidOxxoIntent = {
        ...mockOxxoPaymentIntent,
        next_action: { type: 'redirect_to_url' }
      };
      mockStripe.createPaymentIntentWithOxxo.mockResolvedValue(invalidOxxoIntent);

      await expect(StripePaymentService.processOxxoPayment(paymentData))
        .rejects
        .toThrow('Failed to generate OXXO payment details from Stripe');
    });

    it('should handle missing OXXO reference number', async () => {
      const invalidOxxoIntent = {
        ...mockOxxoPaymentIntent,
        next_action: {
          type: 'oxxo_display_details',
          oxxo_display_details: {
            hosted_voucher_url: 'https://payments.stripe.com/oxxo/voucher'
          }
        }
      };
      mockStripe.createPaymentIntentWithOxxo.mockResolvedValue(invalidOxxoIntent);

      await expect(StripePaymentService.processOxxoPayment(paymentData))
        .rejects
        .toThrow('Stripe did not generate OXXO reference number');
    });

    it('should validate required fields', async () => {
      await expect(StripePaymentService.processOxxoPayment({ amount: 150 }))
        .rejects
        .toThrow('Customer ID is required for OXXO payment');

      await expect(StripePaymentService.processOxxoPayment({ customerId: 'cus_test' }))
        .rejects
        .toThrow('Payment amount is required');
    });
  });

  describe('retrievePaymentIntent', () => {
    const mockPaymentIntent = {
      id: 'pi_test123',
      status: 'succeeded',
      amount: 15000
    };

    it('should retrieve payment intent successfully', async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      const result = await StripePaymentService.retrievePaymentIntent('pi_test123');

      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_test123');
      expect(result).toBe(mockPaymentIntent);
    });

    it('should handle Stripe errors when retrieving payment intent', async () => {
      const stripeError = new Error('Payment intent not found');
      mockStripe.paymentIntents.retrieve.mockRejectedValue(stripeError);

      await expect(StripePaymentService.retrievePaymentIntent('pi_invalid'))
        .rejects
        .toThrow('Payment intent not found');
    });
  });

  describe('confirmPaymentIntent', () => {
    const mockConfirmedIntent = {
      id: 'pi_test123',
      status: 'succeeded'
    };

    it('should confirm payment intent successfully', async () => {
      mockStripe.paymentIntents.confirm.mockResolvedValue(mockConfirmedIntent);

      const result = await StripePaymentService.confirmPaymentIntent('pi_test123');

      expect(mockStripe.paymentIntents.confirm).toHaveBeenCalledWith('pi_test123');
      expect(result).toBe(mockConfirmedIntent);
    });

    it('should handle confirmation errors', async () => {
      const confirmError = new Error('Confirmation failed');
      confirmError.code = 'payment_intent_confirmation_failed';
      mockStripe.paymentIntents.confirm.mockRejectedValue(confirmError);

      await expect(StripePaymentService.confirmPaymentIntent('pi_test123'))
        .rejects
        .toThrow('Confirmation failed');
    });
  });

  describe('capturePaymentIntent', () => {
    const mockCapturedIntent = {
      id: 'pi_test123',
      status: 'succeeded',
      amount_captured: 15000
    };

    it('should capture payment intent successfully', async () => {
      mockStripe.paymentIntents.capture.mockResolvedValue(mockCapturedIntent);

      const result = await StripePaymentService.capturePaymentIntent('pi_test123');

      expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith('pi_test123');
      expect(result).toBe(mockCapturedIntent);
    });

    it('should handle capture errors', async () => {
      const captureError = new Error('Capture failed');
      captureError.code = 'payment_intent_capture_failed';
      mockStripe.paymentIntents.capture.mockRejectedValue(captureError);

      await expect(StripePaymentService.capturePaymentIntent('pi_test123'))
        .rejects
        .toThrow('Capture failed');
    });
  });

  describe('constructWebhookEvent', () => {
    const mockPayload = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' }));
    const mockSignature = 'test_signature';
    const mockEvent = {
      id: 'evt_test123',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test123' } }
    };

    it('should construct webhook event successfully', () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = StripePaymentService.constructWebhookEvent(mockPayload, mockSignature);

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        mockPayload,
        mockSignature,
        'test_webhook_secret'
      );
      expect(result).toBe(mockEvent);
    });

    it('should handle missing signature', () => {
      expect(() => StripePaymentService.constructWebhookEvent(mockPayload, null))
        .toThrow('Missing stripe-signature header');
    });

    it('should handle webhook verification errors', () => {
      const webhookError = new Error('Invalid signature');
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw webhookError;
      });

      expect(() => StripePaymentService.constructWebhookEvent(mockPayload, mockSignature))
        .toThrow('Invalid signature');
    });

    it('should require webhook secret in all environments', () => {
      const mockConfig = require('../../../config');
      mockConfig.stripeWebhookSecret = null;
      mockConfig.nodeEnv = 'development';

      expect(() => StripePaymentService.constructWebhookEvent(mockPayload, mockSignature))
        .toThrow('Webhook secret not configured - signature verification required');

      // Test production environment also requires secret
      mockConfig.nodeEnv = 'production';
      expect(() => StripePaymentService.constructWebhookEvent(mockPayload, mockSignature))
        .toThrow('Webhook secret not configured - signature verification required');

      // Reset for other tests
      mockConfig.stripeWebhookSecret = 'test_webhook_secret';
      mockConfig.nodeEnv = 'test';
    });
  });

  describe('mapStripeErrorToUserMessage', () => {
    it('should map card decline errors correctly', () => {
      const errorMappings = [
        { code: 'card_declined', expected: 'Su tarjeta fue rechazada' },
        { code: 'insufficient_funds', expected: 'Fondos insuficientes' },
        { code: 'expired_card', expected: 'Su tarjeta ha expirado' },
        { code: 'incorrect_cvc', expected: 'El código de seguridad (CVC) es incorrecto' },
        { code: 'invalid_number', expected: 'El número de tarjeta es inválido' },
        { code: 'processing_error', expected: 'Error al procesar el pago' },
        { code: 'unknown_error', expected: 'Error al procesar el pago' }
      ];

      errorMappings.forEach(({ code, expected }) => {
        const error = { code };
        const result = StripePaymentService.mapStripeErrorToUserMessage(error);
        expect(result).toMatch(expected);
      });
    });
  });

  describe('getCircuitBreakerStates', () => {
    it('should return circuit breaker states', () => {
      const states = StripePaymentService.getCircuitBreakerStates();

      expect(states).toHaveProperty('cardPayment');
      expect(states).toHaveProperty('oxxoPayment');
      expect(states).toHaveProperty('customerOperations');
      expect(states).toHaveProperty('webhookProcessing');
      
      Object.values(states).forEach(state => {
        expect(state).toHaveProperty('state');
      });
    });
  });

  describe('checkRateLimit', () => {
    it('should allow payment within rate limits', () => {
      expect(() => {
        StripePaymentService.checkRateLimit('cus_test123', '1');
      }).not.toThrow();
    });

    it('should block payment when rate limit exceeded', () => {
      // Simulate multiple rapid calls
      for (let i = 0; i < 10; i++) {
        StripePaymentService.checkRateLimit('cus_spam', '1');
      }
      
      expect(() => {
        StripePaymentService.checkRateLimit('cus_spam', '1');
      }).toThrow('Too many payment attempts');
    });
  });

  describe('payment velocity feature flag', () => {
    const paymentData = {
      customerId: 'cus_test123',
      amount: 150,
      currency: 'MXN',
      description: 'Test payment',
      applicationId: '1',
      userId: '1',
      email: 'john@example.com',
      ipAddress: '192.168.1.1'
    };

    it('should perform velocity checks when feature flag is enabled', async () => {
      const mockConfig = require('../../../config');
      mockConfig.payment.velocityEnabled = true;

      mockStripe.createPaymentIntentWithCard.mockResolvedValue({
        id: 'pi_test123',
        amount: 15000,
        currency: 'mxn',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret_test',
        created: 1640995200,
        metadata: { application_id: '1' }
      });

      await StripePaymentService.createPaymentIntentForCard(paymentData);

      expect(paymentVelocityService.checkPaymentVelocity).toHaveBeenCalledWith({
        userId: '1',
        email: 'john@example.com',
        ipAddress: '192.168.1.1',
        amount: 150,
        cardLast4: undefined,
        cardFingerprint: undefined
      });
    });

    it('should skip velocity checks when feature flag is disabled', async () => {
      const mockConfig = require('../../../config');
      mockConfig.payment.velocityEnabled = false;

      mockStripe.createPaymentIntentWithCard.mockResolvedValue({
        id: 'pi_test123',
        amount: 15000,
        currency: 'mxn',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret_test',
        created: 1640995200,
        metadata: { application_id: '1' }
      });

      await StripePaymentService.createPaymentIntentForCard(paymentData);

      expect(paymentVelocityService.checkPaymentVelocity).not.toHaveBeenCalled();
      expect(mockStripe.createPaymentIntentWithCard).toHaveBeenCalled();

      // Reset for other tests
      mockConfig.payment.velocityEnabled = true;
    });

    it('should perform velocity checks for OXXO payments when feature flag is enabled', async () => {
      const mockConfig = require('../../../config');
      mockConfig.payment.velocityEnabled = true;

      const mockOxxoPaymentIntent = {
        id: 'pi_oxxo_test123',
        amount: 15000,
        currency: 'mxn',
        status: 'requires_action',
        client_secret: 'pi_oxxo_test123_secret',
        created: 1640995200,
        metadata: { application_id: '1' },
        next_action: {
          type: 'oxxo_display_details',
          oxxo_display_details: {
            number: '12345678901234',
            hosted_voucher_url: 'https://payments.stripe.com/oxxo/voucher',
            expires_after: 1640995200
          }
        }
      };

      mockStripe.createPaymentIntentWithOxxo.mockResolvedValue(mockOxxoPaymentIntent);

      await StripePaymentService.processOxxoPayment(paymentData);

      expect(paymentVelocityService.checkPaymentVelocity).toHaveBeenCalledWith({
        userId: '1',
        email: 'john@example.com',
        ipAddress: '192.168.1.1',
        amount: 150,
        cardLast4: undefined,
        cardFingerprint: undefined
      });
    });

    it('should skip velocity checks for OXXO payments when feature flag is disabled', async () => {
      const mockConfig = require('../../../config');
      mockConfig.payment.velocityEnabled = false;

      const mockOxxoPaymentIntent = {
        id: 'pi_oxxo_test123',
        amount: 15000,
        currency: 'mxn',
        status: 'requires_action',
        client_secret: 'pi_oxxo_test123_secret',
        created: 1640995200,
        metadata: { application_id: '1' },
        next_action: {
          type: 'oxxo_display_details',
          oxxo_display_details: {
            number: '12345678901234',
            hosted_voucher_url: 'https://payments.stripe.com/oxxo/voucher',
            expires_after: 1640995200
          }
        }
      };

      mockStripe.createPaymentIntentWithOxxo.mockResolvedValue(mockOxxoPaymentIntent);

      await StripePaymentService.processOxxoPayment(paymentData);

      expect(paymentVelocityService.checkPaymentVelocity).not.toHaveBeenCalled();
      expect(mockStripe.createPaymentIntentWithOxxo).toHaveBeenCalled();

      // Reset for other tests
      mockConfig.payment.velocityEnabled = true;
    });

    it('should block payments when velocity check fails and feature flag is enabled', async () => {
      const mockConfig = require('../../config');
      mockConfig.payment.velocityEnabled = true;

      paymentVelocityService.checkPaymentVelocity.mockResolvedValue({
        allowed: false,
        riskScore: 95,
        violations: [
          { type: 'user_hourly_limit', severity: 'high' },
          { type: 'rapid_fire_attempts', severity: 'high' }
        ]
      });

      const error = await StripePaymentService.createPaymentIntentForCard(paymentData)
        .catch(err => err);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Su pago ha sido rechazado por motivos de seguridad. Por favor, intente más tarde o contacte a soporte.');
      expect(error.code).toBe('velocity_check_failed');
      expect(error.violations).toEqual([
        { type: 'user_hourly_limit', severity: 'high' },
        { type: 'rapid_fire_attempts', severity: 'high' }
      ]);
      expect(error.riskScore).toBe(95);

      expect(paymentMonitoring.recordPaymentFailure).toHaveBeenCalledWith({
        error: expect.any(Error),
        method: 'card',
        amount: 150,
        applicationId: '1',
        userId: '1',
        reason: 'velocity_check_failed',
        violations: [
          { type: 'user_hourly_limit', severity: 'high' },
          { type: 'rapid_fire_attempts', severity: 'high' }
        ]
      });

      expect(mockStripe.createPaymentIntentWithCard).not.toHaveBeenCalled();
    });

    it('should log risk score when velocity check passes with some risk', async () => {
      const mockConfig = require('../../config');
      mockConfig.payment.velocityEnabled = true;

      paymentVelocityService.checkPaymentVelocity.mockResolvedValue({
        allowed: true,
        riskScore: 35,
        violations: [
          { type: 'email_hourly_limit', severity: 'medium' }
        ]
      });

      mockStripe.createPaymentIntentWithCard.mockResolvedValue({
        id: 'pi_test123',
        amount: 15000,
        currency: 'mxn',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret_test',
        created: 1640995200,
        metadata: { application_id: '1' }
      });

      await StripePaymentService.createPaymentIntentForCard(paymentData);

      expect(paymentVelocityService.checkPaymentVelocity).toHaveBeenCalled();
      expect(mockStripe.createPaymentIntentWithCard).toHaveBeenCalled();
      expect(paymentMonitoring.recordPaymentSuccess).toHaveBeenCalled();
    });
  });

  describe('error handling and resilience', () => {
    it('should handle initialization failures gracefully', async () => {
      stripeConfig.getInstance.mockImplementation(() => {
        throw new Error('Stripe initialization failed');
      });

      // Reset the service instance to trigger re-initialization
      jest.resetModules();
      const FreshStripeService = require('../stripe-payment.service');
      
      await expect(FreshStripeService.createCustomer({ name: 'Test', email: 'test@example.com' }))
        .rejects
        .toThrow();

      // Restore mock for cleanup
      stripeConfig.getInstance.mockReturnValue(mockStripe);
    });

    it('should handle memory management in metrics', () => {
      // Fill up processing times beyond limit
      for (let i = 0; i < 1500; i++) {
        StripePaymentService.metrics.processingTimes.push(100 + i);
      }

      // This should trigger cleanup to prevent memory leaks
      const initialLength = StripePaymentService.metrics.processingTimes.length;
      
      // Simulate a successful payment to trigger metrics update
      StripePaymentService.metrics.successfulPayments++;
      
      // The cleanup should happen during normal operation
      expect(StripePaymentService.metrics.processingTimes.length).toBeLessThanOrEqual(1000);
    });
  });
});