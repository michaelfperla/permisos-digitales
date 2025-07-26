import { logger } from './logger';
import { getApiBaseUrl, getIsDevelopment } from '../config/api-config';

let csrfToken: string | null = null;
let tokenExpiryTime: number | null = null;
const TOKEN_LIFETIME_MS = 50 * 60 * 1000; // 50 minutes

/**
 * Get CSRF token for secure requests, with caching and auto-refresh
 */
export const getCsrfToken = async (forceRefresh = false): Promise<string> => {
  const now = Date.now();

  if (csrfToken && tokenExpiryTime && now < tokenExpiryTime && !forceRefresh) {
    return csrfToken;
  }

  try {
    if (getIsDevelopment()) {
      logger.info('Fetching fresh CSRF token from server');
    }

    const csrfEndpoint = getIsDevelopment()
      ? '/auth/csrf-token'
      : `${getApiBaseUrl()}/auth/csrf-token`;

    if (getIsDevelopment()) {
      logger.info('Fetching CSRF token from:', csrfEndpoint);
    }

    // Use native fetch to avoid any circular dependencies
    const response = await fetch(csrfEndpoint, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const responseData = await response.json();

    if (responseData && responseData.data && responseData.data.csrfToken) {
      csrfToken = responseData.data.csrfToken;
    } else if (responseData && responseData.csrfToken) {
      csrfToken = responseData.csrfToken;
    } else {
      logger.error('Invalid CSRF token response structure:', responseData);
      throw new Error('Invalid CSRF token response structure');
    }

    tokenExpiryTime = now + TOKEN_LIFETIME_MS;

    return csrfToken || '';
  } catch (error) {
    logger.error('Failed to fetch CSRF token:', error);

    if (getIsDevelopment()) {
      logger.error('CSRF token fetch failed in development. Please ensure the backend server is running and the /auth/csrf-token endpoint is accessible.');
      logger.error('This is a security-by-design requirement - no fallback tokens are provided.');
    }

    // No fallback tokens - always throw the error to maintain security
    throw new Error(`CSRF token unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Add CSRF token interceptor to axios instance for mutating requests
 */
export const addCsrfTokenInterceptor = (axiosInstance: any) => {
  axiosInstance.interceptors.request.use(
    async (config: any) => {
      if (
        config.method &&
        ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())
      ) {
        try {
          const token = await getCsrfToken();
          if (config.headers) {
            config.headers['X-CSRF-Token'] = token;
          } else {
            config.headers = { 'X-CSRF-Token': token };
          }
        } catch (error) {
          logger.error('Error adding CSRF token to request:', error);
          if (getIsDevelopment()) {
            logger.error('Request will proceed without CSRF token, which may cause server-side validation failures.');
          }
          // Don't throw here - let the request proceed and fail at the server level
          // This allows for better error handling and user feedback
        }
      }
      return config;
    },
    (error: any) => {
      return Promise.reject(error);
    },
  );
};

/**
 * Handle CSRF token errors by refreshing the token
 */
export const handleCsrfError = async (error: any): Promise<boolean> => {
  const isCsrfError =
    error.response &&
    (error.response.status === 403 || error.response.status === 419) &&
    (error.response.data?.message?.includes('CSRF') ||
      error.response.data?.error?.includes('CSRF') ||
      error.response.statusText?.includes('CSRF'));

  if (isCsrfError) {
    if (getIsDevelopment()) {
      logger.warn('CSRF token validation failed. Refreshing token...');
    }
    try {
      await getCsrfToken(true);
      return true;
    } catch (refreshError) {
      logger.error('Failed to refresh CSRF token:', refreshError);
      return false;
    }
  }

  return false;
};
