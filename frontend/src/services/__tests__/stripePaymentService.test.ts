import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createPaymentOrder,
  createPaymentIntent,
  createOxxoPayment,
  confirmPayment,
  getPaymentStatus,
  cancelPaymentIntent,
  PaymentOrderResponse,
  PaymentIntentPayload,
  OxxoPaymentResponse,
  PaymentConfirmationResponse,
  FullApiResponse,
} from '../stripePaymentService';
import api from '../api';
import authService from '../authService';

// Mock dependencies
vi.mock('../api');
vi.mock('../authService');

// Mock the logger module
vi.mock('../../utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('stripePaymentService', () => {
  const mockApi = vi.mocked(api);
  const mockAuthService = vi.mocked(authService);

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthService.getCsrfToken.mockResolvedValue('mock-csrf-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createPaymentOrder', () => {
    it('should create payment order successfully', async () => {
      const applicationId = 'app-123';
      const mockPayload: PaymentOrderResponse = {
        success: true,
        applicationId,
        customerId: 'cus-456',
        amount: 1000,
        currency: 'MXN',
        description: 'Permiso de Circulación',
        referenceId: 'REF-123',
      };

      const mockResponse: FullApiResponse<PaymentOrderResponse> = {
        success: true,
        data: mockPayload,
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await createPaymentOrder(applicationId);

      expect(result).toEqual(mockPayload);
      expect(mockAuthService.getCsrfToken).toHaveBeenCalled();
      expect(mockApi.post).toHaveBeenCalledWith(
        `/applications/${applicationId}/payment/order`,
        {},
        {
          headers: {
            'X-CSRF-Token': 'mock-csrf-token',
          },
        }
      );
    });

    it('should handle API errors with custom message', async () => {
      const applicationId = 'app-123';
      const errorResponse = {
        response: {
          data: {
            message: 'Application not found',
          },
        },
      };

      mockApi.post.mockRejectedValue(errorResponse);

      await expect(createPaymentOrder(applicationId)).rejects.toThrow('Application not found');
    });

    it('should handle API errors without custom message', async () => {
      const applicationId = 'app-123';
      mockApi.post.mockRejectedValue(new Error('Network error'));

      await expect(createPaymentOrder(applicationId)).rejects.toThrow(
        'Error al preparar la orden de pago. Por favor, intenta de nuevo.'
      );
    });

    it('should handle CSRF token retrieval failure', async () => {
      const applicationId = 'app-123';
      mockAuthService.getCsrfToken.mockRejectedValue(new Error('CSRF unavailable'));

      await expect(createPaymentOrder(applicationId)).rejects.toThrow(
        'Error al preparar la orden de pago. Por favor, intenta de nuevo.'
      );
    });
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent successfully', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      const mockPayload: PaymentIntentPayload = {
        success: true,
        clientSecret: 'pi_secret_123',
        paymentIntentId: 'pi_123',
        customerId,
        amount: 1000,
        currency: 'MXN',
        status: 'requires_payment_method',
      };

      const mockResponse: FullApiResponse<PaymentIntentPayload> = {
        success: true,
        data: mockPayload,
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await createPaymentIntent(applicationId, customerId);

      expect(result).toEqual(mockPayload);
      expect(mockAuthService.getCsrfToken).toHaveBeenCalled();
      expect(mockApi.post).toHaveBeenCalledWith(
        `/applications/${applicationId}/payment/create-intent`,
        {
          customerId,
          paymentMethod: 'card',
        },
        {
          headers: {
            'X-CSRF-Token': 'mock-csrf-token',
          },
        }
      );
    });

    it('should handle missing clientSecret in response', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      const mockPayload = {
        success: true,
        paymentIntentId: 'pi_123',
        customerId,
        amount: 1000,
        currency: 'MXN',
        status: 'requires_payment_method',
        // Missing clientSecret
      };

      const mockResponse: FullApiResponse<any> = {
        success: true,
        data: mockPayload,
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      await expect(createPaymentIntent(applicationId, customerId)).rejects.toThrow(
        'El servidor respondió exitosamente pero la carga útil no incluyó una clave de pago (clientSecret).'
      );
    });

    it('should handle null or undefined response data', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';

      const mockResponse: FullApiResponse<any> = {
        success: true,
        data: null,
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      await expect(createPaymentIntent(applicationId, customerId)).rejects.toThrow(
        'El servidor respondió exitosamente pero la carga útil no incluyó una clave de pago (clientSecret).'
      );
    });

    it('should handle API errors with custom message', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      const errorResponse = {
        response: {
          data: {
            message: 'Invalid customer ID',
          },
        },
      };

      mockApi.post.mockRejectedValue(errorResponse);

      await expect(createPaymentIntent(applicationId, customerId)).rejects.toThrow(
        'Invalid customer ID'
      );
    });

    it('should handle network errors', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      const networkError = new Error('Network timeout');

      mockApi.post.mockRejectedValue(networkError);

      await expect(createPaymentIntent(applicationId, customerId)).rejects.toThrow(
        'Error al crear la intención de pago. Detalle: Network timeout'
      );
    });

    it('should handle errors without message', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      const errorWithoutMessage = {};

      mockApi.post.mockRejectedValue(errorWithoutMessage);

      await expect(createPaymentIntent(applicationId, customerId)).rejects.toThrow(
        'Error al crear la intención de pago. Detalle: Error desconocido.'
      );
    });
  });

  describe('createOxxoPayment', () => {
    it('should create OXXO payment successfully', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      const mockPayload: OxxoPaymentResponse = {
        success: true,
        paymentIntentId: 'pi_123',
        orderId: 'ord-789',
        status: 'requires_action',
        paymentMethod: 'oxxo',
        clientSecret: 'pi_secret_123',
        oxxoReference: '930012345678901',
        expiresAt: '2024-12-31T23:59:59.000Z',
        amount: 1000,
        hostedVoucherUrl: 'https://payments.stripe.com/oxxo/voucher/123',
      };

      const mockResponse: FullApiResponse<OxxoPaymentResponse> = {
        success: true,
        data: mockPayload,
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await createOxxoPayment(applicationId, customerId);

      expect(result).toEqual(mockPayload);
      expect(mockAuthService.getCsrfToken).toHaveBeenCalled();
      expect(mockApi.post).toHaveBeenCalledWith(
        `/applications/${applicationId}/payment/oxxo`,
        { customerId },
        {
          headers: {
            'X-CSRF-Token': 'mock-csrf-token',
          },
        }
      );
    });

    it('should handle API errors with custom message', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      const errorResponse = {
        response: {
          data: {
            message: 'OXXO service temporarily unavailable',
          },
        },
      };

      mockApi.post.mockRejectedValue(errorResponse);

      await expect(createOxxoPayment(applicationId, customerId)).rejects.toThrow(
        'OXXO service temporarily unavailable'
      );
    });

    it('should handle generic errors', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';

      mockApi.post.mockRejectedValue(new Error('Network error'));

      await expect(createOxxoPayment(applicationId, customerId)).rejects.toThrow(
        'Error al generar la referencia de pago OXXO.'
      );
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment successfully', async () => {
      const applicationId = 'app-123';
      const paymentIntentId = 'pi_123';
      const mockPayload: PaymentConfirmationResponse = {
        success: true,
        paymentIntentId,
        status: 'succeeded',
        applicationId,
        receiptUrl: 'https://example.com/receipt/123',
      };

      const mockResponse: FullApiResponse<PaymentConfirmationResponse> = {
        success: true,
        data: mockPayload,
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await confirmPayment(applicationId, paymentIntentId);

      expect(result).toEqual(mockPayload);
      expect(mockAuthService.getCsrfToken).toHaveBeenCalled();
      expect(mockApi.post).toHaveBeenCalledWith(
        `/applications/${applicationId}/payment/confirm`,
        {
          paymentIntentId,
          paymentMethod: 'card',
        },
        {
          headers: {
            'X-CSRF-Token': 'mock-csrf-token',
          },
        }
      );
    });

    it('should handle payment confirmation errors', async () => {
      const applicationId = 'app-123';
      const paymentIntentId = 'pi_123';
      const errorResponse = {
        response: {
          data: {
            message: 'Payment already confirmed',
          },
        },
      };

      mockApi.post.mockRejectedValue(errorResponse);

      await expect(confirmPayment(applicationId, paymentIntentId)).rejects.toThrow(
        'Payment already confirmed'
      );
    });

    it('should handle generic confirmation errors', async () => {
      const applicationId = 'app-123';
      const paymentIntentId = 'pi_123';

      mockApi.post.mockRejectedValue(new Error('Server error'));

      await expect(confirmPayment(applicationId, paymentIntentId)).rejects.toThrow(
        'Error al confirmar el pago. Por favor, contacta soporte.'
      );
    });
  });

  describe('getPaymentStatus', () => {
    it('should get payment status successfully', async () => {
      const applicationId = 'app-123';
      const paymentIntentId = 'pi_123';
      const mockPayload = {
        status: 'succeeded',
      };

      const mockResponse: FullApiResponse<{ status: string }> = {
        success: true,
        data: mockPayload,
      };

      mockApi.get.mockResolvedValue({ data: mockResponse });

      const result = await getPaymentStatus(applicationId, paymentIntentId);

      expect(result).toEqual(mockPayload);
      expect(mockApi.get).toHaveBeenCalledWith(
        `/applications/${applicationId}/payment/status/${paymentIntentId}`
      );
    });

    it('should get payment status with error details', async () => {
      const applicationId = 'app-123';
      const paymentIntentId = 'pi_123';
      const mockPayload = {
        status: 'failed',
        lastError: 'Your card was declined.',
      };

      const mockResponse: FullApiResponse<{ status: string; lastError: string }> = {
        success: true,
        data: mockPayload,
      };

      mockApi.get.mockResolvedValue({ data: mockResponse });

      const result = await getPaymentStatus(applicationId, paymentIntentId);

      expect(result).toEqual(mockPayload);
      expect(result.lastError).toBe('Your card was declined.');
    });

    it('should handle payment status errors', async () => {
      const applicationId = 'app-123';
      const paymentIntentId = 'pi_123';

      mockApi.get.mockRejectedValue(new Error('Payment intent not found'));

      await expect(getPaymentStatus(applicationId, paymentIntentId)).rejects.toThrow(
        'Error al obtener el estado del pago.'
      );
    });
  });

  describe('cancelPaymentIntent', () => {
    it('should cancel payment intent successfully', async () => {
      const applicationId = 'app-123';
      const paymentIntentId = 'pi_123';
      const mockPayload = {
        success: true,
      };

      const mockResponse: FullApiResponse<{ success: boolean }> = {
        success: true,
        data: mockPayload,
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await cancelPaymentIntent(applicationId, paymentIntentId);

      expect(result).toEqual(mockPayload);
      expect(mockAuthService.getCsrfToken).toHaveBeenCalled();
      expect(mockApi.post).toHaveBeenCalledWith(
        `/applications/${applicationId}/payment/cancel`,
        {
          paymentIntentId,
        },
        {
          headers: {
            'X-CSRF-Token': 'mock-csrf-token',
          },
        }
      );
    });

    it('should handle cancellation errors', async () => {
      const applicationId = 'app-123';
      const paymentIntentId = 'pi_123';

      mockApi.post.mockRejectedValue(new Error('Cannot cancel completed payment'));

      await expect(cancelPaymentIntent(applicationId, paymentIntentId)).rejects.toThrow(
        'Error al cancelar el pago.'
      );
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle malformed error responses', async () => {
      const applicationId = 'app-123';
      const errorWithoutResponse = new Error('Network timeout');
      (errorWithoutResponse as any).response = undefined;

      mockApi.post.mockRejectedValue(errorWithoutResponse);

      await expect(createPaymentOrder(applicationId)).rejects.toThrow(
        'Error al preparar la orden de pago. Por favor, intenta de nuevo.'
      );
    });

    it('should handle errors with empty response data', async () => {
      const applicationId = 'app-123';
      const errorWithEmptyResponse = {
        response: {
          data: null,
        },
      };

      mockApi.post.mockRejectedValue(errorWithEmptyResponse);

      await expect(createPaymentOrder(applicationId)).rejects.toThrow(
        'Error al preparar la orden de pago. Por favor, intenta de nuevo.'
      );
    });

    it('should handle errors with nested response structure', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      const errorWithNestedMessage = {
        response: {
          data: {
            error: {
              message: 'Deeply nested error message',
            },
          },
        },
      };

      mockApi.post.mockRejectedValue(errorWithNestedMessage);

      await expect(createPaymentIntent(applicationId, customerId)).rejects.toThrow(
        'Error al crear la intención de pago. Detalle: Error desconocido.'
      );
    });
  });

  describe('Service integration', () => {
    it('should work with different CSRF token values', async () => {
      const applicationId = 'app-123';
      const specialCsrfToken = 'special-csrf-token-12345';
      
      mockAuthService.getCsrfToken.mockResolvedValue(specialCsrfToken);

      const mockPayload: PaymentOrderResponse = {
        success: true,
        applicationId,
        customerId: 'cus-456',
        amount: 1000,
        currency: 'MXN',
        description: 'Test',
        referenceId: 'REF-123',
      };

      const mockResponse: FullApiResponse<PaymentOrderResponse> = {
        success: true,
        data: mockPayload,
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      await createPaymentOrder(applicationId);

      expect(mockApi.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        {
          headers: {
            'X-CSRF-Token': specialCsrfToken,
          },
        }
      );
    });

    it('should handle concurrent requests properly', async () => {
      const applications = ['app-1', 'app-2', 'app-3'];
      const mockPayload: PaymentOrderResponse = {
        success: true,
        applicationId: 'test',
        customerId: 'cus-456',
        amount: 1000,
        currency: 'MXN',
        description: 'Test',
        referenceId: 'REF-123',
      };

      const mockResponse: FullApiResponse<PaymentOrderResponse> = {
        success: true,
        data: mockPayload,
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const promises = applications.map(appId => createPaymentOrder(appId));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockApi.post).toHaveBeenCalledTimes(3);
      expect(mockAuthService.getCsrfToken).toHaveBeenCalledTimes(3);
    });
  });
});