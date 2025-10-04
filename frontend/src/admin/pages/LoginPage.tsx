import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaUser, FaLock, FaShieldAlt, FaSpinner, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';

import Alert from '../../components/ui/Alert/Alert';
import Button from '../../components/ui/Button/Button';
import MobileForm, {
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormActions,
} from '../../components/ui/MobileForm/MobileForm';
import { AdminUser } from '../../shared/contexts/AuthContext';
import { useAdminAuth as useAuth } from '../../shared/hooks/useAuth';
import { useToast } from '../../shared/hooks/useToast';
import { adminLoginSchema, AdminLoginFormData } from '../../shared/schemas/auth.schema';
import { logger } from '../../utils/logger';
import AdminAuthLayout from '../layouts/AdminAuthLayout';
import api from '../services/api';
import { getCsrfToken as fetchCsrfToken, clearCsrfTokenCache } from '../services/authService';
import styles from './LoginPage.module.css';

// Set this to true to use a simplified rendering for debugging
const USE_SIMPLE_RENDERING = false;

const LoginPage: React.FC = () => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>('');

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginFormData>({
    resolver: zodResolver(adminLoginSchema),
    mode: 'onBlur',
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading: isAuthLoading, error: authError } = useAuth();
  const { showToast } = useToast();

  // Log on every render to track state changes
  logger.debug('[LoginPage Render] State check', {
    isAuthenticated,
    isAuthLoading,
    errorState: error,
    authError,
  });

  // Secure navigation with proper cleanup and race condition prevention
  useEffect(() => {
    let navigationTimer: NodeJS.Timeout;
    
    logger.debug('[LoginPage useEffect] Auth state check:', {
      isAuthenticated,
      isAuthLoading,
    });

    if (isAuthenticated && !isAuthLoading) {
      logger.debug('[LoginPage useEffect] Authentication confirmed, navigating...');
      // Small delay to prevent race conditions
      navigationTimer = setTimeout(() => {
        const targetPath = location.state?.from?.pathname || '/admin/dashboard';
        navigate(targetPath, { replace: true });
      }, 100);
    }

    return () => {
      if (navigationTimer) {
        clearTimeout(navigationTimer);
      }
    };
  }, [isAuthenticated, isAuthLoading, navigate, location.state?.from?.pathname]);

  // Get CSRF token on component mount
  useEffect(() => {
    const getInitialCsrfToken = async () => {
      try {
        setIsLoading(true);
        const token = await fetchCsrfToken();
        if (token) {
          setCsrfToken(token);
          logger.info('CSRF token fetched successfully:', token);
        } else {
          logger.error('CSRF token is undefined or empty');
          setError('Error al obtener token de seguridad. Intente nuevamente.');
        }
      } catch (error) {
        logger.error('Failed to get CSRF token:', error);
        setError('Error al conectar con el servidor. Intente nuevamente.');
      } finally {
        setIsLoading(false);
      }
    };

    getInitialCsrfToken();
  }, []);

  // Get CSRF token with improved error handling
  const getCsrfToken = async (): Promise<string> => {
    if (csrfToken) return csrfToken;

    try {
      const token = await fetchCsrfToken();
      if (!token) {
        throw new Error('CSRF token is empty or undefined');
      }
      setCsrfToken(token);
      return token;
    } catch (error) {
      logger.error('Failed to get CSRF token:', error);
      setError('Error al obtener token de seguridad. Intente nuevamente.');
      throw new Error('Failed to get CSRF token');
    }
  };

  const onSubmit = async (data: AdminLoginFormData) => {
    try {
      setIsLoading(true);
      setError('');

      // STRICT CSRF token validation - no bypasses allowed
      let tokenToUse = csrfToken;
      if (!tokenToUse) {
        try {
          tokenToUse = await getCsrfToken();
          if (!tokenToUse || tokenToUse.length < 10) {
            throw new Error('Invalid CSRF token received');
          }
        } catch (tokenErr) {
          logger.error('CRITICAL: CSRF token validation failed:', tokenErr);
          setError('Error de seguridad crítico. Recargue la página e intente nuevamente.');
          setIsLoading(false);
          // Force page reload to get fresh CSRF token
          setTimeout(() => window.location.reload(), 2000);
          return;
        }
      }

      logger.info('Using CSRF token for login:', tokenToUse);

      // Attempt login with admin portal flag
      const response = await api.post(
        '/auth/login',
        { email: data.email, password: data.password },
        {
          headers: {
            'X-CSRF-Token': tokenToUse,
            'X-Portal-Type': 'admin',
          },
        },
      );

      logger.info('Login response:', response.data);

      // Check if response has the expected structure
      const hasData = !!response.data;
      const hasSuccess = !!response.data?.success;
      const hasUser = !!response.data?.user;

      logger.debug('[LoginPage handleSubmit] Response structure:', {
        hasData,
        hasSuccess,
        hasUser,
        userObject: response.data?.user,
        responseKeys: hasData ? Object.keys(response.data) : [],
        dataType: hasData ? typeof response.data : 'undefined',
      });

      // Try to handle potential data structure issues
      if (response.data && typeof response.data === 'string') {
        try {
          // Try to parse if the response is a JSON string
          const parsedData = JSON.parse(response.data);
          logger.debug('[LoginPage handleSubmit] Parsed string response:', parsedData);
          response.data = parsedData;
        } catch (e) {
          logger.error('[LoginPage handleSubmit] Failed to parse string response:', e);
        }
      }

      // Check for success AND user data in the response
      if (response.data && response.data.success) {
        logger.info('Login successful, checking for user data...');

        // Look for user data in different possible locations
        let userData = response.data.user;

        // If no user data directly in response.data.user, check other common locations
        if (!userData) {
          logger.debug(
            '[LoginPage handleSubmit] No user data in response.data.user, checking alternatives...',
          );

          if (response.data.data && response.data.data.user) {
            userData = response.data.data.user;
            logger.debug('[LoginPage handleSubmit] Found user data in response.data.data.user');
          } else if (response.data.data) {
            userData = response.data.data;
            logger.debug('[LoginPage handleSubmit] Using response.data.data as user data');
          }
        }

        if (!userData) {
          logger.error('[LoginPage handleSubmit] Could not find user data in response');
          setError('Error: No se encontraron datos de usuario en la respuesta');
          return;
        }

        // Verify user object has required fields
        if (!userData.id || !userData.email) {
          logger.error(
            '[LoginPage handleSubmit] User object is missing required fields:',
            userData,
          );
          setError('Error: Datos de usuario incompletos');
          return;
        }

        logger.debug('[LoginPage handleSubmit] Calling authContext.login with user data:', userData);

        // Clear CSRF token cache to ensure fresh state for new user
        clearCsrfTokenCache();

        // Call the context login function, passing the user data
        // This will trigger the useEffect for navigation
        login(userData as AdminUser);

        // Show success toast
        showToast('¡Bienvenido al portal administrativo!', 'success');

        logger.debug(
          '[LoginPage handleSubmit] Called authContext.login. State update should be queued.',
        );
        logger.debug('AuthContext updated, navigation will happen via useEffect');
      } else {
        // Handle case where response is successful status-code wise, but login failed logically OR user data missing
        setError(
          response.data?.message ||
            response.data?.error ||
            'Error al iniciar sesión. Verifique sus credenciales o faltan datos del usuario.',
        );
      }
    } catch (err: any) {
      logger.error('Login error:', err);

      // Improved error handling
      if (axios.isAxiosError(err) && err.response) {
        // Handle specific API errors (e.g., 401 Unauthorized, 403 Forbidden)
        if (err.response.status === 401 || err.response.status === 403) {
          setError(err.response.data?.message || 'Credenciales incorrectas o acceso denegado.');
        } else if (err.response.data?.message) {
          setError(err.response.data.message);
        } else {
          setError('Ocurrió un error en el servidor. Intente nuevamente.');
        }

        // Check for CSRF token error specifically if applicable
        if (
          err.response.data?.error?.includes('CSRF') ||
          (typeof err.response.data === 'string' && err.response.data.includes('CSRF')) ||
          err.response.status === 403
        ) {
          logger.info('Potential CSRF error, attempting to refresh token...');
          try {
            const newToken = await fetchCsrfToken();
            if (newToken) {
              setCsrfToken(newToken);
              logger.info('Got new CSRF token after error:', newToken);
            }
          } catch (tokenErr) {
            logger.error('Failed to get new CSRF token:', tokenErr);
          }
          setError('Error de seguridad, intente iniciar sesión nuevamente.');
        }
      } else {
        // Handle network errors or other issues
        setError('No se pudo conectar al servidor. Verifique su conexión.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Use simplified rendering for debugging if enabled
  if (USE_SIMPLE_RENDERING) {
    return (
      <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
        <h1>Prueba de Página de Inicio de Sesión</h1>
        <p>Estado de Autenticación: {isAuthenticated ? 'Autenticado' : 'No Autenticado'}</p>
        <p>Estado de Carga: {isAuthLoading ? 'Cargando' : 'No Cargando'}</p>
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          <input type="email" placeholder="Correo electrónico" required autoComplete="off" {...register('email')} />
          <input type="password" placeholder="Contraseña" required autoComplete="new-password" {...register('password')} />
          <Button
            variant="primary"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Procesando...' : 'Iniciar Sesión'}
          </Button>
          {error && (
            <div style={{ color: error.includes('successful') ? 'green' : 'red' }}>{error}</div>
          )}
        </form>
      </div>
    );
  }

  // Modern Admin Login Panel
  return (
    <div className={styles.adminLoginPanel}>
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <div className={styles.adminBadge}>
              <FaShieldAlt className={styles.adminIcon} />
              Portal Administrativo
            </div>
            <h1 className={styles.loginTitle}>Acceso Seguro</h1>
            <p className={styles.loginSubtitle}>
              Ingrese sus credenciales para continuar
            </p>
          </div>

          <form className={styles.loginForm} onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className={styles.errorMessage}>
                <FaExclamationTriangle className={styles.errorIcon} />
                {error}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.formLabel}>
                Correo electrónico *
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="email"
                  id="email"
                  className={styles.formInput}
                  placeholder="Correo electrónico"
                  autoComplete="off"
                  {...register('email')}
                />
                <FaUser className={styles.inputIcon} />
              </div>
              {errors.email && (
                <div className={styles.fieldError}>
                  {errors.email.message}
                </div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.formLabel}>
                Contraseña *
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="password"
                  id="password"
                  className={styles.formInput}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...register('password')}
                />
                <FaLock className={styles.inputIcon} />
              </div>
              {errors.password && (
                <div className={styles.fieldError}>
                  {errors.password.message}
                </div>
              )}
            </div>

            <button
              type="submit"
              className={styles.loginButton}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <FaSpinner className={styles.loadingSpinner} />
                  Validando credenciales...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
