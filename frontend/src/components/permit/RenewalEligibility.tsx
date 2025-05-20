import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import applicationService from '../../services/applicationService';
import { Application } from '../../services/applicationService';
import styles from './RenewalEligibility.module.css';

interface RenewalEligibilityProps {
  application: Application;
  onRefresh?: () => void;
}

const RenewalEligibility: React.FC<RenewalEligibilityProps> = ({ application, onRefresh }) => {
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    message: string;
    daysUntilExpiration?: number;
    expirationDate?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkEligibility();
  }, [application.id]);

  const checkEligibility = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await applicationService.checkRenewalEligibility(application.id);
      setEligibility(result);
    } catch (err) {
      setError('Error al verificar la elegibilidad para renovación');
      console.error('Error checking renewal eligibility:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Verificando elegibilidad para renovación...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{error}</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={checkEligibility}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!eligibility) {
    return null;
  }

  return (
    <div className={styles.container}>
      {eligibility.eligible ? (
        <div className={styles.eligibleCard}>
          <div className={styles.iconContainer}>
            <span className={styles.eligibleIcon}>✓</span>
          </div>
          <div className={styles.content}>
            <h3 className={styles.title}>Elegible para Renovación</h3>
            <p className={styles.message}>{eligibility.message}</p>
            {eligibility.expirationDate && (
              <p className={styles.expirationDate}>
                Fecha de vencimiento: {new Date(eligibility.expirationDate).toLocaleDateString()}
              </p>
            )}
            <p className={styles.renewalInfo}>
              Recuerde que todos los permisos tienen una validez de 30 días y pueden renovarse 7 días antes de su vencimiento o hasta 15 días después de vencidos.
            </p>
            <div className={styles.actions}>
              <Link
                to={`/permits/${application.id}/renew`}
                className={styles.renewButton}
              >
                Renovar Permiso
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.ineligibleCard}>
          <div className={styles.iconContainer}>
            <span className={styles.ineligibleIcon}>ⓘ</span>
          </div>
          <div className={styles.content}>
            <h3 className={styles.title}>No Elegible para Renovación</h3>
            <p className={styles.message}>{eligibility.message}</p>
            {eligibility.expirationDate && (
              <p className={styles.expirationDate}>
                Fecha de vencimiento: {new Date(eligibility.expirationDate).toLocaleDateString()}
              </p>
            )}
            <p className={styles.renewalInfo}>
              Todos los permisos tienen una validez de 30 días y pueden renovarse 7 días antes de su vencimiento o hasta 15 días después de vencidos.
            </p>
            {eligibility.daysUntilExpiration && eligibility.daysUntilExpiration < -15 && (
              <div className={styles.actions}>
                <Link
                  to="/permits/new"
                  className={styles.newPermitButton}
                >
                  Solicitar Nuevo Permiso
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RenewalEligibility;
