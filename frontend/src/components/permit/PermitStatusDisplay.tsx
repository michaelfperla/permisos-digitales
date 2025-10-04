import React from 'react';
import { FaInfoCircle, FaStore, FaExclamationTriangle, FaTimesCircle, FaSpinner } from 'react-icons/fa';
import styles from '../../pages/PermitDetailsPage.module.css';
import QueueStatusDisplay from './QueueStatusDisplay';
import { ApplicationStatusDisplay } from '../../constants/application.constants';
import { 
  formatDateMexicoWithTZ, 
  calculatePermitExpirationDate, 
  getExpirationStatusMessage 
} from '../../utils/permitBusinessDays';

interface PermitStatusDisplayProps {
  status?: string;
  applicationData: any; // Using 'any' for simplicity, can be typed more strictly
}

const PermitStatusDisplay: React.FC<PermitStatusDisplayProps> = ({ status, applicationData }) => {

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  };

  const renderContent = () => {
    switch (status) {
      case 'AWAITING_OXXO_PAYMENT':
        return {
          title: 'Pago Pendiente en OXXO',
          icon: <FaStore className={styles.statusInstructionsIcon} />,
          content: (
            <>
              <p>Para completar tu solicitud, realiza el pago en cualquier tienda OXXO usando la referencia proporcionada. Una vez procesado el pago, tu permiso será generado automáticamente.</p>
              <div className={styles.oxxoReferenceContainer}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Referencia OXXO:</span>
                  <span className={styles.infoValueImportant}>{applicationData?.oxxoReference || 'No disponible'}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Monto a Pagar:</span>
                  <span className={styles.infoValueImportant}>{formatCurrency(applicationData?.application?.importe || 500)}</span>
                </div>
              </div>
              <div className={styles.oxxoVoucherNote}>
                <p>
                  Usa el botón "Ver Ficha de Pago OXXO" arriba para ver o imprimir tu ficha completa con código de barras.
                </p>
              </div>
            </>
          ),
        };
      case 'PAYMENT_PROCESSING':
        return {
          title: 'Procesando tu Pago',
          icon: <FaSpinner className={`${styles.statusInstructionsIcon} ${styles.spinning}`} />,
          content: (
            <>
              <p>Tu pago está siendo procesado por el banco. Este proceso puede tomar unos minutos.</p>
              <p>La página se actualizará automáticamente cuando el pago sea confirmado.</p>
              <div className={styles.paymentProcessingNote}>
                <FaInfoCircle />
                <span>No cierres esta ventana ni actualices la página durante el procesamiento.</span>
              </div>
            </>
          ),
        };
      case 'PAYMENT_FAILED':
        return {
          title: 'Pago Rechazado',
          icon: <FaTimesCircle className={`${styles.statusInstructionsIcon} ${styles.statusInstructionsIconDanger}`} />,
          content: <p>Lamentablemente, tu pago fue rechazado. Por favor, intenta de nuevo o contacta a soporte.</p>,
        };
      case 'GENERATING_PERMIT':
        return {
          title: 'Generando tu Permiso',
          icon: <FaInfoCircle className={styles.statusInstructionsIcon} />,
          content: applicationData?.application?.id ? (
            <QueueStatusDisplay 
              applicationId={applicationData.application.id}
              onComplete={() => {
                // Refresh the page when generation completes
                window.location.reload();
              }}
            />
          ) : (
            <p>Tu permiso está siendo generado. Este proceso puede tomar algunos minutos.</p>
          ),
        };
      case 'PERMIT_READY':
      case 'COMPLETED':
        return {
          title: '¡Tu Permiso está Listo!',
          icon: <FaInfoCircle className={`${styles.statusInstructionsIcon} ${styles.statusInstructionsIconSuccess}`} />,
          content: (() => {
            // Show expiration information with business rules
            const permitReadyDate = applicationData?.fecha_expedicion || applicationData?.updated_at;
            
            if (permitReadyDate && status === 'PERMIT_READY') {
              const calculatedExpiration = calculatePermitExpirationDate(permitReadyDate);
              const statusInfo = getExpirationStatusMessage(permitReadyDate, status);
              
              return (
                <div>
                  <p>Tu permiso ha sido generado correctamente y está listo para descargar. Utiliza el botón de descarga para obtener tu documento.</p>
                  <div style={{ marginTop: '12px', padding: '8px', backgroundColor: 'var(--color-background-secondary)', borderRadius: '4px' }}>
                    <p style={{ margin: 0, fontSize: '0.9em' }}>
                      <strong>Fecha de vencimiento:</strong> {formatDateMexicoWithTZ(calculatedExpiration)}
                    </p>
                    {statusInfo.urgency !== 'normal' && (
                      <p style={{ 
                        margin: '4px 0 0 0', 
                        fontSize: '0.9em',
                        color: statusInfo.urgency === 'critical' ? 'var(--color-warning)' : 'var(--color-info)'
                      }}>
                        <strong>{statusInfo.message}</strong>
                      </p>
                    )}
                  </div>
                </div>
              );
            }
            
            return <p>Tu permiso ha sido generado correctamente y está listo para descargar. Utiliza el botón de descarga para obtener tu documento.</p>;
          })(),
        };
      case 'EXPIRED':
        return {
          title: 'Permiso Expirado',
          icon: <FaExclamationTriangle className={`${styles.statusInstructionsIcon} ${styles.statusInstructionsIconWarning}`} />,
          content: <p>Este permiso ha expirado. Para circular, necesitas solicitar una renovación o un nuevo permiso.</p>,
        };
      case 'VENCIDO':
        return {
          title: 'Permiso Vencido',
          icon: <FaExclamationTriangle className={`${styles.statusInstructionsIcon} ${styles.statusInstructionsIconWarning}`} />,
          content: <p>Este permiso ha vencido después de 30 días. Para circular, necesitas solicitar una renovación o un nuevo permiso.</p>,
        };
      default:
        // Try to get the Spanish label from the constants, fallback to a generic message
        const statusConfig = status && ApplicationStatusDisplay[status as keyof typeof ApplicationStatusDisplay];
        const statusLabel = statusConfig ? statusConfig.label : 'En proceso';
        
        return {
          title: 'Estado de tu Permiso',
          icon: <FaInfoCircle className={styles.statusInstructionsIcon} />,
          content: <p>Tu solicitud está siendo procesada. El estado actual es: <strong>{statusLabel}</strong>. Te notificaremos sobre cualquier cambio.</p>,
        };
    }
  };

  const { title, icon, content } = renderContent();

  return (
    <div className={styles.statusInstructionsPanel}>
      <div className={styles.statusInstructionsTitle}>
        {icon}
        {title}
      </div>
      <div className={styles.statusInstructionsContent}>{content}</div>
    </div>
  );
};

export default PermitStatusDisplay;