import React, { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import authService from '../services/authService';
import { debugLog, errorLog } from '../utils/debug';
import styles from './ResendVerificationPage.module.css';
import Button from '../components/ui/Button/Button';
import Input from '../components/ui/Input/Input';
import Alert from '../components/ui/Alert/Alert';
import Card from '../components/ui/Card/Card';
import { FaCheckCircle, FaEnvelope, FaArrowRight, FaInfoCircle, FaSpinner } from 'react-icons/fa';

const ResendVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use email from location state if available
  useEffect(() => {
    const stateEmail = location.state?.email;
    if (stateEmail) {
      setEmail(stateEmail);
    }
  }, [location.state]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);

    if (!email) {
      setEmailError('Por favor, ingresa tu correo electrónico');
      return false;
    } else if (!isValid) {
      setEmailError('Por favor, ingresa un correo electrónico válido');
      return false;
    }

    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    debugLog('ResendVerificationPage', 'Form submitted');

    // Clear any previous errors
    setError(null);

    // Validate form
    const isEmailValid = validateEmail(email);

    if (!isEmailValid) {
      debugLog('ResendVerificationPage', 'Form validation failed', { emailError });
      return;
    }

    try {
      setIsLoading(true);
      debugLog('ResendVerificationPage', `Resending verification email to: ${email}`);

      const result = await authService.resendVerificationEmail(email);

      if (result.success) {
        debugLog('ResendVerificationPage', 'Verification email resent successfully');
        setIsSuccess(true);
      } else {
        debugLog('ResendVerificationPage', 'Failed to resend verification email', result.message);
        setError(result.message);
      }
    } catch (error) {
      errorLog('ResendVerificationPage', 'Error resending verification email', error);
      setError('Error al reenviar el correo de verificación. Por favor, intenta nuevamente más tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.verificationContainer}>
      <div className={styles.verificationHeader}>
        <h1 className={styles.verificationTitle}>Reenviar Correo de Verificación</h1>
        <p className={styles.verificationSubtitle}>
          Solicita un nuevo enlace de verificación para tu cuenta
        </p>
      </div>

      <Card className={styles.verificationCard}>
        <div className={styles.cardContent}>
          {isSuccess ? (
            <div className={styles.successContainer}>
              <div className={styles.successIconWrapper}>
                <FaCheckCircle className={styles.successIcon} />
              </div>
              <h2 className={styles.successTitle}>¡Correo enviado!</h2>
              <p className={styles.successMessage}>
                Si tu correo electrónico está registrado y aún no ha sido verificado,
                recibirás un nuevo enlace de verificación en tu bandeja de entrada.
              </p>
              <div className={styles.infoBox}>
                <h3 className={styles.infoTitle}>
                  <FaInfoCircle className={styles.infoIcon} />
                  Información importante:
                </h3>
                <p className={styles.infoText}>
                  El correo puede tardar hasta 5 minutos en llegar. Por favor, revisa tu bandeja de entrada y también tu carpeta de spam.
                </p>
                <p className={styles.infoText}>
                  Recuerda que el enlace de verificación estará activo durante 24 horas. Haz clic en él para activar tu cuenta.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                className={styles.loginButton}
                onClick={() => navigate('/login')}
              >
                Ir a iniciar sesión <FaArrowRight className={styles.buttonIcon} />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.formIconWrapper}>
                <FaEnvelope className={styles.formIcon} />
              </div>

              {error && (
                <Alert variant="error" className={styles.alertMargin}>
                  {error}
                </Alert>
              )}

              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.label}>
                  Correo electrónico
                </label>
                <div className={styles.inputWrapper}>
                  <Input
                    type="email"
                    id="email"
                    error={!!emailError}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
                {emailError && <span className={styles.errorText}>{emailError}</span>}
              </div>

              <div className={styles.infoBox}>
                <h3 className={styles.infoTitle}>
                  <FaInfoCircle className={styles.infoIcon} />
                  Nota:
                </h3>
                <p className={styles.infoText}>
                  Si ya verificaste tu correo electrónico, puedes ir directamente a la página de inicio de sesión.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={isLoading}
                className={styles.submitButton}
              >
                {isLoading ? (
                  <>
                    Enviando... <FaSpinner className={styles.spinner} />
                  </>
                ) : (
                  'Reenviar correo de verificación'
                )}
              </Button>

              <Link to="/login" className={styles.backLink}>
                Volver a iniciar sesión
              </Link>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ResendVerificationPage;
