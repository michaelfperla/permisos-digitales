import React, { useState } from 'react';
import {
  FaCheckCircle,
  FaHome,
  FaStore,
  FaMoneyBill,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaBarcode,
  FaCopy,
  FaCheck,
  FaEye,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import styles from './CompleteForm.module.css';
import Button from "../ui/Button/Button";

interface OxxoConfirmationStepProps {
  applicationId: string;
  formData: {
    nombre_completo: string;
    marca: string;
    linea: string;
    ano_modelo: string | number;
  };
  oxxoDetails: {
    reference: string;
    amount: number;
    currency: string;
    expiresAt: string;
    barcodeUrl?: string;
  };
}

const OxxoConfirmationStep: React.FC<OxxoConfirmationStepProps> = ({
  applicationId,
  formData,
  oxxoDetails,
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
    }).format(amount);
  };

  // Copy text to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  // Handle navigation to dashboard
  const goToDashboard = () => {
    navigate('/dashboard');
  };

  // Handle navigation to permit details
  const goToPermitDetails = () => {
    navigate(`/permits/${applicationId}`);
  };

  return (
    <div className={styles.confirmationSection}>
      <div className={styles.confirmationHeader}>
        <FaCheckCircle className={styles.confirmationIcon} />
        <h2 className={styles.confirmationTitle}>¡Solicitud Enviada Exitosamente!</h2>
      </div>

      <p className={styles.confirmationText}>
        Su solicitud de permiso digital ha sido recibida correctamente. Para completar el proceso,
        realice el pago en cualquier tienda OXXO utilizando la referencia proporcionada.
      </p>

      <div className={styles.confirmationDetails}>
        <div className={styles.confirmationDetailItem}>
          <span className={styles.confirmationDetailLabel}>Número de Solicitud:</span>
          <span className={styles.confirmationDetailValue}>{applicationId}</span>
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
          <span className={styles.confirmationDetailValue}>Esperando Pago en OXXO</span>
        </div>
      </div>

      <div className={styles.oxxoPaymentBox}>
        <h3 className={styles.oxxoPaymentTitle}>
          <FaStore className={styles.oxxoPaymentIcon} /> Instrucciones de Pago en OXXO
        </h3>

        <div className={styles.oxxoPaymentDetails}>
          <div className={styles.oxxoPaymentItem}>
            <FaBarcode className={styles.oxxoPaymentItemIcon} />
            <span className={styles.oxxoPaymentItemLabel}>Referencia:</span>
            <div className={styles.oxxoReferenceContainer}>
              <span className={styles.oxxoReferenceValue}>{oxxoDetails.reference}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => copyToClipboard(oxxoDetails.reference, 'reference')}
                title="Copiar referencia"
                className={styles.copyButton}
                icon={
                  copied === 'reference' ? (
                    <FaCheck className={styles.copyIcon} />
                  ) : (
                    <FaCopy className={styles.copyIcon} />
                  )
                }
              >
                {copied === 'reference' ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>

          <div className={styles.oxxoPaymentItem}>
            <FaMoneyBill className={styles.oxxoPaymentItemIcon} />
            <span className={styles.oxxoPaymentItemLabel}>Monto:</span>
            <span className={styles.oxxoPaymentItemValue}>
              {formatCurrency(oxxoDetails.amount, oxxoDetails.currency)}
            </span>
          </div>

          <div className={styles.oxxoPaymentItem}>
            <FaCalendarAlt className={styles.oxxoPaymentItemIcon} />
            <span className={styles.oxxoPaymentItemLabel}>Fecha de Vencimiento:</span>
            <span className={styles.oxxoPaymentItemValue}>{formatDate(oxxoDetails.expiresAt)}</span>
          </div>
        </div>

        {oxxoDetails.barcodeUrl && (
          <div className={styles.oxxoBarcode}>
            <img src={oxxoDetails.barcodeUrl} alt="Código de barras para pago en OXXO" />
          </div>
        )}

        <div className={styles.oxxoInstructions}>
          <FaExclamationTriangle className={styles.oxxoInstructionsIcon} />
          <p className={styles.oxxoInstructionsText}>
            Por favor, realice su pago en cualquier tienda OXXO antes de la fecha de vencimiento.
            Una vez procesado el pago, su permiso será generado automáticamente.
          </p>
        </div>
      </div>

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
          onClick={goToPermitDetails}
          icon={<FaEye />}
          className={styles.navigationButton}
        >
          Ver Detalles del Permiso
        </Button>
      </div>
    </div>
  );
};

export default OxxoConfirmationStep;
