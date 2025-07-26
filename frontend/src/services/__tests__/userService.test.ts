import axios, { AxiosError } from 'axios';
import { vi, describe, test, expect, beforeEach } from 'vitest';

import { User } from '../../shared/contexts/AuthContext';
// Import userService AFTER mocks
import api from '../api';
import authService from '../authService';
import userService from '../userService';

// Mock dependencies BEFORE importing userService
vi.mock('axios');
vi.mock('../api', () => ({
  default: {
    defaults: {
      baseURL: '',
      withCredentials: true,
      headers: {},
    },
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('../authService');

// Mock the logger module
vi.mock('../../utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('userService', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
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

      vi.mocked(api.get).mockResolvedValueOnce({
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
      expect(api.get).toHaveBeenCalledWith('/api/user/profile', { signal: undefined });
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

      vi.mocked(api.get).mockRejectedValueOnce(mockAxiosError);

      // Act
      const result = await userService.getProfile();

      // Assert
      expect(result).toEqual({
        success: false,
        user: null,
        message: 'Error fetching user profile',
      });
      expect(api.get).toHaveBeenCalledWith('/api/user/profile', { signal: undefined });
    });

    test('should handle network error when fetching profile', async () => {
      // Arrange
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Network Failure'));

      // Act
      const result = await userService.getProfile();

      // Assert
      expect(result).toEqual({
        success: false,
        user: null,
        message: 'Error fetching user profile',
      });
      expect(api.get).toHaveBeenCalledWith('/api/user/profile', { signal: undefined });
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

      const existingUser: User = {
        id: 'usr_1',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        accountType: 'citizen',
      };

      // Setup sessionStorage to return existing user
      vi.mocked(window.sessionStorage.getItem).mockReturnValue(JSON.stringify(existingUser));

      const mockCsrfToken = 'test-csrf-token';
      vi.mocked(authService.getCsrfToken).mockResolvedValueOnce(mockCsrfToken);

      vi.mocked(api.put).mockResolvedValueOnce({
        data: {
          success: true,
          user: {
            ...existingUser,
            ...updateData,
          },
          message: 'Profile updated successfully',
        },
      });

      // Act
      const result = await userService.updateProfile(updateData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Profile updated successfully');
      expect(result.user?.first_name).toBe('Updated');
      expect(result.user?.last_name).toBe('User');
      expect(result.user?.id).toBe('usr_1');
      expect(result.user?.email).toBe('test@example.com');
      expect(result.user?.accountType).toBe('citizen');
      
      expect(authService.getCsrfToken).toHaveBeenCalled();
      expect(api.put).toHaveBeenCalledWith('/api/user/profile', updateData, {
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

      vi.mocked(api.put).mockRejectedValueOnce(mockAxiosError);

      // Act & Assert
      await expect(userService.updateProfile(updateData)).rejects.toThrow();
      expect(authService.getCsrfToken).toHaveBeenCalled();
      expect(api.put).toHaveBeenCalledWith('/api/user/profile', updateData, {
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
      vi.mocked(api.put).mockRejectedValueOnce(networkError);

      // Act & Assert
      await expect(userService.updateProfile(updateData)).rejects.toThrow('Network Failure');
      expect(authService.getCsrfToken).toHaveBeenCalled();
      expect(api.put).toHaveBeenCalledWith('/api/user/profile', updateData, {
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
