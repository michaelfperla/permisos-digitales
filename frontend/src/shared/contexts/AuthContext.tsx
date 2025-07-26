import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';

export interface BaseUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface User extends BaseUser {
  role?: string;
  accountType?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminUser extends BaseUser {
  accountType: string;
  is_admin_portal: boolean;
  accessDetails?: {
    isAdmin: boolean;
    hasAdminPortalAccess: boolean;
    sessionId: string;
  };
}

export type AuthUser<T extends 'user' | 'admin'> = T extends 'user' ? User : AdminUser;

interface BaseAuthContextType<T extends BaseUser> {
  isAuthenticated: boolean;
  user: T | null;
  isLoading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  checkAuth: (signal?: AbortSignal) => Promise<void>;
  clearError: () => void;
}

export interface UserAuthContextType extends BaseAuthContextType<User> {
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    confirmPassword?: string;
    whatsapp_phone?: string;
  }) => Promise<boolean>;
  setUser: (user: User | null) => void;
  resendVerificationEmail: (email: string) => Promise<{ success: boolean; message: string }>;
}

export interface AdminAuthContextType extends BaseAuthContextType<AdminUser> {
  login: (loggedInUser: AdminUser) => void;
  setUser?: (user: AdminUser | null) => void;
}

export type AuthContextType<T extends 'user' | 'admin'> = T extends 'user'
  ? UserAuthContextType
  : AdminAuthContextType;

const defaultUserAuthContext: UserAuthContextType = {
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
  resendVerificationEmail: async () => ({ success: false, message: 'No implementado' }),
};

const defaultAdminAuthContext: AdminAuthContextType = {
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,
  login: () => {},
  logout: async () => {},
  checkAuth: async () => {},
  clearError: () => {},
  setUser: () => {},
};

// eslint-disable-next-line react-refresh/only-export-components -- Context files legitimately export both contexts and provider components
export const UserAuthContext = createContext<UserAuthContextType>(defaultUserAuthContext);
// eslint-disable-next-line react-refresh/only-export-components -- Context files legitimately export both contexts and provider components
export const AdminAuthContext = createContext<AdminAuthContextType>(defaultAdminAuthContext);

interface AuthProviderProps {
  children: ReactNode;
  type: 'user' | 'admin';
  authService: any;
  debugUtils?: {
    debugLog?: (context: string, message: string, data?: any) => void;
    errorLog?: (context: string, message: string, error?: any) => void;
  };
}

/**
 * Authentication provider that handles both user and admin authentication flows.
 * Manages authentication state, login/logout, and session persistence.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  type,
  authService,
  debugUtils,
}) => {
  const debugLog = useMemo(() =>
    debugUtils?.debugLog ||
    ((context: string, message: string, data?: any) => console.debug(`[${context}] ${message}`, data || ''))
  , [debugUtils]);

  const errorLog = useMemo(() =>
    debugUtils?.errorLog ||
    ((context: string, message: string, error?: any) =>
      console.error(`[${context}] ${message}`, error))
  , [debugUtils]);

  const [isAuthenticated, _setIsAuthenticated] = useState<boolean>(false);
  const [user, setUserState] = useState<User | AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const setIsAuthenticated = useCallback((value: boolean) => {
    debugLog('AuthContext', `setIsAuthenticated called with: ${value}`);
    _setIsAuthenticated(value);
  }, [debugLog]);

  const setUser = useCallback((newUser: User | AdminUser | null) => {
    debugLog('AuthContext', 'setUser called with new user:', newUser);
    setUserState(newUser);
  }, [debugLog]);

  const checkAuth = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      debugLog('checkAuth', 'Starting...');
      setIsLoading(true);
      try {
        debugLog('checkAuth', 'Calling authService.checkStatus...');
        const response = await authService.checkStatus(signal);
        if (signal?.aborted) {
          debugLog('checkAuth', 'Request was aborted, not updating state');
          return;
        }
        if (response.isLoggedIn && response.user) {
          if (type === 'admin') {
            const adminUser = response.user as AdminUser;
            if (adminUser.accessDetails?.isAdmin && adminUser.accessDetails?.hasAdminPortalAccess) {
              debugLog('checkAuth', 'User has admin access, setting authenticated state');
              setIsAuthenticated(true);
              setUser(adminUser);
              setError(null);
            } else {
              debugLog('checkAuth', 'User does not have admin access, logging out');
              setIsAuthenticated(false);
              setUser(null);
              setError('No tienes acceso al portal administrativo');
              try { await authService.logout(); }
              catch (logoutErr: unknown) { errorLog('checkAuth', 'Error during logout after access check', logoutErr); }
            }
          } else {
            debugLog('checkAuth', 'User is logged in, setting authenticated state');
            setIsAuthenticated(true);
            setUser(response.user as User);
            setError(null);
          }
        } else {
          debugLog('checkAuth', 'User is not logged in, setting unauthenticated state');
          setIsAuthenticated(false);
          setUser(null);
          setError(null);
          if (type === 'admin') {
            try {
              sessionStorage.removeItem('adminAuthenticated');
              sessionStorage.removeItem('adminUser');
            } catch (err: unknown) { errorLog('checkAuth', 'Error clearing sessionStorage', err); }
          }
        }
      } catch (err: unknown) {
        if (signal?.aborted) {
          debugLog('checkAuth', 'Request was aborted during error handling, not updating state');
          return;
        }
        errorLog('checkAuth', 'Error caught', err);
        setIsAuthenticated(false);
        setUser(null);
        setError('Error al verificar el estado de autenticación');
      } finally {
        if (!signal?.aborted) {
          debugLog('checkAuth', 'Setting isLoading to false');
          setIsLoading(false);
        }
      }
    },
    [type, authService, debugLog, errorLog, setIsAuthenticated, setUser, setIsLoading, setError]
  );

  useEffect(() => {
    debugLog('AuthContext', 'Initial effect running, calling checkAuth...');
    const controller = new AbortController();
    const performAuthCheck = async () => {
      try { await checkAuth(controller.signal); }
      catch (err) { if (!controller.signal.aborted) { errorLog('AuthContext', 'Unhandled error in initial auth check', err); } }
    };
    performAuthCheck();
    return () => {
      debugLog('AuthContext', 'Cleanup running, aborting controller...');
      controller.abort();
    };
  }, [checkAuth, debugLog, errorLog]);

  const logout = useCallback(async (): Promise<void> => {
    debugLog('logout', 'Starting logout process');
    setIsLoading(true);
    setError(null);
    try {
      await authService.logout();
      setIsAuthenticated(false);
      setUser(null);
      if (type === 'admin') {
        try {
          sessionStorage.removeItem('adminAuthenticated');
          sessionStorage.removeItem('adminUser');
        } catch (storageErr: unknown) { errorLog('logout', 'Error clearing sessionStorage', storageErr); }
      }
      debugLog('logout', 'Logout successful');
    } catch (err) {
      errorLog('logout', 'Error logging out', err);
      setError('Error al cerrar sesión');
    } finally {
      setIsLoading(false);
    }
  }, [authService, type, debugLog, errorLog, setIsAuthenticated, setUser, setIsLoading, setError]);

  const clearError = useCallback((): void => {
    debugLog('clearError', 'Clearing error state');
    setError(null);
  }, [debugLog, setError]);

  const userLogin = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (type !== 'user') return false;
    debugLog('AuthContext', `User login attempt: ${email}`);
    setIsLoading(true);
    setError(null);
    let loadingTimeout: NodeJS.Timeout | null = setTimeout(() => { debugLog('AuthContext', 'Login timeout'); setIsLoading(false); loadingTimeout = null; }, 15000);
    try {
      const response = await authService.login(email, password);
      if (loadingTimeout) clearTimeout(loadingTimeout);
      loadingTimeout = null;
      if (response.success && response.user) {
        setIsAuthenticated(true);
        setUser(response.user as User);
        setIsLoading(false);
        return true;
      }
      setError(response.message || 'Error al iniciar sesión.');
      setIsLoading(false);
      return false;
    } catch (errLogin) {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      loadingTimeout = null;
      errorLog('AuthContext', 'User login error', errLogin);
      setError('Error de conexión durante el inicio de sesión.');
      setIsLoading(false);
      return false;
    }
  }, [type, authService, debugLog, errorLog, setIsAuthenticated, setUser, setIsLoading, setError]);

  const userRegister = useCallback(async (userData: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    confirmPassword?: string;
    whatsapp_phone?: string;
  }): Promise<boolean> => {
    if (type !== 'user') return false;
    debugLog('AuthContext', `User registration attempt: ${userData.email}`);
    setIsLoading(true);
    setError(null);
    let loadingTimeout: NodeJS.Timeout | null = setTimeout(() => { debugLog('AuthContext', 'Register timeout'); setIsLoading(false); loadingTimeout = null; }, 15000);
    try {
      const response = await authService.register(userData);
      if (loadingTimeout) clearTimeout(loadingTimeout);
      loadingTimeout = null;
      if (response.success) {
        setIsLoading(false);
        return true;
      }
      setError(response.message || 'Error en el registro.');
      setIsLoading(false);
      return false;
    } catch (errRegister) {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      loadingTimeout = null;
      errorLog('AuthContext', 'User registration error', errRegister);
      setError('Error de conexión durante el registro.');
      setIsLoading(false);
      return false;
    }
  }, [type, authService, debugLog, errorLog, setIsLoading, setError]);

  const userResendVerificationEmail = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    if (type !== 'user') return { success: false, message: 'Operación inválida para tipo administrador' };
    try {
      debugLog('AuthContext', `Resending verification email for: ${email}`);
      return await authService.resendVerificationEmail(email);
    } catch (errResend) {
      errorLog('AuthContext', 'Error resending verification email', errResend);
      return { success: false, message: 'Error al reenviar el correo de verificación.' };
    }
  }, [type, authService, debugLog, errorLog]);

  const adminLogin = useCallback((loggedInUser: AdminUser): void => {
    if (type !== 'admin') return;
    debugLog('AuthContext', 'Admin login function called');
    if (!loggedInUser?.id || !loggedInUser?.email) {
      errorLog('AuthContext', 'Invalid user data for admin login', loggedInUser);
      setError('Datos de usuario inválidos');
      return;
    }
    const hasAdminAccess = loggedInUser.accountType === 'admin' && loggedInUser.is_admin_portal === true;
    if (!hasAdminAccess) {
      errorLog('AuthContext', 'User lacks admin access', loggedInUser);
      setError('No tienes acceso al portal administrativo');
      return;
    }
    setError(null);
    setUser(loggedInUser);
    setIsLoading(false);
    setIsAuthenticated(true);
    try {
      sessionStorage.setItem('adminAuthenticated', 'true');
      sessionStorage.setItem('adminUser', JSON.stringify(loggedInUser));
    } catch (err: unknown) { errorLog('AuthContext', 'Session storage error (admin login)', err); }
  }, [type, debugLog, errorLog, setIsAuthenticated, setUser, setIsLoading, setError]);

  const userContextValue: UserAuthContextType = useMemo(() => ({
    isAuthenticated,
    user: user as User | null,
    isLoading,
    error,
    login: userLogin,
    register: userRegister,
    logout,
    checkAuth,
    clearError,
    setUser: setUser as (newUser: User | null) => void,
    resendVerificationEmail: userResendVerificationEmail,
  }), [isAuthenticated, user, isLoading, error, userLogin, userRegister, logout, checkAuth, clearError, setUser, userResendVerificationEmail]);

  const adminContextValue: AdminAuthContextType = useMemo(() => ({
    isAuthenticated,
    user: user as AdminUser | null,
    isLoading,
    error,
    login: adminLogin,
    logout,
    checkAuth,
    clearError,
    setUser: setUser as (newUser: AdminUser | null) => void, // Added setUser for admin context as well
  }), [isAuthenticated, user, isLoading, error, adminLogin, logout, checkAuth, clearError, setUser]);

  if (type === 'user') {
    return <UserAuthContext.Provider value={userContextValue}>{children}</UserAuthContext.Provider>;
  } else {
    return <AdminAuthContext.Provider value={adminContextValue}>{children}</AdminAuthContext.Provider>;
  }
};