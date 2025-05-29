import axios, { AxiosError } from 'axios';
import { vi, describe, test, expect, beforeEach } from 'vitest';

import { User } from '../../shared/contexts/AuthContext';
// Import userService AFTER mocks
import authService from '../authService';
import userService from '../userService';

// Mock dependencies BEFORE importing userService
vi.mock('axios');
vi.mock('../authService');

describe('userService', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
  });

  // Test getProfile
  describe('getProfile', () => {
    test('should fetch user profile successfully', async () => {
      // Arrange
      const mockProfileData: User = {
        id: 'usr_1',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        accountType: 'citizen',
      };

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          success: true,
          user: mockProfileData,
          message: 'Profile fetched successfully',
        },
      });

      // Act
      const result = await userService.getProfile();

      // Assert
      expect(result).toEqual({
        success: true,
        user: mockProfileData,
        message: 'Profile fetched successfully',
      });
      expect(axios.get).toHaveBeenCalledWith('/api/user/profile');
    });

    test('should handle API error when fetching profile', async () => {
      // Arrange
      const apiErrorMessage = 'User profile not found';
      const mockAxiosError = new Error(apiErrorMessage) as AxiosError;
      mockAxiosError.isAxiosError = true;
      mockAxiosError.response = {
        data: { message: apiErrorMessage },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
      };

      vi.mocked(axios.get).mockRejectedValueOnce(mockAxiosError);

      // Act
      const result = await userService.getProfile();

      // Assert
      expect(result).toEqual({
        success: false,
        user: null,
        message: 'Error fetching user profile',
      });
      expect(axios.get).toHaveBeenCalledWith('/api/user/profile');
    });

    test('should handle network error when fetching profile', async () => {
      // Arrange
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network Failure'));

      // Act
      const result = await userService.getProfile();

      // Assert
      expect(result).toEqual({
        success: false,
        user: null,
        message: 'Error fetching user profile',
      });
      expect(axios.get).toHaveBeenCalledWith('/api/user/profile');
    });
  });

  // Test updateProfile
  describe('updateProfile', () => {
    test('should update user profile successfully', async () => {
      // Arrange
      const updateData = {
        first_name: 'Updated',
        last_name: 'User',
      };

      const expectedUpdatedUser: User = {
        id: 'usr_1',
        email: 'test@example.com',
        first_name: 'Updated',
        last_name: 'User',
        accountType: 'citizen',
      };

      const mockCsrfToken = 'test-csrf-token';
      vi.mocked(authService.getCsrfToken).mockResolvedValueOnce(mockCsrfToken);

      vi.mocked(axios.put).mockResolvedValueOnce({
        data: {
          success: true,
          user: expectedUpdatedUser,
          message: 'Profile updated successfully',
        },
      });

      // Act
      const result = await userService.updateProfile(updateData);

      // Assert
      expect(result).toEqual({
        success: true,
        user: expectedUpdatedUser,
        message: 'Profile updated successfully',
      });
      expect(authService.getCsrfToken).toHaveBeenCalled();
      expect(axios.put).toHaveBeenCalledWith('/api/user/profile', updateData, {
        headers: {
          'X-CSRF-Token': mockCsrfToken,
        },
        signal: undefined,
      });
    });

    test('should propagate API errors when updating profile', async () => {
      // Arrange
      const updateData = {
        first_name: 'Updated',
        last_name: 'User',
      };

      const mockCsrfToken = 'test-csrf-token';
      vi.mocked(authService.getCsrfToken).mockResolvedValueOnce(mockCsrfToken);

      const apiErrorMessage = 'Invalid profile data';
      const mockAxiosError = new Error(apiErrorMessage) as AxiosError;
      mockAxiosError.isAxiosError = true;
      mockAxiosError.response = {
        data: { message: apiErrorMessage },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      };

      vi.mocked(axios.put).mockRejectedValueOnce(mockAxiosError);

      // Act & Assert
      await expect(userService.updateProfile(updateData)).rejects.toThrow();
      expect(authService.getCsrfToken).toHaveBeenCalled();
      expect(axios.put).toHaveBeenCalledWith('/api/user/profile', updateData, {
        headers: {
          'X-CSRF-Token': mockCsrfToken,
        },
        signal: undefined,
      });
    });

    test('should propagate network errors when updating profile', async () => {
      // Arrange
      const updateData = {
        first_name: 'Updated',
        last_name: 'User',
      };

      const mockCsrfToken = 'test-csrf-token';
      vi.mocked(authService.getCsrfToken).mockResolvedValueOnce(mockCsrfToken);

      const networkError = new Error('Network Failure');
      vi.mocked(axios.put).mockRejectedValueOnce(networkError);

      // Act & Assert
      await expect(userService.updateProfile(updateData)).rejects.toThrow('Network Failure');
      expect(authService.getCsrfToken).toHaveBeenCalled();
      expect(axios.put).toHaveBeenCalledWith('/api/user/profile', updateData, {
        headers: {
          'X-CSRF-Token': mockCsrfToken,
        },
        signal: undefined,
      });
    });
  });

  // Test changePassword
  describe('changePassword', () => {
    test('should change password successfully', async () => {
      // Arrange
      const currentPassword = 'oldPassword123';
      const newPassword = 'newPassword456';

      vi.mocked(authService.changePassword).mockResolvedValueOnce({
        success: true,
        message: 'Password changed successfully',
      });

      // Act
      const result = await userService.changePassword(currentPassword, newPassword);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Password changed successfully',
      });
      expect(authService.changePassword).toHaveBeenCalledWith(currentPassword, newPassword);
    });

    test('should handle error when changing password', async () => {
      // Arrange
      const currentPassword = 'oldPassword123';
      const newPassword = 'newPassword456';

      vi.mocked(authService.changePassword).mockResolvedValueOnce({
        success: false,
        message: 'Incorrect current password',
      });

      // Act
      const result = await userService.changePassword(currentPassword, newPassword);

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Incorrect current password',
      });
      expect(authService.changePassword).toHaveBeenCalledWith(currentPassword, newPassword);
    });

    test('should handle empty message when changing password', async () => {
      // Arrange
      const currentPassword = 'oldPassword123';
      const newPassword = 'newPassword456';

      vi.mocked(authService.changePassword).mockResolvedValueOnce({
        success: false,
        message: undefined,
      });

      // Act
      const result = await userService.changePassword(currentPassword, newPassword);

      // Assert
      expect(result).toEqual({
        success: false,
        message: '',
      });
      expect(authService.changePassword).toHaveBeenCalledWith(currentPassword, newPassword);
    });
  });
});
