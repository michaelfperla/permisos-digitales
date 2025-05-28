import axios from 'axios';

import { api } from './api'; // Use the main API instance with CSRF interceptor
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

// Note: CSRF token handling is now done automatically by the main API instance

/**
 * Login user
 * @param email User email
 * @param password User password
 */
export const login = async (email: string, password: string): Promise<AuthResponse> => {
  debugLog('authService', `Login attempt for email: ${email}`);

  try {
    // Log the request details
    debugLog('authService', 'Login request payload', { email, password: '***REDACTED***' });

    // CSRF token is automatically added by the API interceptor
    const response = await api.post<{ success: boolean; data: { user: User }; message: string }>(
      '/auth/login',
      { email, password },
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
      message: 'Error de conexión. Por favor, verifica tu conexión a internet.',
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
    // Log the request details
    const sanitizedUserData = {
      ...userData,
      password: '***REDACTED***',
      confirmPassword: userData.confirmPassword ? '***REDACTED***' : undefined,
    };
    debugLog('authService', 'Registration request payload', sanitizedUserData);

    // CSRF token is automatically added by the API interceptor
    const response = await api.post<AuthResponse>('/auth/register', userData);

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
          message: error.response.data.message || 'Error en el registro. Por favor, inténtalo de nuevo.',
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
      message: 'Error de conexión. Por favor, verifica tu conexión a internet.',
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
      // Check if we received HTML instead of JSON (common with 404s or CORS issues)
      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
        console.warn('[checkStatus] Received HTML response instead of JSON - likely a 404 or CORS issue');
      } else {
        console.error('[checkStatus] Unexpected successful response structure:', response.data);
      }
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
    // CSRF token is automatically added by the API interceptor
    const response = await api.post<AuthResponse>('/auth/logout', {});

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
      message: 'Sesión cerrada exitosamente. Has sido desconectado localmente.',
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
    // CSRF token is automatically added by the API interceptor
    const response = await api.post<AuthResponse>('/auth/forgot-password', { email });

    return response.data;
  } catch (error) {
    console.error('Forgot password error:', error);

    if (axios.isAxiosError(error) && error.response) {
      // Return the error message from the API
      return {
        success: false,
        message:
          error.response.data.message || 'Error al enviar el correo de restablecimiento de contraseña. Por favor, inténtalo de nuevo.',
      };
    }
    return {
      success: false,
      message: 'Error de conexión. Por favor, verifica tu conexión a internet.',
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
    // CSRF token is automatically added by the API interceptor
    const response = await api.post<AuthResponse>('/auth/reset-password', { token, password });

    return response.data;
  } catch (error) {
    console.error('Reset password error:', error);

    if (axios.isAxiosError(error) && error.response) {
      // Return the error message from the API
      return {
        success: false,
        message:
          error.response.data.message ||
          'Error al restablecer la contraseña. El token puede ser inválido o haber expirado.',
      };
    }
    return {
      success: false,
      message: 'Error de conexión. Por favor, verifica tu conexión a internet.',
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
  // Log the request (without exposing sensitive data)
  debugLog('authService', 'Changing password', {
    currentPassword: '***REDACTED***',
    newPassword: '***REDACTED***',
  });

  // CSRF token is automatically added by the API interceptor
  const response = await api.post<AuthResponse>('/auth/change-password', {
    currentPassword,
    newPassword,
  });

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
    // CSRF token is automatically added by the API interceptor
    const response = await api.post<{ success: boolean; message: string }>(
      '/auth/resend-verification',
      { email },
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
