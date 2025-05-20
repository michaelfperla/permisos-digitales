import axios from 'axios';
import { AdminUser } from '../contexts/AuthContext';

// Create an axios instance with default config
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'admin' // Always include admin portal flag
  },
  withCredentials: true // Include cookies for session authentication
});

// Define types for API responses
interface AuthResponse {
  success: boolean;
  message?: string;
  user?: AdminUser;
}

interface StatusResponse {
  isLoggedIn: boolean;
  user?: AdminUser;
}

interface CsrfResponse {
  csrfToken: string;
}

/**
 * Get CSRF token for protected requests
 */
export const getCsrfToken = async (): Promise<string> => {
  try {
    const response = await api.get<any>('/auth/csrf-token');

    // Handle different response structures
    if (response.data.data && response.data.data.csrfToken) {
      // ApiResponse.success format: { data: { csrfToken: string } }
      return response.data.data.csrfToken;
    } else if (response.data.csrfToken) {
      // Direct format: { csrfToken: string }
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
 * Check if user is logged in
 * @param signal Optional AbortSignal for cancellation
 */
export const checkStatus = async (signal?: AbortSignal): Promise<StatusResponse> => {
  try {
    console.log('[checkStatus] Starting API call to /api/auth/status...');
    const response = await api.get<any>('/auth/status', { signal });

    console.log('[checkStatus] API call successful, response:', response.data);

    // Handle different response structures
    if (response.data.data) {
      // ApiResponse.success format: { data: { isLoggedIn: boolean, user?: AdminUser } }
      return response.data.data;
    } else {
      // Direct format: { isLoggedIn: boolean, user?: AdminUser }
      return response.data;
    }
  } catch (error) {
    // Don't log canceled requests as errors
    if (axios.isCancel(error)) {
      console.log('[checkStatus] Request cancelled/aborted. Rethrowing...');
      throw error; // Rethrow to be handled by the caller
    } else {
      console.error('[checkStatus] Failed to check auth status:', error);
    }
    return { isLoggedIn: false };
  }
};

/**
 * Log out the current user
 */
export const logout = async (): Promise<void> => {
  try {
    const csrfToken = await getCsrfToken();
    await api.post('/auth/logout', {}, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
  } catch (error) {
    console.error('Failed to logout:', error);
    throw new Error('Failed to logout');
  }
};

// Export all functions as default object
const authService = {
  getCsrfToken,
  checkStatus,
  logout
};

export default authService;
