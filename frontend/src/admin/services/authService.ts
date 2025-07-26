import axios from 'axios';

import { AdminUser } from '../../shared/contexts/AuthContext';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdminAuthService');

const api = axios.create({
  baseURL: import.meta.env.PROD ? 'https://api.permisosdigitales.com.mx' : '/',
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'admin',
  },
  withCredentials: true,
});

interface StatusResponse {
  isLoggedIn: boolean;
  user?: AdminUser;
}

/**
 * Get CSRF token for admin requests
 */
export const getCsrfToken = async (): Promise<string> => {
  try {
    const response = await api.get<any>('/auth/csrf-token');

    if (response.data.data && response.data.data.csrfToken) {
      return response.data.data.csrfToken;
    } else if (response.data.csrfToken) {
      return response.data.csrfToken;
    } else {
      logger.error('Invalid CSRF token response structure', { responseData: response.data });
      throw new Error('Invalid CSRF token response structure');
    }
  } catch (error) {
    logger.error('Failed to get CSRF token', { error: (error as Error).message });
    throw new Error('Failed to get CSRF token');
  }
};

/**
 * Check admin authentication status
 */
export const checkStatus = async (signal?: AbortSignal): Promise<StatusResponse> => {
  try {
    logger.debug('Starting API call to /auth/status');
    const response = await api.get<any>('/auth/status', { signal });

    logger.debug('API call successful', { response: response.data });

    if (response.data.data) {
      return response.data.data;
    } else {
      return response.data;
    }
  } catch (error) {
    if (axios.isCancel(error)) {
      logger.info('Request cancelled/aborted. Rethrowing...');
      throw error;
    } else {
      logger.error('Failed to check auth status', { error: (error as Error).message });
    }
    return { isLoggedIn: false };
  }
};

/**
 * Log out current admin user
 */
export const logout = async (): Promise<void> => {
  try {
    const csrfTokenVal = await getCsrfToken();
    await api.post(
      '/auth/logout',
      {},
      {
        headers: {
          'X-CSRF-Token': csrfTokenVal,
        },
      },
    );
  } catch (error) {
    logger.error('Failed to logout', { error: (error as Error).message });
    throw new Error('Failed to logout');
  }
};

// Functions are already exported individually above, no need to re-export