/**
 * StatusTimeline Component
 *
 * This component displays a timeline of application status steps.
 * It was previously named NewStatusTimeline and has been updated to support
 * the new payment flow, including OXXO payments and other status types.
 *
 * The component provides a responsive timeline that adapts to different screen sizes
 * and shows the appropriate steps based on the current application status.
 */

import React from 'react';
import { FaCheck, FaTimes, FaExclamationTriangle, FaCircle } from 'react-icons/fa';
import styles from './StatusTimeline.module.css';
import { ApplicationStatus } from '../../services/applicationService';

// Define the step status types
type StepStatus = 'completed' | 'current' | 'pending' | 'rejected' | 'expired';

// Define the structure for a timeline step
interface TimelineStep {
  id: string;
  label: string;
  description: string;
  date?: string;
  status: StepStatus;
  icon?: React.ReactNode;
}

// Props for the StatusTimeline component
interface StatusTimelineProps {
  currentStatus: ApplicationStatus;
  applicationDates: {
    created_at: string;
    payment_proof_uploaded_at?: string;
    payment_verified_at?: string;
    fecha_expedicion?: string;
  };
}

const StatusTimeline: React.FC<StatusTimelineProps> = ({
  currentStatus,
  applicationDates
}) => {
  // Helper function to format dates
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Pendiente';

    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Generate steps based on the current status
  const getTimelineSteps = (): TimelineStep[] => {
    // Special case for OXXO payment
    if (currentStatus === 'AWAITING_OXXO_PAYMENT') {
      return [
        {
          id: 'created',
          label: 'Solicitud Creada',
          description: formatDate(applicationDates.created_at),
          status: 'completed',
          icon: <FaCheck />
        },
        {
          id: 'awaiting-oxxo',
          label: 'Pago OXXO Pendiente',
          description: 'Esperando confirmación de pago en OXXO. Por favor, realice el pago con la referencia proporcionada.',
          status: 'current',
          icon: <FaCircle size={12} />
        }
      ];
    }

    // Special case for expired permits
    if (currentStatus === 'EXPIRED') {
      return [
        {
          id: 'permit-issued',
          label: 'Permiso Emitido',
          description: formatDate(applicationDates.fecha_expedicion),
          status: 'completed',
          icon: <FaCheck />
        },
        {
          id: 'permit-expired',
          label: 'Permiso Expirado',
          description: 'Este permiso ha expirado. Si necesita continuar utilizando el vehículo, deberá solicitar un nuevo permiso.',
          status: 'expired',
          icon: <FaExclamationTriangle />
        }
      ];
    }

    // Define all possible status steps in order for the new payment flow
    const allSteps: { status: ApplicationStatus; label: string; description: string; date?: string }[] = [
      {
        status: 'SUBMITTED',
        label: 'Solicitud Creada',
        description: 'Solicitud creada',
        date: applicationDates.created_at
      },
      {
        status: 'PAYMENT_RECEIVED',
        label: 'Pago Recibido',
        description: 'Pago procesado y confirmado',
        date: applicationDates.payment_verified_at
      },
      {
        status: 'GENERATING_PERMIT',
        label: 'Generando Permiso',
        description: 'Procesando y generando el permiso',
        date: undefined
      },
      {
        status: 'PERMIT_READY',
        label: 'Permiso Listo',
        description: 'Permiso generado y listo para descargar',
        date: applicationDates.fecha_expedicion
      },
      {
        status: 'COMPLETED',
        label: 'Completado',
        description: 'Proceso completado',
        date: undefined
      }
    ];

    // Find the index of the current status
    const currentStatusIndex = allSteps.findIndex(step => step.status === currentStatus);

    // If status not found in our defined steps, show a simplified timeline
    if (currentStatusIndex === -1) {
      return [
        {
          id: 'created',
          label: 'Solicitud Creada',
          description: formatDate(applicationDates.created_at),
          status: 'completed',
          icon: <FaCheck />
        },
        {
          id: 'current-status',
          label: getStatusText(currentStatus),
          description: 'Estado actual de la solicitud',
          status: 'current',
          icon: <FaCircle size={12} />
        }
      ];
    }

    // Create timeline steps up to the current status
    const timelineSteps: TimelineStep[] = [];

    // Add all steps up to and including the current one
    for (let i = 0; i <= currentStatusIndex; i++) {
      const step = allSteps[i];
      timelineSteps.push({
        id: `step-${i}`,
        label: step.label,
        description: step.date ? formatDate(step.date) : step.description,
        status: i < currentStatusIndex ? 'completed' : 'current',
        icon: i < currentStatusIndex ? <FaCheck /> : <FaCircle size={12} />
      });
    }

    // Add the next step as pending if not at the end
    if (currentStatusIndex < allSteps.length - 1) {
      const nextStep = allSteps[currentStatusIndex + 1];
      timelineSteps.push({
        id: `step-${currentStatusIndex + 1}`,
        label: nextStep.label,
        description: nextStep.description,
        status: 'pending',
        icon: null
      });
    }

    return timelineSteps;
  };

  // Get the timeline steps
  const steps = getTimelineSteps();

  return (
    <div className={styles.timelineContainer}>
      <div className={styles.timeline}>
        {steps.map((step, index) => (
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

// Helper function to get status text
const getStatusText = (status: ApplicationStatus): string => {
  switch (status) {
    // New payment flow statuses
    case 'AWAITING_OXXO_PAYMENT':
      return 'Pago OXXO Pendiente';
    case 'PAYMENT_RECEIVED':
      return 'Pago Recibido';

    // Permit generation statuses
    case 'GENERATING_PERMIT':
      return 'Generando Permiso';
    case 'ERROR_GENERATING_PERMIT':
      return 'Error al Generar';
    case 'PERMIT_READY':
      return 'Permiso Listo';

    // Completion statuses
    case 'COMPLETED':
      return 'Completado';
    case 'CANCELLED':
      return 'Cancelado';
    case 'EXPIRED':
      return 'Expirado';

    // Legacy statuses - kept for backward compatibility
    case 'PENDING_PAYMENT':
      return 'Pago Pendiente';
    case 'PROOF_RECEIVED_SCHEDULED':
      return 'Comprobante Recibido';
    case 'PROOF_SUBMITTED':
      return 'Comprobante Enviado';
    case 'PROOF_REJECTED':
      return 'Comprobante Rechazado';

    default:
      return status;
  }
};

export default StatusTimeline;
