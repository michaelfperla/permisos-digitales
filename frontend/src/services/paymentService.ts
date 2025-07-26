// --- REPLACEMENT CODE for paymentService.ts ---

import axios from 'axios';

import { apiInstance as api } from './api-instance';
import { DEFAULT_PERMIT_FEE, DEFAULT_CURRENCY } from '../constants';
import { getCsrfToken } from '../utils/csrf';
import {
  isSimulationMode,
  simulatePaymentProcess,
  SimulatedPaymentOutcome,
} from '../utils/paymentSimulation';
import { createLogger } from '../utils/logger';

const logger = createLogger('PaymentService');

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
  amount: number;
  currency: string;
  checkoutUrl?: string;
  oxxoReference?: string;
  expiresAt?: string; // This should be an ISO Date String
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

// Create payment-specific API instance factory function
const createPaymentApi = () => {
  return axios.create({
    // No baseURL - use full paths for each endpoint
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    withCredentials: true,
  });
};

/**
 * Create payment order for application
 */
export const initiatePayment = async (
  applicationId: string,
  _simulatedOutcome?: SimulatedPaymentOutcome,
): Promise<PaymentOrderResponse> => {
  try {
    if (isSimulationMode()) {
      logger.info('SIMULATION: Bypassing real payment initiation.');

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
    const paymentApi = createPaymentApi();

    const response = await paymentApi.post<PaymentOrderResponse>(
      `/applications/${applicationId}/payment/order`,
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to initiate payment', {
      error: (error as any).message,
      response: (error as any).response?.data
    });

    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Error al iniciar el pago');
    }

    throw new Error('Error al iniciar el pago. Por favor intente de nuevo.');
  }
};

/**
 * Process card payment with Stripe
 */
export const processCardPayment = async (
  applicationId: string,
  customerId: string,
  token: string,
  deviceSessionId: string,
): Promise<PaymentMethodResponse> => {
  try {
    const csrfToken = await getCsrfToken();
    const paymentApi = createPaymentApi();

    const response = await paymentApi.post<PaymentMethodResponse>(
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
    logger.error('Failed to process card payment', {
      error: (error as any).message,
      response: (error as any).response?.data
    });

    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Error al procesar el pago con tarjeta');
    }

    throw new Error('Error al procesar el pago con tarjeta. Por favor intente de nuevo.');
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
      logger.info('SIMULATION: Bypassing real OXXO payment processing.');

      const simulatedReference = `9300${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;

      const simulatedResponse: PaymentMethodResponse = {
        success: true,
        orderId: `sim_ord_${Math.random().toString(36).substring(2, 10)}`,
        status: 'pending_payment',
        paymentMethod: 'oxxo_cash',
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        oxxoReference: simulatedReference,
        expiresAt: new Date(Date.now() + 172800 * 1000).toISOString(),
        checkoutUrl: `/checkout?order_id=sim_ord&method=oxxo&reference=${simulatedReference}`,
      };

      return simulatedResponse;
    }

    const csrfToken = await getCsrfToken();
    const paymentApi = createPaymentApi();

    const response = await paymentApi.post<PaymentMethodResponse>(
      `/applications/${applicationId}/payment/oxxo`,
      {
        customerId,
        device_session_id: undefined, // Add if needed
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );

    // Handle ApiResponse format
    if (response.data && response.data.success) {
      const data = response.data;
      
      if (!data.oxxoReference) {
        throw new Error('El servidor no generó una referencia OXXO válida.');
      }

      return {
        success: true,
        orderId: data.orderId,
        status: data.status || 'pending_payment',
        paymentMethod: 'oxxo_cash',
        amount: data.amount || DEFAULT_PERMIT_FEE,
        currency: data.currency || DEFAULT_CURRENCY,
        oxxoReference: data.oxxoReference,
        expiresAt: data.expiresAt,
        barcodeUrl: data.barcodeUrl || (data as any).hostedVoucherUrl, // Fall back to hostedVoucherUrl
        checkoutUrl: undefined,
      };
    }

    return response.data;
  } catch (error) {
    logger.error('Failed to process OXXO payment', {
      error: (error as any).message,
      response: (error as any).response?.data
    });
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
      logger.info('SIMULATION: Bypassing real payment status check.');
      const urlParams = new URLSearchParams(window.location.search);
      const statusFromUrl = urlParams.get('status');
      const status = simulatedStatus || statusFromUrl || 'pending_payment';
      let applicationStatus;
      switch (status) {
        case 'paid': applicationStatus = 'PAYMENT_RECEIVED'; break;
        case 'pending': case 'pending_payment': applicationStatus = 'PAYMENT_PENDING'; break;
        case 'failed': case 'declined': applicationStatus = 'PAYMENT_FAILED'; break;
        default: applicationStatus = 'PAYMENT_PENDING';
      }
      const simulatedResponse: PaymentStatusResponse = {
        success: true,
        orderId: `sim_ord_${Math.random().toString(36).substring(2, 10)}`,
        paymentId: `sim_pay_${Math.random().toString(36).substring(2, 10)}`,
        status: status,
        applicationStatus: applicationStatus,
        amount: DEFAULT_PERMIT_FEE,
        currency: DEFAULT_CURRENCY,
        paymentMethod: 'oxxo_cash',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return simulatedResponse;
    }
    
    const paymentApi = createPaymentApi();
    const response = await paymentApi.get<PaymentStatusResponse>(
      `/applications/${applicationId}/payment/status`,
    );
    return response.data;
  } catch (error) {
    logger.error('Failed to check payment status', {
      error: (error as any).message,
      response: (error as any).response?.data
    });
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Error al verificar el estado del pago');
    }
    throw new Error('Error al verificar el estado del pago. Por favor intente de nuevo.');
  }
};

// Functions are already exported individually above, no need to re-export