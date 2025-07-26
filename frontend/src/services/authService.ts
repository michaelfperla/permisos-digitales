// --- FINAL, AUTHORITATIVE CODE for authService.ts ---

import axios from 'axios';
import { apiInstance as api } from './api-instance';
import { getCsrfToken } from '../utils/csrf';
import { debugLog, errorLog } from '../utils/debug';

interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

// THIS IS THE ONLY CHANGE. The 'customerId' property is added.
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  accountType: string;
  role?: string;
  profile_image_url?: string;
  customerId?: string; // This is the required property for Stripe payments.
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

// Error handling helper
const handleAuthError = (error: unknown): AuthResponse => {
  errorLog('authService', 'Auth error:', error);
  
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.message) {
      return { success: false, message: error.response.data.message };
    }
    if (!error.response) {
      return { success: false, message: 'Error de conexión. Por favor, verifica tu conexión a internet.' };
    }
  }
  
  return { success: false, message: 'Ha ocurrido un error. Por favor, intenta nuevamente.' };
}

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    debugLog('authService', `Login attempt for email: ${email}`);
    const response = await api.post<{ success: boolean; data: { user: User }; message: string }>('/auth/login', { email, password });
    debugLog('authService', 'Login response received', response.data);
    const user = response.data.data?.user;
    if (user) {
      debugLog('authService', 'Storing user in session storage', user);
      sessionStorage.setItem('user', JSON.stringify(user));
    }
    return { ...response.data, user };
  } catch (error) {
    return handleAuthError(error);
  }
};

export const register = async (userData: RegisterRequest): Promise<AuthResponse> => {
  try {
    debugLog('authService', `Registration attempt for email: ${userData.email}`);
    const response = await api.post<AuthResponse>('/auth/register', userData);
    debugLog('authService', 'Registration response received', response.data);
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const checkStatus = async (signal?: AbortSignal): Promise<StatusResponse> => {
  debugLog('authService', 'Starting API call to /auth/status...');
  try {
    const response = await api.get<StatusApiResponse>('/auth/status', { signal });
    if (response.data.data?.user) {
      sessionStorage.setItem('user', JSON.stringify(response.data.data.user));
    } else {
      sessionStorage.removeItem('user');
    }
    debugLog('authService', 'API call successful', response.data);
    return response.data.data || { isLoggedIn: false };
  } catch (error) {
    if (axios.isCancel(error)) {
      debugLog('authService', 'Request cancelled/aborted.');
      throw error;
    }
    errorLog('authService', 'API call error:', error);
    sessionStorage.removeItem('user');
    const userJson = sessionStorage.getItem('user');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        return { isLoggedIn: true, user };
      } catch {}
    }
    return { isLoggedIn: false };
  }
};

export const logout = async (): Promise<AuthResponse> => {
  try {
    debugLog('authService', 'Logout request');
    await api.post<AuthResponse>('/auth/logout', {});
    sessionStorage.removeItem('user');
    return { success: true, message: 'Sesión cerrada exitosamente.' };
  } catch (error) {
    // Even if logout fails on server, clear local session
    sessionStorage.removeItem('user');
    return handleAuthError(error);
  }
};

export const getCurrentUser = (): User | null => {
  const userJson = sessionStorage.getItem('user');
  return userJson ? (JSON.parse(userJson) as User) : null;
};

export const isLoggedIn = (): boolean => !!getCurrentUser();

export const forgotPassword = async (email: string): Promise<AuthResponse> => {
  try {
    debugLog('authService', `Forgot password request for email: ${email}`);
    const response = await api.post<AuthResponse>('/auth/forgot-password', { email });
    debugLog('authService', 'Forgot password response received', response.data);
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const resetPassword = async (token: string, password: string): Promise<AuthResponse> => {
  try {
    debugLog('authService', 'Reset password request');
    const response = await api.post<AuthResponse>('/auth/reset-password', { token, password });
    debugLog('authService', 'Reset password response received', response.data);
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<AuthResponse> => {
  try {
    debugLog('authService', 'Change password request');
    const response = await api.post<AuthResponse>('/auth/change-password', { currentPassword, newPassword });
    debugLog('authService', 'Change password response received', response.data);
    return response.data;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const resendVerificationEmail = async (email: string): Promise<{ success: boolean; message: string }> => {
  try {
    debugLog('authService', `Resend verification email for: ${email}`);
    const response = await api.post<{ success: boolean; message: string }>('/auth/resend-verification', { email });
    debugLog('authService', 'Resend verification response received', response.data);
    return response.data;
  } catch (error) {
    const errorResult = handleAuthError(error);
    return { success: false, message: errorResult.message || 'Error al reenviar el correo de verificación' };
  }
};

export const verifyEmailToken = async (token: string): Promise<{ success: boolean; message: string }> => {
  try {
    debugLog('authService', 'Verify email token request');
    const response = await api.get<{ success: boolean; message: string }>(`/auth/verify-email/${token}`);
    debugLog('authService', 'Verify email response received', response.data);
    return response.data;
  } catch (error) {
    const errorResult = handleAuthError(error);
    return { success: false, message: errorResult.message || 'Error al verificar el correo electrónico' };
  }
};

// Functions are already exported individually above, no need to re-export