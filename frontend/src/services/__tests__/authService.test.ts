import { AxiosError } from 'axios';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the API service
const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn(), eject: vi.fn() },
    response: { use: vi.fn(), eject: vi.fn() },
  },
};

vi.mock('../api', () => ({
  api: mockApi,
  default: mockApi,
}));

// Mock CSRF utilities
vi.mock('../../utils/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('mock-csrf-token'),
  addCsrfTokenInterceptor: vi.fn(),
}));

// Mock debug utilities
vi.mock('../../utils/debug', () => ({
  debugLog: vi.fn(),
  errorLog: vi.fn(),
}));

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
    it('should login successfully', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        accountType: 'citizen',
      };
      const mockResponse = {
        success: true,
        message: 'Login successful',
        data: { user: mockUser }
      };

      // Mock login request
      mockApi.post.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.login('test@example.com', 'password');

      expect(result).toEqual({
        success: true,
        message: 'Login successful',
        user: mockUser,
      });
      expect(mockApi.post).toHaveBeenCalledWith(
        '/auth/login',
        { email: 'test@example.com', password: 'password' },
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
    });

    it('should handle API error and return failure response', async () => {
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
      mockApi.post.mockRejectedValueOnce(axiosError);

      const result = await authService.login('test@example.com', 'wrong-password');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle network error and return failure response', async () => {
      // Mock login request with network error
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await authService.login('regular@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error de conexión. Por favor, verifica tu conexión a internet.');
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });

  });

  describe('register', () => {
    it('should register successfully', async () => {
      const userData = {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        password: 'password',
      };
      const mockResponse = { success: true, message: 'Registration successful' };

      // Mock register request
      mockApi.post.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.register(userData);

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith('/auth/register', userData);
    });

    it('should handle API error and return failure response', async () => {
      const userData = {
        first_name: 'Test',
        last_name: 'User',
        email: 'existing@example.com',
        password: 'password',
      };

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
      mockApi.post.mockRejectedValueOnce(axiosError);

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

      // Mock register request with network error
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await authService.register(userData);

      // Verify proper error handling
      expect(result.success).toBe(false);
      expect(result.message).toBe('Error de conexión. Por favor, verifica tu conexión a internet.');
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

      mockApi.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: { isLoggedIn: true, user: mockUser }
        },
      });

      const result = await authService.checkStatus();

      expect(result.isLoggedIn).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockApi.get).toHaveBeenCalledWith('/auth/status', { signal: undefined });
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
    });

    it('should return not logged in status when not authenticated', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: { isLoggedIn: false }
        },
      });

      const result = await authService.checkStatus();

      expect(result.isLoggedIn).toBe(false);
      expect(result.user).toBeUndefined();
      expect(mockApi.get).toHaveBeenCalledWith('/auth/status', { signal: undefined });
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('should handle API error and return not logged in', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('API error'));

      const result = await authService.checkStatus();

      expect(result.isLoggedIn).toBe(false);
      expect(mockApi.get).toHaveBeenCalledWith('/auth/status', { signal: undefined });
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

      mockApi.get.mockRejectedValueOnce(new Error('API error'));
      mockSessionStorage.getItem.mockReturnValueOnce(JSON.stringify(mockUser));

      const result = await authService.checkStatus();

      expect(result.isLoggedIn).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockApi.get).toHaveBeenCalledWith('/auth/status', { signal: undefined });
      expect(mockSessionStorage.removeItem).toHaveBeenCalled();
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('user');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const mockResponse = { success: true, message: 'Logout successful' };

      // Mock logout request
      mockApi.post.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.logout();

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith('/auth/logout', {});
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('should handle API error, remove user from session, and return success response', async () => {
      // Mock logout request with error
      mockApi.post.mockRejectedValueOnce(new Error('API error'));

      const result = await authService.logout();

      expect(result.success).toBe(true); // Note: logout returns success even on API error
      expect(result.message).toContain('Sesión cerrada exitosamente');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('forgotPassword', () => {
    it('should request password reset successfully', async () => {
      const mockResponse = { success: true, message: 'Password reset email sent' };

      // Mock forgot password request
      mockApi.post.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.forgotPassword('test@example.com');

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith(
        '/auth/forgot-password',
        { email: 'test@example.com' },
      );
    });

    it('should handle API error and return failure response', async () => {
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
      mockApi.post.mockRejectedValueOnce(axiosError);

      const result = await authService.forgotPassword('nonexistent@example.com');

      // Verify proper error handling
      expect(result.success).toBe(false);
      expect(result.message).toBe('Email not found');
    });

    it('should handle network error and return failure response', async () => {
      // Mock forgot password request with network error
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await authService.forgotPassword('regular@example.com');

      // Verify proper error handling
      expect(result.success).toBe(false);
      expect(result.message).toBe('Error de conexión. Por favor, verifica tu conexión a internet.');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const mockResponse = { success: true, message: 'Password reset successful' };

      // Mock reset password request
      mockApi.post.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.resetPassword('reset-token-123', 'newpassword');

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith(
        '/auth/reset-password',
        { token: 'reset-token-123', password: 'newpassword' },
      );
    });

    it('should handle API error and return failure response', async () => {
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
      mockApi.post.mockRejectedValueOnce(axiosError);

      const result = await authService.resetPassword('invalid-token', 'newpassword');

      // Verify proper error handling
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid or expired token');
    });

    it('should handle network error and return failure response', async () => {
      // Mock reset password request with network error
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await authService.resetPassword('reset-token', 'newpassword');

      // Verify proper error handling
      expect(result.success).toBe(false);
      expect(result.message).toBe('Error de conexión. Por favor, verifica tu conexión a internet.');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockResponse = { success: true, message: 'Password changed successfully' };

      // Mock change password request
      mockApi.post.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await authService.changePassword('currentpassword', 'newpassword');

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith(
        '/auth/change-password',
        { currentPassword: 'currentpassword', newPassword: 'newpassword' },
      );
    });

    it('should throw API error when the server returns an error', async () => {
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
      mockApi.post.mockRejectedValueOnce(axiosError);

      // The function should now throw the error instead of handling it
      await expect(authService.changePassword('wrongpassword', 'newpassword')).rejects.toThrow();
    });

    it('should throw network error when there is a connection issue', async () => {
      // Mock change password request with network error
      const networkError = new Error('Network error');
      mockApi.post.mockRejectedValueOnce(networkError);

      // The function should now throw the error instead of handling it
      await expect(authService.changePassword('currentpassword', 'newpassword')).rejects.toThrow(
        'Network error',
      );
    });
  });
});
