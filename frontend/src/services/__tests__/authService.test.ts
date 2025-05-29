import { AxiosError } from 'axios';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define mock functions for axios methods
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

// Mock axios module
vi.mock('axios', () => {
  return {
    default: {
      create: () => ({
        get: mockGet,
        post: mockPost,
        put: mockPut,
        delete: mockDelete,
      }),
      isAxiosError: (error: any): error is AxiosError => !!error?.isAxiosError,
    },
  };
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Import authService after mocking
let authService: typeof import('../authService');

describe('authService', () => {
  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    mockSessionStorage.clear();

    // Import the module for each test to ensure clean state
    authService = await import('../authService');
  });

  afterEach(() => {
    vi.resetModules();
  });

  // Tests for non-API functions
  describe('getCurrentUser', () => {
    it('should return null when no user in sessionStorage', () => {
      mockSessionStorage.getItem.mockReturnValueOnce(null);

      const result = authService.getCurrentUser();

      expect(result).toBeNull();
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('user');
    });

    it('should return user object when user exists in sessionStorage', () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        accountType: 'citizen',
      };
      mockSessionStorage.getItem.mockReturnValueOnce(JSON.stringify(mockUser));

      const result = authService.getCurrentUser();

      expect(result).toEqual(mockUser);
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('user');
    });

    it('should return null when sessionStorage contains invalid JSON', () => {
      mockSessionStorage.getItem.mockReturnValueOnce('invalid-json');

      const result = authService.getCurrentUser();

      expect(result).toBeNull();
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('user');
    });
  });

  describe('isLoggedIn', () => {
    it('should return true when user exists in sessionStorage', () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        accountType: 'citizen',
      };
      mockSessionStorage.getItem.mockReturnValueOnce(JSON.stringify(mockUser));

      const result = authService.isLoggedIn();

      expect(result).toBe(true);
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('user');
    });

    it('should return false when no user in sessionStorage', () => {
      mockSessionStorage.getItem.mockReturnValueOnce(null);

      const result = authService.isLoggedIn();

      expect(result).toBe(false);
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('user');
    });
  });

  // Tests for API functions

  describe('login', () => {
    it('should fetch CSRF token and login successfully', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        accountType: 'citizen',
      };
      const mockResponse = { success: true, message: 'Login successful', user: mockUser };

      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock login request
      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.login('test@example.com', 'password');

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith(
        '/auth/login',
        { email: 'test@example.com', password: 'password' },
        { headers: { 'X-CSRF-Token': 'test-csrf-token' } },
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
    });

    it('should reuse existing CSRF token if available', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        accountType: 'citizen',
      };
      const mockResponse = { success: true, message: 'Login successful', user: mockUser };

      // First call to get CSRF token
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // First login
      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      await authService.login('test@example.com', 'password');

      // Reset mocks to verify second call
      mockGet.mockClear();
      mockPost.mockClear();
      mockSessionStorage.setItem.mockClear();

      // Second login should reuse token
      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.login('test@example.com', 'password');

      expect(result).toEqual(mockResponse);
      expect(mockGet).not.toHaveBeenCalled(); // Should not call for CSRF token again
      expect(mockPost).toHaveBeenCalledWith(
        '/auth/login',
        { email: 'test@example.com', password: 'password' },
        { headers: { 'X-CSRF-Token': 'test-csrf-token' } },
      );
    });

    it('should handle API error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock login request with error
      const axiosError = new Error('API error') as AxiosError;
      axiosError.isAxiosError = true;
      axiosError.response = {
        data: { message: 'Invalid credentials' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: {} as any,
      };
      mockPost.mockRejectedValueOnce(axiosError);

      const result = await authService.login('test@example.com', 'wrong-password');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle network error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock login request with network error
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      // Use a non-test email to avoid the development fallback
      const result = await authService.login('regular@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error. Please check your connection.');
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('should not use development fallback for normal API errors', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock login request with error
      const axiosError = new Error('API error') as AxiosError;
      axiosError.isAxiosError = true;
      axiosError.response = {
        data: { message: 'Invalid credentials' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: {} as any,
      };
      mockPost.mockRejectedValueOnce(axiosError);

      const result = await authService.login('regular@example.com', 'wrong-password');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should fetch CSRF token and register successfully', async () => {
      const userData = {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        password: 'password',
      };
      const mockResponse = { success: true, message: 'Registration successful' };

      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock register request
      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.register(userData);

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith('/auth/register', userData, {
        headers: { 'X-CSRF-Token': 'test-csrf-token' },
      });
    });

    it('should handle API error and return failure response', async () => {
      const userData = {
        first_name: 'Test',
        last_name: 'User',
        email: 'existing@example.com',
        password: 'password',
      };

      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock register request with error
      const axiosError = new Error('API error') as AxiosError;
      axiosError.isAxiosError = true;
      axiosError.response = {
        data: { message: 'Email already exists' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      };
      mockPost.mockRejectedValueOnce(axiosError);

      const result = await authService.register(userData);

      // Verify proper error handling
      expect(result.success).toBe(false);
      expect(result.message).toBe('Email already exists');
    });

    it('should handle network error and return failure response', async () => {
      const userData = {
        first_name: 'Test',
        last_name: 'User',
        email: 'regular@example.com',
        password: 'password',
      };

      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock register request with network error
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      const result = await authService.register(userData);

      // Verify proper error handling
      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error. Please check your connection.');
    });
  });

  describe('checkStatus', () => {
    it('should return logged in status and user when authenticated', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        accountType: 'citizen',
      };

      mockGet.mockResolvedValueOnce({
        data: { isLoggedIn: true, user: mockUser },
      });

      const result = await authService.checkStatus();

      expect(result.isLoggedIn).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockGet).toHaveBeenCalledWith('/auth/status');
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
    });

    it('should return not logged in status when not authenticated', async () => {
      mockGet.mockResolvedValueOnce({
        data: { isLoggedIn: false },
      });

      const result = await authService.checkStatus();

      expect(result.isLoggedIn).toBe(false);
      expect(result.user).toBeUndefined();
      expect(mockGet).toHaveBeenCalledWith('/auth/status');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('should handle API error and return not logged in', async () => {
      mockGet.mockRejectedValueOnce(new Error('API error'));

      const result = await authService.checkStatus();

      expect(result.isLoggedIn).toBe(false);
      expect(mockGet).toHaveBeenCalledWith('/auth/status');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('should use session storage as fallback when API fails but user exists in session', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        accountType: 'citizen',
      };

      mockGet.mockRejectedValueOnce(new Error('API error'));
      mockSessionStorage.getItem.mockReturnValueOnce(JSON.stringify(mockUser));

      const result = await authService.checkStatus();

      expect(result.isLoggedIn).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockGet).toHaveBeenCalledWith('/auth/status');
      expect(mockSessionStorage.removeItem).toHaveBeenCalled();
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('user');
    });
  });

  describe('logout', () => {
    it('should fetch CSRF token and logout successfully', async () => {
      const mockResponse = { success: true, message: 'Logout successful' };

      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock logout request
      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.logout();

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith(
        '/auth/logout',
        {},
        { headers: { 'X-CSRF-Token': 'test-csrf-token' } },
      );
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('should handle API error, remove user from session, and return success response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock logout request with error
      mockPost.mockRejectedValueOnce(new Error('API error'));

      const result = await authService.logout();

      expect(result.success).toBe(true); // Note: logout returns success even on API error
      expect(result.message).toContain('Logout successful. You have been logged out locally');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('forgotPassword', () => {
    it('should fetch CSRF token and request password reset successfully', async () => {
      const mockResponse = { success: true, message: 'Password reset email sent' };

      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock forgot password request
      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.forgotPassword('test@example.com');

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith(
        '/auth/forgot-password',
        { email: 'test@example.com' },
        { headers: { 'X-CSRF-Token': 'test-csrf-token' } },
      );
    });

    it('should handle API error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock forgot password request with error
      const axiosError = new Error('API error') as AxiosError;
      axiosError.isAxiosError = true;
      axiosError.response = {
        data: { message: 'Email not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
      };
      mockPost.mockRejectedValueOnce(axiosError);

      const result = await authService.forgotPassword('nonexistent@example.com');

      // Verify proper error handling
      expect(result.success).toBe(false);
      expect(result.message).toBe('Email not found');
    });

    it('should handle network error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock forgot password request with network error
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      const result = await authService.forgotPassword('regular@example.com');

      // Verify proper error handling
      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error. Please check your connection.');
    });
  });

  describe('resetPassword', () => {
    it('should fetch CSRF token and reset password successfully', async () => {
      const mockResponse = { success: true, message: 'Password reset successful' };

      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock reset password request
      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.resetPassword('reset-token-123', 'newpassword');

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith(
        '/auth/reset-password',
        { token: 'reset-token-123', password: 'newpassword' },
        { headers: { 'X-CSRF-Token': 'test-csrf-token' } },
      );
    });

    it('should handle API error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock reset password request with error
      const axiosError = new Error('API error') as AxiosError;
      axiosError.isAxiosError = true;
      axiosError.response = {
        data: { message: 'Invalid or expired token' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      };
      mockPost.mockRejectedValueOnce(axiosError);

      const result = await authService.resetPassword('invalid-token', 'newpassword');

      // Verify proper error handling
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid or expired token');
    });

    it('should handle network error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock reset password request with network error
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      const result = await authService.resetPassword('reset-token', 'newpassword');

      // Verify proper error handling
      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error. Please check your connection.');
    });
  });

  describe('changePassword', () => {
    it('should fetch CSRF token and change password successfully', async () => {
      const mockResponse = { success: true, message: 'Password changed successfully' };

      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock change password request
      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.changePassword('currentpassword', 'newpassword');

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith(
        '/auth/change-password',
        { currentPassword: 'currentpassword', newPassword: 'newpassword' },
        { headers: { 'X-CSRF-Token': 'test-csrf-token' } },
      );
    });

    it('should throw API error when the server returns an error', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock change password request with error
      const axiosError = new Error('API error') as AxiosError;
      axiosError.isAxiosError = true;
      axiosError.response = {
        data: { message: 'Current password is incorrect' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      };
      mockPost.mockRejectedValueOnce(axiosError);

      // The function should now throw the error instead of handling it
      await expect(authService.changePassword('wrongpassword', 'newpassword')).rejects.toThrow();
    });

    it('should throw network error when there is a connection issue', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      // Mock change password request with network error
      const networkError = new Error('Network error');
      mockPost.mockRejectedValueOnce(networkError);

      // The function should now throw the error instead of handling it
      await expect(authService.changePassword('currentpassword', 'newpassword')).rejects.toThrow(
        'Network error',
      );
    });
  });
});
