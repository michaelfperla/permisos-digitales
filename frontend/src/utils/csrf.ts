import axios from 'axios';

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
    if (import.meta.env.DEV) {
      console.info('Fetching fresh CSRF token from server');
    }

    const isDevelopment = import.meta.env.DEV;
    const csrfEndpoint = isDevelopment
      ? '/auth/csrf-token'
      : `${import.meta.env.VITE_API_URL || ''}/auth/csrf-token`;

    if (import.meta.env.DEV) {
      console.info('Fetching CSRF token from:', csrfEndpoint);
    }

    const response = await axios.get<any>(csrfEndpoint, {
      withCredentials: true,
    });

    if (response.data && response.data.data && response.data.data.csrfToken) {
      csrfToken = response.data.data.csrfToken;
    } else if (response.data && response.data.csrfToken) {
      csrfToken = response.data.csrfToken;
    } else {
      console.error('Invalid CSRF token response structure:', response.data);
      throw new Error('Invalid CSRF token response structure');
    }

    tokenExpiryTime = now + TOKEN_LIFETIME_MS;

    return csrfToken || '';
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);

    if (import.meta.env.DEV) {
      console.warn('Using fallback CSRF token in development mode');
      csrfToken = 'dummy-csrf-token-for-development';
      tokenExpiryTime = now + TOKEN_LIFETIME_MS;
      return csrfToken;
    }

    throw error;
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
          console.error('Error adding CSRF token to request:', error);
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
    if (import.meta.env.DEV) {
      console.warn('CSRF token validation failed. Refreshing token...');
    }
    try {
      await getCsrfToken(true);
      return true;
    } catch (refreshError) {
      console.error('Failed to refresh CSRF token:', refreshError);
      return false;
    }
  }

  return false;
};
