import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaUser, FaLock, FaExclamationTriangle, FaCheckCircle, FaSignInAlt } from 'react-icons/fa';
import api from '../services/api';
import { getCsrfToken as fetchCsrfToken } from '../services/authService';
import { useAuth, AdminUser } from '../contexts/AuthContext';
import axios from 'axios';
import styles from './LoginPage.module.css';
import Button from '../../components/ui/Button/Button';

// Set this to true to use a simplified rendering for debugging
const USE_SIMPLE_RENDERING = false;

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>('');

  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading: isAuthLoading, error: authError } = useAuth(); // Get auth context values

  // Log on every render to track state changes
  console.log('[LoginPage Render] isAuthenticated:', isAuthenticated, 'isAuthLoading:', isAuthLoading, 'Error State:', error, 'Auth Error:', authError);

  // Add useEffect for navigation after successful login
  useEffect(() => {
    console.log('[LoginPage useEffect] Running effect. isAuthenticated:', isAuthenticated, 'isAuthLoading:', isAuthLoading);

    if (isAuthenticated && !isAuthLoading) {
      console.log('[LoginPage useEffect] Condition met. Calling navigate...');
      // Navigate to the intended destination or dashboard
      navigate(location.state?.from?.pathname || '/', { replace: true });
    }
  }, [isAuthenticated, isAuthLoading, navigate, location.state?.from?.pathname]);

  // Get CSRF token on component mount
  useEffect(() => {
    const getInitialCsrfToken = async () => {
      try {
        setIsLoading(true);
        const token = await fetchCsrfToken();
        if (token) {
          setCsrfToken(token);
          console.log('CSRF token fetched successfully:', token);
        } else {
          console.error('CSRF token is undefined or empty');
          setError('Error al obtener token de seguridad. Intente nuevamente.');
        }
      } catch (error) {
        console.error('Failed to get CSRF token:', error);
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
      console.error('Failed to get CSRF token:', error);
      setError('Error al obtener token de seguridad. Intente nuevamente.');
      throw new Error('Failed to get CSRF token');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Por favor ingrese su correo electrónico y contraseña');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      // Make sure we have a CSRF token
      let tokenToUse = csrfToken;
      if (!tokenToUse) {
        try {
          tokenToUse = await getCsrfToken();
        } catch (tokenErr) {
          console.error('Failed to get CSRF token before login:', tokenErr);
          setError('Error al obtener token de seguridad. Intente nuevamente.');
          setIsLoading(false);
          return;
        }
      }

      console.log('Using CSRF token for login:', tokenToUse);

      // Attempt login with admin portal flag
      const response = await api.post('/auth/login',
        { email, password },
        {
          headers: {
            'X-CSRF-Token': tokenToUse,
            'X-Portal-Type': 'admin'
          }
        }
      );

      console.log('Login response:', response.data);

      // Check if response has the expected structure
      const hasData = !!response.data;
      const hasSuccess = !!response.data?.success;
      const hasUser = !!response.data?.user;

      console.log('[LoginPage handleSubmit] Response structure:', {
        hasData,
        hasSuccess,
        hasUser,
        userObject: response.data?.user,
        responseKeys: hasData ? Object.keys(response.data) : [],
        dataType: hasData ? typeof response.data : 'undefined'
      });

      // Try to handle potential data structure issues
      if (response.data && typeof response.data === 'string') {
        try {
          // Try to parse if the response is a JSON string
          const parsedData = JSON.parse(response.data);
          console.log('[LoginPage handleSubmit] Parsed string response:', parsedData);
          response.data = parsedData;
        } catch (e) {
          console.error('[LoginPage handleSubmit] Failed to parse string response:', e);
        }
      }

      // Check for success AND user data in the response
      if (response.data && response.data.success) {
        console.log('Login successful, checking for user data...');

        // Look for user data in different possible locations
        let userData = response.data.user;

        // If no user data directly in response.data.user, check other common locations
        if (!userData) {
          console.log('[LoginPage handleSubmit] No user data in response.data.user, checking alternatives...');

          if (response.data.data && response.data.data.user) {
            userData = response.data.data.user;
            console.log('[LoginPage handleSubmit] Found user data in response.data.data.user');
          } else if (response.data.data) {
            userData = response.data.data;
            console.log('[LoginPage handleSubmit] Using response.data.data as user data');
          }
        }

        if (!userData) {
          console.error('[LoginPage handleSubmit] Could not find user data in response');
          setError('Error: No se encontraron datos de usuario en la respuesta');
          return;
        }

        // Verify user object has required fields
        if (!userData.id || !userData.email) {
          console.error('[LoginPage handleSubmit] User object is missing required fields:', userData);
          setError('Error: Datos de usuario incompletos');
          return;
        }

        console.log('[LoginPage handleSubmit] Calling authContext.login with user data:', userData);

        // Call the context login function, passing the user data
        // This will trigger the useEffect for navigation
        login(userData as AdminUser);

        console.log('[LoginPage handleSubmit] Called authContext.login. State update should be queued.');
        console.log('AuthContext updated, navigation will happen via useEffect');
      } else {
        // Handle case where response is successful status-code wise, but login failed logically OR user data missing
        setError(
          response.data?.message ||
          response.data?.error ||
          'Error al iniciar sesión. Verifique sus credenciales o faltan datos del usuario.'
        );
      }
    } catch (err: any) {
      console.error('Login error:', err);

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
        if (err.response.data?.error?.includes('CSRF') ||
            (typeof err.response.data === 'string' && err.response.data.includes('CSRF')) ||
            err.response.status === 403) {
          console.log('Potential CSRF error, attempting to refresh token...');
          try {
            const newToken = await fetchCsrfToken();
            if (newToken) {
              setCsrfToken(newToken);
              console.log('Got new CSRF token after error:', newToken);
            }
          } catch (tokenErr) {
            console.error('Failed to get new CSRF token:', tokenErr);
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
        <h1>Login Page Test</h1>
        <p>Authentication Status: {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</p>
        <p>Loading Status: {isAuthLoading ? 'Loading' : 'Not Loading'}</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
          <Button
            variant="primary"
            htmlType="submit"
            disabled={isLoading}
            icon={<FaSignInAlt />}
          >
            {isLoading ? 'Processing...' : 'Login'}
          </Button>
          {error && <div style={{ color: error.includes('successful') ? 'green' : 'red' }}>{error}</div>}
        </form>
      </div>
    );
  }

  // Regular rendering
  return (
    <div className={styles.loginPage}>
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <img src="/img/logo.svg" alt="Permisos Digitales" className={styles.logo} />
            <h1 className={styles.loginTitle}>Portal Administrativo</h1>
          </div>

          <form className={styles.loginForm} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.formLabel}>Correo Electrónico</label>
              <div className={styles.inputWrapper}>
                <FaUser className={styles.inputIcon} />
                <input
                  type="email"
                  id="email"
                  className={styles.formInput}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ingrese su correo electrónico"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.formLabel}>Contraseña</label>
              <div className={styles.inputWrapper}>
                <FaLock className={styles.inputIcon} />
                <input
                  type="password"
                  id="password"
                  className={styles.formInput}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button
              variant="primary"
              htmlType="submit"
              className={styles.loginButton}
              disabled={isLoading}
              icon={<FaSignInAlt />}
            >
              {isLoading ? 'Procesando...' : 'Iniciar Sesión'}
            </Button>

            {error && (
              <div className={error.includes('successful') ? styles.successMessage : styles.errorMessage}>
                {error.includes('successful') ? (
                  <>
                    <FaCheckCircle className={styles.successIcon} />
                    <span>{error}</span>
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle className={styles.errorIcon} />
                    <span>{error}</span>
                  </>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
