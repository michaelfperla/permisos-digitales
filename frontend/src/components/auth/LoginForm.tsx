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

const LoginForm: React.FC = () => {
  const [isEmailNotVerified, setIsEmailNotVerified] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendVerificationSuccess, setResendVerificationSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get auth context
  const { login, isLoading, error, clearError, resendVerificationEmail } = useAuth();

  // Get toast context
  const { showToast } = useToast();

  // Get the intended destination from location state, or default to dashboard
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
  });

  // Clear auth errors when component unmounts
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Handle resend verification email
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
      // Ignore the specific error and just show a generic message
      showToast('Error al reenviar el correo de verificación.', 'error');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    debugLog('LoginForm', 'Login form submitted');

    // Clear any previous errors
    clearError();

    // Create a promise that will reject after a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Login request timed out'));
      }, 10000); // 10 second timeout
    });

    try {
      debugLog('LoginForm', `Attempting login with email: ${data.email}`);

      // Race the login against the timeout
      const loginPromise = login(data.email, data.password);
      const success = (await Promise.race([loginPromise, timeoutPromise])) as boolean;

      debugLog('LoginForm', `Login result: ${success}`);

      if (success) {
        // Show success toast
        showToast('¡Bienvenido! Iniciaste sesión', 'success');
        debugLog('LoginForm', `Login successful, navigating to: ${from}`);

        // Navigate directly without setTimeout
        navigate(from, { replace: true });
      } else {
        debugLog('LoginForm', 'Login returned false');
        showToast('No pudimos iniciar tu sesión. Por favor, inténtalo de nuevo.', 'error');
      }
    } catch (error) {
      errorLog('LoginForm', 'Login submission error', error);

      // Reset email verification state
      setIsEmailNotVerified(false);
      setResendVerificationSuccess(false);

      // Handle timeout specifically
      if (error instanceof Error && error.message === 'Login request timed out') {
        showToast(
          'La solicitud de inicio de sesión tardó demasiado. Por favor, inténtalo de nuevo.',
          'error',
        );
      } else if (axios.isAxiosError(error)) {
        // Check for email not verified error
        const status = error.response?.status;
        const errorCode = error.response?.data?.code;
        const errorMessage = error.response?.data?.message;

        if ((status === 401 || status === 403) && errorCode === 'EMAIL_NOT_VERIFIED') {
          // Set email not verified state
          setIsEmailNotVerified(true);
          // Don't show a toast since we'll display a specific message in the UI
        } else if (errorMessage) {
          // Show the error message from the server
          showToast(errorMessage, 'error');
        } else {
          // Show a generic error message
          showToast('No pudimos iniciar tu sesión. Por favor, inténtalo de nuevo.', 'error');
        }
      } else {
        showToast('No pudimos iniciar tu sesión. Por favor, inténtalo de nuevo.', 'error');
      }

      // Force isLoading to false in case it got stuck
      if (isLoading) {
        // This is a hack to force the loading state to false
        // We're directly calling the function that would normally be called by the AuthContext
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
        {/* Empty button to maintain consistent layout with RegisterForm */}
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
