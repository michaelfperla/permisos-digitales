import React from 'react';
import { FaCheck, FaExclamationTriangle, FaCircle } from 'react-icons/fa';

import styles from './StatusTimeline.module.css';
import { ApplicationStatus } from '../../constants/application.constants';
import Icon from '../../shared/components/ui/Icon';

type StepStatus = 'completed' | 'current' | 'pending' | 'rejected' | 'expired';

interface TimelineStep {
  id: string;
  label: string;
  description: string;
  date?: string;
  status: StepStatus;
  icon?: React.ReactNode;
}

interface StatusTimelineProps {
  currentStatus: ApplicationStatus;
  applicationDates: {
    created_at: string;    payment_verified_at?: string;
    fecha_expedicion?: string;
  };
}

/**
 * Timeline component showing application status progression with OXXO payment support
 */

const StatusTimeline: React.FC<StatusTimelineProps> = ({ currentStatus, applicationDates }) => {
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Pendiente';

    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimelineSteps = (): TimelineStep[] => {
    if (currentStatus === 'AWAITING_OXXO_PAYMENT') {
      return [
        {
          id: 'created',
          label: 'Solicitud Creada',
          description: formatDate(applicationDates.created_at),
          status: 'completed',
          icon: null,
        },
        {
          id: 'awaiting-oxxo',
          label: 'Pago OXXO Pendiente',
          description:
            'Esperando confirmación de pago en OXXO. Por favor, realice el pago con la referencia proporcionada.',
          status: 'current',
          icon: null,
        },
      ];
    }

    if (currentStatus === 'EXPIRED') {
      return [
        {
          id: 'permit-issued',
          label: 'Permiso Emitido',
          description: formatDate(applicationDates.fecha_expedicion),
          status: 'completed',
          icon: null,
        },
        {
          id: 'permit-expired',
          label: 'Permiso Expirado',
          description:
            'Este permiso ha expirado. Si necesita continuar utilizando el vehículo, deberá solicitar un nuevo permiso.',
          status: 'expired',
          icon: null,
        },
      ];
    }

    const allSteps: {
      status: ApplicationStatus;
      label: string;
      description: string;
      date?: string;
    }[] = [
      {
        status: ApplicationStatus.AWAITING_PAYMENT,
        label: 'Solicitud Creada',
        description: 'Solicitud creada, pendiente de pago',
        date: applicationDates.created_at,
      },
      {
        status: ApplicationStatus.PAYMENT_PROCESSING,
        label: 'Pago en Proceso',
        description: 'Pago en proceso de verificación',
        date: undefined,
      },
      {
        status: ApplicationStatus.PAYMENT_RECEIVED,
        label: 'Pago Recibido',
        description: 'Pago procesado y confirmado',
        date: applicationDates.payment_verified_at,
      },
      {
        status: ApplicationStatus.GENERATING_PERMIT,
        label: 'Generando Permiso',
        description: 'Tu permiso está en proceso de generación',
        date: undefined,
      },
      {
        status: ApplicationStatus.PERMIT_READY,
        label: 'Permiso Listo',
        description: 'Permiso generado y listo para descargar',
        date: applicationDates.fecha_expedicion,
      },
    ];

    const currentStatusIndex = allSteps.findIndex((step) => step.status === currentStatus);

    if (currentStatusIndex === -1) {
      return [
        {
          id: 'created',
          label: 'Solicitud Creada',
          description: formatDate(applicationDates.created_at),
          status: 'completed',
          icon: null,
        },
        {
          id: 'current-status',
          label: getStatusText(currentStatus),
          description: 'Estado actual de la solicitud',
          status: 'current',
          icon: null,
        },
      ];
    }

    const timelineSteps: TimelineStep[] = [];

    for (let i = 0; i <= currentStatusIndex; i++) {
      const step = allSteps[i];
      // Mark PERMIT_READY as completed when it's the current status
      const isCompleted = i < currentStatusIndex || 
        (currentStatus === ApplicationStatus.PERMIT_READY && step.status === ApplicationStatus.PERMIT_READY);
      
      timelineSteps.push({
        id: `step-${i}`,
        label: step.label,
        description: step.date ? formatDate(step.date) : step.description,
        status: isCompleted ? 'completed' : 'current',
        icon: null, // Icons are now handled by CSS pseudo-elements
      });
    }

    if (currentStatusIndex < allSteps.length - 1) {
      const nextStep = allSteps[currentStatusIndex + 1];
      timelineSteps.push({
        id: `step-${currentStatusIndex + 1}`,
        label: nextStep.label,
        description: nextStep.description,
        status: 'pending',
        icon: null,
      });
    }

    return timelineSteps;
  };

  const steps = getTimelineSteps();

  return (
    <div className={styles.timelineContainer}>
      <div className={styles.timeline}>
        {steps.map((step, _index) => (
          <div
            key={step.id}
            className={`${styles.stepItem} ${styles[`step${step.status.charAt(0).toUpperCase() + step.status.slice(1)}`]}`}
          >
            <div className={styles.stepIndicator}>
              {step.icon}
            </div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>{step.label}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const getStatusText = (status: ApplicationStatus): string => {
  switch (status) {
    case 'AWAITING_OXXO_PAYMENT':
      return 'Pendiente de Pago (OXXO)';
    case 'PAYMENT_PROCESSING':
      return 'Pago en Proceso';
    case 'PAYMENT_FAILED':
      return 'Pago Fallido';
    case 'PAYMENT_RECEIVED':
      return 'Pago Recibido';
    case 'GENERATING_PERMIT':
      return 'Generando Permiso';
    case 'ERROR_GENERATING_PERMIT':
      return 'Error al Generar';
    case 'PERMIT_READY':
      return 'Permiso Listo';
    case 'COMPLETED':
      return 'Completado';
    case 'CANCELLED':
      return 'Cancelado';
    case 'EXPIRED':
      return 'Expirado';
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

export default StatusTimeline;
