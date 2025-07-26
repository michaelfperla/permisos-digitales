import React from 'react';
import { FaTimes, FaStore, FaDownload, FaPrint } from 'react-icons/fa';
import Modal from '../ui/Modal';
import Button from '../ui/Button/Button';
import Icon from '../../shared/components/ui/Icon';
import styles from './OxxoPaymentSlipModal.module.css';

interface OxxoVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  oxxoReference?: string;
  hostedVoucherUrl?: string;
  amount?: number | string;
  expiresAt?: string;
}

const OxxoVoucherModal: React.FC<OxxoVoucherModalProps> = ({
  isOpen,
  onClose,
  oxxoReference,
  hostedVoucherUrl,
  amount,
  expiresAt,
}) => {
  const formatCurrency = (value?: number | string) => {
    if (!value && value !== 0) return 'N/A';
    const numericAmount = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN' 
    }).format(numericAmount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No especificada';
    try {
      return new Date(dateString).toLocaleString('es-MX', {
        dateStyle: 'long',
        timeStyle: 'short',
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const handlePrint = () => {
    if (hostedVoucherUrl) {
      window.open(hostedVoucherUrl, '_blank');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ficha de Pago OXXO">
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <FaStore className={styles.oxxoIcon} />
          <h2 className={styles.title}>Ficha de Pago OXXO</h2>
        </div>

        <div className={styles.instructions}>
          <p>Presenta esta información en cualquier tienda OXXO para realizar tu pago:</p>
        </div>

        <div className={styles.paymentDetails}>
          <div className={styles.detailItem}>
            <span className={styles.label}>Referencia de Pago:</span>
            <span className={styles.referenceNumber}>
              {oxxoReference || 'No disponible'}
            </span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Monto a Pagar:</span>
            <span className={styles.amount}>
              {formatCurrency(amount || 500)}
            </span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Vence:</span>
            <span className={styles.value}>
              {formatDate(expiresAt)}
            </span>
          </div>
        </div>

        {hostedVoucherUrl && (
          <div className={styles.voucherSection}>
            <p className={styles.voucherLabel}>
              Código de barras para escanear en OXXO:
            </p>
            <div className={styles.voucherContainer}>
              <iframe
                src={hostedVoucherUrl}
                className={styles.voucherFrame}
                title="Ficha de Pago OXXO"
              />
            </div>
          </div>
        )}

        <div className={styles.actions}>
          {hostedVoucherUrl && (
            <Button
              variant="primary"
              className={styles.printButton}
              onClick={handlePrint}
              icon={<Icon IconComponent={FaPrint} />}
            >
              Abrir Ficha Completa
            </Button>
          )}
          <Button
            variant="secondary"
            className={styles.closeButton}
            onClick={onClose}
            icon={<Icon IconComponent={FaTimes} />}
          >
            Cerrar
          </Button>
        </div>

        <div className={styles.warning}>
          <p>
            <strong>Importante:</strong> Realiza tu pago antes de la fecha de vencimiento. 
            Una vez procesado, tu permiso se generará automáticamente.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default OxxoVoucherModal;