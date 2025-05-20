import React, { useState } from 'react';
import { FaBarcode, FaMoneyBill, FaCalendarAlt, FaCopy, FaPrint, FaExclamationTriangle } from 'react-icons/fa';
import Modal from '../ui/Modal';
import Button from '../ui/Button/Button';
import { useToast } from '../../contexts/ToastContext';
import styles from './OxxoPaymentSlipModal.module.css';

interface OxxoPaymentSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  oxxoReference: string;
  amount: string | number;
  currency: string;
  expiresAt?: string;
  permitFolio?: string;
  barcodeUrl?: string;
}

const OxxoPaymentSlipModal: React.FC<OxxoPaymentSlipModalProps> = ({
  isOpen,
  onClose,
  oxxoReference,
  amount,
  currency,
  expiresAt,
  permitFolio,
  barcodeUrl
}) => {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  // Format currency for display
  const formatCurrency = (value: string | number): string => {
    const numericAmount = typeof value === 'string' ? parseFloat(value) : value;

    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN'
    }).format(numericAmount);
  };

  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'No especificado';

    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Handle copying reference to clipboard
  const handleCopyReference = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Referencia copiada al portapapeles', 'success');

    // Reset copied state after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle printing instructions
  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Instrucciones para Pago en OXXO">
      <div className={styles.oxxoSlipContainer}>
        {permitFolio && (
          <h4 className={styles.permitFolio}>Pago para Permiso Nº: {permitFolio}</h4>
        )}

        {/* Reference Number Block */}
        <div className={styles.oxxoDetailBlock}>
          <div className={styles.oxxoDetailHeader}>
            <FaBarcode className={styles.oxxoDetailIcon} />
            <span className={styles.oxxoDetailLabel}>Referencia OXXO:</span>
          </div>
          <div className={styles.oxxoReferenceWrapper}>
            <span className={styles.oxxoReferenceValue}>{oxxoReference}</span>
            <Button
              variant="text"
              size="small"
              onClick={() => handleCopyReference(oxxoReference)}
              aria-label="Copiar referencia"
              className={styles.copyButtonSmall}
              icon={<FaCopy />}
              iconAfter={true}
            >
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>

        {/* Amount Block */}
        <div className={styles.oxxoDetailBlock}>
          <div className={styles.oxxoDetailHeader}>
            <FaMoneyBill className={styles.oxxoDetailIcon} />
            <span className={styles.oxxoDetailLabel}>Monto a Pagar:</span>
          </div>
          <span className={styles.oxxoAmountValue}>{formatCurrency(amount)}</span>
        </div>

        {/* Expiry Date Block (Conditional) */}
        {expiresAt && (
          <div className={styles.oxxoDetailBlock}>
            <div className={styles.oxxoDetailHeader}>
              <FaCalendarAlt className={styles.oxxoDetailIcon} />
              <span className={styles.oxxoDetailLabel}>Pagar antes del:</span>
            </div>
            <span className={styles.oxxoDateValue}>{formatDate(expiresAt)}</span>
          </div>
        )}

        {/* Instructions Block */}
        <div className={styles.oxxoInstructions}>
          <div className={styles.oxxoInstructionsHeader}>
            <FaExclamationTriangle className={styles.oxxoInstructionsIcon} />
            <h4>Instrucciones de Pago</h4>
          </div>
          <ol className={styles.instructionsList}>
            <li>Acude a cualquier tienda OXXO.</li>
            <li>Indica al cajero que deseas realizar un pago de servicio/OXXO Pay.</li>
            <li>Proporciona la Referencia OXXO mostrada arriba.</li>
            <li>Realiza el pago por el monto exacto.</li>
            <li>Conserva tu comprobante de pago.</li>
          </ol>
        </div>

        {/* Barcode Image (if available) */}
        {barcodeUrl && (
          <div className={styles.oxxoBarcodeBlock}>
            <div className={styles.oxxoDetailHeader}>
              <FaBarcode className={styles.oxxoDetailIcon} />
              <span className={styles.oxxoDetailLabel}>Código de Barras:</span>
            </div>
            <div className={styles.oxxoBarcodeWrapper}>
              <img
                src={barcodeUrl}
                alt="Código de barras para pago en OXXO"
                className={styles.oxxoBarcodeImage}
              />
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className={styles.modalActions}>
          <Button
            variant="secondary"
            onClick={handlePrint}
            icon={<FaPrint />}
            className={styles.printButton}
          >
            Imprimir Instrucciones
          </Button>
          <Button
            variant="danger"
            onClick={onClose}
            className={styles.closeButtonModal}
          >
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default OxxoPaymentSlipModal;
