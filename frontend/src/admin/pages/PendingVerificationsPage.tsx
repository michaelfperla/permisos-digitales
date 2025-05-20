import React from 'react';
import { Link } from 'react-router-dom';
import { FaExclamationTriangle } from 'react-icons/fa';
import styles from './PendingVerificationsPage.module.css';

/**
 * PendingVerificationsPage Component
 *
 * This component displays a placeholder page for the payment verification functionality
 * that has been replaced by an automated payment provider integration.
 */
const PendingVerificationsPage: React.FC = () => {
  return (
    <div className={styles.pendingVerificationsPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Verificaciones de Pago</h1>
          <p className={styles.pageSubtitle}>
            Sistema de verificación de pagos actualizado
          </p>
        </div>
      </header>

      <div className={styles.emptyState}>
        <FaExclamationTriangle className={styles.noticeIcon} />
        <h2>Funcionalidad en actualización</h2>
        <p>El sistema de verificación manual de pagos ha sido reemplazado por verificación automática a través de un proveedor de pagos.</p>
        <p>Para ver todas las solicitudes, visite la <Link to="/applications" className={styles.linkText}>lista de solicitudes</Link>.</p>
      </div>
    </div>
  );
};

export default PendingVerificationsPage;
