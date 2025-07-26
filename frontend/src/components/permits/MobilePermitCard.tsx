import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaCar, 
  FaCalendarAlt, 
  FaFileAlt, 
  FaClock,
  FaCheckCircle,
  FaExclamationCircle,
  FaStore,
  FaIdCard,
  FaDollarSign
} from 'react-icons/fa';

import styles from './MobilePermitCard.module.css';
import StatusBadge from '../ui/StatusBadge/StatusBadge';
import Button from '../ui/Button/Button';
import Icon from '../../shared/components/ui/Icon';
import { ApplicationStatus } from '../../constants/application.constants';
import { formatTimeRemaining, isExpiringSoon } from '../../utils/dateUtils';

interface MobilePermitCardProps {
  application: {
    id: string;
    folio?: string;
    marca: string;
    linea: string;
    ano_modelo: string;
    nombre_completo: string;
    status: ApplicationStatus | string;
    created_at: string;
    expires_at?: string;
    importe?: number | string;
    placas?: string;
  };
  onClick?: () => void;
  className?: string;
}

const MobilePermitCard: React.FC<MobilePermitCardProps> = ({ 
  application, 
  onClick,
  className = '' 
}) => {
  const navigate = useNavigate();
  
  // Get status icon
  const getStatusIcon = (status: ApplicationStatus | string) => {
    switch (status) {
      case ApplicationStatus.AWAITING_OXXO_PAYMENT:
        return <FaStore />;
      case ApplicationStatus.PERMIT_READY:
      case ApplicationStatus.COMPLETED:
        return <FaCheckCircle />;
      case ApplicationStatus.PAYMENT_FAILED:
        return <FaExclamationCircle />;
      case ApplicationStatus.AWAITING_PAYMENT:
      case ApplicationStatus.PAYMENT_PROCESSING:
        return <FaClock />;
      default:
        return <FaClock />;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Format price
  const formatPrice = (importe: any): string => {
    if (importe === null || importe === undefined) return '150.00';
    if (typeof importe === 'number') return importe.toFixed(2);
    if (typeof importe === 'string') {
      const parsed = parseFloat(importe);
      return isNaN(parsed) ? '150.00' : parsed.toFixed(2);
    }
    return '150.00';
  };

  // Check if needs payment action
  const needsPaymentAction = 
    application.status === ApplicationStatus.AWAITING_PAYMENT || 
    application.status === ApplicationStatus.AWAITING_OXXO_PAYMENT ||
    application.status === ApplicationStatus.PAYMENT_FAILED;

  // Check expiration
  const timeRemaining = application.expires_at ? formatTimeRemaining(application.expires_at) : null;
  const expiringSoon = application.expires_at ? isExpiringSoon(application.expires_at) : false;

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/permits/${application.id}`);
    }
  };

  const handlePaymentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/permits/${application.id}/payment`);
  };

  return (
    <div 
      className={`${styles.card} ${className}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleCardClick();
        }
      }}
    >
      {/* Card Header */}
      <div className={styles.cardHeader}>
        <div className={styles.vehicleIcon}>
          <FaCar />
        </div>
        <div className={styles.headerContent}>
          <h3 className={styles.vehicleTitle}>
            {application.marca} {application.linea} {application.ano_modelo}
          </h3>
          <p className={styles.ownerName}>{application.nombre_completo}</p>
        </div>
        <StatusBadge 
          status={application.status as ApplicationStatus}
          icon={getStatusIcon(application.status)}
          className={styles.statusBadge}
        />
      </div>

      {/* Card Body */}
      <div className={styles.cardBody}>
        <div className={styles.dataRows}>
          {application.folio && (
            <div className={styles.dataRow}>
              <Icon IconComponent={FaFileAlt} size="sm" className={styles.dataIcon} />
              <span className={styles.dataLabel}>Folio:</span>
              <span className={styles.dataValue}>{application.folio}</span>
            </div>
          )}
          
          {application.placas && (
            <div className={styles.dataRow}>
              <Icon IconComponent={FaIdCard} size="sm" className={styles.dataIcon} />
              <span className={styles.dataLabel}>Placas:</span>
              <span className={styles.dataValue}>{application.placas}</span>
            </div>
          )}
          
          <div className={styles.dataRow}>
            <Icon IconComponent={FaCalendarAlt} size="sm" className={styles.dataIcon} />
            <span className={styles.dataLabel}>Creada:</span>
            <span className={styles.dataValue}>{formatDate(application.created_at)}</span>
          </div>

          {needsPaymentAction && (
            <div className={styles.dataRow}>
              <Icon IconComponent={FaDollarSign} size="sm" className={styles.dataIcon} />
              <span className={styles.dataLabel}>Monto:</span>
              <span className={styles.dataValue}>${formatPrice(application.importe)} MXN</span>
            </div>
          )}
        </div>

        {/* Expiration Warning */}
        {timeRemaining && needsPaymentAction && (
          <div className={`${styles.expirationWarning} ${expiringSoon ? styles.expiringSoon : ''}`}>
            <Icon IconComponent={FaClock} size="sm" />
            <span>Vence en: {timeRemaining}</span>
          </div>
        )}
      </div>

      {/* Card Footer */}
      {needsPaymentAction && (
        <div className={styles.cardFooter}>
          <Button
            variant="primary"
            size="small"
            onClick={handlePaymentClick}
            className={styles.paymentButton}
          >
            Completar Pago
          </Button>
        </div>
      )}
    </div>
  );
};

export default MobilePermitCard;