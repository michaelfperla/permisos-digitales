import React from 'react';

import styles from './StatusBadge.module.css';
import { ApplicationStatus } from '../../../services/applicationService';

interface StatusBadgeProps {
  status: ApplicationStatus;
  size?: 'default' | 'large';
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'default', className = '' }) => {
  // Map status to display text
  const getStatusText = (status: ApplicationStatus): string => {
    switch (status) {
      // Payment-related statuses
      case 'AWAITING_PAYMENT':
        return 'Pendiente de Pago';
      case 'AWAITING_OXXO_PAYMENT':
        return 'Pendiente de Pago (OXXO)';
      case 'PAYMENT_PROCESSING':
        return 'Pago en Proceso';
      case 'PAYMENT_FAILED':
        return 'Pago Fallido';
      case 'PAYMENT_RECEIVED':
        return 'Pago Recibido';

      // Permit generation statuses
      case 'GENERATING_PERMIT':
        return 'Generando Permiso';
      case 'ERROR_GENERATING_PERMIT':
        return 'Error al Generar';
      case 'PERMIT_READY':
        return 'Permiso Listo';

      // Final statuses
      case 'COMPLETED':
        return 'Completado';
      case 'CANCELLED':
        return 'Cancelado';
      case 'EXPIRED':
        return 'Expirado';

      // Renewal statuses
      case 'RENEWAL_PENDING':
        return 'Renovación Pendiente';
      case 'RENEWAL_APPROVED':
        return 'Renovación Aprobada';
      case 'RENEWAL_REJECTED':
        return 'Renovación Rechazada';

      default:
        return status;
    }
  };

  // Map status to CSS class
  const getStatusClass = (status: ApplicationStatus): string => {
    switch (status) {
      // Action needed statuses
      case 'AWAITING_PAYMENT':
      case 'AWAITING_OXXO_PAYMENT':
        return styles.statusActionNeeded;

      // Rejected/Error statuses
      case 'ERROR_GENERATING_PERMIT':
      case 'CANCELLED':
      case 'PAYMENT_FAILED':
      case 'RENEWAL_REJECTED':
        return styles.statusRejected;

      // Approved/Success statuses
      case 'PAYMENT_RECEIVED':
      case 'PERMIT_READY':
      case 'COMPLETED':
      case 'RENEWAL_APPROVED':
        return styles.statusApproved;

      // Processing statuses
      case 'PAYMENT_PROCESSING':
      case 'GENERATING_PERMIT':
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
    <span
      className={`${styles.statusBadge} ${getStatusClass(status)} ${size === 'large' ? styles.statusBadgeLarge : ''} ${className}`}
    >
      {getStatusText(status)}
    </span>
  );
};

export default StatusBadge;
