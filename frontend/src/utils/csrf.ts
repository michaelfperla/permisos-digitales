import axios from 'axios';

// Store CSRF token
let csrfToken: string | null = null;
let tokenExpiryTime: number | null = null;
const TOKEN_LIFETIME_MS = 50 * 60 * 1000; // 50 minutes (less than the server's 1 hour)

/**
 * Get CSRF token for secure requests
 * @param forceRefresh Force refresh the token even if we have a cached one
 * @returns Promise resolving to CSRF token
 */
export const getCsrfToken = async (forceRefresh = false): Promise<string> => {
  const now = Date.now();

  // If we have a token and it's not expired and we're not forcing a refresh, return it
  if (csrfToken && tokenExpiryTime && now < tokenExpiryTime && !forceRefresh) {
    return csrfToken;
  }

  try {
    console.info('Fetching fresh CSRF token from server');

    // In development, use the Vite proxy which forwards requests to the backend
    // In production, use the environment variable or default to relative path
    const isDevelopment = import.meta.env.DEV;
    const csrfEndpoint = isDevelopment
      ? '/api/auth/csrf-token' // Use relative path for proxy in development
      : `${import.meta.env.VITE_API_URL || ''}/api/auth/csrf-token`; // Use env var or relative path in production

    console.info('Fetching CSRF token from:', csrfEndpoint);

    // Make a direct request to the CSRF token endpoint
    const response = await axios.get<any>(csrfEndpoint, {
      withCredentials: true,
    });

    // Check different possible response structures
    if (response.data && response.data.data && response.data.data.csrfToken) {
      csrfToken = response.data.data.csrfToken;
    } else if (response.data && response.data.csrfToken) {
      csrfToken = response.data.csrfToken;
    } else {
      console.error('Invalid CSRF token response structure:', response.data);
      throw new Error('Invalid CSRF token response structure');
    }

    // Set token expiry time
    tokenExpiryTime = now + TOKEN_LIFETIME_MS;

    return csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);

    // In development mode, use a dummy token to allow testing
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Using fallback CSRF token in development mode');
      csrfToken = 'dummy-csrf-token-for-development';
      tokenExpiryTime = now + TOKEN_LIFETIME_MS;
      return csrfToken;
    }

    // In production, rethrow the error
    throw error;
  }
};

/**
 * Create an axios request interceptor that adds CSRF token to requests
 * @param axiosInstance The axios instance to add the interceptor to
 */
export const addCsrfTokenInterceptor = (axiosInstance: any) => {
  axiosInstance.interceptors.request.use(
    async (config: any) => {
      // Only add CSRF token for mutating requests (POST, PUT, PATCH, DELETE)
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
 * @param error The error that occurred
 * @returns True if the error was a CSRF error and the token was refreshed
 */
export const handleCsrfError = async (error: any): Promise<boolean> => {
  // Check if this is a CSRF token error
  const isCsrfError =
    error.response &&
    (error.response.status === 403 || error.response.status === 419) &&
    (error.response.data?.message?.includes('CSRF') ||
      error.response.data?.error?.includes('CSRF') ||
      error.response.statusText?.includes('CSRF'));

  if (isCsrfError) {
    console.warn('CSRF token validation failed. Refreshing token...');
    try {
      // Force refresh the token
      await getCsrfToken(true);
      return true;
    } catch (refreshError) {
      console.error('Failed to refresh CSRF token:', refreshError);
      return false;
    }
  }

  return false;
};
