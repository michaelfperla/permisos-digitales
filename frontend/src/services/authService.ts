import axios from 'axios';

import { debugLog, errorLog } from '../utils/debug';

// Define types for our API responses and requests
interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  accountType: string;
  role?: string;
  profile_image_url?: string;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
}

interface StatusResponse {
  isLoggedIn: boolean;
  user?: User;
}

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true, // Important for cookies
  timeout: 5000, // 5 second timeout for all requests
});

// Store CSRF token
let csrfToken: string | null = null;

/**
 * Get CSRF token for secure requests
 */
export const getCsrfToken = async (): Promise<string> => {
  debugLog('authService', 'Fetching CSRF token');

  // If we already have a token, return it
  if (csrfToken) {
    debugLog('authService', `Using existing CSRF token: ${csrfToken}`);
    return csrfToken;
  }

  try {
    // Make a direct request to the CSRF token endpoint
    const response = await api.get<{ data: { csrfToken: string } }>('/auth/csrf-token');

    // Check if the response has the expected structure
    if (response && response.data && response.data.data && response.data.data.csrfToken) {
      csrfToken = response.data.data.csrfToken;
      debugLog('authService', `CSRF token fetched successfully: ${csrfToken}`);
      return csrfToken;
    } else {
      debugLog('authService', 'Invalid CSRF token response structure:', response.data);
      throw new Error('Invalid CSRF token response structure');
    }
  } catch (error) {
    errorLog('authService', 'Failed to fetch CSRF token', error);

    // In development mode, use a dummy token to allow testing
    if (process.env.NODE_ENV !== 'production') {
      csrfToken = 'dummy-csrf-token-for-development';
      debugLog('authService', `Using dummy CSRF token: ${csrfToken}`);
      return csrfToken;
    }

    // In production, rethrow the error
    throw error;
  }
};

/**
 * Login user
 * @param email User email
 * @param password User password
 */
export const login = async (email: string, password: string): Promise<AuthResponse> => {
  debugLog('authService', `Login attempt for email: ${email}`);

  try {
    // Ensure we have a CSRF token
    if (!csrfToken) {
      debugLog('authService', 'No CSRF token found, fetching one');
      await getCsrfToken();
    }

    debugLog('authService', `Using CSRF token: ${csrfToken}`);

    // Log the request details
    debugLog('authService', 'Login request payload', { email, password: '***REDACTED***' });

    const response = await api.post<{ success: boolean; data: { user: User }; message: string }>(
      '/auth/login',
      { email, password },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );

    debugLog('authService', 'Login response received', response.data);

    // Extract user from the nested data structure
    const user = response.data.data && response.data.data.user;

    // Store user info in session storage for persistence
    if (user) {
      debugLog('authService', 'Storing user in session storage', user);
      sessionStorage.setItem('user', JSON.stringify(user));

      // Return in the format expected by the AuthContext
      return {
        success: response.data.success,
        message: response.data.message,
        user: user,
      };
    } else {
      debugLog('authService', 'No user data in response', response.data);

      // Return success but no user
      return {
        success: response.data.success,
        message: response.data.message,
      };
    }
  } catch (error) {
    errorLog('authService', 'Login error', error);

    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorLog(
          'authService',
          `Server responded with status ${error.response.status}`,
          error.response.data,
        );

        return {
          success: false,
          message: error.response.data.message || 'Login failed. Please check your credentials.',
        };
      } else if (error.request) {
        // The request was made but no response was received
        errorLog('authService', 'No response received from server', error.request);
      } else {
        // Something happened in setting up the request
        errorLog('authService', 'Error setting up request', error.message);
      }
    }

    return {
      success: false,
      message: 'Network error. Please check your connection.',
    };
  }
};

/**
 * Register a new user
 * @param userData User registration data
 */
export const register = async (userData: RegisterRequest): Promise<AuthResponse> => {
  debugLog('authService', `Registration attempt for email: ${userData.email}`);

  try {
    // Ensure we have a CSRF token
    if (!csrfToken) {
      debugLog('authService', 'No CSRF token found, fetching one');
      await getCsrfToken();
    }

    debugLog('authService', `Using CSRF token: ${csrfToken}`);

    // Log the request details
    const sanitizedUserData = {
      ...userData,
      password: '***REDACTED***',
      confirmPassword: userData.confirmPassword ? '***REDACTED***' : undefined,
    };
    debugLog('authService', 'Registration request payload', sanitizedUserData);

    const response = await api.post<AuthResponse>('/auth/register', userData, {
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });

    debugLog('authService', 'Registration response received', response.data);

    return response.data;
  } catch (error) {
    errorLog('authService', 'Registration error', error);

    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorLog(
          'authService',
          `Server responded with status ${error.response.status}`,
          error.response.data,
        );

        return {
          success: false,
          message: error.response.data.message || 'Registration failed. Please try again.',
        };
      } else if (error.request) {
        // The request was made but no response was received
        errorLog('authService', 'No response received from server', error.request);
      } else {
        // Something happened in setting up the request
        errorLog('authService', 'Error setting up request', error.message);
      }
    }

    return {
      success: false,
      message: 'Network error. Please check your connection.',
    };
  }
};

/**
 * Check authentication status
 * @param signal Optional AbortSignal to cancel the request
 */
export const checkStatus = async (signal?: AbortSignal): Promise<StatusResponse> => {
  console.info('[checkStatus] Starting API call to /api/auth/status...');
  try {
    const response = await api.get<StatusResponse>('/auth/status', { signal });

    // Update session storage with user info
    if (response.data.user) {
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
    } else {
      sessionStorage.removeItem('user');
    }

    console.info('[checkStatus] API call successful, response:', response.data);

    // Return the *nested* data object which matches the StatusResponse type
    if (response.data.success && response.data.data) {
      return response.data.data; // Return { isLoggedIn: boolean, user?: User }
    } else {
      // Handle cases where the structure might be different unexpectedly
      console.error('[checkStatus] Unexpected successful response structure:', response.data);
      // Decide on appropriate fallback - maybe return logged out state?
      return { isLoggedIn: false };
    }
  } catch (error) {
    // IMMEDIATELY check for cancellation and re-throw if found
    if (
      axios.isAxiosError(error) &&
      (error.name === 'AbortError' ||
        error.name === 'CanceledError' ||
        error.code === 'ERR_CANCELED')
    ) {
      console.info('[checkStatus] Request cancelled/aborted. Rethrowing...');
      throw error; // Exit catch block immediately
    }

    // --- ONLY proceed here if it's NOT a cancellation error ---
    console.error('[checkStatus] API call error (non-cancellation):', error);
    console.error('Failed to check auth status (non-cancellation error):', error);

    // Fallback logic for actual errors (network, server issues etc.)
    sessionStorage.removeItem('user');

    // For development purposes, check if there's a user in session storage
    // This allows us to test the UI without a working backend
    const userJson = sessionStorage.getItem('user');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        const fallbackResponse = { isLoggedIn: true, user };
        console.info(
          '[checkStatus] API failed, returning fallback from sessionStorage:',
          fallbackResponse,
        );
        return fallbackResponse;
      } catch {
        // Invalid JSON, ignore
      }
    }

    console.info('[checkStatus] API failed, returning fallback:', { isLoggedIn: false });
    return { isLoggedIn: false };
  }
};

/**
 * Logout user
 */
export const logout = async (): Promise<AuthResponse> => {
  try {
    // Ensure we have a CSRF token
    if (!csrfToken) {
      await getCsrfToken();
    }

    const response = await api.post<AuthResponse>(
      '/auth/logout',
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );

    // Clear user from session storage
    sessionStorage.removeItem('user');

    return response.data;
  } catch (error) {
    console.error('Failed to logout:', error);
    // Still remove user from session storage even if API call fails
    sessionStorage.removeItem('user');

    // Even if the API call fails, we still want to remove the user from session storage
    // and consider the logout successful from the client's perspective
    return {
      success: true,
      message: 'Logout successful. You have been logged out locally.',
    };
  }
};

/**
 * Get current user from session storage
 */
export const getCurrentUser = (): User | null => {
  const userJson = sessionStorage.getItem('user');
  if (userJson) {
    try {
      return JSON.parse(userJson) as User;
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Check if user is logged in (from session storage)
 */
export const isLoggedIn = (): boolean => {
  return getCurrentUser() !== null;
};

/**
 * Request password reset
 * @param email User email
 */
export const forgotPassword = async (email: string): Promise<AuthResponse> => {
  try {
    // Ensure we have a CSRF token
    if (!csrfToken) {
      await getCsrfToken();
    }

    const response = await api.post<AuthResponse>(
      '/auth/forgot-password',
      { email },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error('Forgot password error:', error);

    if (axios.isAxiosError(error) && error.response) {
      // Return the error message from the API
      return {
        success: false,
        message:
          error.response.data.message || 'Failed to send password reset email. Please try again.',
      };
    }
    return {
      success: false,
      message: 'Network error. Please check your connection.',
    };
  }
};

/**
 * Reset password with token
 * @param token Reset token from email
 * @param password New password
 */
export const resetPassword = async (token: string, password: string): Promise<AuthResponse> => {
  try {
    // Ensure we have a CSRF token
    if (!csrfToken) {
      await getCsrfToken();
    }

    const response = await api.post<AuthResponse>(
      '/auth/reset-password',
      { token, password },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error('Reset password error:', error);

    if (axios.isAxiosError(error) && error.response) {
      // Return the error message from the API
      return {
        success: false,
        message:
          error.response.data.message ||
          'Failed to reset password. The token may be invalid or expired.',
      };
    }
    return {
      success: false,
      message: 'Network error. Please check your connection.',
    };
  }
};

/**
 * Change user password
 * @param currentPassword Current password
 * @param newPassword New password
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<AuthResponse> => {
  // Ensure we have a CSRF token
  if (!csrfToken) {
    await getCsrfToken();
  }

  // Log the request (without exposing sensitive data)
  debugLog('authService', 'Changing password', {
    currentPassword: '***REDACTED***',
    newPassword: '***REDACTED***',
  });

  // Make the API call and let Axios errors propagate naturally
  const response = await api.post<AuthResponse>(
    '/auth/change-password',
    { currentPassword, newPassword },
    {
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    },
  );

  // Log success (without sensitive data)
  debugLog('authService', 'Password change response received', response.data);

  // Return the response data directly
  return response.data;
};

/**
 * Resend verification email
 * @param email User email
 */
export const resendVerificationEmail = async (
  email: string,
): Promise<{ success: boolean; message: string }> => {
  debugLog('authService', `Resending verification email for: ${email}`);

  try {
    // Ensure we have a CSRF token
    if (!csrfToken) {
      debugLog('authService', 'No CSRF token found, fetching one');
      await getCsrfToken();
    }

    debugLog('authService', `Using CSRF token: ${csrfToken}`);

    const response = await api.post<{ success: boolean; message: string }>(
      '/auth/resend-verification',
      { email },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      },
    );

    debugLog('authService', 'Resend verification email response received', response.data);

    return {
      success: response.data.success,
      message: response.data.message || 'Correo de verificación reenviado exitosamente.',
    };
  } catch (error) {
    errorLog('authService', 'Resend verification email error', error);

    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorLog(
          'authService',
          `Server responded with status ${error.response.status}`,
          error.response.data,
        );

        return {
          success: false,
          message: error.response.data.message || 'Error al reenviar el correo de verificación.',
        };
      } else if (error.request) {
        // The request was made but no response was received
        errorLog('authService', 'No response received from server', error.request);
      } else {
        // Something happened in setting up the request
        errorLog('authService', 'Error setting up request', error.message);
      }
    }

    return {
      success: false,
      message: 'Error de red. Por favor, verifica tu conexión.',
    };
  }
};

/**
 * Verify email token
 * @param token Email verification token
 */
export const verifyEmailToken = async (
  token: string,
): Promise<{ success: boolean; message: string }> => {
  debugLog('authService', `Verifying email token: ${token.substring(0, 8)}...`);

  try {
    const response = await api.get<{ success: boolean; message: string }>(
      `/auth/verify-email/${token}`,
    );

    debugLog('authService', 'Verify email token response received', response.data);

    return {
      success: response.data.success,
      message: response.data.message || 'Correo electrónico verificado exitosamente.',
    };
  } catch (error) {
    errorLog('authService', 'Verify email token error', error);

    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorLog(
          'authService',
          `Server responded with status ${error.response.status}`,
          error.response.data,
        );

        return {
          success: false,
          message: error.response.data.message || 'Error al verificar el correo electrónico.',
        };
      } else if (error.request) {
        // The request was made but no response was received
        errorLog('authService', 'No response received from server', error.request);
      } else {
        // Something happened in setting up the request
        errorLog('authService', 'Error setting up request', error.message);
      }
    }

    return {
      success: false,
      message: 'Error de red. Por favor, verifica tu conexión.',
    };
  }
};

// Export all functions as default object
const authService = {
  login,
  register,
  checkStatus,
  logout,
  getCsrfToken,
  getCurrentUser,
  isLoggedIn,
  forgotPassword,
  resetPassword,
  changePassword,
  resendVerificationEmail,
  verifyEmailToken,
};

export default authService;
