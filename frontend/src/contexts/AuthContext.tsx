// --- FINAL, AUTHORITATIVE CODE for AuthContext.tsx ---

import React, { createContext, useState, useEffect, useMemo, ReactNode } from 'react';
// This import now brings in the corrected User type.
import { checkStatus, logout as authLogout, login as authLogin, User } from '../services/authService';

// This interface now uses the User type that includes customerId.
export interface UserAuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  checkAuthStatus: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export interface AdminAuthContextType {}

export const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);
export const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const UserAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      const { isLoggedIn, user: sessionUser } = await checkStatus();
      if (isLoggedIn && sessionUser) {
        setUser(sessionUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { checkAuthStatus(); }, []);

  const login = async (email: string, password: string) => {
    const response = await authLogin(email, password);
    if (response.success && response.user) {
      setUser(response.user);
      setIsAuthenticated(true);
    }
    return response;
  };

  const logout = async () => {
    await authLogout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const contextValue = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuthStatus,
    setUser
  }), [user, isAuthenticated, isLoading]);

  return (
    <UserAuthContext.Provider value={contextValue}>
      {children}
    </UserAuthContext.Provider>
  );
};