import axios from 'axios';

import { apiInstance as api } from './api-instance';
import { ApplicationFormData } from '../types/application.types';
import { getCsrfToken, handleCsrfError } from '../utils/csrf';
import { ApplicationStatus } from '../constants/application.constants';
import { getApiBaseUrl } from '../config/api-config';
import { createLogger } from '../utils/logger';

const logger = createLogger('ApplicationService');

// Re-export ApplicationStatus for convenience
export { ApplicationStatus };

export interface Application {
  id: number;
  user_id: number;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  parent_application_id?: number;

  // Applicant data
  nombre_completo: string;
  curp_rfc: string;
  domicilio: string;

  // Vehicle data
  marca: string;
  linea: string;
  color: string;
  numero_serie: string;
  numero_motor: string;
  ano_modelo: number;

  // Permit data
  folio?: string;
  importe?: number;
  fecha_expedicion?: string;
  fecha_vencimiento?: string;
  is_renewal?: boolean;

  // Renewal data
  renewal_reason?: string;
  renewal_notes?: string;
  renewal_submitted_at?: string;
  renewal_approved_at?: string;
  renewal_rejected_at?: string;
  renewal_rejection_reason?: string;

  // Payment data
  payment_reference?: string;

  // Expiration tracking
  expires_at?: string;
  payment_initiated_at?: string;

  // File paths
  permit_file_path?: string;
  certificado_file_path?: string;
  placas_file_path?: string;
}


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
  fecha_vencimiento?: string;
  paymentVerified?: string;
  payment_verified_at?: string;
  fecha_expedicion?: string;
}

export interface ApplicationDetails {
  id: number;
  vehicleInfo: VehicleInfo;
  ownerInfo: OwnerInfo;
  dates: ApplicationDates;
  is_sample_permit?: boolean;
  paymentReference?: string;
  payment_proof_path?: string;
  payment_proof_uploaded_at?: string;
  payment_verified_at?: string;
  payment_rejection_reason?: string;
  folio?: string;
  importe?: number;
}

export interface StatusInfo {
  currentStatus: ApplicationStatus;
  lastUpdated: string;
  displayMessage: string;
  nextSteps: string;
  allowedActions: string[];
}

export interface ApplicationStatusResponse {
  application: ApplicationDetails | null;
  status?: StatusInfo;
  success: boolean;
  message?: string;
  oxxoReference?: string;
  hostedVoucherUrl?: string;
  expiresAt?: string;
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
  payment?: {
    success?: boolean;
    method?: string;
    status?: string;
    requiresAction?: boolean;
    threeDsUrl?: string;
    message?: string;
  };
  oxxo?: {
    reference: string;
    amount: number;
    currency: string;
    expiresAt: string;
    barcodeUrl?: string;
  };
  customerId?: string;
  paymentError?: boolean;
  errorCode?: string;
  details?: any;
}

export interface RenewalFormData {
  domicilio: string;
  color: string;
  renewal_reason: string;
  renewal_notes?: string;
  payment_method?: string;
  payment_token?: string;
  device_session_id?: string;
}

/**
 * Get all applications for the current user
 */
export const getApplications = async (options?: {
  signal?: AbortSignal;
}): Promise<ApplicationsResponse> => {
  const response = await api.get<ApplicationsResponse>('/applications', {
    signal: options?.signal,
  });

  logger.info('Applications response from API', { responseData: response.data });

  if (response.data.success === undefined) {
    return {
      success: true,
      applications: response.data.applications || [],
      expiringPermits: response.data.expiringPermits || [],
    };
  }

  return response.data;
};

/**
 * Get pending applications that need payment completion
 */
export const getPendingApplications = async (options?: {
  signal?: AbortSignal;
}): Promise<{ success: boolean; applications: Application[] }> => {
  try {
    const response = await api.get<{ success: boolean; applications: Application[] }>(
      '/applications/pending-payment',
      {
        signal: options?.signal,
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to fetch pending applications', {
      error: (error as any).message,
      response: (error as any).response?.data
    });
    return {
      success: false,
      applications: [],
    };
  }
};

// Lazy-initialized set for tracking non-existent permit IDs
let _nonExistentPermitIds: Set<string> | null = null;
export const getNonExistentPermitIds = () => {
  if (!_nonExistentPermitIds) {
    _nonExistentPermitIds = new Set<string>();
  }
  return _nonExistentPermitIds;
};

/**
 * Get application details and status by ID
 */
export const getApplicationById = async (
  id: string,
  options?: { signal?: AbortSignal },
): Promise<ApplicationStatusResponse> => {
  logger.info('Fetching application with ID', { id });

  try {
    const response = await api.get<ApplicationStatusResponse>(`/applications/${id}/status`, {
      signal: options?.signal,
    });

    logger.info('Application status API response received', { response: response.data });
    
    // Ensure we have the expected structure
    if (!response.data) {
      throw new Error('No data received from application status API');
    }
    
    return response.data;
  } catch (error: any) {
    logger.error('Error fetching application by ID', {
      error: (error as any).message,
      response: (error as any).response?.data,
      status: (error as any).response?.status
    });
    throw error;
  }
};

/**
 * Get application for renewal process
 */
export const getApplicationForRenewal = async (
  id: string,
  options?: { signal?: AbortSignal },
): Promise<ApplicationResponse> => {
  logger.info('Fetching application for renewal with ID', { id });

  try {
    const statusResponse = await api.get<ApplicationStatusResponse>(`/applications/${id}/status`, {
      signal: options?.signal,
    });

    if (!statusResponse.data || !statusResponse.data.application) {
      throw new Error('Application not found');
    }

    const appDetails = statusResponse.data.application;

    const application: Application = {
      id: appDetails.id,
      user_id: 0,
      status: (statusResponse.data.status?.currentStatus || 'PENDING_PAYMENT') as ApplicationStatus,
      created_at: appDetails.dates.created,
      updated_at: appDetails.dates.updated,

      nombre_completo: appDetails.ownerInfo.nombre_completo,
      curp_rfc: appDetails.ownerInfo.curp_rfc,
      domicilio: appDetails.ownerInfo.domicilio,

      marca: appDetails.vehicleInfo.marca,
      linea: appDetails.vehicleInfo.linea,
      color: appDetails.vehicleInfo.color,
      numero_serie: appDetails.vehicleInfo.numero_serie,
      numero_motor: appDetails.vehicleInfo.numero_motor,
      ano_modelo:
        typeof appDetails.vehicleInfo.ano_modelo === 'string'
          ? parseInt(appDetails.vehicleInfo.ano_modelo, 10)
          : appDetails.vehicleInfo.ano_modelo,

      fecha_expedicion: appDetails.dates.created,
      fecha_vencimiento: appDetails.dates.fecha_vencimiento || '',
    };

    return {
      success: true,
      application,
    };
  } catch (error) {
    logger.error('Failed to get application for renewal', {
      id,
      error: (error as any).message,
      response: (error as any).response?.data
    });

    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        application: {} as Application,
        message: error.response.data.message || 'Failed to get application details',
      };
    }

    return {
      success: false,
      application: {} as Application,
      message: 'Failed to get application details',
    };
  }
};

/**
 * Create a new vehicle permit application
 */
export const createApplication = async (
  applicationData: ApplicationFormData,
): Promise<ApplicationResponse> => {
  try {
    const submissionData = {
      ...applicationData,
      ano_modelo:
        typeof applicationData.ano_modelo === 'string'
          ? parseInt(applicationData.ano_modelo, 10)
          : applicationData.ano_modelo,
    };

    logger.info('Submitting application data to API', { submissionData });

    if (isNaN(submissionData.ano_modelo as number)) {
      logger.error('Invalid ano_modelo value', { anoModelo: applicationData.ano_modelo });
      return {
        success: false,
        application: {} as Application,
        message: 'El año del modelo no es válido. Por favor ingresa un año válido.',
      };
    }

    if (submissionData.payment_token) {
      logger.info('Payment token included in submission', {
        tokenPreview: submissionData.payment_token.substring(0, 8) + '...'
      });
    } else {
      logger.info('No payment token included in submission');
    }

    if (submissionData.device_session_id) {
      logger.info('Device session ID included in submission', {
        deviceSessionPreview: submissionData.device_session_id.substring(0, 8) + '...'
      });
    } else {
      logger.info('No device session ID included in submission');
    }

    logger.info('Making POST request to /applications');

    try {
      logger.info('Using API base URL', { baseUrl: getApiBaseUrl() });

      const response = await api.post<ApplicationResponse>('/applications', submissionData);

      logger.info('Application submission successful', { response: response?.data });

      // Ensure we have a valid response object to return
      if (response && response.data) {
        const responseData = response.data;

        if (responseData.payment) {
          logger.info('Payment information in response', {
            method: responseData.payment.method,
            status: responseData.payment.status,
            requiresAction: responseData.payment.requiresAction,
            threeDsUrl: responseData.payment.threeDsUrl ? 'Present' : 'Not present'
          });
        }

        if (responseData.application) {
          if (responseData.success !== undefined) {
            return responseData;
          }

          return {
            success: true,
            application: responseData.application,
            payment: responseData.payment,
            paymentInstructions: responseData.paymentInstructions,
            message: 'Solicitud creada exitosamente',
          };
        }

        if (responseData.success !== undefined) {
          return responseData;
        }

        return {
          success: true,
          application: responseData.application || ({} as Application),
          message: 'Solicitud procesada',
        };
      } else {
        return {
          success: false,
          application: {} as Application,
          message: 'La respuesta del servidor no tiene el formato esperado.',
        };
      }
    } catch (apiError) {
      if (axios.isAxiosError(apiError)) {
        logger.error('API call failed', {
          status: apiError.response?.status,
          response: apiError.response?.data
        });

        if (apiError.response?.status === 402) {
          logger.error('Payment required error', { response: apiError.response?.data });

          let errorMessage =
            'Error al procesar el pago. Por favor, verifica los datos de tu tarjeta e intenta de nuevo.';
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
            paymentError: true,
          };
        }

        if (await handleCsrfError(apiError)) {
          try {
            logger.info('Retrying request with fresh CSRF token');
            const retryResponse = await api.post<ApplicationResponse>(
              '/applications',
              submissionData,
            );

            logger.info('Retry successful', { response: retryResponse?.data });
            return retryResponse.data;
          } catch (retryError) {
            logger.error('Retry also failed', {
              error: (retryError as any).message,
              response: (retryError as any).response?.data
            });
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
            message: errorMessage,
          };
        }
      }

      // Generic error response as last resort
      return {
        success: false,
        application: {} as Application,
        message: 'Error al comunicarse con el servidor. Por favor, inténtalo de nuevo.',
      };
    }
  } catch (error) {
    logger.error('Failed to create application', {
      error: (error as any).message,
      response: (error as any).response?.data
    });

    // Provide more specific error messages based on the API response
    if (axios.isAxiosError(error) && error.response) {
      logger.info('Error response data', { responseData: error.response.data });

      // Check if this is a payment error (status 402)
      if (error.response.status === 402) {
        logger.error('Payment error', { responseData: error.response.data });

        // Extract detailed error message
        const errorMessage =
          error.response.data.message ||
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
          details,
        };
      }

      // Check if the API returned validation errors (status 400)
      if (error.response.status === 400 && error.response.data.errors) {
        const validationErrors = error.response.data.errors;
        // Check for ano_modelo specific errors
        const anoModeloError = validationErrors.find(
          (err: any) => err.param === 'ano_modelo' || err.field === 'ano_modelo',
        );

        if (anoModeloError) {
          return {
            success: false,
            application: {} as Application,
            message: anoModeloError.msg || 'Error en el año del modelo.',
          };
        }

        // Return the first validation error message
        if (validationErrors.length > 0) {
          return {
            success: false,
            application: {} as Application,
            message: validationErrors[0].msg || 'Error de validación en el formulario.',
          };
        }
      }

      // Return the error message from the API
      return {
        success: false,
        application: {} as Application,
        message:
          error.response.data.message ||
          'Error al crear la solicitud. Por favor, revisa los datos ingresados.',
      };
    }

    // Default error response for network errors
    return {
      success: false,
      application: {} as Application,
      message: 'Error de red. Por favor, verifica tu conexión e inténtalo de nuevo.',
    };
  }
};

/**
 * Update application data (only allowed in PENDING_PAYMENT status)
 */
export const updateApplication = async (
  id: string,
  applicationData: Partial<Application>,
): Promise<ApplicationResponse> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.put<ApplicationResponse>(`/applications/${id}`, applicationData, {
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });

    return response.data;
  } catch (error) {
    logger.error('Failed to update application', {
      id,
      error: (error as any).message,
      response: (error as any).response?.data
    });

    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        application: {} as Application,
        message:
          error.response.data.message || 'Failed to update application. Please try again later.',
      };
    }
    return {
      success: false,
      application: {} as Application,
      message: 'Error de red. Por favor, verifica tu conexión.',
    };
  }
};

/**
 * Submit application for review (not used in current backend flow)
 */
export const submitApplication = async (id: string): Promise<ApplicationResponse> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.post<ApplicationResponse>(
      `/applications/${id}/submit`,
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to submit application', {
      id,
      error: (error as any).message,
      response: (error as any).response?.data
    });

    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        application: {} as Application,
        message:
          error.response.data.message || 'Failed to submit application. Please try again later.',
      };
    }
    return {
      success: false,
      application: {} as Application,
      message: 'Network error. Please check your connection.',
    };
  }
};

/**
 * Upload payment proof (deprecated - payment provider integration pending)
 */
export const uploadPaymentProof = async (
  _id: string,
  _file: File,
  _paymentReference?: string,
  _options?: { signal?: AbortSignal },
): Promise<ApplicationResponse> => {
  logger.warn('Manual payment proof upload is no longer supported. Payment provider integration pending.');
  return {
    success: false,
    application: {} as Application,
    message: 'El sistema de pagos está siendo actualizado. Por favor, intente más tarde.',
  };
};

/**
 * Get a secure, temporary URL for a permit document and open it to trigger a download.
 * This is the correct method for downloading from a secure backend.
 */
export const downloadPermit = async (
  id: string,
  type: 'permiso' | 'certificado' | 'placas' | 'recomendaciones' = 'permiso',
): Promise<string> => {
  try {
    interface PdfUrlResponse { url: string; success: boolean; message?: string; }
    
    // Try the pdf-url endpoint first (preferred)
    try {
      const response = await api.get<PdfUrlResponse>(`/applications/${id}/pdf-url/${type}`);
      if (response.data?.success && response.data.url) {
        return response.data.url;
      }
      throw new Error(response.data.message || 'Could not retrieve a valid download URL.');
    } catch (pdfUrlError) {
      // If pdf-url fails, try the download endpoint as fallback
      logger.warn('pdf-url endpoint failed, trying download endpoint', { error: pdfUrlError });
      
      const response = await api.get<PdfUrlResponse>(`/applications/${id}/download/${type}`);
      if (response.data?.success && response.data.url) {
        return response.data.url;
      }
      throw new Error(response.data.message || 'Could not retrieve a valid download URL.');
    }
  } catch (error) {
    logger.error('Failed to get secure download URL', { documentType: type, applicationId: id, error });
    throw error;
  }
};

/**
 * Check permit renewal eligibility
 */
export const checkRenewalEligibility = async (
  id: string,
  options?: { signal?: AbortSignal },
): Promise<{
  eligible: boolean;
  message: string;
  daysUntilExpiration?: number;
  expirationDate?: string;
}> => {
  try {
    const response = await api.get(`/applications/${id}/renewal-eligibility`, {
      signal: options?.signal,
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to check renewal eligibility for application', {
      id,
      error: (error as any).message
    });

    return {
      eligible: false,
      message: 'Failed to check renewal eligibility. Please try again later.',
    };
  }
};

/**
 * Create renewal application for existing permit
 */
export const createRenewalApplication = async (
  id: string,
  renewalData: RenewalFormData,
  options?: { signal?: AbortSignal },
): Promise<ApplicationResponse> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.post<ApplicationResponse>(`/applications/${id}/renew`, renewalData, {
      headers: {
        'X-CSRF-Token': csrfToken,
      },
      signal: options?.signal,
    });

    if (response.data) {
      if (response.data.success === true) {
        return response.data;
      }

      if (response.data.application) {
        return {
          success: true,
          application: response.data.application,
          message: response.data.message || 'Solicitud de renovación creada exitosamente',
          payment: response.data.payment,
          paymentInstructions: response.data.paymentInstructions,
          customerId: response.data.customerId,
          oxxo: response.data.oxxo,
        };
      }
    }

    return {
      success: true,
      application: response.data?.application || ({} as Application),
      message: response.data?.message || 'Solicitud de renovación procesada',
      payment: response.data?.payment,
      paymentInstructions: response.data?.paymentInstructions,
      customerId: response.data?.customerId,
      oxxo: response.data?.oxxo,
    };
  } catch (error) {
    logger.error('Failed to create renewal for application', {
      id,
      error: (error as any).message,
      response: (error as any).response?.data
    });

    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        application: {} as Application,
        message:
          error.response.data.message ||
          'Failed to create renewal application. Please try again later.',
      };
    }
    return {
      success: false,
      application: {} as Application,
      message: 'Network error. Please check your connection.',
    };
  }
};

/**
 * Submit renewal application for review
 */
export const submitRenewalApplication = async (
  id: string,
  options?: { signal?: AbortSignal },
): Promise<ApplicationResponse> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.post<ApplicationResponse>(
      `/applications/${id}/submit-renewal`,
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        signal: options?.signal,
      },
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to submit renewal application', {
      id,
      error: (error as any).message,
      response: (error as any).response?.data
    });

    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        application: {} as Application,
        message:
          error.response.data.message ||
          'Failed to submit renewal application. Please try again later.',
      };
    }
    return {
      success: false,
      application: {} as Application,
      message: 'Network error. Please check your connection.',
    };
  }
};

/**
 * Delete application (only allowed in PENDING_PAYMENT status)
 */
export const deleteApplication = async (
  id: string,
  options?: { signal?: AbortSignal },
): Promise<{ success: boolean; message: string }> => {
  try {
    const csrfToken = await getCsrfToken();

    const response = await api.delete<{ success: boolean; message: string }>(
      `/applications/${id}`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        signal: options?.signal,
      },
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to delete application', {
      id,
      error: (error as any).message
    });

    return {
      success: false,
      message: 'Failed to delete application. Please try again later.',
    };
  }
};

/**
 * Renew application with default renewal data
 */
export const renewApplication = async (
  id: string,
  options?: { signal?: AbortSignal },
): Promise<ApplicationResponse> => {
  try {
    const csrfToken = await getCsrfToken();

    const renewalData: RenewalFormData = {
      domicilio: '',
      color: '',
      renewal_reason: 'Renovación regular',
      renewal_notes: '',
    };

    const response = await api.post<ApplicationResponse>(`/applications/${id}/renew`, renewalData, {
      headers: {
        'X-CSRF-Token': csrfToken,
      },
      signal: options?.signal,
    });

    if (response.data) {
      if (response.data.success === true) {
        return response.data;
      }

      if (response.data.application) {
        return {
          success: true,
          application: response.data.application,
          message: response.data.message || 'Solicitud de renovación creada exitosamente',
          payment: response.data.payment,
          paymentInstructions: response.data.paymentInstructions,
          customerId: response.data.customerId,
          oxxo: response.data.oxxo,
        };
      }
    }

    return {
      success: true,
      application: response.data?.application || ({} as Application),
      message: response.data?.message || 'Solicitud de renovación procesada',
      payment: response.data?.payment,
      paymentInstructions: response.data?.paymentInstructions,
      customerId: response.data?.customerId,
      oxxo: response.data?.oxxo,
    };
  } catch (error) {
    logger.error('Failed to renew application', {
      id,
      error: (error as any).message
    });

    return {
      success: false,
      application: {} as Application,
      message: 'Failed to renew application. Please try again later.',
    };
  }
};

/**
 * Get queue status for an application
 */
export const getQueueStatus = async (
  id: string | number,
  options?: { signal?: AbortSignal },
): Promise<{
  queueStatus: string | null;
  queuePosition: number | null;
  estimatedWaitMinutes: number | null;
  message: string;
  nextPollInterval?: number;
  retryAfterError?: number;
}> => {
  try {
    const response = await api.get(`/queue/status/${id}`, {
      signal: options?.signal,
    });

    // Extract data from response
    const data = response.data.data || response.data;
    
    // Add nextPollInterval and retryAfterError if provided by server
    // These fields allow server-side control of polling behavior
    return {
      ...data,
      nextPollInterval: data.nextPollInterval,
      retryAfterError: data.retryAfterError,
    };
  } catch (error) {
    logger.error('Failed to get queue status for application', {
      id,
      error: (error as any).message
    });

    // Return a default response if the queue service is not available
    return {
      queueStatus: null,
      queuePosition: null,
      estimatedWaitMinutes: null,
      message: 'Unable to retrieve queue status',
      nextPollInterval: undefined,
      retryAfterError: undefined,
    };
  }
};

// Functions are already exported individually above, no need to re-export
