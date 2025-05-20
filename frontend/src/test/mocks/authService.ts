import { vi } from 'vitest';
import { User } from '../../services/authService';

// Mock user data
export const mockUser: User = {
  id: '123',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  role: 'user',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
};

// Mock CSRF token for tests
export const mockCsrfToken = 'test-csrf-token';

// Mock auth service
const authServiceMock = {
  login: vi.fn().mockImplementation((email: string, password: string) => {
    if (email === 'test@example.com' && password === 'password') {
      // Store user in session storage to simulate login
      sessionStorage.setItem('user', JSON.stringify(mockUser));
      return Promise.resolve({
        success: true,
        user: mockUser,
        message: 'Login successful'
      });
    }

    return Promise.resolve({
      success: false,
      user: null,
      message: 'Invalid email or password'
    });
  }),

  register: vi.fn().mockImplementation((userData: any) => {
    if (userData.email === 'existing@example.com') {
      return Promise.resolve({
        success: false,
        user: null,
        message: 'Email already exists'
      });
    }

    const newUser = {
      id: '456',
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return Promise.resolve({
      success: true,
      user: newUser,
      message: 'Registration successful'
    });
  }),

  logout: vi.fn().mockImplementation(() => {
    // Clear user from session storage to simulate logout
    sessionStorage.removeItem('user');
    return Promise.resolve({
      success: true,
      message: 'Logout successful'
    });
  }),

  checkStatus: vi.fn().mockImplementation(() => {
    // Check if user exists in session storage
    const userJson = sessionStorage.getItem('user');
    const isAuthenticated = !!userJson;
    const user = userJson ? JSON.parse(userJson) : null;

    return Promise.resolve({
      success: true,
      isAuthenticated,
      user
    });
  }),

  forgotPassword: vi.fn().mockImplementation((email: string) => {
    if (email === 'test@example.com') {
      return Promise.resolve({
        success: true,
        message: 'Password reset email sent'
      });
    }

    return Promise.resolve({
      success: false,
      message: 'Email not found'
    });
  }),

  resetPassword: vi.fn().mockImplementation((token: string, password: string) => {
    if (token === 'valid-token') {
      return Promise.resolve({
        success: true,
        message: 'Password reset successful'
      });
    }

    return Promise.resolve({
      success: false,
      message: 'Invalid or expired token'
    });
  }),

  getCsrfToken: vi.fn().mockResolvedValue(mockCsrfToken),

  getCurrentUser: vi.fn().mockImplementation(() => {
    // Get user from session storage
    const userJson = sessionStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
  }),

  isLoggedIn: vi.fn().mockImplementation(() => {
    // Check if user exists in session storage
    return !!sessionStorage.getItem('user');
  }),

  changePassword: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      success: true,
      message: 'Password changed successfully'
    });
  })
};

export default authServiceMock;
