import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import { Link } from 'react-router-dom';

import styles from './VerificationHistoryPage.module.css';
import Icon from '../../shared/components/ui/Icon';

/**
 * VerificationHistoryPage Component
 *
 * This component displays a placeholder page for the payment verification history functionality
 * that has been replaced by an automated payment provider integration.
 */
const VerificationHistoryPage: React.FC = () => {
  return (
    <div className={styles.verificationHistoryPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Historial de Verificaciones</h1>
          <p className={styles.pageSubtitle}>Sistema de verificación de pagos actualizado</p>
        </div>
      </header>

      <div className={styles.emptyState}>
        <Icon
          IconComponent={FaExclamationTriangle}
          className={styles.noticeIcon}
          size="xl"
          color="var(--color-warning)"
        />
        <h2>Funcionalidad en actualización</h2>
        <p>
          El historial de verificaciones manuales de pagos ya no está disponible. El sistema ha sido
          actualizado para usar verificación automática a través de un proveedor de pagos.
        </p>
        <p>
          Para ver todas las solicitudes, visite la{' '}
          <Link to="/applications" className={styles.linkText}>
            lista de solicitudes
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default VerificationHistoryPage;
