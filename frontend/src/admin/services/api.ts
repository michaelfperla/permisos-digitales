import axios, { AxiosInstance, AxiosResponse } from 'axios';

import { logger } from '../../utils/logger';
import { getApiBaseUrl, getIsDevelopment } from '../../config/api-config';
import { logConfigValidation } from '../../utils/config-validator';

// Create a custom axios instance for the admin portal
const api: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(), // Use centralized API configuration
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'admin',
  },
  withCredentials: true, // Include cookies for session authentication
});

// Development-only validation
if (getIsDevelopment()) {
  console.log('🔧 Admin API Configuration:', {
    baseURL: getApiBaseUrl() || 'relative paths (proxied)',
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      'X-Portal-Type': 'admin',
    },
  });
  logConfigValidation();
}

// Function to get CSRF token
export const getCsrfToken = async (): Promise<string> => {
  try {
    const response = await api.get<{ data: { csrfToken: string } } | { csrfToken: string }>('/auth/csrf-token');

    // Handle different response structures
    if ('data' in response.data && response.data.data && response.data.data.csrfToken) {
      return response.data.data.csrfToken;
    } else if ('csrfToken' in response.data && response.data.csrfToken) {
      return response.data.csrfToken;
    } else {
      logger.error('Invalid CSRF token response structure:', response.data);
      throw new Error('Invalid CSRF token response structure');
    }
  } catch (error) {
    logger.error('Failed to get CSRF token:', error);
    throw new Error('Failed to get CSRF token');
  }
};

// Request interceptor to add CSRF token to requests that need it
api.interceptors.request.use(
  async (config) => {
    // Only add CSRF token for mutating requests (POST, PUT, PATCH, DELETE)
    if (config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      // Check if the request already has a CSRF token (manually added)
      if (!config.headers['X-CSRF-Token']) {
        try {
          const token = await getCsrfToken();
          config.headers = config.headers || {};
          config.headers['X-CSRF-Token'] = token;
        } catch (error) {
          logger.error('Error adding CSRF token to request:', error);
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    // Skip handling for canceled requests
    if (axios.isCancel(error)) {
      logger.info('Request canceled:', error.message);
      return Promise.reject(error);
    }

    // Handle CSRF token errors
    if (error.response && error.response.status === 403) {
      // Check for CSRF error in various response formats
      const errorData = error.response.data;
      const isCsrfError =
        (typeof errorData === 'object' &&
          (errorData.error?.toLowerCase().includes('csrf') ||
            errorData.message?.toLowerCase().includes('csrf'))) ||
        (typeof errorData === 'string' && errorData.toLowerCase().includes('csrf'));

      if (isCsrfError) {
        logger.error('CSRF token error:', error.response.data);
        // You could implement retry logic here if needed
      } else {
        logger.error('Forbidden error (non-CSRF):', error.response.data);
      }
    }

    // Handle session expiration
    if (error.response && error.response.status === 401) {
      logger.error('Session expired or unauthorized:', error.response.data);
      // Don't redirect here - let the auth context handle it
      // This prevents breaking out of the admin SPA
    }

    return Promise.reject(error);
  },
);

export default api;
