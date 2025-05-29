import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import styles from './Form.module.css';
import { useUserAuth as useAuth } from '../../shared/hooks/useAuth';
import { useToast } from '../../shared/hooks/useToast';
import { loginSchema, LoginFormData } from '../../shared/schemas/auth.schema';
import { debugLog, errorLog } from '../../utils/debug';
import Alert from "../ui/Alert/Alert";
import Button from "../ui/Button/Button";
import MobileForm, {
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormActions,
} from "../ui/MobileForm/MobileForm";

/**
 * Login form with email verification handling and timeout protection
 */
const LoginForm: React.FC = () => {
  const [isEmailNotVerified, setIsEmailNotVerified] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendVerificationSuccess, setResendVerificationSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { login, isLoading, error, clearError, resendVerificationEmail } = useAuth();
  const { showToast } = useToast();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
  });

  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  const handleResendVerification = async () => {
    const email = getValues('email');

    if (!email) {
      showToast('Por favor, ingresa tu correo electrónico', 'error');
      return;
    }

    try {
      setIsResendingVerification(true);
      setResendVerificationSuccess(false);

      const result = await resendVerificationEmail(email);

      if (result.success) {
        setResendVerificationSuccess(true);
        showToast(
          'Correo de verificación reenviado exitosamente. Por favor, revisa tu bandeja de entrada.',
          'success',
        );
      } else {
        showToast(result.message || 'Error al reenviar el correo de verificación.', 'error');
      }
    } catch (ignore) {
      showToast('Error al reenviar el correo de verificación.', 'error');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    debugLog('LoginForm', 'Login form submitted');

    clearError();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Login request timed out'));
      }, 10000);
    });

    try {
      debugLog('LoginForm', `Attempting login with email: ${data.email}`);

      const loginPromise = login(data.email, data.password);
      const success = (await Promise.race([loginPromise, timeoutPromise])) as boolean;

      debugLog('LoginForm', `Login result: ${success}`);

      if (success) {
        showToast('¡Bienvenido! Iniciaste sesión', 'success');
        debugLog('LoginForm', `Login successful, navigating to: ${from}`);

        navigate(from, { replace: true });
      } else {
        debugLog('LoginForm', 'Login returned false');
        showToast('No pudimos iniciar tu sesión. Por favor, inténtalo de nuevo.', 'error');
      }
    } catch (error) {
      errorLog('LoginForm', 'Login submission error', error);

      setIsEmailNotVerified(false);
      setResendVerificationSuccess(false);

      if (error instanceof Error && error.message === 'Login request timed out') {
        showToast(
          'La solicitud de inicio de sesión tardó demasiado. Por favor, inténtalo de nuevo.',
          'error',
        );
      } else if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorCode = error.response?.data?.code;
        const errorMessage = error.response?.data?.message;

        if ((status === 401 || status === 403) && errorCode === 'EMAIL_NOT_VERIFIED') {
          setIsEmailNotVerified(true);
        } else if (errorMessage) {
          showToast(errorMessage, 'error');
        } else {
          showToast('No pudimos iniciar tu sesión. Por favor, inténtalo de nuevo.', 'error');
        }
      } else {
        showToast('No pudimos iniciar tu sesión. Por favor, inténtalo de nuevo.', 'error');
      }

      if (isLoading) {
        if (typeof clearError === 'function') {
          clearError();
        }
      }
    }
  };

  return (
    <MobileForm title="Entrar" onSubmit={handleSubmit(onSubmit)}>
      {error && !isEmailNotVerified && (
        <Alert variant="error" className={styles.formAlert}>
          {error}
        </Alert>
      )}

      {isEmailNotVerified && (
        <div className={styles.verificationAlert}>
          <Alert variant="warning" className={styles.formAlert}>
            <h4>¡Necesitas verificar tu correo electrónico!</h4>
            <p>
              <strong>No puedes iniciar sesión hasta verificar tu correo.</strong> Por favor, revisa
              tu bandeja de entrada y la carpeta de spam para encontrar el enlace de verificación
              que te enviamos.
            </p>
            <p>
              El correo puede tardar hasta 5 minutos en llegar. Si no lo recibiste o el enlace ya
              expiró (son válidos por 24 horas), puedes solicitar uno nuevo.
            </p>

            {resendVerificationSuccess ? (
              <div className={styles.successMessage}>
                <p>¡Correo de verificación reenviado exitosamente!</p>
                <p>
                  El correo puede tardar hasta 5 minutos en llegar. Por favor, revisa tu bandeja de
                  entrada y también tu carpeta de spam.
                </p>
                <p>Recuerda que el enlace estará activo durante 24 horas.</p>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={handleResendVerification}
                disabled={isResendingVerification}
                className={`${styles.resendButton} touch-target`}
              >
                {isResendingVerification ? 'Reenviando...' : 'Reenviar correo de verificación'}
              </Button>
            )}
          </Alert>
        </div>
      )}

      <MobileFormGroup>
        <MobileFormLabel htmlFor="email" required>
          Correo electrónico
        </MobileFormLabel>
        <MobileFormInput
          type="email"
          id="email"
          error={errors.email?.message}
          {...register('email')}
          required
          autoComplete="email"
          inputMode="email"
        />
      </MobileFormGroup>

      <MobileFormGroup>
        <MobileFormLabel htmlFor="password" required>
          Contraseña
        </MobileFormLabel>
        <MobileFormInput
          type="password"
          id="password"
          error={errors.password?.message}
          {...register('password')}
          required
          autoComplete="current-password"
        />
      </MobileFormGroup>

      <MobileFormActions>
        <div className="hidden-xs"></div>

        <Button type="submit" variant="primary" disabled={isLoading}>
          {isLoading ? (
            <>
              Entrando...
              <span className={styles.spinner}></span>
            </>
          ) : (
            'Entrar'
          )}
        </Button>
      </MobileFormActions>

      <div className="mobile-form-links">
        <div className="mobile-form-links-section">
          <p>
            <Link to="/forgot-password" className="mobile-link-minor touch-target">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </div>

        <div className="mobile-form-links-section">
          <p className="mobile-text-muted">¿No tienes cuenta?</p>
          <p>
            <Link to="/register" className="mobile-link-action touch-target">
              Crear cuenta
            </Link>
          </p>
        </div>
      </div>
    </MobileForm>
  );
};

export default LoginForm;
