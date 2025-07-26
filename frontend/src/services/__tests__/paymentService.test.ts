import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import paymentService, {
  initiatePayment,
  processCardPayment,
  processOxxoPayment,
  checkPaymentStatus,
  PaymentOrderResponse,
  PaymentMethodResponse,
  PaymentStatusResponse,
} from '../paymentService';
import { DEFAULT_PERMIT_FEE, DEFAULT_CURRENCY } from '../../constants';
import * as csrfUtils from '../../utils/csrf';
import * as paymentSimulation from '../../utils/paymentSimulation';

// Mock dependencies
vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));
vi.mock('../api', () => ({
  default: {
    defaults: {
      baseURL: '',
      withCredentials: true,
      headers: {},
    },
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('../../utils/csrf');
vi.mock('../../utils/paymentSimulation');

// Mock the logger module
vi.mock('../../utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('paymentService', () => {
  const mockPost = vi.fn();
  const mockGet = vi.fn();
  
  const mockGetCsrfToken = vi.mocked(csrfUtils.getCsrfToken);
  const mockIsSimulationMode = vi.mocked(paymentSimulation.isSimulationMode);
  const mockAxios = vi.mocked(axios);

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock axios methods used for creating payment API instances
    mockAxios.create.mockReturnValue({
      post: mockPost,
      get: mockGet,
      defaults: {},
    } as any);
    mockAxios.isAxiosError.mockReturnValue(false);
    
    // Mock CSRF token
    mockGetCsrfToken.mockResolvedValue('mock-csrf-token');
    
    // Mock simulation mode (disabled by default)
    mockIsSimulationMode.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initiatePayment', () => {
    it('should initiate payment successfully', async () => {
      const applicationId = 'app-123';
      const mockResponse: PaymentOrderResponse = {
        success: true,
        applicationId,
        customerId: 'cus-456',
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        description: 'Permiso de Circulación',
        referenceId: 'REF-123',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await initiatePayment(applicationId);

      expect(result).toEqual(mockResponse);
      expect(mockGetCsrfToken).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(
        `/applications/${applicationId}/payment/order`,
        {},
        {
          headers: {
            'X-CSRF-Token': 'mock-csrf-token',
          },
        }
      );
    });

    it('should handle simulation mode', async () => {
      const applicationId = 'app-123';
      mockIsSimulationMode.mockReturnValue(true);

      const result = await initiatePayment(applicationId);

      expect(result.success).toBe(true);
      expect(result.applicationId).toBe(applicationId);
      expect(result.amount).toBe(DEFAULT_PERMIT_FEE);
      expect(result.currency).toBe(DEFAULT_CURRENCY);
      expect(result.description).toBe('Permiso de Circulación - Simulación');
      expect(result.referenceId).toMatch(/^SIM-APP-/);
      expect(result.customerId).toMatch(/^sim_cus_/);

      // Should not make HTTP requests in simulation mode
      expect(mockPost).not.toHaveBeenCalled();
      expect(mockGetCsrfToken).not.toHaveBeenCalled();
    });

    it('should handle API errors with error response', async () => {
      const applicationId = 'app-123';
      const errorResponse = {
        response: {
          data: {
            message: 'Application not found',
          },
        },
      };

      mockPost.mockRejectedValue(errorResponse);
      mockAxios.isAxiosError.mockReturnValue(true);

      await expect(initiatePayment(applicationId)).rejects.toThrow('Application not found');
    });

    it('should handle network errors', async () => {
      const applicationId = 'app-123';
      mockPost.mockRejectedValue(new Error('Network error'));
      mockAxios.isAxiosError.mockReturnValue(false);

      await expect(initiatePayment(applicationId)).rejects.toThrow(
        'Error al iniciar el pago. Por favor intente de nuevo.'
      );
    });

    it('should handle API errors without message', async () => {
      const applicationId = 'app-123';
      const errorResponse = {
        response: {
          data: {},
        },
      };

      mockPost.mockRejectedValue(errorResponse);
      mockAxios.isAxiosError.mockReturnValue(true);

      await expect(initiatePayment(applicationId)).rejects.toThrow('Error al iniciar el pago');
    });
  });

  describe('processCardPayment', () => {
    it('should process card payment successfully', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      const token = 'card-token';
      const deviceSessionId = 'device-session-123';

      const mockResponse: PaymentMethodResponse = {
        success: true,
        orderId: 'ord-789',
        status: 'completed',
        paymentMethod: 'card',
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        checkoutUrl: 'https://checkout.example.com',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await processCardPayment(applicationId, customerId, token, deviceSessionId);

      expect(result).toEqual(mockResponse);
      expect(mockGetCsrfToken).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(
        `/applications/${applicationId}/payment/card`,
        {
          customerId,
          token,
          device_session_id: deviceSessionId,
        },
        {
          headers: {
            'X-CSRF-Token': 'mock-csrf-token',
          },
        }
      );
    });

    it('should handle card payment errors with error response', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      const token = 'card-token';
      const deviceSessionId = 'device-session-123';

      const errorResponse = {
        response: {
          data: {
            message: 'Invalid card token',
          },
        },
      };

      mockPost.mockRejectedValue(errorResponse);
      mockAxios.isAxiosError.mockReturnValue(true);

      await expect(
        processCardPayment(applicationId, customerId, token, deviceSessionId)
      ).rejects.toThrow('Invalid card token');
    });

    it('should handle card payment network errors', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      const token = 'card-token';
      const deviceSessionId = 'device-session-123';

      mockPost.mockRejectedValue(new Error('Network error'));
      mockAxios.isAxiosError.mockReturnValue(false);

      await expect(
        processCardPayment(applicationId, customerId, token, deviceSessionId)
      ).rejects.toThrow('Error al procesar el pago con tarjeta. Por favor intente de nuevo.');
    });
  });

  describe('processOxxoPayment', () => {
    it('should process OXXO payment successfully with data wrapper', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';

      const mockResponse = {
        success: true,
        data: {
          orderId: 'ord-789',
          amount: DEFAULT_PERMIT_FEE,
          currency: DEFAULT_CURRENCY,
          oxxoReference: '930012345678901',
          expiresAt: '2024-12-31T23:59:59.000Z',
          barcodeUrl: 'https://example.com/barcode.png',
        },
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await processOxxoPayment(applicationId, customerId);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('ord-789');
      expect(result.status).toBe('pending_payment');
      expect(result.paymentMethod).toBe('oxxo_cash');
      expect(result.amount).toBe(DEFAULT_PERMIT_FEE);
      expect(result.oxxoReference).toBe('930012345678901');
      expect(result.barcodeUrl).toBe('https://example.com/barcode.png');
    });

    it('should process OXXO payment successfully with direct response', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';

      const mockResponse: PaymentMethodResponse = {
        success: true,
        orderId: 'ord-789',
        status: 'pending_payment',
        paymentMethod: 'oxxo_cash',
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        oxxoReference: '930012345678901',
        expiresAt: '2024-12-31T23:59:59.000Z',
        barcodeUrl: 'https://example.com/barcode.png',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await processOxxoPayment(applicationId, customerId);

      expect(result).toEqual(mockResponse);
    });

    it('should handle simulation mode for OXXO payment', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';
      mockIsSimulationMode.mockReturnValue(true);

      const result = await processOxxoPayment(applicationId, customerId);

      expect(result.success).toBe(true);
      expect(result.paymentMethod).toBe('oxxo_cash');
      expect(result.status).toBe('pending_payment');
      expect(result.amount).toBe(DEFAULT_PERMIT_FEE);
      expect(result.oxxoReference).toMatch(/^9300/);
      expect(result.oxxoReference).toHaveLength(13);
      expect(result.checkoutUrl).toMatch(/^\/checkout/);

      // Should not make HTTP requests in simulation mode
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should handle missing OXXO reference error', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';

      const mockResponse = {
        success: true,
        orderId: 'ord-789',
        status: 'pending_payment',
        paymentMethod: 'oxxo_cash',
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        // Missing oxxoReference
        barcodeUrl: 'https://example.com/barcode.png',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      await expect(processOxxoPayment(applicationId, customerId)).rejects.toThrow(
        'El servidor no generó una referencia OXXO válida.'
      );
    });

    it('should handle missing barcode URL error', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';

      const mockResponse = {
        success: true,
        orderId: 'ord-789',
        status: 'pending_payment',
        paymentMethod: 'oxxo_cash',
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        oxxoReference: '930012345678901',
        // Missing barcodeUrl
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      await expect(processOxxoPayment(applicationId, customerId)).rejects.toThrow(
        'El servidor no generó un código de barras válido.'
      );
    });

    it('should handle OXXO payment errors', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';

      const errorResponse = {
        response: {
          data: {
            message: 'OXXO service unavailable',
          },
        },
      };

      mockPost.mockRejectedValue(errorResponse);
      mockAxios.isAxiosError.mockReturnValue(true);

      await expect(processOxxoPayment(applicationId, customerId)).rejects.toThrow(
        'OXXO service unavailable'
      );
    });
  });

  describe('checkPaymentStatus', () => {
    it('should check payment status successfully', async () => {
      const applicationId = 'app-123';
      const mockResponse: PaymentStatusResponse = {
        success: true,
        orderId: 'ord-789',
        paymentId: 'pay-123',
        status: 'paid',
        applicationStatus: 'PAYMENT_RECEIVED',
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        paymentMethod: 'card',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T01:00:00.000Z',
      };

      mockGet.mockResolvedValue({ data: mockResponse });

      const result = await checkPaymentStatus(applicationId);

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith(
        `/applications/${applicationId}/payment/status`
      );
    });

    it('should handle simulation mode with status mapping', async () => {
      const applicationId = 'app-123';
      mockIsSimulationMode.mockReturnValue(true);

      // Test different status mappings
      const testCases = [
        { simulatedStatus: 'paid', expectedAppStatus: 'PAYMENT_RECEIVED' },
        { simulatedStatus: 'pending', expectedAppStatus: 'PAYMENT_PENDING' },
        { simulatedStatus: 'pending_payment', expectedAppStatus: 'PAYMENT_PENDING' },
        { simulatedStatus: 'failed', expectedAppStatus: 'PAYMENT_FAILED' },
        { simulatedStatus: 'declined', expectedAppStatus: 'PAYMENT_FAILED' },
        { simulatedStatus: 'unknown', expectedAppStatus: 'PAYMENT_PENDING' },
      ];

      for (const { simulatedStatus, expectedAppStatus } of testCases) {
        const result = await checkPaymentStatus(applicationId, simulatedStatus);

        expect(result.success).toBe(true);
        expect(result.status).toBe(simulatedStatus);
        expect(result.applicationStatus).toBe(expectedAppStatus);
        expect(result.amount).toBe(DEFAULT_PERMIT_FEE);
        expect(result.currency).toBe(DEFAULT_CURRENCY);
        expect(result.paymentMethod).toBe('oxxo_cash');
      }

      // Should not make HTTP requests in simulation mode
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('should handle URL parameters in simulation mode', async () => {
      const applicationId = 'app-123';
      mockIsSimulationMode.mockReturnValue(true);

      // Mock window.location.search
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, search: '?status=paid' };

      const result = await checkPaymentStatus(applicationId);

      expect(result.status).toBe('paid');
      expect(result.applicationStatus).toBe('PAYMENT_RECEIVED');

      // Restore window.location
      window.location = originalLocation;
    });

    it('should handle payment status check errors', async () => {
      const applicationId = 'app-123';

      const errorResponse = {
        response: {
          data: {
            message: 'Payment not found',
          },
        },
      };

      mockGet.mockRejectedValue(errorResponse);
      mockAxios.isAxiosError.mockReturnValue(true);

      await expect(checkPaymentStatus(applicationId)).rejects.toThrow('Payment not found');
    });

    it('should handle network errors for payment status', async () => {
      const applicationId = 'app-123';

      mockGet.mockRejectedValue(new Error('Network error'));
      mockAxios.isAxiosError.mockReturnValue(false);

      await expect(checkPaymentStatus(applicationId)).rejects.toThrow(
        'Error al verificar el estado del pago. Por favor intente de nuevo.'
      );
    });
  });

  describe('paymentService object', () => {
    it('should export all payment methods', () => {
      expect(paymentService).toHaveProperty('initiatePayment');
      expect(paymentService).toHaveProperty('processCardPayment');
      expect(paymentService).toHaveProperty('processOxxoPayment');
      expect(paymentService).toHaveProperty('checkPaymentStatus');

      expect(typeof paymentService.initiatePayment).toBe('function');
      expect(typeof paymentService.processCardPayment).toBe('function');
      expect(typeof paymentService.processOxxoPayment).toBe('function');
      expect(typeof paymentService.checkPaymentStatus).toBe('function');
    });

    it('should have consistent API configuration', async () => {
      // Mock successful initiation to trigger API creation
      mockPost.mockResolvedValue({ data: { success: true } });
      
      try {
        await initiatePayment('test-app');
      } catch (e) {
        // Ignore errors, we just want to trigger API creation
      }
      
      // Verify paymentApi was configured correctly (api.defaults includes headers)
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: '/api/payments',
        withCredentials: true,
        headers: {},
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle CSRF token retrieval failure', async () => {
      const applicationId = 'app-123';
      mockGetCsrfToken.mockRejectedValue(new Error('CSRF token unavailable'));

      await expect(initiatePayment(applicationId)).rejects.toThrow('CSRF token unavailable');
    });

    it('should handle empty application ID', async () => {
      const applicationId = '';
      const mockResponse: PaymentOrderResponse = {
        success: true,
        applicationId,
        customerId: 'cus-456',
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        description: 'Permiso de Circulación',
        referenceId: 'REF-123',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await initiatePayment(applicationId);
      expect(result.applicationId).toBe('');
    });

    it('should handle malformed OXXO response structure', async () => {
      const applicationId = 'app-123';
      const customerId = 'cus-456';

      // Mock response with unexpected structure
      const mockResponse = {
        unexpected: 'structure',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await processOxxoPayment(applicationId, customerId);
      expect(result).toEqual(mockResponse);
    });
  });
});