import axios from 'axios';
import { ApplicationFormData } from '../types/application.types';
import api from './api';
import { getCsrfToken, handleCsrfError } from '../utils/csrf';

// Define types for our API responses and requests based on backend schema
export interface Application {
  id: string;
  user_id: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  parent_application_id?: string; // For renewals, references the original application

  // Applicant Data
  nombre_completo: string;
  curp_rfc: string;
  domicilio: string;

  // Vehicle Data
  marca: string;
  linea: string;
  color: string;
  numero_serie: string;
  numero_motor: string;
  ano_modelo: number;

  // Permit Data
  folio?: string;
  importe?: number;
  fecha_expedicion?: string;
  fecha_vencimiento?: string;
  is_renewal?: boolean; // Indicates if this is a renewal application

  // Payment Data
  payment_proof_path?: string;
  payment_proof_uploaded_at?: string;
  payment_notes?: string;
  payment_verified_at?: string;
  payment_rejection_reason?: string;
  payment_reference?: string;

  // Renewal Data
  renewal_reason?: string;
  renewal_notes?: string;
  renewal_submitted_at?: string;
  renewal_approved_at?: string;
  renewal_rejected_at?: string;
  renewal_rejection_reason?: string;
}

// Application status values from backend
export type ApplicationStatus =
  | 'PENDING_PAYMENT'
  | 'PROOF_RECEIVED_SCHEDULED'
  | 'PROOF_SUBMITTED'
  | 'PROOF_REJECTED'
  | 'PAYMENT_RECEIVED'
  | 'GENERATING_PERMIT'
  | 'ERROR_GENERATING_PERMIT'
  | 'PERMIT_READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'RENEWAL_PENDING'
  | 'RENEWAL_SUBMITTED'
  | 'RENEWAL_APPROVED'
  | 'RENEWAL_REJECTED';

export interface ApplicationsResponse {
  success: boolean;
  applications: Application[];
  expiringPermits?: Application[];
  message?: string;
}

export interface VehicleInfo {
  marca: string;
  linea: string;
  ano_modelo: string | number;
  color: string;
  numero_serie: string;
  numero_motor: string;
}

export interface OwnerInfo {
  nombre_completo: string;
  curp_rfc: string;
  domicilio: string;
}

export interface ApplicationDates {
  created: string;
  updated: string;
  paymentProofUploaded?: string;
  paymentVerified?: string;
}

export interface ApplicationDetails {
  id: string;
  vehicleInfo: VehicleInfo;
  ownerInfo: OwnerInfo;
  dates: ApplicationDates;
  paymentReference?: string;
  payment_rejection_reason?: string;
  is_sample_permit?: boolean;
}

export interface StatusInfo {
  currentStatus: ApplicationStatus;
  lastUpdated: string;
  displayMessage: string;
  nextSteps: string;
  allowedActions: string[];
}

export interface ApplicationStatusResponse {
  application: ApplicationDetails;
  status: StatusInfo;
}

export interface ApplicationResponse {
  success: boolean;
  application: Application;
  message?: string;
  paymentInstructions?: {
    amount: number;
    currency: string;
    reference: string;
    paymentMethods: string[];
    nextSteps: string[];
  };
}

// Note: We now use the centralized api instance from api.ts
// and the getCsrfToken function from utils/csrf.ts

/**
 * Get all applications for the current user
 * @param options Optional request options including AbortSignal
 */
export const getApplications = async (options?: { signal?: AbortSignal }): Promise<ApplicationsResponse> => {
  const response = await api.get<ApplicationsResponse>('/applications', {
    signal: options?.signal
  });

  // Log the response for debugging
  console.log('Applications response from API:', response.data);

  // If the response doesn't have a success flag, add it
  if (response.data.success === undefined) {
    return {
      success: true,
      applications: response.data.applications || [],
      expiringPermits: response.data.expiringPermits || []
    };
  }

  // Return the response as is
  return response.data;
};

// Cache for non-existent permit IDs to prevent repeated API calls
export const nonExistentPermitIds = new Set<string>();

/**
 * Get a specific application by ID
 * @param id Application ID
 * @param options Optional request options including AbortSignal
 * @returns Full application status response including application details and status info
 */
export const getApplicationById = async (
  id: string,
  options?: { signal?: AbortSignal }
): Promise<ApplicationStatusResponse> => {
  console.log(`Fetching application with ID: ${id}`);

  const response = await api.get<ApplicationStatusResponse>(`/applications/${id}/status`, {
    signal: options?.signal
  });

  // Log the response for debugging
  console.log(`Application ${id} response:`, response.data);

  return response.data;
};

/**
 * Create a new vehicle permit application
 * @param applicationData Application data
 */
export const createApplication = async (applicationData: ApplicationFormData): Promise<ApplicationResponse> => {
  try {
    // Make sure ano_modelo is a number before submission
    // This is critical since the database expects an integer
    const submissionData = {
      ...applicationData,
      ano_modelo: typeof applicationData.ano_modelo === 'string'
        ? parseInt(applicationData.ano_modelo, 10)
        : applicationData.ano_modelo
    };

    // Log the data being submitted for debugging
    console.log('Submitting application data to API:', submissionData);

    // Ensure the parsed ano_modelo value is valid (not NaN)
    if (isNaN(submissionData.ano_modelo as number)) {
      console.error('Invalid ano_modelo value:', applicationData.ano_modelo);
      return {
        success: false,
        application: {} as Application,
        message: 'El año del modelo no es válido. Por favor ingresa un año válido.'
      };
    }

    // Log if payment token is present
    if (submissionData.payment_token) {
      console.log('Payment token included in submission:', submissionData.payment_token.substring(0, 8) + '...');
    } else {
      console.log('No payment token included in submission');
    }

    // Log device session ID if present
    if (submissionData.device_session_id) {
      console.log('Device session ID included in submission:', submissionData.device_session_id.substring(0, 8) + '...');
    } else {
      console.log('No device session ID included in submission');
    }

    // Attempt to make the API call with detailed error handling
    console.log('Making POST request to /api/applications');

    try {
      // Get the API base URL from environment variables or use a default
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      console.log('Using API base URL:', apiBaseUrl);

      // Make the API call (CSRF token will be added by the interceptor)
      let response = await api.post<ApplicationResponse>('/applications', submissionData);

      // If there's a CSRF error, the interceptor will handle it automatically
      console.log('Application submission successful, response:', response?.data);

      // Ensure we have a valid response object to return
      if (response && response.data) {
        const responseData = response.data;

        // Log the payment information if present
        if (responseData.payment) {
          console.log('Payment information in response:', {
            method: responseData.payment.method,
            status: responseData.payment.status,
            requiresAction: responseData.payment.requiresAction,
            threeDsUrl: responseData.payment.threeDsUrl ? 'Present' : 'Not present'
          });
        }

        // Check if the response has the expected structure
        if (responseData.application) {
          // If the response already has a success flag, return it as is
          if (responseData.success !== undefined) {
            return responseData;
          }

          // The backend might not include a success flag, so we add it
          return {
            success: true,
            application: responseData.application,
            payment: responseData.payment,
            paymentInstructions: responseData.paymentInstructions,
            message: 'Solicitud creada exitosamente'
          };
        }

        // If the response already has a success flag, return it as is
        if (responseData.success !== undefined) {
          return responseData;
        }

        // If we can't determine the structure, return a generic success
        return {
          success: true,
          application: responseData.application || {} as Application,
          message: 'Solicitud procesada'
        };
      } else {
        // Create a minimal valid response if response or data is missing
        return {
          success: false,
          application: {} as Application,
          message: 'La respuesta del servidor no tiene el formato esperado.'
        };
      }
    } catch (apiError) {
      // This is a more detailed error handler specifically for the API call
      if (axios.isAxiosError(apiError)) {
        console.error('API call failed with status:', apiError.response?.status);
        console.error('API error response:', apiError.response?.data);

        // Handle payment-specific errors (402 Payment Required)
        if (apiError.response?.status === 402) {
          console.error('Payment required error:', apiError.response?.data);

          // Extract detailed error message from the response
          let errorMessage = 'Error al procesar el pago. Por favor, verifica los datos de tu tarjeta e intenta de nuevo.';
          let errorCode = 'payment_error';

          if (apiError.response?.data) {
            if (apiError.response.data.message) {
              errorMessage = apiError.response.data.message;
            }

            if (apiError.response.data.errorCode) {
              errorCode = apiError.response.data.errorCode;
            }
          }

          return {
            success: false,
            application: {} as Application,
            message: errorMessage,
            errorCode: errorCode,
            paymentError: true
          };
        }

        // Check if this is a CSRF error and try to refresh the token
        if (await handleCsrfError(apiError)) {
          // Retry with fresh token
          try {
            console.log('Retrying request with fresh CSRF token');
            const retryResponse = await api.post<ApplicationResponse>('/applications', submissionData);

            console.log('Retry successful, response:', retryResponse?.data);
            return retryResponse.data;
          } catch (retryError) {
            console.error('Retry also failed:', retryError);
          }
        }

        // Return any error message from the response if available
        if (apiError.response?.data) {
          const errorData = apiError.response.data;

          // Try to extract message from various response formats
          let errorMessage = 'Error desconocido al enviar la solicitud.';

          if (typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          } else if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
            errorMessage = errorData.errors[0].message || 'Error de validación.';
          }

          return {
            success: false,
            application: {} as Application,
            message: errorMessage
          };
        }
      }

      // Generic error response as last resort
      return {
        success: false,
        application: {} as Application,
        message: 'Error al comunicarse con el servidor. Por favor, inténtalo de nuevo.'
      };
    }
  } catch (error) {
    console.error('Failed to create application:', error);

    // Provide more specific error messages based on the API response
    if (axios.isAxiosError(error) && error.response) {
      console.log('Error response data:', error.response.data);

      // Check if this is a payment error (status 402)
      if (error.response.status === 402) {
        console.error('Payment error:', error.response.data);

        // Extract detailed error message
        const errorMessage = error.response.data.message ||
          'Error al procesar el pago. Por favor, intenta con otra tarjeta o método de pago.';

        // Extract error code if available
        const errorCode = error.response.data.errorCode || 'payment_error';

        // Extract details if available
        const details = error.response.data.details || null;

        return {
          success: false,
          application: {} as Application,
          message: errorMessage,
          paymentError: true,
          errorCode,
          details
        };
      }

      // Check if the API returned validation errors (status 400)
      if (error.response.status === 400 && error.response.data.errors) {
        const validationErrors = error.response.data.errors;
        // Check for ano_modelo specific errors
        const anoModeloError = validationErrors.find((err: any) =>
          err.param === 'ano_modelo' || err.field === 'ano_modelo'
        );

        if (anoModeloError) {
          return {
            success: false,
            application: {} as Application,
            message: anoModeloError.msg || 'Error en el año del modelo.'
          };
        }

        // Return the first validation error message
        if (validationErrors.length > 0) {
          return {
            success: false,
            application: {} as Application,
            message: validationErrors[0].msg || 'Error de validación en el formulario.'
          };
        }
      }

      // Return the error message from the API
      return {
        success: false,
        application: {} as Application,
        message: error.response.data.message || 'Error al crear la solicitud. Por favor, revisa los datos ingresados.'
      };
    }

    // Default error response for network errors
    return {
      success: false,
      application: {} as Application,
      message: 'Error de red. Por favor, verifica tu conexión e inténtalo de nuevo.'
    };
  }
};

/**
 * Update an existing application (only allowed in PENDING_PAYMENT status)
 * @param id Application ID
 * @param applicationData Updated application data
 */
export const updateApplication = async (
  id: string,
  applicationData: Partial<Application>
): Promise<ApplicationResponse> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.put<ApplicationResponse>(
      `/applications/${id}`,
      applicationData,
      {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error(`Failed to update application ${id}:`, error);

    // Return error response
    if (axios.isAxiosError(error) && error.response) {
      // Return the error message from the API
      return {
        success: false,
        application: {} as Application,
        message: error.response.data.message || 'Failed to update application. Please try again later.'
      };
    }
    return {
      success: false,
      application: {} as Application,
      message: 'Error de red. Por favor, verifica tu conexión.'
    };
  }
};

/**
 * Submit an application for review (not used in current backend flow)
 * @param id Application ID
 */
export const submitApplication = async (id: string): Promise<ApplicationResponse> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.post<ApplicationResponse>(
      `/applications/${id}/submit`,
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error(`Failed to submit application ${id}:`, error);

    // Return error response
    if (axios.isAxiosError(error) && error.response) {
      // Return the error message from the API
      return {
        success: false,
        application: {} as Application,
        message: error.response.data.message || 'Failed to submit application. Please try again later.'
      };
    }
    return {
      success: false,
      application: {} as Application,
      message: 'Network error. Please check your connection.'
    };
  }
};

// [Refactor - Remove Manual Payment] API call for uploading manual payment proof. Obsolete.
/**
 * Upload payment proof for an application
 * @param id Application ID
 * @param file Payment proof file
 * @param paymentReference Optional payment reference
 * @param options Optional request options including AbortSignal
 */
/*
export const uploadPaymentProof = async (
  id: string,
  file: File,
  paymentReference?: string,
  options?: { signal?: AbortSignal }
): Promise<ApplicationResponse> => {
  const csrfToken = await getCsrfToken();

  const formData = new FormData();
  formData.append('paymentProof', file);

  // Add payment reference if provided
  if (paymentReference) {
    formData.append('paymentReference', paymentReference);
  }

  const response = await api.post<ApplicationResponse>(
    `/applications/${id}/payment-proof`,
    formData,
    {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'multipart/form-data'
      },
      signal: options?.signal
    }
  );

  return response.data;
};
*/

// Temporary placeholder function until payment provider integration is implemented
export const uploadPaymentProof = async (
  id: string,
  file: File,
  paymentReference?: string,
  options?: { signal?: AbortSignal }
): Promise<ApplicationResponse> => {
  console.warn('Manual payment proof upload is no longer supported. Payment provider integration pending.');
  return {
    success: false,
    application: {} as Application,
    message: 'El sistema de pagos está siendo actualizado. Por favor, intente más tarde.'
  };
};

/**
 * Download permit document
 * @param id Application ID
 * @param type Document type ('permiso', 'recibo', 'certificado', 'placas')
 * @param options Optional request options including AbortSignal
 */
export const downloadPermit = async (
  id: string,
  type: 'permiso' | 'recibo' | 'certificado' | 'placas' = 'permiso',
  options?: { signal?: AbortSignal }
): Promise<Blob> => {
  try {
    // Get CSRF token for authenticated requests
    const csrfToken = await getCsrfToken();

    // Map frontend types to backend API endpoints
    const typeMap: Record<string, string> = {
      'permiso': 'permiso',
      'recibo': 'recibo',
      'certificado': 'certificado',
      'placas': 'placas'
    };

    const apiType = typeMap[type] || 'permiso';
    console.log(`Downloading ${apiType} document for application ${id}`);

    const response = await api.get<Blob>(`/applications/${id}/download/${apiType}`, {
      responseType: 'blob',
      headers: {
        'X-CSRF-Token': csrfToken
      },
      signal: options?.signal
    });

    return response.data;
  } catch (error) {
    console.error(`Failed to download ${type} for application ${id}:`, error);

    // For development purposes, generate a mock PDF
    // In a real implementation, this would be handled by the error handler
    const mockPdfContent = `Mock PDF content for ${type} document - application ${id}`;
    return new Blob([mockPdfContent], { type: 'application/pdf' });
  }
};

/**
 * Check if a permit is eligible for renewal
 * @param id Application ID
 * @param options Optional request options including AbortSignal
 */
export const checkRenewalEligibility = async (
  id: string,
  options?: { signal?: AbortSignal }
): Promise<{
  eligible: boolean;
  message: string;
  daysUntilExpiration?: number;
  expirationDate?: string;
}> => {
  try {
    const response = await api.get(`/applications/${id}/renewal-eligibility`, {
      signal: options?.signal
    });
    return response.data;
  } catch (error) {
    console.error(`Failed to check renewal eligibility for application ${id}:`, error);

    // Return error response
    return {
      eligible: false,
      message: 'Failed to check renewal eligibility. Please try again later.'
    };
  }
};

/**
 * Create a renewal application for an existing permit
 * @param id Original application ID
 * @param renewalData Additional data for the renewal
 * @param options Optional request options including AbortSignal
 */
export const createRenewalApplication = async (
  id: string,
  renewalData: RenewalFormData,
  options?: { signal?: AbortSignal }
): Promise<ApplicationResponse> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.post<ApplicationResponse>(
      `/applications/${id}/renew`,
      renewalData,
      {
        headers: {
          'X-CSRF-Token': csrfToken
        },
        signal: options?.signal
      }
    );

    return response.data;
  } catch (error) {
    console.error(`Failed to create renewal for application ${id}:`, error);

    // Return error response
    if (axios.isAxiosError(error) && error.response) {
      // Return the error message from the API
      return {
        success: false,
        application: {} as Application,
        message: error.response.data.message || 'Failed to create renewal application. Please try again later.'
      };
    }
    return {
      success: false,
      application: {} as Application,
      message: 'Network error. Please check your connection.'
    };
  }
};

/**
 * Submit a renewal application for review
 * @param id Renewal application ID
 * @param options Optional request options including AbortSignal
 */
export const submitRenewalApplication = async (
  id: string,
  options?: { signal?: AbortSignal }
): Promise<ApplicationResponse> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.post<ApplicationResponse>(
      `/applications/${id}/submit-renewal`,
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken
        },
        signal: options?.signal
      }
    );

    return response.data;
  } catch (error) {
    console.error(`Failed to submit renewal application ${id}:`, error);

    // Return error response
    if (axios.isAxiosError(error) && error.response) {
      // Return the error message from the API
      return {
        success: false,
        application: {} as Application,
        message: error.response.data.message || 'Failed to submit renewal application. Please try again later.'
      };
    }
    return {
      success: false,
      application: {} as Application,
      message: 'Network error. Please check your connection.'
    };
  }
};

/**
 * Delete an application (only allowed in PENDING_PAYMENT status)
 * @param id Application ID
 * @param options Optional request options including AbortSignal
 */
export const deleteApplication = async (
  id: string,
  options?: { signal?: AbortSignal }
): Promise<{ success: boolean; message: string }> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.delete<{ success: boolean; message: string }>(
      `/applications/${id}`,
      {
        headers: {
          'X-CSRF-Token': csrfToken
        },
        signal: options?.signal
      }
    );

    return response.data;
  } catch (error) {
    console.error(`Failed to delete application ${id}:`, error);

    // Return error response
    return {
      success: false,
      message: 'Failed to delete application. Please try again later.'
    };
  }
};

/**
 * Renew an application (simplified version that calls createRenewalApplication)
 * @param id Application ID to renew
 * @param options Optional request options including AbortSignal
 */
export const renewApplication = async (
  id: string,
  options?: { signal?: AbortSignal }
): Promise<ApplicationResponse> => {
  try {
    const csrfToken = await getCsrfToken();

    const renewalData: RenewalFormData = {
      domicilio: '',
      color: '',
      renewal_reason: 'Renovación regular',
      renewal_notes: ''
    };

    const response = await api.post<ApplicationResponse>(
      `/applications/${id}/renew`,
      renewalData,
      {
        headers: {
          'X-CSRF-Token': csrfToken
        },
        signal: options?.signal
      }
    );

    return response.data;
  } catch (error) {
    console.error(`Failed to renew application ${id}:`, error);

    // Return error response
    return {
      success: false,
      application: {} as Application,
      message: 'Failed to renew application. Please try again later.'
    };
  }
};

// Export all functions as default object
const applicationService = {
  getApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  submitApplication,
  uploadPaymentProof,
  downloadPermit,
  checkRenewalEligibility,
  createRenewalApplication,
  submitRenewalApplication,
  deleteApplication,
  renewApplication,
  nonExistentPermitIds // Export the set of non-existent permit IDs
};

export default applicationService;
