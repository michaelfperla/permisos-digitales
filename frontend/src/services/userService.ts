import axios from 'axios';

import authService, { User } from './authService';

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

const userService = {
  /**
   * Get current user profile
   */
  getProfile: async (options?: { signal?: AbortSignal }): Promise<UserProfileResponse> => {
    try {
      const response = await axios.get('/api/user/profile', { signal: options?.signal });
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
  },

  /**
   * Update user profile information
   */
  updateProfile: async (
    data: UserProfileUpdateData,
    options?: { signal?: AbortSignal },
  ): Promise<UserProfileResponse> => {
    console.debug('Updating user profile with data:', data);

    let user = null;
    try {
      const userJson = sessionStorage.getItem('user');
      if (userJson) {
        user = JSON.parse(userJson);
      }
    } catch (e) {
      console.error('Error parsing user from session storage:', e);
    }

    const csrfToken = await authService.getCsrfToken();

    const response = await axios.put('/api/user/profile', data, {
      headers: {
        'X-CSRF-Token': csrfToken,
      },
      signal: options?.signal,
    });

    console.debug('[userService.updateProfile] Raw Axios response:', response);
    console.debug(
      '[userService.updateProfile] Response data structure:',
      JSON.stringify(response.data, null, 2),
    );

    return {
      success: true,
      message: response.data.message || 'Profile updated successfully',
      user: {
        ...(user || {}),
        first_name: data.first_name || user?.first_name || '',
        last_name: data.last_name || user?.last_name || '',
      } as User,
    };
  },

  /**
   * Change user password
   */
  changePassword: async (
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      console.debug('Changing password via userService');
      const response = await authService.changePassword(currentPassword, newPassword);
      return {
        success: response.success,
        message: response.message || '',
      };
    } catch (error) {
      console.error('Error changing password:', error);
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
  },

  /**
   * Update user profile image
   */
  updateProfileImage: async (formData: FormData): Promise<UserProfileResponse> => {
    try {
      const csrfToken = await authService.getCsrfToken();
      const response = await axios.post('/api/user/profile/image', formData, {
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
        console.error('Error parsing user from session storage:', e);
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
      console.error('Error updating profile image:', error);
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
  },
};

export default userService;