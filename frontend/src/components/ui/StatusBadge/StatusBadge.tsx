import React from 'react';
import { ApplicationStatus } from '../../../services/applicationService';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  status: ApplicationStatus;
  size?: 'default' | 'large';
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'default', className = '' }) => {
  // Map status to display text
  const getStatusText = (status: ApplicationStatus): string => {
    switch (status) {
      // Payment flow statuses
      case 'AWAITING_OXXO_PAYMENT':
        return 'Pago OXXO Pendiente';
      case 'PAYMENT_RECEIVED':
        return 'Pago recibido';

      // Permit generation statuses
      case 'GENERATING_PERMIT':
        return 'Preparando permiso';
      case 'ERROR_GENERATING_PERMIT':
        return 'No se pudo generar el permiso';
      case 'PERMIT_READY':
        return 'Permiso listo';

      // Completion statuses
      case 'COMPLETED':
        return 'Completado';
      case 'CANCELLED':
        return 'Cancelado';
      case 'EXPIRED':
        return 'Vencido';

      // Renewal statuses
      case 'RENEWAL_PENDING':
        return 'Falta renovar';
      case 'RENEWAL_SUBMITTED':
        return 'Renovación enviada';
      case 'RENEWAL_APPROVED':
        return 'Renovación aprobada';
      case 'RENEWAL_REJECTED':
        return 'Renovación rechazada';

      default:
        return status;
    }
  };

  // Map status to CSS class
  const getStatusClass = (status: ApplicationStatus): string => {
    switch (status) {
      // Action needed statuses
      case 'AWAITING_OXXO_PAYMENT':
        return styles.statusActionNeeded;

      // Rejected/Error statuses
      case 'ERROR_GENERATING_PERMIT':
      case 'CANCELLED':
      case 'RENEWAL_REJECTED':
        return styles.statusRejected;

      // Approved/Success statuses
      case 'PAYMENT_RECEIVED':
      case 'PERMIT_READY':
      case 'COMPLETED':
      case 'RENEWAL_APPROVED':
        return styles.statusApproved;

      // Processing statuses
      case 'GENERATING_PERMIT':
      case 'RENEWAL_SUBMITTED':
        return styles.statusPending;

      // Warning statuses
      case 'EXPIRED':
      case 'RENEWAL_PENDING':
        return styles.statusWarning;

      default:
        return styles.statusPending;
    }
  };

  return (
    <span className={`${styles.statusBadge} ${getStatusClass(status)} ${size === 'large' ? styles.statusBadgeLarge : ''} ${className}`}>
      {getStatusText(status)}
    </span>
  );
};

export default StatusBadge;
