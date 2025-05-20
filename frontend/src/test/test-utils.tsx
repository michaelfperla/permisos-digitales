import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AuthContext from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { mockUser } from './mocks/authService';
import { vi } from 'vitest';

// Create a function to get a fresh auth context value for each test
const createMockAuthContextValue = (initialState = { isAuthenticated: true }) => {
  // Initialize session storage with user if authenticated
  if (initialState.isAuthenticated && !sessionStorage.getItem('user')) {
    sessionStorage.setItem('user', JSON.stringify(mockUser));
  }

  // Get user from session storage or use mock user
  const getUserFromSession = () => {
    const userJson = sessionStorage.getItem('user');
    if (userJson) {
      try {
        return JSON.parse(userJson);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  // Set initial user state
  const [user, setUserState] = React.useState(getUserFromSession());
  const [isAuthenticated, setIsAuthenticated] = React.useState(!!user);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Update session storage when user changes
  React.useEffect(() => {
    if (user) {
      sessionStorage.setItem('user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('user');
    }
  }, [user]);

  // Login implementation
  const login = vi.fn().mockImplementation((email, password) => {
    setIsLoading(true);

    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        if (email === 'test@example.com' && password === 'password123') {
          setUserState(mockUser);
          setIsAuthenticated(true);
          setIsLoading(false);
          resolve({
            success: true,
            user: mockUser,
            message: 'Login successful'
          });
        } else {
          setError('Invalid email or password');
          setIsLoading(false);
          resolve({
            success: false,
            user: null,
            message: 'Invalid email or password'
          });
        }
      }, 10); // Small timeout to simulate async
    });
  });

  // Logout implementation
  const logout = vi.fn().mockImplementation(() => {
    setIsLoading(true);

    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        setUserState(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        resolve({ success: true, message: 'Logout successful' });
      }, 10); // Small timeout to simulate async
    });
  });

  // Register implementation
  const register = vi.fn().mockImplementation(() => {
    setIsLoading(true);

    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        setIsLoading(false);
        resolve({ success: true, user: mockUser, message: 'Registration successful' });
      }, 10); // Small timeout to simulate async
    });
  });

  // Check auth implementation
  const checkAuth = vi.fn().mockImplementation(() => {
    setIsLoading(true);

    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        const currentUser = getUserFromSession();
        setUserState(currentUser);
        setIsAuthenticated(!!currentUser);
        setIsLoading(false);
        resolve();
      }, 10); // Small timeout to simulate async
    });
  });

  // Clear error implementation
  const clearError = vi.fn().mockImplementation(() => {
    setError(null);
  });

  return {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout,
    register,
    checkAuth,
    error,
    clearError,
    // Add setUser for tests that need to directly manipulate the user state
    setUser: setUserState
  };
};

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  // Create a fresh auth context value for each render
  const mockAuthContextValue = createMockAuthContextValue();

  return (
    <BrowserRouter>
      <AuthContext.Provider value={mockAuthContextValue}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authState?: { isAuthenticated: boolean };
}

const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions,
) => {
  // Create a custom wrapper with the provided auth state
  const CustomWrapper = ({ children }: { children: React.ReactNode }) => {
    const mockAuthContextValue = createMockAuthContextValue(options?.authState);

    return (
      <BrowserRouter>
        <AuthContext.Provider value={mockAuthContextValue}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthContext.Provider>
      </BrowserRouter>
    );
  };

  // Use the custom wrapper if authState is provided, otherwise use the default wrapper
  const wrapper = options?.authState ? CustomWrapper : AllTheProviders;

  // Remove authState from options to avoid passing it to render
  const { authState, ...renderOptions } = options || {};

  return render(ui, { wrapper, ...renderOptions });
};

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render method
export { customRender as render };
