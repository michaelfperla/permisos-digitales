import axios from 'axios';

import { DEFAULT_PERMIT_FEE, DEFAULT_CURRENCY } from '../constants';
import { getCsrfToken } from '../utils/csrf';
import {
  isSimulationMode,
  simulatePaymentProcess,
  SimulatedPaymentOutcome,
} from '../utils/paymentSimulation';

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
  checkoutUrl?: string;
  speiReference?: string;
  oxxoReference?: string;
  expiresAt?: number;
  barcodeUrl?: string;
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

const api = axios.create({
  baseURL: '/api/payments',
  withCredentials: true,
});

/**
 * Create payment order for application
 */
export const initiatePayment = async (
  applicationId: string,
  _simulatedOutcome?: SimulatedPaymentOutcome,
): Promise<PaymentOrderResponse> => {
  try {
    if (isSimulationMode()) {
      console.info('SIMULATION: Bypassing real payment initiation.');

      const simulatedResponse: PaymentOrderResponse = {
        success: true,
        applicationId: applicationId,
        customerId: `sim_cus_${Math.random().toString(36).substring(2, 10)}`,
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        description: 'Permiso de Circulación - Simulación',
        referenceId: `SIM-APP-${applicationId}`,
      };

      return simulatedResponse;
    }

    const csrfToken = await getCsrfToken();

    const response = await api.post<PaymentOrderResponse>(
      `/applications/${applicationId}/payment`,
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
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
 * Process card payment with Conekta
 */
export const processCardPayment = async (
  applicationId: string,
  customerId: string,
  token: string,
  deviceSessionId: string,
): Promise<PaymentMethodResponse> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.post<PaymentMethodResponse>(
      `/applications/${applicationId}/payment/card`,
      {
        customerId,
        token,
        device_session_id: deviceSessionId,
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
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
 * Process bank transfer payment (SPEI)
 */
export const processBankTransferPayment = async (
  applicationId: string,
  customerId: string,
  simulatedOutcome?: SimulatedPaymentOutcome,
): Promise<PaymentMethodResponse> => {
  try {
    if (isSimulationMode()) {
      console.info('SIMULATION: Bypassing real bank transfer payment processing.');

      const simulatedResponse: PaymentMethodResponse = {
        success: true,
        orderId: `sim_ord_${Math.random().toString(36).substring(2, 10)}`,
        status: 'pending_payment',
        paymentMethod: 'spei',
        speiReference: '646180111812345678',
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        checkoutUrl: `/checkout?order_id=sim_ord&method=spei&reference=646180111812345678`,
      };

      setTimeout(() => {
        simulatePaymentProcess(applicationId, simulatedOutcome || SimulatedPaymentOutcome.SUCCESS);
      }, 500);

      return simulatedResponse;
    }

    const csrfToken = await getCsrfToken();

    const response = await api.post<PaymentMethodResponse>(
      `/applications/${applicationId}/payment/bank-transfer`,
      {
        customerId,
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
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
 * Process OXXO cash payment
 */
export const processOxxoPayment = async (
  applicationId: string,
  customerId: string,
): Promise<PaymentMethodResponse> => {
  try {
    if (isSimulationMode()) {
      console.info('SIMULATION: Bypassing real OXXO payment processing.');

      const simulatedResponse: PaymentMethodResponse = {
        success: true,
        orderId: `sim_ord_${Math.random().toString(36).substring(2, 10)}`,
        status: 'pending_payment',
        paymentMethod: 'oxxo_cash',
        oxxoReference: '93000123456789',
        expiresAt: Math.floor(Date.now() / 1000) + 172800,
        checkoutUrl: `/checkout?order_id=sim_ord&method=oxxo&reference=93000123456789`,
      };

      return simulatedResponse;
    }

    const csrfToken = await getCsrfToken();

    const response = await axios.post<PaymentMethodResponse>(
      '/api/payments/oxxo',
      {
        customerId,
        amount: DEFAULT_PERMIT_FEE,
        description: 'Permiso de Circulación',
        referenceId: `APP-${applicationId}`,
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );

    if (response.data && 'success' in response.data && response.data.success && 'data' in response.data && response.data.data) {
      const data = response.data.data as any;
      return {
        success: true,
        orderId: data.orderId,
        status: 'pending_payment',
        paymentMethod: 'oxxo_cash',
        oxxoReference: data.oxxoReference,
        expiresAt: data.expiresAt,
        barcodeUrl: data.barcodeUrl,
        checkoutUrl: undefined,
      };
    }

    if (response.data && 'success' in response.data && response.data.success) {
      const data = response.data as any;
      return {
        success: true,
        orderId: data.orderId || `oxxo-${Date.now()}`,
        status: 'pending_payment',
        paymentMethod: 'oxxo_cash',
        oxxoReference: data.oxxoReference || '93000123456789',
        expiresAt: data.expiresAt || Math.floor(Date.now() / 1000) + 172800,
        barcodeUrl: data.barcodeUrl,
        checkoutUrl: undefined,
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
 * Check payment status for application
 */
export const checkPaymentStatus = async (
  applicationId: string,
  simulatedStatus?: string,
): Promise<PaymentStatusResponse> => {
  try {
    if (isSimulationMode()) {
      console.info('SIMULATION: Bypassing real payment status check.');

      const urlParams = new URLSearchParams(window.location.search);
      const statusFromUrl = urlParams.get('status');

      const status = simulatedStatus || statusFromUrl || 'pending_payment';

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
        updatedAt: new Date().toISOString(),
      };

      return simulatedResponse;
    }

    const response = await api.get<PaymentStatusResponse>(
      `/applications/${applicationId}/payment/status`,
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

const paymentService = {
  initiatePayment,
  processCardPayment,
  processBankTransferPayment,
  processOxxoPayment,
  checkPaymentStatus,
};

export default paymentService;
