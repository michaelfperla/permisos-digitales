import axios from 'axios';
import { getCsrfToken } from '../utils/csrf';
import {
  isSimulationMode,
  simulatePaymentProcess,
  SimulatedPaymentOutcome
} from '../utils/paymentSimulation';
import { DEFAULT_PERMIT_FEE, DEFAULT_CURRENCY } from '../constants';

// Define types for payment API responses
export interface PaymentOrderResponse {
  success: boolean;
  applicationId: string;
  customerId: string;
  amount: number;
  currency: string;
  description: string;
  referenceId: string;
  message?: string;
}

export interface PaymentMethodResponse {
  success: boolean;
  orderId: string;
  status: string;
  paymentMethod: string;
  checkoutUrl?: string; // URL for redirect to Conekta checkout
  speiReference?: string; // For bank transfers
  oxxoReference?: string; // For OXXO payments
  expiresAt?: number; // Expiration timestamp for OXXO/SPEI
  message?: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  orderId: string;
  paymentId: string;
  status: string;
  applicationStatus: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  message?: string;
}

// Create axios instance with base URL
const api = axios.create({
  baseURL: '/api/payments',
  withCredentials: true
});

/**
 * Initiate a payment for an application
 * This creates a payment order in Conekta and returns the order details
 * @param applicationId The ID of the application to pay for
 * @param simulatedOutcome Optional parameter to specify the simulated outcome (only used in simulation mode)
 * @returns Payment order details including customerId needed for payment methods
 */
export const initiatePayment = async (
  applicationId: string,
  simulatedOutcome?: SimulatedPaymentOutcome
): Promise<PaymentOrderResponse> => {
  try {
    // Check if we're in simulation mode
    if (isSimulationMode()) {
      console.log('SIMULATION: Bypassing real payment initiation.');

      // Create a simulated response
      const simulatedResponse: PaymentOrderResponse = {
        success: true,
        applicationId: applicationId,
        customerId: `sim_cus_${Math.random().toString(36).substring(2, 10)}`,
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        description: 'Permiso de Circulación - Simulación',
        referenceId: `SIM-APP-${applicationId}`
      };

      return simulatedResponse;
    }

    // Real implementation for production
    const csrfToken = getCsrfToken();

    const response = await api.post<PaymentOrderResponse>(
      `/applications/${applicationId}/payment`,
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Failed to initiate payment:', error);

    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Error al iniciar el pago');
    }

    throw new Error('Error al iniciar el pago. Por favor intente de nuevo.');
  }
};

/**
 * Process a card payment
 * @param applicationId The ID of the application
 * @param customerId The Conekta customer ID
 * @param token The Conekta card token
 * @param deviceSessionId The Conekta device session ID for fraud prevention
 * @returns Payment result with direct success/failure status
 */
export const processCardPayment = async (
  applicationId: string,
  customerId: string,
  token: string,
  deviceSessionId: string
): Promise<PaymentMethodResponse> => {
  try {
    const csrfToken = getCsrfToken();

    const response = await api.post<PaymentMethodResponse>(
      `/applications/${applicationId}/payment/card`,
      {
        customerId,
        token,
        device_session_id: deviceSessionId
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Failed to process card payment:', error);

    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Error al procesar el pago con tarjeta');
    }

    throw new Error('Error al procesar el pago con tarjeta. Por favor intente de nuevo.');
  }
};

/**
 * Process a bank transfer payment (SPEI)
 * @param applicationId The ID of the application
 * @param customerId The Conekta customer ID
 * @param simulatedOutcome Optional parameter to specify the simulated outcome (only used in simulation mode)
 * @returns Payment result with SPEI details
 */
export const processBankTransferPayment = async (
  applicationId: string,
  customerId: string,
  simulatedOutcome?: SimulatedPaymentOutcome
): Promise<PaymentMethodResponse> => {
  try {
    // Check if we're in simulation mode
    if (isSimulationMode()) {
      console.log('SIMULATION: Bypassing real bank transfer payment processing.');

      // Create a simulated response
      const simulatedResponse: PaymentMethodResponse = {
        success: true,
        orderId: `sim_ord_${Math.random().toString(36).substring(2, 10)}`,
        status: 'pending_payment',
        paymentMethod: 'spei',
        speiReference: '646180111812345678',
        expiresAt: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
        checkoutUrl: `/checkout?order_id=sim_ord&method=spei&reference=646180111812345678`
      };

      // Simulate the payment process with the specified outcome or a random one
      setTimeout(() => {
        simulatePaymentProcess(
          applicationId,
          simulatedOutcome || SimulatedPaymentOutcome.SUCCESS
        );
      }, 500); // Short delay before redirect

      return simulatedResponse;
    }

    // Real implementation for production
    const csrfToken = getCsrfToken();

    const response = await api.post<PaymentMethodResponse>(
      `/applications/${applicationId}/payment/bank-transfer`,
      {
        customerId
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Failed to process bank transfer payment:', error);

    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Error al procesar el pago por transferencia');
    }

    throw new Error('Error al procesar el pago por transferencia. Por favor intente de nuevo.');
  }
};

/**
 * Process an OXXO cash payment
 * @param applicationId The ID of the application
 * @param customerId The Conekta customer ID
 * @returns Payment result with OXXO reference
 */
export const processOxxoPayment = async (
  applicationId: string,
  customerId: string
): Promise<PaymentMethodResponse> => {
  try {
    // Check if we're in simulation mode
    if (isSimulationMode()) {
      console.log('SIMULATION: Bypassing real OXXO payment processing.');

      // Create a simulated response
      const simulatedResponse: PaymentMethodResponse = {
        success: true,
        orderId: `sim_ord_${Math.random().toString(36).substring(2, 10)}`,
        status: 'pending_payment',
        paymentMethod: 'oxxo_cash',
        oxxoReference: '93000123456789',
        expiresAt: Math.floor(Date.now() / 1000) + 172800, // 48 hours from now
        checkoutUrl: `/checkout?order_id=sim_ord&method=oxxo&reference=93000123456789`
      };

      return simulatedResponse;
    }

    const csrfToken = getCsrfToken();

    // Use the new OXXO payment endpoint
    const response = await axios.post<PaymentMethodResponse>(
      '/api/payments/oxxo',
      {
        customerId,
        amount: DEFAULT_PERMIT_FEE,
        description: 'Permiso de Circulación',
        referenceId: `APP-${applicationId}`
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      }
    );

    // Extract the OXXO payment details from the response
    if (response.data && response.data.success && response.data.data) {
      return {
        success: true,
        orderId: response.data.data.orderId,
        status: 'pending_payment',
        paymentMethod: 'oxxo_cash',
        oxxoReference: response.data.data.oxxoReference,
        expiresAt: response.data.data.expiresAt,
        barcodeUrl: response.data.data.barcodeUrl,
        checkoutUrl: null
      };
    }

    // If we don't have the expected data structure, return a generic success response
    if (response.data && response.data.success) {
      return {
        success: true,
        orderId: response.data.orderId || `oxxo-${Date.now()}`,
        status: 'pending_payment',
        paymentMethod: 'oxxo_cash',
        oxxoReference: response.data.oxxoReference || '93000123456789',
        expiresAt: response.data.expiresAt || Math.floor(Date.now() / 1000) + 172800,
        barcodeUrl: response.data.barcodeUrl,
        checkoutUrl: null
      };
    }

    return response.data;
  } catch (error) {
    console.error('Failed to process OXXO payment:', error);

    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Error al procesar el pago en OXXO');
    }

    throw new Error('Error al procesar el pago en OXXO. Por favor intente de nuevo.');
  }
};

/**
 * Check payment status
 * @param applicationId The ID of the application
 * @param simulatedStatus Optional parameter to specify the simulated status (only used in simulation mode)
 * @returns Payment status details
 */
export const checkPaymentStatus = async (
  applicationId: string,
  simulatedStatus?: string
): Promise<PaymentStatusResponse> => {
  try {
    // Check if we're in simulation mode
    if (isSimulationMode()) {
      console.log('SIMULATION: Bypassing real payment status check.');

      // Get status from URL if available
      const urlParams = new URLSearchParams(window.location.search);
      const statusFromUrl = urlParams.get('status');

      // Determine the status to use
      const status = simulatedStatus || statusFromUrl || 'pending_payment';

      // Map the status to an application status
      let applicationStatus;
      switch (status) {
        case 'paid':
          applicationStatus = 'PAYMENT_RECEIVED';
          break;
        case 'pending':
        case 'pending_payment':
          applicationStatus = 'PAYMENT_PENDING';
          break;
        case 'failed':
        case 'declined':
          applicationStatus = 'PAYMENT_FAILED';
          break;
        default:
          applicationStatus = 'PAYMENT_PENDING';
      }

      // Create a simulated response
      const simulatedResponse: PaymentStatusResponse = {
        success: true,
        orderId: `sim_ord_${Math.random().toString(36).substring(2, 10)}`,
        paymentId: `sim_pay_${Math.random().toString(36).substring(2, 10)}`,
        status: status,
        applicationStatus: applicationStatus,
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        paymentMethod: 'spei',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return simulatedResponse;
    }

    // Real implementation for production
    const response = await api.get<PaymentStatusResponse>(
      `/applications/${applicationId}/payment/status`
    );

    return response.data;
  } catch (error) {
    console.error('Failed to check payment status:', error);

    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Error al verificar el estado del pago');
    }

    throw new Error('Error al verificar el estado del pago. Por favor intente de nuevo.');
  }
};

// Export all functions as default object
const paymentService = {
  initiatePayment,
  processCardPayment,
  processBankTransferPayment,
  processOxxoPayment,
  checkPaymentStatus
};

export default paymentService;
