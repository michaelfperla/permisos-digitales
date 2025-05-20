import React, { createContext, useState, useEffect, useMemo, useContext, ReactNode, useCallback } from 'react';
import axios from 'axios';
import authService from '../services/authService';

// Define User type based on backend response
export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  accountType: string;
  is_admin_portal: boolean;
  accessDetails?: {
    isAdmin: boolean;
    hasAdminPortalAccess: boolean;
    sessionId: string;
  };
}

// Define the shape of our context
interface AuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  isLoading: boolean;
  error: string | null;
  checkAuth: (signal?: AbortSignal) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  login: (loggedInUser: AdminUser) => void; // Added login function
}

// Create the context with a default value
export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,
  checkAuth: async () => {},
  logout: async () => {},
  clearError: () => {},
  login: () => {}, // Added login function default
});

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticatedRaw] = useState(false);

  // Wrapper for setIsAuthenticated to add logging
  const setIsAuthenticated = (value: boolean) => {
    console.log(`[AuthContext] setIsAuthenticated called with: ${value}. Stack:`, new Error());
    setIsAuthenticatedRaw(value);
  };
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to check authentication status
  const checkAuth = useCallback(async (signal?: AbortSignal) => {
    console.log('[checkAuth] Starting...');
    try {
      setIsLoading(true);
      console.log('[checkAuth] Calling authService.checkStatus...');
      const response = await authService.checkStatus(signal);

      // If the request was aborted, don't update state
      if (signal?.aborted) {
        console.log('[checkAuth] Request was aborted, not updating state');
        return;
      }

      if (response.isLoggedIn && response.user) {
        // Verify this is an admin user with admin portal access
        const user = response.user as AdminUser;
        console.log('[checkAuth] User is logged in:', user);

        if (user.accessDetails?.isAdmin && user.accessDetails?.hasAdminPortalAccess) {
          console.log('[checkAuth] User has admin access, setting authenticated state');
          setIsAuthenticated(true);
          setUser(user);
          setError(null); // Clear any previous errors
        } else {
          console.log('[checkAuth] User does not have admin access, logging out');
          // Not an admin user or doesn't have admin portal access
          setIsAuthenticated(false);
          setUser(null);
          setError('No tienes acceso al portal administrativo');

          // Logout if not an admin
          try {
            await authService.logout();
          } catch (logoutErr: unknown) {
            console.error('Error during logout after access check:', logoutErr);
          }
        }
      } else {
        // User is not logged in according to the API
        console.log('[checkAuth] User is not logged in, setting unauthenticated state');
        setIsAuthenticated(false);
        setUser(null);
        // Don't set an error for normal unauthenticated state
        setError(null);

        // Clear any sessionStorage data to ensure consistency
        try {
          sessionStorage.removeItem('adminAuthenticated');
          sessionStorage.removeItem('adminUser');
          console.log('[checkAuth] Cleared sessionStorage authentication data');
        } catch (err: unknown) {
          console.error('[checkAuth] Error clearing sessionStorage:', err);
        }
      }
    } catch (err: unknown) {
      // Don't update state if the request was aborted
      if (signal?.aborted) {
        console.log('[checkAuth] Request was aborted during error handling, not updating state');
        return;
      }

      // Handle different error types
      if (axios.isCancel(err as Error)) {
        console.log('[checkAuth] Request was cancelled/aborted. Rethrowing...');
        throw err; // Rethrow to be caught by the caller
      } else {
        console.error(' [checkAuth] Error caught:', err);
        setIsAuthenticated(false);
        setUser(null);
        setError('Error al verificar el estado de autenticación');
      }
    } finally {
      console.log('[checkAuth] Finished.');
      // Only update loading state if the request wasn't aborted
      if (!signal?.aborted) {
        console.log('[checkAuth] Setting isLoading to false.');
        setIsLoading(false);
      } else {
        console.log('[checkAuth] Request was cancelled, leaving isLoading true for next run.');
      }
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    console.log('[AuthContext] Initial effect running, calling checkAuth...');

    // Create a controller for the initial auth check
    const controller = new AbortController();

    // Perform the auth check
    const performAuthCheck = async () => {
      try {
        await checkAuth(controller.signal);
      } catch (err) {
        // Log any errors that weren't handled in checkAuth
        if (!controller.signal.aborted) {
          console.error('Unhandled error in initial auth check:', err);
        }
      }
    };

    performAuthCheck();

    // Cleanup function to abort the request when component unmounts
    return () => {
      console.log('[AuthContext] Cleanup running, aborting controller...');
      controller.abort('Component unmounted');
    };
  }, []); // Remove checkAuth from dependencies



  // Function to logout
  const logout = async () => {
    try {
      // Call the API to logout
      await authService.logout();

      // Clear authentication state
      setIsAuthenticated(false);
      setUser(null);

      // Clear sessionStorage data
      try {
        sessionStorage.removeItem('adminAuthenticated');
        sessionStorage.removeItem('adminUser');
        console.log('[logout] Cleared sessionStorage authentication data');
      } catch (storageErr: unknown) {
        console.error('[logout] Error clearing sessionStorage:', storageErr);
      }

      // Redirect is handled by the component using the hook
    } catch (err: unknown) {
      console.error('Error logging out:', err);
      setError('Error al cerrar sesión');
    }
  };

  // Function to clear error
  const clearError = () => {
    setError(null);
  };

  // Function to handle login
  const login = (loggedInUser: AdminUser) => {
    console.log('[AuthContext] login function called with user:', loggedInUser);

    // Ensure we have valid admin user data
    if (!loggedInUser || !loggedInUser.id || !loggedInUser.email) {
      console.error('[AuthContext] Invalid user data provided to login function:', loggedInUser);
      setError('Datos de usuario inválidos');
      return;
    }

    // Verify this is an admin user with admin portal access
    const hasAdminAccess =
      loggedInUser.accountType === 'admin' &&
      loggedInUser.is_admin_portal === true;

    if (!hasAdminAccess) {
      console.error('[AuthContext] User does not have admin access:', loggedInUser);
      setError('No tienes acceso al portal administrativo');
      return;
    }

    // Update state in the correct order to ensure consistency
    setError(null); // Clear any previous login errors first

    // Set all state updates synchronously to avoid race conditions
    setUser(loggedInUser); // Set user data
    setIsLoading(false); // Ensure loading is false

    // Force authenticated state to be true
    console.log('[AuthContext] Setting isAuthenticated to TRUE');
    setIsAuthenticatedRaw(true); // Use raw setter to bypass logging and potential issues

    console.log('[AuthContext login] State update calls completed.');

    // Store authentication in sessionStorage for potential use by other components
    // Note: This is NOT used as a backup authentication mechanism anymore
    // The API's /auth/status endpoint is the single source of truth for authentication
    try {
      sessionStorage.setItem('adminAuthenticated', 'true');
      sessionStorage.setItem('adminUser', JSON.stringify(loggedInUser));
      console.log('[AuthContext] Stored authentication in sessionStorage (for component use only)');
    } catch (err: unknown) {
      console.error('[AuthContext] Failed to store in sessionStorage:', err);
    }

    console.log('[AuthContext] State updated via login: isAuthenticated=true, user set.');
  };

  // Context value
  const value = useMemo(() => {
    console.log('[AuthContext] Context value recalculated. isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);
    return {
      isAuthenticated,
      user,
      isLoading,
      error,
      checkAuth,
      logout,
      clearError,
      login, // Added login to the provided value
    };
  }, [isAuthenticated, user, isLoading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
