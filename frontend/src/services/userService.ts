import axios from 'axios';

import { apiInstance as api } from './api-instance';
import { getCsrfToken } from '../utils/csrf';
import type { User } from './authService';
import { createLogger } from '../utils/logger';

const logger = createLogger('UserService');

export interface UserProfileUpdateData {
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_image?: File;
}

export interface UserProfileResponse {
  success: boolean;
  user: User | null;
  message: string;
}

/**
 * Get current user profile
 */
export const getProfile = async (options?: { signal?: AbortSignal }): Promise<UserProfileResponse> => {
    try {
      const response = await api.get('/user/profile', { signal: options?.signal });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.name === 'AbortError') {
        throw error;
      }
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          user: null,
          message: error.response.data.message || 'Error fetching user profile',
        };
      }
      return {
        success: false,
        user: null,
        message: 'Error fetching user profile',
      };
    }
};

/**
 * Update user profile information
 */
export const updateProfile = async (
    data: UserProfileUpdateData,
    options?: { signal?: AbortSignal },
  ): Promise<UserProfileResponse> => {
    logger.debug('Updating user profile with data', { data });

    let user = null;
    try {
      const userJson = sessionStorage.getItem('user');
      if (userJson) {
        user = JSON.parse(userJson);
      }
    } catch (e) {
      logger.error('Error parsing user from session storage', { error: (e as Error).message });
    }

    const csrfToken = await getCsrfToken();

    const response = await api.put('/user/profile', data, {
      headers: {
        'X-CSRF-Token': csrfToken,
      },
      signal: options?.signal,
    });

    logger.debug('Raw Axios response for updateProfile', {
      response: response.data,
      dataStructure: JSON.stringify(response.data, null, 2)
    });

    return {
      success: true,
      message: response.data.message || 'Profile updated successfully',
      user: {
        ...(user || {}),
        first_name: data.first_name || user?.first_name || '',
        last_name: data.last_name || user?.last_name || '',
      } as User,
    };
};

/**
 * Change user password
 */
export const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      logger.debug('Changing password via userService');
      const csrfToken = await getCsrfToken();
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      }, {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
      return {
        success: response.data.success || true,
        message: response.data.message || 'Contraseña cambiada exitosamente.',
      };
    } catch (error) {
      logger.error('Error changing password', {
        error: (error as any).message,
        response: (error as any).response?.data
      });
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          message:
            error.response.data.message ||
            'Error al cambiar la contraseña. Por favor, intente nuevamente.',
        };
      }
      return {
        success: false,
        message: 'Error de red. Por favor, verifique su conexión.',
      };
    }
};

/**
 * Update user profile image
 */
export const updateProfileImage = async (formData: FormData): Promise<UserProfileResponse> => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await api.post('/user/profile/image', formData, {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'multipart/form-data',
        },
      });

      let user = null;
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          user = JSON.parse(userJson);
        }
      } catch (e) {
        logger.error('Error parsing user from session storage', { error: (e as Error).message });
      }

      return {
        success: true,
        message: response.data.message || 'Imagen de perfil actualizada exitosamente',
        user: {
          ...(user || {}),
          profile_image_url: response.data.profile_image_url || user?.profile_image_url,
          id: user?.id || '',
          email: user?.email || '',
          first_name: user?.first_name || '',
          last_name: user?.last_name || '',
          accountType: user?.accountType || '',
        } as User,
      };
    } catch (error) {
      logger.error('Error updating profile image', {
        error: (error as any).message,
        response: (error as any).response?.data
      });
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          user: null,
          message: error.response.data.message || 'Error al actualizar la imagen de perfil',
        };
      }
      return {
        success: false,
        user: null,
        message: 'Error de red. Por favor, verifique su conexión.',
      };
    }
};

export interface DeleteAccountData {
  confirmEmail: string;
  deleteReason?: string;
}

export interface DeleteAccountResponse {
  success: boolean;
  message: string;
}

/**
 * Delete user account permanently
 */
export const deleteAccount = async (data: DeleteAccountData): Promise<DeleteAccountResponse> => {
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await api.delete('/user/account', {
      data: {
        confirmEmail: data.confirmEmail,
        deleteReason: data.deleteReason
      },
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      message: response.data.message || 'Cuenta eliminada exitosamente'
    };
  } catch (error) {
    logger.error('Error deleting account', {
      error: (error as any).message,
      response: (error as any).response?.data
    });
    
    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        message: error.response.data.message || 'Error al eliminar la cuenta'
      };
    }
    
    return {
      success: false,
      message: 'Error de red. Por favor, verifique su conexión.'
    };
  }
};

export interface DataExportResponse {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Request user data export
 */
export const requestDataExport = async (): Promise<DataExportResponse> => {
  try {
    const response = await api.get('/user/data-export');
    
    return {
      success: true,
      message: response.data.message || 'Datos exportados exitosamente',
      data: response.data.data
    };
  } catch (error) {
    logger.error('Error requesting data export', {
      error: (error as any).message,
      response: (error as any).response?.data
    });
    
    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        message: error.response.data.message || 'Error al exportar datos'
      };
    }
    
    return {
      success: false,
      message: 'Error de red. Por favor, verifique su conexión.'
    };
  }
};