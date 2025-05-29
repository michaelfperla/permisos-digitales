import axios from 'axios';

import { api } from './api';
import { getCsrfToken } from '../utils/csrf';
import { debugLog, errorLog } from '../utils/debug';

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

interface StatusApiResponse {
  success: boolean;
  data: StatusResponse;
}

/**
 * Authenticate user with email and password
 */
export const login = async (email: string, password: string): Promise<AuthResponse> => {
  debugLog('authService', `Login attempt for email: ${email}`);

  try {
    debugLog('authService', 'Login request payload', { email, password: '***REDACTED***' });

    const response = await api.post<{ success: boolean; data: { user: User }; message: string }>(
      '/auth/login',
      { email, password },
    );

    debugLog('authService', 'Login response received', response.data);

    const user = response.data.data && response.data.data.user;

    if (user) {
      debugLog('authService', 'Storing user in session storage', user);
      sessionStorage.setItem('user', JSON.stringify(user));

      return {
        success: response.data.success,
        message: response.data.message,
        user: user,
      };
    } else {
      debugLog('authService', 'No user data in response', response.data);

      return {
        success: response.data.success,
        message: response.data.message,
      };
    }
  } catch (error) {
    errorLog('authService', 'Login error', error);

    if (axios.isAxiosError(error)) {
      if (error.response) {
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
        errorLog('authService', 'No response received from server', error.request);
      } else {
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
 * Register a new user account
 */
export const register = async (userData: RegisterRequest): Promise<AuthResponse> => {
  debugLog('authService', `Registration attempt for email: ${userData.email}`);

  try {
    const sanitizedUserData = {
      ...userData,
      password: '***REDACTED***',
      confirmPassword: userData.confirmPassword ? '***REDACTED***' : undefined,
    };
    debugLog('authService', 'Registration request payload', sanitizedUserData);

    const response = await api.post<AuthResponse>('/auth/register', userData);

    debugLog('authService', 'Registration response received', response.data);

    return response.data;
  } catch (error) {
    errorLog('authService', 'Registration error', error);

    if (axios.isAxiosError(error)) {
      if (error.response) {
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
        errorLog('authService', 'No response received from server', error.request);
      } else {
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
 * Check current authentication status
 */
export const checkStatus = async (signal?: AbortSignal): Promise<StatusResponse> => {
  console.info('[checkStatus] Starting API call to /api/auth/status...');
  try {
    const response = await api.get<StatusApiResponse>('/auth/status', { signal });

    if (response.data.data?.user) {
      sessionStorage.setItem('user', JSON.stringify(response.data.data.user));
    } else {
      sessionStorage.removeItem('user');
    }

    console.info('[checkStatus] API call successful, response:', response.data);

    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
        console.warn('[checkStatus] Received HTML response instead of JSON - likely a 404 or CORS issue');
      } else {
        console.error('[checkStatus] Unexpected successful response structure:', response.data);
      }
      return { isLoggedIn: false };
    }
  } catch (error) {
    // Re-throw cancellation errors immediately
    if (
      axios.isAxiosError(error) &&
      (error.name === 'AbortError' ||
        error.name === 'CanceledError' ||
        error.code === 'ERR_CANCELED')
    ) {
      console.info('[checkStatus] Request cancelled/aborted. Rethrowing...');
      throw error;
    }

    console.error('[checkStatus] API call error (non-cancellation):', error);
    console.error('Failed to check auth status (non-cancellation error):', error);

    sessionStorage.removeItem('user');

    // Development fallback: check session storage for testing without backend
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
 * Logout current user
 */
export const logout = async (): Promise<AuthResponse> => {
  try {
    const response = await api.post<AuthResponse>('/auth/logout', {});

    sessionStorage.removeItem('user');

    return response.data;
  } catch (error) {
    console.error('Failed to logout:', error);
    sessionStorage.removeItem('user');

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
 * Check if user is logged in
 */
export const isLoggedIn = (): boolean => {
  return getCurrentUser() !== null;
};

/**
 * Request password reset email
 */
export const forgotPassword = async (email: string): Promise<AuthResponse> => {
  try {
    const response = await api.post<AuthResponse>('/auth/forgot-password', { email });

    return response.data;
  } catch (error) {
    console.error('Forgot password error:', error);

    if (axios.isAxiosError(error) && error.response) {
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
 * Reset password using token from email
 */
export const resetPassword = async (token: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await api.post<AuthResponse>('/auth/reset-password', { token, password });

    return response.data;
  } catch (error) {
    console.error('Reset password error:', error);

    if (axios.isAxiosError(error) && error.response) {
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
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<AuthResponse> => {
  debugLog('authService', 'Changing password', {
    currentPassword: '***REDACTED***',
    newPassword: '***REDACTED***',
  });

  const response = await api.post<AuthResponse>('/auth/change-password', {
    currentPassword,
    newPassword,
  });

  debugLog('authService', 'Password change response received', response.data);

  return response.data;
};

/**
 * Resend email verification
 */
export const resendVerificationEmail = async (
  email: string,
): Promise<{ success: boolean; message: string }> => {
  debugLog('authService', `Resending verification email for: ${email}`);

  try {
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
        errorLog('authService', 'No response received from server', error.request);
      } else {
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
 * Verify email using token from verification email
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
        errorLog('authService', 'No response received from server', error.request);
      } else {
        errorLog('authService', 'Error setting up request', error.message);
      }
    }

    return {
      success: false,
      message: 'Error de red. Por favor, verifica tu conexión.',
    };
  }
};

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
