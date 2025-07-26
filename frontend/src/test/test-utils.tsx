// frontend/src/test/test-utils.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react';
import React, { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { mockUser } from './mocks/authService';
// Ensure this alias matches your actual context export
import { UserAuthContext as AuthContext, UserAuthContextType as AuthContextType } from '../shared/contexts/AuthContext';
import { ToastProvider } from '../shared/contexts/ToastContext';

// Define the initial state type for the hook
interface UseMockAuthOptions {
  isAuthenticatedByDefault?: boolean;
  initialUser?: any;
  user?: any;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  login?: any;
  logout?: any;
  checkAuthStatus?: any;
}

// Custom Hook to provide mock auth context value
const useMockAuthContext = (options?: UseMockAuthOptions): AuthContextType => {
  const { isAuthenticatedByDefault = true, initialUser = mockUser } = options || {};

  const getUserFromSession = () => {
    const userJson = sessionStorage.getItem('user');
    if (userJson) {
      try {
        return JSON.parse(userJson);
      } catch (ignore) { // Changed _e to ignore
        sessionStorage.removeItem('user');
        return null;
      }
    }
    return null;
  };

  const initialAuthUser = isAuthenticatedByDefault ? (getUserFromSession() || initialUser) : null;

  if (isAuthenticatedByDefault && initialAuthUser && !sessionStorage.getItem('user')) {
    sessionStorage.setItem('user', JSON.stringify(initialAuthUser));
  } else if (!isAuthenticatedByDefault) {
    sessionStorage.removeItem('user');
  }

  const [user, setUserState] = React.useState<any | null>(initialAuthUser);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(!!initialAuthUser);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      sessionStorage.setItem('user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('user');
    }
  }, [user]);

  const login = vi.fn().mockImplementation(async (email, password) => {
    setIsLoading(true);
    setError(null);
    await new Promise(resolve => setTimeout(resolve, 10));
    if (email === 'test@example.com' && password === 'password123') {
      const loggedInUser = initialUser || mockUser;
      setUserState(loggedInUser);
      setIsAuthenticated(true);
      setIsLoading(false);
      return true;
    } else {
      setError('Invalid email or password');
      setIsLoading(false);
      return false;
    }
  });

  const logout = vi.fn().mockImplementation(async () => {
    setIsLoading(true);
    setError(null);
    await new Promise(resolve => setTimeout(resolve, 10));
    setUserState(null);
    setIsAuthenticated(false);
    setIsLoading(false);
  });

  const register = vi.fn().mockImplementation(async () => {
    setIsLoading(true);
    setError(null);
    await new Promise(resolve => setTimeout(resolve, 10));
    setIsLoading(false);
    return true;
  });

  const checkAuth = vi.fn().mockImplementation(async () => {
    setIsLoading(true);
    setError(null);
    await new Promise(resolve => setTimeout(resolve, 10));
    const currentUser = getUserFromSession();
    setUserState(currentUser);
    setIsAuthenticated(!!currentUser);
    setIsLoading(false);
  });

  const clearError = vi.fn().mockImplementation(() => {
    setError(null);
  });

  const resendVerificationEmail = vi.fn().mockResolvedValue({ success: true, message: 'Verification email sent' });

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
    setUser: setUserState,
    resendVerificationEmail,
  } as AuthContextType;
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authContextProps?: UseMockAuthOptions;
  queryClient?: QueryClient;
  initialEntries?: string[];
}

// Create a default query client for tests
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

const customRender = (ui: ReactElement, options?: CustomRenderOptions) => {
  const queryClient = options?.queryClient ?? createTestQueryClient();

  const WrapperComponent = ({ children }: { children: ReactNode }) => {
    const authValue = useMockAuthContext(options?.authContextProps);
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthContext.Provider value={authValue}>
            <ToastProvider>{children}</ToastProvider>
          </AuthContext.Provider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  return render(ui, { wrapper: WrapperComponent, ...options });
};

// eslint-disable-next-line react-refresh/only-export-components -- This is a test utility file that legitimately exports both components and utilities
export * from '@testing-library/react';

export { customRender as render, createTestQueryClient };

// Additional test utilities
export const waitForLoadingToFinish = () =>
  new Promise(resolve => setTimeout(resolve, 0));

// Helper to create admin auth context
export const createAdminAuthContext = (options?: UseMockAuthOptions): AuthContextType => {
  // This would be similar to useMockAuthContext but for admin
  // Implementation would depend on admin auth structure
  // Note: This is a factory function, not a hook, so we create the mock directly
  return {
    user: options?.user || null,
    isAuthenticated: options?.isAuthenticated || false,
    isLoading: options?.isLoading || false,
    error: null,
    login: options?.login || vi.fn(),
    register: vi.fn(),
    logout: options?.logout || vi.fn(),
    checkAuth: options?.checkAuthStatus || vi.fn(),
    clearError: vi.fn(),
    setUser: vi.fn(),
    resendVerificationEmail: vi.fn(),
  };
};

// Helper to render with admin context
export const renderWithAdminAuth = (ui: ReactElement, options?: CustomRenderOptions) => {
  const authValue = createAdminAuthContext(options?.authContextProps);
  const queryClient = options?.queryClient ?? createTestQueryClient();

  const WrapperComponent = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthContext.Provider value={authValue}>
          <ToastProvider>{children}</ToastProvider>
        </AuthContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: WrapperComponent, ...options });
};