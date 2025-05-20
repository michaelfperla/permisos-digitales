import React, { createContext, useState, useEffect, ReactNode } from 'react';
import authService from '../services/authService';
import { debugLog, errorLog } from '../utils/debug';

// Define User type based on backend response
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role?: string;
  accountType?: string;
  created_at?: string;
  updated_at?: string;
}

// Define the shape of our context
interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    confirmPassword?: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: (signal?: AbortSignal) => Promise<void>;
  clearError: () => void;
  setUser: (user: User | null) => void;
  resendVerificationEmail: (email: string) => Promise<{ success: boolean; message: string }>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,
  login: async () => false,
  register: async () => false,
  logout: async () => {},
  checkAuth: async () => {},
  clearError: () => {},
  setUser: () => {},
  resendVerificationEmail: async () => ({ success: false, message: 'Not implemented' }),
});

// Create the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, _setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Create a wrapper function for setIsAuthenticated that adds logging
  const setIsAuthenticated = (value: boolean) => {
    console.log(`[AuthContext] setIsAuthenticated called with: ${value}. Stack:`, new Error().stack); // Log value and stack trace
    _setIsAuthenticated(value); // Call original setter
  };

  // Check authentication status when the provider mounts
  useEffect(() => {
    // Create an AbortController for this effect instance
    const abortController = new AbortController();

    console.log('[AuthContext] Initial effect running, calling checkAuth...');

    // Wrap in try-catch to prevent app from crashing if backend is unavailable
    try {
      checkAuth(abortController.signal);
    } catch (error) {
      console.error('Error in initial auth check:', error);
      setIsLoading(false);
    }

    // Cleanup function to abort any pending requests
    return () => {
      console.log('[AuthContext] Cleanup running, aborting controller...');
      abortController.abort();
    };
  }, []);

  // Function to check authentication status
  const checkAuth = async (signal?: AbortSignal): Promise<void> => {
    console.log('[checkAuth] Starting...');
    let wasCancelled = false;
    setIsLoading(true);
    try {
      console.log('[checkAuth] Calling authService.checkStatus...');
      const response = await authService.checkStatus(signal);

      // Store results in temporary variables
      const loggedIn = response.isLoggedIn;
      const userData = response.user || null;

      console.log(`[checkAuth] Success: Setting isAuthenticated=${loggedIn}, user=${JSON.stringify(userData)}`);

      // Set auth state FIRST
      setIsAuthenticated(loggedIn);
      setUser(userData);
    } catch (err: any) {
      const error = err as Error;
      console.error('[checkAuth] Error caught:', error);

      // Check if this was an abort/cancel error (not a real error)
      if (error.name === 'AbortError' || error.name === 'CanceledError' || (error as any).code === 'ERR_CANCELED') {
        console.log('[checkAuth] Request was cancelled/aborted, ignoring...');
        wasCancelled = true;
        // Removed the return statement to allow finally block to run
      }

      if (!wasCancelled) {
        console.error('Error checking authentication status:', error);

        console.log('[checkAuth] Non-cancellation error: Setting isAuthenticated=false, user=null');

        // Set auth state FIRST, then error
        setIsAuthenticated(false);
        setUser(null);
        setError('Error checking authentication status. Please try again.');
      }
    } finally {
      // setIsLoading(false) is the VERY LAST thing done
      console.log('[checkAuth] Finished.');
      if (!wasCancelled) {
        console.log('[checkAuth] Setting isLoading to false.');
        setIsLoading(false);
      } else {
        console.log('[checkAuth] Request was cancelled, leaving isLoading true for next run.');
      }
    }
  };

  // Function to log in a user
  const login = async (email: string, password: string): Promise<boolean> => {
    debugLog('AuthContext', `Login function called for email: ${email}`);
    setIsLoading(true);
    setError(null);

    // Create a promise that will automatically set isLoading to false after a timeout
    const resetLoadingTimeout = setTimeout(() => {
      debugLog('AuthContext', 'Login timeout reached, resetting loading state');
      setIsLoading(false);
    }, 15000); // 15 second safety timeout

    try {
      debugLog('AuthContext', 'Calling authService.login');
      const response = await authService.login(email, password);
      debugLog('AuthContext', 'Login response received', response);

      // Clear the safety timeout
      clearTimeout(resetLoadingTimeout);

      if (response.success && response.user) {
        debugLog('AuthContext', 'Login successful, updating state', response.user);
        setIsAuthenticated(true);
        setUser(response.user);

        debugLog('AuthContext', 'Login complete, returning true');
        setIsLoading(false);
        return true;
      } else {
        debugLog('AuthContext', `Login failed with message: ${response.message}`);
        setError(response.message || 'Login failed. Please check your credentials.');
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      // Clear the safety timeout
      clearTimeout(resetLoadingTimeout);

      errorLog('AuthContext', 'Login error', error);
      setError('Network error. Please check your connection.');
      setIsLoading(false);
      return false;
    }
  };

  // Function to register a new user
  const register = async (userData: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    confirmPassword?: string;
  }): Promise<boolean> => {
    debugLog('AuthContext', `Register function called for email: ${userData.email}`);
    setIsLoading(true);
    setError(null);

    // Create a promise that will automatically set isLoading to false after a timeout
    const resetLoadingTimeout = setTimeout(() => {
      debugLog('AuthContext', 'Registration timeout reached, resetting loading state');
      setIsLoading(false);
    }, 15000); // 15 second safety timeout

    try {
      debugLog('AuthContext', 'Calling authService.register');
      const response = await authService.register(userData);
      debugLog('AuthContext', 'Register response received', response);

      // Clear the safety timeout
      clearTimeout(resetLoadingTimeout);

      if (response.success) {
        debugLog('AuthContext', 'Registration successful');
        // Note: Typically registration doesn't automatically log the user in
        // They might need to verify their email first

        debugLog('AuthContext', 'Registration complete, returning true');
        setIsLoading(false);
        return true;
      } else {
        debugLog('AuthContext', `Registration failed with message: ${response.message}`);
        setError(response.message || 'Registration failed. Please try again.');
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      // Clear the safety timeout
      clearTimeout(resetLoadingTimeout);

      errorLog('AuthContext', 'Registration error', error);
      setError('Network error. Please check your connection.');
      setIsLoading(false);
      return false;
    }
  };

  // Function to log out a user
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.logout();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      setError('Error logging out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to clear any error messages
  const clearError = (): void => {
    setError(null);
  };

  // Function to resend verification email
  const resendVerificationEmail = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      debugLog('AuthContext', `Resending verification email for: ${email}`);
      return await authService.resendVerificationEmail(email);
    } catch (error) {
      errorLog('AuthContext', 'Error resending verification email', error);
      return {
        success: false,
        message: 'Error al reenviar el correo de verificación.'
      };
    }
  };

  // Provide the context value
  const contextValue: AuthContextType = {
    isAuthenticated,
    user,
    isLoading,
    error,
    login,
    register,
    logout,
    checkAuth,
    clearError,
    setUser,
    resendVerificationEmail,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
