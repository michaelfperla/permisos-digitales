import React, { useState, useEffect } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaSpinner, FaArrowRight } from 'react-icons/fa';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';

import styles from './VerifyEmailPage.module.css';
import Button from '../components/ui/Button/Button';
import Card from '../components/ui/Card/Card';
import authService from '../services/authService';
import Icon from '../shared/components/ui/Icon';
import { debugLog, errorLog } from '../utils/debug';

const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setError('Enlace de verificación inválido o faltante.');
        setIsLoading(false);
        return;
      }

      try {
        debugLog('VerifyEmailPage', `Verifying email with token: ${token.substring(0, 8)}...`);
        const result = await authService.verifyEmailToken(token);

        if (result.success) {
          debugLog('VerifyEmailPage', 'Email verification successful');
          setIsSuccess(true);
        } else {
          debugLog('VerifyEmailPage', 'Email verification failed', result.message);
          setError(result.message);
        }
      } catch (error) {
        errorLog('VerifyEmailPage', 'Error verifying email', error);
        setError(
          'Error al verificar el correo electrónico. Por favor, intenta nuevamente más tarde.',
        );
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className={styles.verificationContainer}>
      <div className={styles.verificationHeader}>
        <h1 className={styles.verificationTitle}>Verifica tu correo electrónico</h1>
        <p className={styles.verificationSubtitle}>
          Estamos procesando tu solicitud de verificación
        </p>
      </div>

      <Card className={styles.verificationCard}>
        {isLoading && (
          <div className={styles.loadingContainer}>
            <div className={styles.spinnerWrapper}>
              <Icon IconComponent={FaSpinner} className={styles.spinner} size="xl" />
            </div>
            <p className={styles.loadingText}>Verificando tu correo electrónico...</p>
          </div>
        )}

        {!isLoading && isSuccess && (
          <div className={styles.successContainer}>
            <div className={styles.successIconWrapper}>
              <Icon
                IconComponent={FaCheckCircle}
                className={styles.successIcon}
                size="xl"
                color="var(--color-success)"
              />
            </div>
            <h2 className={styles.successTitle}>¡Correo verificado exitosamente!</h2>
            <p className={styles.successMessage}>
              Tu dirección de correo electrónico ha sido verificada. ¡Ya puedes iniciar sesión en tu
              cuenta y comenzar a usar todos nuestros servicios!
            </p>
            <Button
              type="button"
              variant="primary"
              className={styles.loginButton}
              onClick={() => navigate('/login')}
            >
              Ir a iniciar sesión{' '}
              <Icon IconComponent={FaArrowRight} className={styles.buttonIcon} size="sm" />
            </Button>
          </div>
        )}

        {!isLoading && !isSuccess && error && (
          <div className={styles.errorContainer}>
            <div className={styles.errorIconWrapper}>
              <Icon
                IconComponent={FaExclamationTriangle}
                className={styles.errorIcon}
                size="xl"
                color="var(--color-danger)"
              />
            </div>
            <h2 className={styles.errorTitle}>Error de verificación</h2>
            <p className={styles.errorMessage}>{error}</p>
            <div className={styles.errorNote}>
              El enlace puede ser inválido o haber expirado. Los enlaces de verificación son válidos
              por 24 horas.
            </div>
            <div className={styles.errorActions}>
              <Button
                type="button"
                variant="primary"
                className={styles.actionButton}
                onClick={() => navigate('/login')}
              >
                Ir a iniciar sesión
              </Button>
              <span className={styles.linkDivider}>o</span>
              <Link to="/resend-verification" className={styles.actionLink}>
                Solicitar nuevo enlace de verificación
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default VerifyEmailPage;
