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

/**
 * Service for user profile management
 */
const userService = {
  /**
   * Get the current user's profile
   * @param options Optional request options including AbortSignal
   * @returns Promise with user profile data
   */
  getProfile: async (options?: { signal?: AbortSignal }): Promise<UserProfileResponse> => {
    try {
      const response = await axios.get('/api/user/profile', { signal: options?.signal });
      return response.data;
    } catch (error) {
      // Check if this was an abort error (not a real error)
      if (axios.isAxiosError(error) && error.name === 'AbortError') {
        // Rethrow abort errors to be handled by the caller
        throw error;
      }

      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          user: null,
          message: error.response.data.message || 'Error fetching user profile'
        };
      }
      return {
        success: false,
        user: null,
        message: 'Error fetching user profile'
      };
    }
  },

  /**
   * Update the current user's profile
   * @param data - User profile data to update
   * @param options Optional request options including AbortSignal
   * @returns Promise with updated user profile data
   */
  updateProfile: async (
    data: UserProfileUpdateData,
    options?: { signal?: AbortSignal }
  ): Promise<UserProfileResponse> => {
    // Log the profile data being sent (excluding sensitive information)
    console.log('Updating user profile with data:', data);

    // Get the current user from session storage if available
    let user = null;
    try {
      const userJson = sessionStorage.getItem('user');
      if (userJson) {
        user = JSON.parse(userJson);
      }
    } catch (e) {
      console.error('Error parsing user from session storage:', e);
    }

    // Get CSRF token for secure requests
    const csrfToken = await authService.getCsrfToken();

    // Make the API call and let Axios errors propagate naturally
    const response = await axios.put('/api/user/profile', data, {
      headers: {
        'X-CSRF-Token': csrfToken
      },
      signal: options?.signal
    });

    // Log the *entire* response object received from Axios
    console.log('[userService.updateProfile] Raw Axios response:', response);

    // Log the response data structure for debugging
    console.log('[userService.updateProfile] Response data structure:', JSON.stringify(response.data, null, 2));

    // Return the response data with proper structure
    return {
      success: true, // Backend returns 200 OK, so this is always true
      message: response.data.message || 'Profile updated successfully',
      // Create a user object with the updated data
      user: {
        ...(user || {}),
        first_name: data.first_name || (user?.first_name || ''),
        last_name: data.last_name || (user?.last_name || '')
      }
    };
  },

  /**
   * Change the current user's password
   * @param currentPassword - Current password
   * @param newPassword - New password
   * @returns Promise with success/error message
   */
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Log the request (without exposing sensitive data)
      console.log('Changing password via userService');

      // Call authService and let errors propagate to authService
      const response = await authService.changePassword(currentPassword, newPassword);

      // Return success response
      return {
        success: response.success,
        message: response.message || ''
      };
    } catch (error) {
      // Handle errors from authService.changePassword
      console.error('Error changing password:', error);

      // Extract error message from Axios error if available
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          message: error.response.data.message || 'Error al cambiar la contraseña. Por favor, intente nuevamente.'
        };
      }

      // Generic error message for other types of errors
      return {
        success: false,
        message: 'Error de red. Por favor, verifique su conexión.'
      };
    }
  },

  /**
   * Update the user's profile image
   * @param formData - FormData containing the profile_image file
   * @returns Promise with updated user profile data
   */
  updateProfileImage: async (formData: FormData): Promise<UserProfileResponse> => {
    try {
      // Get CSRF token for secure requests
      const csrfToken = await authService.getCsrfToken();

      // Make the API call with FormData
      const response = await axios.post('/api/user/profile/image', formData, {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Get the current user from session storage if available
      let user = null;
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          user = JSON.parse(userJson);
        }
      } catch (e) {
        console.error('Error parsing user from session storage:', e);
      }

      // Return the response data
      return {
        success: true,
        message: response.data.message || 'Imagen de perfil actualizada exitosamente',
        // Create a user object with the updated profile image URL
        user: {
          ...(user || {}),
          profile_image_url: response.data.profile_image_url || user?.profile_image_url
        }
      };
    } catch (error) {
      console.error('Error updating profile image:', error);

      // Extract error message from Axios error if available
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          user: null,
          message: error.response.data.message || 'Error al actualizar la imagen de perfil'
        };
      }

      // Generic error message for other types of errors
      return {
        success: false,
        user: null,
        message: 'Error de red. Por favor, verifique su conexión.'
      };
    }
  }
};

export default userService;
