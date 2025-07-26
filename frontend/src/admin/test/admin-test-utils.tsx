// Admin-specific test utilities
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react';
import React, { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { AdminAuthContext, AdminAuthContextType } from '../../shared/contexts/AuthContext';
import { ToastProvider } from '../../shared/contexts/ToastContext';
import { createMockAdminUser } from '../../test/factories';

// Define the initial state type for the admin auth hook
interface UseMockAdminAuthOptions {
  isAuthenticatedByDefault?: boolean;
  initialUser?: any;
}

// Custom Hook to provide mock admin auth context value
const useMockAdminAuthContext = (options?: UseMockAdminAuthOptions): AdminAuthContextType => {
  const { isAuthenticatedByDefault = true, initialUser = createMockAdminUser() } = options || {};

  const getAdminFromSession = () => {
    const userJson = sessionStorage.getItem('adminUser');
    if (userJson) {
      try {
        return JSON.parse(userJson);
      } catch (ignore) {
        sessionStorage.removeItem('adminUser');
        return null;
      }
    }
    return null;
  };

  const initialAuthUser = isAuthenticatedByDefault ? (getAdminFromSession() || initialUser) : null;

  if (isAuthenticatedByDefault && initialAuthUser && !sessionStorage.getItem('adminUser')) {
    sessionStorage.setItem('adminUser', JSON.stringify(initialAuthUser));
  } else if (!isAuthenticatedByDefault) {
    sessionStorage.removeItem('adminUser');
  }

  const [user, setUserState] = React.useState<any | null>(initialAuthUser);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(!!initialAuthUser);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      sessionStorage.setItem('adminUser', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('adminUser');
    }
  }, [user]);

  const login = vi.fn().mockImplementation((loggedInUser: any) => {
    setError(null);
    const hasAdminAccess = loggedInUser.accountType === 'admin' && loggedInUser.is_admin_portal === true;
    if (!hasAdminAccess) {
      setError('No tienes acceso al portal administrativo');
      return;
    }
    setUserState(loggedInUser);
    setIsAuthenticated(true);
    setIsLoading(false);
  });

  const logout = vi.fn().mockImplementation(async () => {
    setIsLoading(true);
    setError(null);
    await new Promise(resolve => setTimeout(resolve, 10));
    setUserState(null);
    setIsAuthenticated(false);
    setIsLoading(false);
  });

  const checkAuth = vi.fn().mockImplementation(async () => {
    setIsLoading(true);
    setError(null);
    await new Promise(resolve => setTimeout(resolve, 10));
    const currentUser = getAdminFromSession();
    setUserState(currentUser);
    setIsAuthenticated(!!currentUser);
    setIsLoading(false);
  });

  const clearError = vi.fn().mockImplementation(() => {
    setError(null);
  });

  return {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout,
    checkAuth,
    error,
    clearError,
    setUser: setUserState,
  } as AdminAuthContextType;
};

interface CustomAdminRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authContextProps?: UseMockAdminAuthOptions;
  queryClient?: QueryClient;
  initialEntries?: string[];
}

// Create a default query client for admin tests
const createAdminTestQueryClient = () => new QueryClient({
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

const customAdminRender = (ui: ReactElement, options?: CustomAdminRenderOptions) => {
  const queryClient = options?.queryClient ?? createAdminTestQueryClient();

  const WrapperComponent = ({ children }: { children: ReactNode }) => {
    const authValue = useMockAdminAuthContext(options?.authContextProps);
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AdminAuthContext.Provider value={authValue}>
            <ToastProvider>{children}</ToastProvider>
          </AdminAuthContext.Provider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  return render(ui, { wrapper: WrapperComponent, ...options });
};

// eslint-disable-next-line react-refresh/only-export-components -- This is a test utility file that legitimately exports both components and utilities
export * from '@testing-library/react';

export {
  customAdminRender as renderAdmin,
  createAdminTestQueryClient,
  useMockAdminAuthContext
};

// Additional admin test utilities
export const waitForAdminLoadingToFinish = () =>
  new Promise(resolve => setTimeout(resolve, 0));

// Helper to create mock admin service
export const createMockAdminService = () => ({
  getApplications: vi.fn(),
  getApplicationById: vi.fn(),
  updateApplicationStatus: vi.fn(),
  getUsers: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  getDashboardStats: vi.fn(),
});

// Mock admin auth service
export const createMockAdminAuthService = () => ({
  login: vi.fn(),
  logout: vi.fn(),
  checkStatus: vi.fn(),
  getCurrentUser: vi.fn(),
  isLoggedIn: vi.fn(),
});
