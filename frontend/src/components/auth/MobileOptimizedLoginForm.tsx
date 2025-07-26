import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaFingerprint,
  FaGoogle,
  FaFacebook,
  FaCheckCircle,
  FaExclamationCircle,
} from 'react-icons/fa';

import styles from './MobileAuthForm.module.css';
import { useUserAuth as useAuth } from '../../shared/hooks/useAuth';
import { useToast } from '../../shared/hooks/useToast';
import { loginSchema, LoginFormData } from '../../shared/schemas/auth.schema';
import Icon from '../../shared/components/ui/Icon';

/**
 * Mobile-optimized login form with advanced UX features
 */
const MobileOptimizedLoginForm: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { login, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setFocus,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const email = watch('email');

  // Auto-advance to password field when email is valid
  useEffect(() => {
    if (email && email.includes('@') && email.includes('.')) {
      setEmailValid(true);
      // Small delay for visual feedback before advancing
      const timer = setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setEmailValid(null);
    }
  }, [email]);

  // Handle biometric login (mock implementation)
  const handleBiometricLogin = async () => {
    showToast('Autenticación biométrica no disponible en este dispositivo', 'info');
  };

  // Handle social logins (mock implementation)
  const handleSocialLogin = (provider: 'google' | 'facebook') => {
    showToast(`Iniciando sesión con ${provider}...`, 'info');
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    try {
      const success = await login(data.email, data.password);

      if (success) {
        // Store remember me preference
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }

        showToast('¡Bienvenido!', 'success');
        navigate(from, { replace: true });
      } else {
        showToast('Credenciales incorrectas', 'error');
        // Vibrate on error (if supported)
        if ('vibrate' in navigator) {
          navigator.vibrate(200);
        }
      }
    } catch (error) {
      showToast('Error al iniciar sesión', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  return (
    <div className={styles.authFormContainer}>
      {/* Brand Section */}
      <div className={styles.brandSection}>
        <div className={styles.brandLogo}>
          <Icon IconComponent={FaFingerprint} size="2rem" />
        </div>
        <h1 className={styles.brandTitle}>Bienvenido de vuelta</h1>
        <p className={styles.brandSubtitle}>Ingresa a tu cuenta de Permisos Digitales</p>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit(onSubmit)} className={styles.formContent}>
        <div>
          {/* Email Input */}
          <div className={styles.inputGroup}>
            <div className={`${styles.inputWrapper} ${errors.email ? styles.inputError : ''}`}>
              <input
                {...register('email')}
                type="email"
                className={styles.input}
                placeholder=" "
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
                spellCheck={false}
              />
              <label className={styles.label}>
                <Icon IconComponent={FaEnvelope} size="sm" /> Correo electrónico
              </label>
              {emailValid && !errors.email && (
                <Icon IconComponent={FaCheckCircle} className={styles.successIcon} />
              )}
            </div>
            {errors.email && (
              <div className={styles.errorMessage}>
                <Icon IconComponent={FaExclamationCircle} size="sm" />
                {errors.email.message}
              </div>
            )}
          </div>

          {/* Password Input */}
          <div className={styles.inputGroup}>
            <div className={`${styles.inputWrapper} ${errors.password ? styles.inputError : ''}`}>
              <input
                {...register('password')}
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                className={styles.input}
                placeholder=" "
                autoComplete="current-password"
              />
              <label className={styles.label}>
                <Icon IconComponent={FaLock} size="sm" /> Contraseña
              </label>
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Icon IconComponent={showPassword ? FaEyeSlash : FaEye} />
              </button>
            </div>
            {errors.password && (
              <div className={styles.errorMessage}>
                <Icon IconComponent={FaExclamationCircle} size="sm" />
                {errors.password.message}
              </div>
            )}
          </div>

          {/* Remember Me */}
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="rememberMe"
              className={styles.checkbox}
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="rememberMe" className={styles.checkboxLabel}>
              Recordarme en este dispositivo
            </label>
          </div>

          {/* Forgot Password Link */}
          <div style={{ textAlign: 'right', marginBottom: 'var(--space-4)' }}>
            <Link to="/forgot-password" className={styles.textLink}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        {/* Submit Button - In thumb zone */}
        <div>
          <button
            type="submit"
            className={`${styles.submitButton} ${isLoading ? styles.loading : ''}`}
            disabled={isLoading}
          >
            {!isLoading && 'Iniciar Sesión'}
          </button>

          {/* Biometric Login Option */}
          <button
            type="button"
            className={styles.biometricButton}
            onClick={handleBiometricLogin}
            aria-label="Iniciar sesión con huella digital"
          >
            <Icon IconComponent={FaFingerprint} className={styles.biometricIcon} />
          </button>

          {/* Secondary Actions */}
          <div className={styles.secondaryActions}>
            <div className={styles.dividerText}>o continúa con</div>

            {/* Social Login Buttons */}
            <div className={styles.socialButtons}>
              <button
                type="button"
                className={styles.socialButton}
                onClick={() => handleSocialLogin('google')}
              >
                <Icon IconComponent={FaGoogle} size="1.25rem" />
                Google
              </button>
              <button
                type="button"
                className={styles.socialButton}
                onClick={() => handleSocialLogin('facebook')}
              >
                <Icon IconComponent={FaFacebook} size="1.25rem" />
                Facebook
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Footer */}
      <div className={styles.footerSection}>
        <p className={styles.footerText}>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className={styles.textLink}>
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  );
};

export default MobileOptimizedLoginForm;