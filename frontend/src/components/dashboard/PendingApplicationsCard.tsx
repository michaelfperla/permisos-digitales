import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaClock, FaExclamationTriangle, FaCreditCard, FaFileAlt } from 'react-icons/fa';
import { getPendingApplications, type Application } from '../../services/applicationService';
import { formatTimeRemaining, isExpiringSoon } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import styles from './PendingApplicationsCard.module.css';

interface PendingApplicationsCardProps {
  className?: string;
}

const PendingApplicationsCard: React.FC<PendingApplicationsCardProps> = ({ className = '' }) => {
  const [pendingApplications, setPendingApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to safely format price
  const formatPrice = (importe: any): string => {
    if (importe === null || importe === undefined) return '150.00';
    if (typeof importe === 'number') return importe.toFixed(2);
    if (typeof importe === 'string') {
      const parsed = parseFloat(importe);
      return isNaN(parsed) ? '150.00' : parsed.toFixed(2);
    }
    return '150.00';
  };

  useEffect(() => {
    const fetchPendingApplications = async () => {
      try {
        setLoading(true);
        const response = await getPendingApplications();
        if (response.success) {
          setPendingApplications(response.applications);
        } else {
          setError('Error al cargar solicitudes pendientes');
        }
      } catch (err) {
        setError('Error al cargar solicitudes pendientes');
        logger.error('Error fetching pending applications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingApplications();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'AWAITING_PAYMENT':
        return <FaCreditCard className={styles.icon} />;
      case 'AWAITING_OXXO_PAYMENT':
        return <FaFileAlt className={styles.icon} />;
      case 'PAYMENT_PROCESSING':
        return <FaClock className={styles.icon} />;
      default:
        return <FaExclamationTriangle className={styles.icon} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'AWAITING_PAYMENT':
        return 'Pendiente de pago';
      case 'AWAITING_OXXO_PAYMENT':
        return 'Pendiente pago OXXO';
      case 'PAYMENT_PROCESSING':
        return 'Procesando pago';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AWAITING_PAYMENT':
        return styles.statusPending;
      case 'AWAITING_OXXO_PAYMENT':
        return styles.statusOxxo;
      case 'PAYMENT_PROCESSING':
        return styles.statusProcessing;
      default:
        return styles.statusPending;
    }
  };

  if (loading) {
    return (
      <div className={`${styles.card} ${className}`}>
        <div className={styles.header}>
          <div className={styles.titleContainer}>
            <FaClock className={styles.icon} />
            <h3 className={styles.title}>Solicitudes Pendientes</h3>
          </div>
        </div>
        <div className={styles.loadingContent}>
          <div className={`${styles.loadingBar} ${styles.loadingBarLarge}`}></div>
          <div className={`${styles.loadingBar} ${styles.loadingBarSmall}`}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.card} ${className}`}>
        <div className={styles.header}>
          <div className={styles.titleContainer}>
            <FaExclamationTriangle className={`${styles.icon} ${styles.errorIcon}`} />
            <h3 className={styles.title}>Solicitudes Pendientes</h3>
          </div>
        </div>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (pendingApplications.length === 0) {
    return (
      <div className={`${styles.card} ${className}`}>
        <div className={styles.header}>
          <div className={styles.titleContainer}>
            <FaClock className={`${styles.icon} ${styles.successIcon}`} />
            <h3 className={styles.title}>Solicitudes Pendientes</h3>
          </div>
        </div>
        <p className={styles.emptyText}>No tienes solicitudes pendientes de pago.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${className}`}>
      <div className={styles.header}>
        <div className={styles.titleContainer}>
          <FaClock className={styles.icon} />
          <h3 className={styles.title}>Solicitudes Pendientes</h3>
        </div>
        <span className={styles.badge}>
          {pendingApplications.length}
        </span>
      </div>

      <div className={styles.applicationsList}>
        {pendingApplications.map((application) => {
          const timeRemaining = application.expires_at ? formatTimeRemaining(application.expires_at) : null;
          const expiringSoon = application.expires_at ? isExpiringSoon(application.expires_at) : false;

          return (
            <div
              key={application.id}
              className={styles.applicationItem}
            >
              <div className={styles.applicationHeader}>
                <div className={styles.applicationContent}>
                  <h4 className={styles.vehicleInfo}>
                    {application.marca} {application.linea} {application.ano_modelo}
                  </h4>
                  <p className={styles.applicantName}>
                    {application.nombre_completo}
                  </p>
                  
                  <div className={styles.statusContainer}>
                    {getStatusIcon(application.status)}
                    <span className={`${styles.statusBadge} ${getStatusColor(application.status)}`}>
                      {getStatusText(application.status)}
                    </span>
                  </div>
                </div>

                <div className={styles.priceContainer}>
                  <p className={styles.price}>
                    ${formatPrice(application.importe)} MXN
                  </p>
                  {timeRemaining && (
                    <p className={`${styles.expirationInfo} ${expiringSoon ? styles.expirationWarning : styles.expirationNormal}`}>
                      {expiringSoon && <FaExclamationTriangle />}
                      Vence en: {timeRemaining}
                    </p>
                  )}
                </div>
              </div>

              <div className={styles.applicationFooter}>
                <p className={styles.createdDate}>
                  Creada: {new Date(application.created_at).toLocaleDateString('es-MX')}
                </p>
                
                {application.status === 'AWAITING_OXXO_PAYMENT' ? (
                  <Link
                    to={`/permits/${application.id}`}
                    className={styles.paymentButton}
                  >
                    Ver Detalles
                  </Link>
                ) : (
                  <Link
                    to={`/permits/${application.id}/payment`}
                    className={styles.paymentButton}
                  >
                    Completar Pago
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingApplications.length > 3 && (
        <div className={styles.viewAllLink}>
          <Link
            to="/permits"
            className={styles.viewAllLinkText}
          >
            Ver todas las solicitudes →
          </Link>
        </div>
      )}
    </div>
  );
};

export default PendingApplicationsCard;