// frontend/src/services/stripePaymentService.ts
import { apiInstance as api } from './api-instance';
import { getCsrfToken } from '../utils/csrf';
import { createLogger } from '../utils/logger';

const logger = createLogger('StripePaymentService');

// This interface describes the actual payload INSIDE the 'data' wrapper from the server
export interface PaymentIntentPayload {
  success: boolean;
  clientSecret: string;
  paymentIntentId: string;
  customerId: string;
  amount: number | string;
  currency: string;
  status: string;
}

export interface FullApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface PaymentOrderResponse {
  success: boolean;
  applicationId: string;
  customerId: string;
  amount: number;
  currency: string;
  description: string;
  referenceId: string;
}

export interface PaymentConfirmationResponse {
  success: boolean;
  paymentIntentId: string;
  status: string;
  applicationId: string;
  receiptUrl?: string;
}

export interface OxxoPaymentResponse {
    success: boolean;
    paymentIntentId: string;
    orderId: string;
    status: string;
    paymentMethod: 'oxxo';
    clientSecret: string;
    oxxoReference: string;
    expiresAt: string;
    amount: number;
    hostedVoucherUrl?: string;
}

// Re-export for use in components
export type OxxoPaymentDetails = OxxoPaymentResponse;

/**
 * Create a payment order to get the Stripe Customer ID
 */
export const createPaymentOrder = async (
  applicationId: string,
): Promise<PaymentOrderResponse> => {
  try {
    const csrfToken = await getCsrfToken();
    logger.info('Creating payment order for application', { applicationId });
    
    const response = await api.post<FullApiResponse<PaymentOrderResponse>>(
      `/applications/${applicationId}/payment/order`,
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );
    
    logger.info('Payment order API response received', {
      responseData: response.data,
      responseDataType: typeof response.data,
      responseDataKeys: response.data ? Object.keys(response.data) : null
    });
    
    // Handle both nested and direct response structures
    if (response.data && response.data.data) {
      logger.debug('Using nested response structure');
      return response.data.data;
    } else if (response.data && typeof response.data === 'object') {
      logger.debug('Using direct response structure');
      // Check if it looks like a PaymentOrderResponse
      const data = response.data as any;
      if (data.customerId && data.applicationId) {
        return {
          success: true,
          ...data
        } as PaymentOrderResponse;
      }
    }
    
    throw new Error('Unexpected response format from payment order API');
  } catch (error: any) {
    logger.error('Failed to create payment order', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.response?.status === 400) {
      logger.error('Bad Request - Response data', { responseData: error.response.data });
      // Check for specific error messages
      if (error.response.data?.error?.includes('already has a payment')) {
        throw new Error('Esta solicitud ya tiene un pago en proceso. Por favor, verifica el estado de tu solicitud.');
      }
    }
    
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error('Error al preparar la orden de pago. Por favor, intenta de nuevo.');
  }
};

/**
 * Create a payment intent for card payments
 */
export const createPaymentIntent = async (
  applicationId: string,
  customerId: string,
): Promise<PaymentIntentPayload> => {
  try {
    const csrfToken = await getCsrfToken();
    const response = await api.post<FullApiResponse<PaymentIntentPayload>>(
      `/applications/${applicationId}/payment/create-intent`,
      {
        customerId,
        paymentMethod: 'card',
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );
    const responsePayload = response.data.data; 
    logger.info('Received payment intent response payload', { responsePayload });
    if (!responsePayload || !responsePayload.clientSecret) {
        throw new Error('El servidor respondió exitosamente pero la carga útil no incluyó una clave de pago (clientSecret).');
    }
    return responsePayload;
  } catch (error: any) {
    logger.error('Failed to create payment intent', {
      error: error.message,
      response: error.response?.data
    });
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    const detail = error.message || 'Error desconocido.';
    throw new Error(`Error al crear la intención de pago. Detalle: ${detail}`);
  }
};

/**
 * Create an OXXO payment reference
 */
export const createOxxoPayment = async (
  applicationId: string,
  customerId: string,
): Promise<OxxoPaymentResponse> => {
  try {
    const csrfToken = await getCsrfToken();
    const response = await api.post<FullApiResponse<OxxoPaymentResponse>>(
        `/applications/${applicationId}/payment/oxxo`,
        { customerId },
        {
            headers: {
                'X-CSRF-Token': csrfToken,
            },
        }
    );
    // ========================================================================
    // === THE FINAL FIX IS HERE (Part 1) ===
    // Return the clean data payload directly from the server. No more custom objects.
    // ========================================================================
    return response.data.data;
  } catch (error: any) {
    logger.error('Failed to create OXXO payment', {
      error: error.message,
      response: error.response?.data
    });
    if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
    }
    throw new Error('Error al generar la referencia de pago OXXO.');
  }
};


/**
 * Confirm a successful payment
 */
export const confirmPayment = async (
  applicationId: string,
  paymentIntentId: string,
): Promise<PaymentConfirmationResponse> => {
  try {
    const csrfToken = await getCsrfToken();
    const response = await api.post<FullApiResponse<PaymentConfirmationResponse>>(
      `/applications/${applicationId}/payment/confirm`,
      {
        paymentIntentId,
        paymentMethod: 'card',
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );
    return response.data.data;
  } catch (error: any) {
    logger.error('Failed to confirm payment', {
      error: error.message,
      response: error.response?.data
    });
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error('Error al confirmar el pago. Por favor, contacta soporte.');
  }
};

/**
 * Get payment status
 */
export const getPaymentStatus = async (
  applicationId: string,
  paymentIntentId: string,
): Promise<{ status: string; lastError?: string }> => {
  try {
    const response = await api.get<FullApiResponse<{ status: string; lastError?: string }>>(
      `/applications/${applicationId}/payment/status/${paymentIntentId}`,
    );
    return response.data.data;
  } catch (error: any) {
    logger.error('Failed to get payment status', {
      error: error.message,
      response: error.response?.data
    });
    throw new Error('Error al obtener el estado del pago.');
  }
};

/**
 * Cancel a payment intent
 */
export const cancelPaymentIntent = async (
  applicationId: string,
  paymentIntentId: string,
): Promise<{ success: boolean }> => {
  try {
    const csrfToken = await getCsrfToken();
    const response = await api.post<FullApiResponse<{ success: boolean }>>(
      `/applications/${applicationId}/payment/cancel`,
      {
        paymentIntentId,
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );
    return response.data.data;
  } catch (error: any) {
    logger.error('Failed to cancel payment intent', {
      error: error.message,
      response: error.response?.data
    });
    throw new Error('Error al cancelar el pago.');
  }
};