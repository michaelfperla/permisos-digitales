jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../services/alert.service', () => ({
  sendAlert: jest.fn().mockResolvedValue(true)
}));

const PaymentErrorHandler = require('../payment-error-handler');
const { logger } = require('../logger');
const { sendAlert } = require('../../services/alert.service');

describe('PaymentErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleStripeError', () => {
    it('should handle card_declined error', async () => {
      const stripeError = {
        type: 'StripeCardError',
        code: 'card_declined',
        decline_code: 'generic_decline',
        message: 'Your card was declined.',
        payment_intent: { id: 'pi_123' }
      };

      const result = await PaymentErrorHandler.handleStripeError(stripeError, {
        paymentIntentId: 'pi_123',
        userId: 'user123'
      });

      expect(result).toEqual({
        success: false,
        error: 'CARD_DECLINED',
        message: 'Tu tarjeta fue rechazada. Verifica los datos o intenta con otra tarjeta.',
        userMessage: 'Tu tarjeta fue rechazada. Verifica los datos o intenta con otra tarjeta.',
        code: 'card_declined',
        declineCode: 'generic_decline',
        retryable: true
      });

      expect(logger.warn).toHaveBeenCalledWith('Stripe card declined', expect.objectContaining({
        code: 'card_declined',
        declineCode: 'generic_decline',
        paymentIntentId: 'pi_123'
      }));
    });

    it('should handle insufficient_funds decline', async () => {
      const stripeError = {
        type: 'StripeCardError',
        code: 'card_declined',
        decline_code: 'insufficient_funds',
        message: 'Your card has insufficient funds.'
      };

      const result = await PaymentErrorHandler.handleStripeError(stripeError);

      expect(result.userMessage).toBe('Fondos insuficientes en tu tarjeta. Verifica tu saldo o usa otra tarjeta.');
      expect(result.retryable).toBe(true);
    });

    it('should handle expired_card decline', async () => {
      const stripeError = {
        type: 'StripeCardError',
        code: 'card_declined',
        decline_code: 'expired_card',
        message: 'Your card has expired.'
      };

      const result = await PaymentErrorHandler.handleStripeError(stripeError);

      expect(result.userMessage).toBe('Tu tarjeta ha expirado. Actualiza tu información de pago.');
      expect(result.retryable).toBe(false);
    });

    it('should handle incorrect_cvc error', async () => {
      const stripeError = {
        type: 'StripeCardError',
        code: 'incorrect_cvc',
        message: 'Your card\'s security code is incorrect.'
      };

      const result = await PaymentErrorHandler.handleStripeError(stripeError);

      expect(result).toEqual({
        success: false,
        error: 'INCORRECT_CVC',
        message: 'El código de seguridad de tu tarjeta es incorrecto.',
        userMessage: 'El código de seguridad de tu tarjeta es incorrecto.',
        code: 'incorrect_cvc',
        retryable: true
      });
    });

    it('should handle processing_error', async () => {
      const stripeError = {
        type: 'StripeCardError',
        code: 'processing_error',
        message: 'An error occurred while processing your card.'
      };

      const result = await PaymentErrorHandler.handleStripeError(stripeError);

      expect(result.userMessage).toBe('Error procesando tu tarjeta. Intenta nuevamente en unos momentos.');
      expect(result.retryable).toBe(true);
    });

    it('should handle rate_limit error', async () => {
      const stripeError = {
        type: 'StripeRateLimitError',
        message: 'Too many requests made to the API too quickly'
      };

      const result = await PaymentErrorHandler.handleStripeError(stripeError, {
        userId: 'user123'
      });

      expect(result).toEqual({
        success: false,
        error: 'RATE_LIMIT',
        message: 'Demasiadas solicitudes. Intenta nuevamente en unos momentos.',
        userMessage: 'Demasiadas solicitudes. Intenta nuevamente en unos momentos.',
        code: 'rate_limit',
        retryable: true,
        retryAfter: 60
      });

      expect(sendAlert).toHaveBeenCalledWith({
        type: 'STRIPE_RATE_LIMIT',
        severity: 'high',
        message: 'Stripe rate limit exceeded',
        metadata: { userId: 'user123' }
      });
    });

    it('should handle api_key_expired error', async () => {
      const stripeError = {
        type: 'StripeAuthenticationError',
        message: 'Invalid API Key provided'
      };

      const result = await PaymentErrorHandler.handleStripeError(stripeError);

      expect(result).toEqual({
        success: false,
        error: 'API_ERROR',
        message: 'Error de configuración del sistema de pagos.',
        userMessage: 'Error temporal del sistema. Intenta nuevamente más tarde.',
        code: 'api_key_expired',
        retryable: false
      });

      expect(sendAlert).toHaveBeenCalledWith({
        type: 'STRIPE_AUTH_ERROR',
        severity: 'critical',
        message: 'Stripe authentication error',
        metadata: { error: 'Invalid API Key provided' }
      });
    });

    it('should handle connection_error', async () => {
      const stripeError = {
        type: 'StripeConnectionError',
        message: 'Network communication with Stripe failed'
      };

      const result = await PaymentErrorHandler.handleStripeError(stripeError);

      expect(result.error).toBe('CONNECTION_ERROR');
      expect(result.userMessage).toBe('Error de conexión. Verifica tu internet e intenta nuevamente.');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(30);
    });

    it('should handle unknown Stripe errors', async () => {
      const stripeError = {
        type: 'UnknownStripeError',
        message: 'Something went wrong'
      };

      const result = await PaymentErrorHandler.handleStripeError(stripeError, {
        paymentIntentId: 'pi_123'
      });

      expect(result.error).toBe('UNKNOWN_STRIPE_ERROR');
      expect(result.userMessage).toBe('Error inesperado del sistema de pagos. Contacta al soporte.');
      expect(result.retryable).toBe(false);

      expect(logger.error).toHaveBeenCalledWith('Unknown Stripe error', expect.objectContaining({
        error: stripeError,
        paymentIntentId: 'pi_123'
      }));
    });

    it('should handle errors without context', async () => {
      const stripeError = {
        type: 'StripeCardError',
        code: 'card_declined',
        message: 'Your card was declined.'
      };

      const result = await PaymentErrorHandler.handleStripeError(stripeError);

      expect(result.success).toBe(false);
      expect(result.error).toBe('CARD_DECLINED');
    });

    it('should handle alert service failures gracefully', async () => {
      sendAlert.mockRejectedValue(new Error('Alert service down'));
      
      const stripeError = {
        type: 'StripeRateLimitError',
        message: 'Too many requests'
      };

      const result = await PaymentErrorHandler.handleStripeError(stripeError);

      expect(result.error).toBe('RATE_LIMIT');
      expect(logger.error).toHaveBeenCalledWith('Failed to send Stripe error alert', expect.any(Object));
    });
  });

  describe('handlePaymentProcessingError', () => {
    it('should handle timeout errors', async () => {
      const error = new Error('Payment processing timeout');
      error.code = 'TIMEOUT';

      const result = await PaymentErrorHandler.handlePaymentProcessingError(error, {
        paymentIntentId: 'pi_123',
        userId: 'user123'
      });

      expect(result).toEqual({
        success: false,
        error: 'PAYMENT_TIMEOUT',
        message: 'El procesamiento del pago tardó demasiado tiempo.',
        userMessage: 'El pago está tardando más de lo esperado. Verifica tu estado de pago en unos minutos.',
        code: 'timeout',
        retryable: true,
        retryAfter: 300
      });

      expect(logger.warn).toHaveBeenCalledWith('Payment processing timeout', expect.objectContaining({
        paymentIntentId: 'pi_123',
        userId: 'user123'
      }));
    });

    it('should handle validation errors', async () => {
      const error = new Error('Invalid payment data');
      error.code = 'VALIDATION_ERROR';
      error.field = 'amount';

      const result = await PaymentErrorHandler.handlePaymentProcessingError(error);

      expect(result).toEqual({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Datos de pago inválidos.',
        userMessage: 'Los datos de pago son inválidos. Verifica la información e intenta nuevamente.',
        code: 'validation_error',
        field: 'amount',
        retryable: true
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      error.code = 'DB_ERROR';

      const result = await PaymentErrorHandler.handlePaymentProcessingError(error, {
        paymentIntentId: 'pi_123'
      });

      expect(result.error).toBe('DATABASE_ERROR');
      expect(result.userMessage).toBe('Error temporal del sistema. Intenta nuevamente más tarde.');
      expect(result.retryable).toBe(true);

      expect(sendAlert).toHaveBeenCalledWith({
        type: 'PAYMENT_DB_ERROR',
        severity: 'high',
        message: 'Database error during payment processing',
        metadata: { paymentIntentId: 'pi_123', error: 'Database connection failed' }
      });
    });

    it('should handle duplicate payment errors', async () => {
      const error = new Error('Payment already processed');
      error.code = 'DUPLICATE_PAYMENT';

      const result = await PaymentErrorHandler.handlePaymentProcessingError(error);

      expect(result.error).toBe('DUPLICATE_PAYMENT');
      expect(result.userMessage).toBe('Este pago ya fue procesado anteriormente.');
      expect(result.retryable).toBe(false);
    });

    it('should handle unknown processing errors', async () => {
      const error = new Error('Unknown error');

      const result = await PaymentErrorHandler.handlePaymentProcessingError(error, {
        userId: 'user123'
      });

      expect(result.error).toBe('PROCESSING_ERROR');
      expect(result.userMessage).toBe('Error procesando el pago. Contacta al soporte si el problema persiste.');
      expect(result.retryable).toBe(false);

      expect(logger.error).toHaveBeenCalledWith('Unknown payment processing error', expect.objectContaining({
        error: error,
        userId: 'user123'
      }));
    });
  });

  describe('handleWebhookError', () => {
    it('should handle signature verification errors', async () => {
      const error = new Error('Invalid signature');
      error.type = 'StripeSignatureVerificationError';

      const result = await PaymentErrorHandler.handleWebhookError(error, {
        eventId: 'evt_123',
        signature: 'invalid_sig'
      });

      expect(result).toEqual({
        success: false,
        error: 'WEBHOOK_SIGNATURE_ERROR',
        message: 'Error de verificación de firma del webhook.',
        code: 'signature_verification_failed',
        retryable: false
      });

      expect(logger.error).toHaveBeenCalledWith('Webhook signature verification failed', expect.objectContaining({
        eventId: 'evt_123',
        signature: 'invalid_sig'
      }));

      expect(sendAlert).toHaveBeenCalledWith({
        type: 'WEBHOOK_SIGNATURE_ERROR',
        severity: 'critical',
        message: 'Webhook signature verification failed',
        metadata: { eventId: 'evt_123', signature: 'invalid_sig' }
      });
    });

    it('should handle duplicate webhook events', async () => {
      const error = new Error('Event already processed');
      error.code = 'DUPLICATE_EVENT';

      const result = await PaymentErrorHandler.handleWebhookError(error, {
        eventId: 'evt_123'
      });

      expect(result.error).toBe('DUPLICATE_WEBHOOK');
      expect(result.message).toBe('Evento webhook ya procesado.');
      expect(result.retryable).toBe(false);

      expect(logger.info).toHaveBeenCalledWith('Duplicate webhook event ignored', expect.objectContaining({
        eventId: 'evt_123'
      }));
    });

    it('should handle webhook processing timeout', async () => {
      const error = new Error('Webhook processing timeout');
      error.code = 'TIMEOUT';

      const result = await PaymentErrorHandler.handleWebhookError(error, {
        eventId: 'evt_123',
        eventType: 'payment_intent.succeeded'
      });

      expect(result.error).toBe('WEBHOOK_TIMEOUT');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(60);

      expect(logger.warn).toHaveBeenCalledWith('Webhook processing timeout', expect.objectContaining({
        eventId: 'evt_123',
        eventType: 'payment_intent.succeeded'
      }));
    });

    it('should handle webhook validation errors', async () => {
      const error = new Error('Invalid webhook data');
      error.code = 'VALIDATION_ERROR';

      const result = await PaymentErrorHandler.handleWebhookError(error);

      expect(result.error).toBe('WEBHOOK_VALIDATION_ERROR');
      expect(result.message).toBe('Datos del webhook inválidos.');
      expect(result.retryable).toBe(false);
    });

    it('should handle unknown webhook errors', async () => {
      const error = new Error('Unknown webhook error');

      const result = await PaymentErrorHandler.handleWebhookError(error, {
        eventId: 'evt_123'
      });

      expect(result.error).toBe('WEBHOOK_ERROR');
      expect(result.message).toBe('Error procesando webhook.');
      expect(result.retryable).toBe(true);

      expect(logger.error).toHaveBeenCalledWith('Unknown webhook error', expect.objectContaining({
        error: error,
        eventId: 'evt_123'
      }));
    });
  });

  describe('getRetryStrategy', () => {
    it('should return immediate retry for retryable errors', () => {
      const strategy = PaymentErrorHandler.getRetryStrategy('CARD_DECLINED', 1);

      expect(strategy).toEqual({
        shouldRetry: true,
        delay: 1000, // 1 second
        maxRetries: 3
      });
    });

    it('should return exponential backoff for processing errors', () => {
      const strategy = PaymentErrorHandler.getRetryStrategy('PROCESSING_ERROR', 2);

      expect(strategy).toEqual({
        shouldRetry: true,
        delay: 4000, // 2^2 * 1000
        maxRetries: 3
      });
    });

    it('should return longer delay for rate limit errors', () => {
      const strategy = PaymentErrorHandler.getRetryStrategy('RATE_LIMIT', 1);

      expect(strategy).toEqual({
        shouldRetry: true,
        delay: 60000, // 1 minute
        maxRetries: 2
      });
    });

    it('should return no retry for non-retryable errors', () => {
      const strategy = PaymentErrorHandler.getRetryStrategy('API_ERROR', 1);

      expect(strategy).toEqual({
        shouldRetry: false,
        delay: 0,
        maxRetries: 0
      });
    });

    it('should return no retry when max attempts exceeded', () => {
      const strategy = PaymentErrorHandler.getRetryStrategy('CARD_DECLINED', 4);

      expect(strategy).toEqual({
        shouldRetry: false,
        delay: 0,
        maxRetries: 3
      });
    });

    it('should handle unknown error types', () => {
      const strategy = PaymentErrorHandler.getRetryStrategy('UNKNOWN_ERROR', 1);

      expect(strategy).toEqual({
        shouldRetry: false,
        delay: 0,
        maxRetries: 0
      });
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      const retryableErrors = [
        'CARD_DECLINED',
        'PROCESSING_ERROR',
        'CONNECTION_ERROR',
        'RATE_LIMIT',
        'PAYMENT_TIMEOUT'
      ];

      retryableErrors.forEach(error => {
        expect(PaymentErrorHandler.isRetryableError(error)).toBe(true);
      });
    });

    it('should identify non-retryable errors', () => {
      const nonRetryableErrors = [
        'API_ERROR',
        'DUPLICATE_PAYMENT',
        'WEBHOOK_SIGNATURE_ERROR',
        'EXPIRED_CARD'
      ];

      nonRetryableErrors.forEach(error => {
        expect(PaymentErrorHandler.isRetryableError(error)).toBe(false);
      });
    });

    it('should default to non-retryable for unknown errors', () => {
      expect(PaymentErrorHandler.isRetryableError('UNKNOWN_ERROR')).toBe(false);
    });
  });

  describe('formatErrorForUser', () => {
    it('should format error with user-friendly message', () => {
      const errorResult = {
        error: 'CARD_DECLINED',
        message: 'Tu tarjeta fue rechazada.',
        userMessage: 'Tu tarjeta fue rechazada. Verifica los datos.',
        code: 'card_declined',
        retryable: true
      };

      const formatted = PaymentErrorHandler.formatErrorForUser(errorResult);

      expect(formatted).toEqual({
        success: false,
        error: {
          type: 'CARD_DECLINED',
          message: 'Tu tarjeta fue rechazada. Verifica los datos.',
          code: 'card_declined',
          retryable: true
        }
      });
    });

    it('should include retry information when available', () => {
      const errorResult = {
        error: 'RATE_LIMIT',
        userMessage: 'Demasiadas solicitudes.',
        retryable: true,
        retryAfter: 60
      };

      const formatted = PaymentErrorHandler.formatErrorForUser(errorResult);

      expect(formatted.error.retryAfter).toBe(60);
    });

    it('should handle errors without user message', () => {
      const errorResult = {
        error: 'UNKNOWN_ERROR',
        message: 'Internal error'
      };

      const formatted = PaymentErrorHandler.formatErrorForUser(errorResult);

      expect(formatted.error.message).toBe('Internal error');
    });
  });
});