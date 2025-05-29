import axios from 'axios';

import { AdminUser } from '../../shared/contexts/AuthContext';

const api = axios.create({
  baseURL: '/api',
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
      console.error('Invalid CSRF token response structure:', response.data);
      throw new Error('Invalid CSRF token response structure');
    }
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    throw new Error('Failed to get CSRF token');
  }
};

/**
 * Check admin authentication status
 */
export const checkStatus = async (signal?: AbortSignal): Promise<StatusResponse> => {
  try {
    console.debug('[checkStatus] Starting API call to /api/auth/status...');
    const response = await api.get<any>('/auth/status', { signal });

    console.debug('[checkStatus] API call successful, response:', response.data);

    if (response.data.data) {
      return response.data.data;
    } else {
      return response.data;
    }
  } catch (error) {
    if (axios.isCancel(error)) {
      console.info('[checkStatus] Request cancelled/aborted. Rethrowing...');
      throw error;
    } else {
      console.error('[checkStatus] Failed to check auth status:', error);
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
    console.error('Failed to logout:', error);
    throw new Error('Failed to logout');
  }
};

const authService = {
  getCsrfToken,
  checkStatus,
  logout,
};

export default authService;