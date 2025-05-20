import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaCheckCircle,
  FaFileAlt,
  FaHome,
  FaDownload
} from 'react-icons/fa';
import styles from './CompleteForm.module.css';
import Button from '../../components/ui/Button/Button';

interface ConfirmationStepProps {
  applicationId: string;
  formData: {
    nombre_completo: string;
    marca: string;
    linea: string;
    ano_modelo: string | number;
  };
}

const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  applicationId,
  formData
}) => {
  const navigate = useNavigate();

  // Format date for display
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Handle navigation to dashboard
  const goToDashboard = () => {
    navigate('/dashboard');
  };

  // Handle navigation to payment page
  const goToPayment = () => {
    navigate(`/permits/${applicationId}/payment`);
  };

  return (
    <div className={styles.confirmationSection}>
      <div className={styles.confirmationHeader}>
        <FaCheckCircle className={styles.confirmationIcon} />
        <h2 className={styles.confirmationTitle}>¡Solicitud Enviada Exitosamente!</h2>
      </div>

      <p className={styles.confirmationText}>
        Su solicitud de permiso digital ha sido recibida correctamente.
        A continuación, encontrará los detalles de su solicitud y los pasos a seguir.
      </p>

      <div className={styles.confirmationDetails}>
        <div className={styles.confirmationDetailItem}>
          <span className={styles.confirmationDetailLabel}>Número de Solicitud:</span>
          <span className={styles.confirmationDetailValue}>{applicationId}</span>
        </div>

        <div className={styles.confirmationDetailItem}>
          <span className={styles.confirmationDetailLabel}>Fecha de Solicitud:</span>
          <span className={styles.confirmationDetailValue}>{formatDate(new Date())}</span>
        </div>

        <div className={styles.confirmationDetailItem}>
          <span className={styles.confirmationDetailLabel}>Solicitante:</span>
          <span className={styles.confirmationDetailValue}>{formData.nombre_completo}</span>
        </div>

        <div className={styles.confirmationDetailItem}>
          <span className={styles.confirmationDetailLabel}>Vehículo:</span>
          <span className={styles.confirmationDetailValue}>
            {formData.marca} {formData.linea} {formData.ano_modelo}
          </span>
        </div>

        <div className={styles.confirmationDetailItem}>
          <span className={styles.confirmationDetailLabel}>Estado:</span>
          <span className={styles.confirmationDetailValue}>Pendiente de Pago</span>
        </div>
      </div>

      <p className={styles.confirmationText}>
        <strong>Próximos pasos:</strong> Para completar el proceso, es necesario realizar el pago correspondiente.
        Puede hacerlo ahora o más tarde desde su panel de control.
      </p>

      <div className={styles.confirmationActions}>
        <Button
          variant="secondary"
          onClick={goToDashboard}
          icon={<FaHome />}
          className={styles.navigationButton}
        >
          Ir al Panel
        </Button>

        <Button
          variant="primary"
          onClick={goToPayment}
          icon={<FaFileAlt />}
          className={styles.navigationButton}
        >
          Realizar Pago
        </Button>
      </div>
    </div>
  );
};

export default ConfirmationStep;
