// frontend/src/pages/OxxoConfirmationPage.tsx
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaStore, FaCopy, FaExclamationTriangle, FaBarcode, FaArrowLeft, FaClock, FaCheckCircle } from 'react-icons/fa';
import permitStyles from './PermitDetailsPage.module.css';
import styles from './OxxoConfirmationPage.module.css';
import ResponsiveContainer from '../components/ui/ResponsiveContainer/ResponsiveContainer';
import { useToast } from '../shared/hooks/useToast';
import Card from '../components/ui/Card/Card';
import Button from '../components/ui/Button/Button';

const OxxoConfirmationPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const { oxxoDetails, applicationId } = location.state || {};

  if (!oxxoDetails || !applicationId) {
    return (
      <ResponsiveContainer type="fixed" maxWidth="lg" withPadding className={permitStyles.pageWrapper}>
        <Card className={permitStyles.errorContainer}>
          <h2 className={permitStyles.sectionTitle}>Error de Información</h2>
          <p className={permitStyles.statusInstructionsText}>
            No se encontraron los detalles del pago OXXO. Por favor, vuelve a tu lista de permisos para encontrar la referencia.
          </p>
          <Button 
            to="/dashboard" 
            variant="secondary" 
            icon={<FaArrowLeft />}
          >
            Ir a Mi Panel
          </Button>
        </Card>
      </ResponsiveContainer>
    );
  }

  const { oxxoReference, amount, expiresAt, hostedVoucherUrl } = oxxoDetails;

  const handleCopyReference = () => {
    if (oxxoReference) {
      navigator.clipboard.writeText(oxxoReference);
      setCopied(true);
      showToast('Referencia OXXO copiada al portapapeles', 'success');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const formatCurrency = (amountValue: number | string) => {
    const numericAmount = typeof amountValue === 'string' ? parseFloat(amountValue) : amountValue;
    if (isNaN(numericAmount) || numericAmount === null) {
      return '$0.00';
    }
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(numericAmount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('es-MX', { 
        dateStyle: 'long', 
        timeStyle: 'short' 
      });
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  return (
    <ResponsiveContainer type="fixed" maxWidth="lg" withPadding className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Pago en OXXO</h1>
        <Button 
          to="/dashboard" 
          variant="ghost" 
          icon={<FaArrowLeft />}
        >
          Volver al Panel
        </Button>
      </div>

      {/* Main instruction card */}
      <Card className={styles.statusInstructionsPanel}>
        <div className={styles.statusInstructionsTitle}>
          <FaStore className={styles.statusInstructionsIcon} />
          ¡Tu solicitud está lista para pagar!
        </div>
        
        <div className={styles.statusInstructionsContent}>
          <p className={styles.introText}>
            Presenta la siguiente información en cualquier tienda OXXO para completar la solicitud de tu permiso.
          </p>
          
          {/* Payment reference card */}
          <div className={styles.oxxoReferenceContainer}>
            <div className={styles.oxxoPaymentDetails}>
              <div className={styles.oxxoPaymentItem}>
                <span className={styles.oxxoPaymentLabel}>Referencia de Pago OXXO:</span>
                <div className={`${styles.infoValue} ${styles.referenceValueContainer}`}>
                  <span className={`${styles.oxxoPaymentValue} ${styles.referenceNumber}`}>
                    {oxxoReference}
                  </span>
                  <Button 
                    variant="secondary"
                    size="small"
                    onClick={handleCopyReference}
                    title={copied ? 'Copiado!' : 'Copiar referencia'}
                    icon={<FaCopy />}
                  >
                    {copied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </div>
              
              <div className={styles.oxxoPaymentItem}>
                <span className={styles.oxxoPaymentLabel}>Monto a Pagar:</span>
                <span className={`${styles.oxxoPaymentValue} ${styles.amountValue}`}>
                  {formatCurrency(amount)}
                </span>
              </div>
              
              <div className={styles.oxxoPaymentItem}>
                <span className={styles.oxxoPaymentLabel}>Vencimiento:</span>
                <div className={styles.expirationContainer}>
                  <FaClock className={styles.expirationIcon} />
                  <span className={styles.oxxoPaymentValue}>
                    {formatDate(expiresAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Processing time notification */}
          <div className={`${styles.paymentStatusCard} ${styles.processingTimeCard}`}>
            <div className={styles.paymentStatusMessage}>
              <FaClock className={styles.processingIcon} />
              <div>
                <p className={styles.processingTitle}>Tiempo de procesamiento</p>
                <p className={styles.processingText}>
                  Una vez que realices tu pago en OXXO, el procesamiento toma entre <strong>1 a 4 horas</strong> en reflejarse 
                  en nuestro sistema. Una vez confirmado el pago, tu permiso se generará automáticamente.
                </p>
              </div>
            </div>
          </div>

          {/* Voucher section */}
          {hostedVoucherUrl && (
            <Card className={styles.voucherCard}>
              <h3 className={`${permitStyles.oxxoInstructionsHeader} ${styles.voucherHeader}`}>
                <FaBarcode className={styles.voucherIcon} />
                Ficha de Pago con Código de Barras
              </h3>
              <p className={styles.voucherDescription}>
                También puedes presentar este código de barras en la tienda OXXO:
              </p>
              <div className={styles.voucherContainer}>
                <iframe 
                  src={hostedVoucherUrl} 
                  className={styles.voucherIframe}
                  title="Ficha de Pago OXXO"
                />
              </div>
            </Card>
          )}

          {/* Important warning */}
          <div className={`${styles.paymentStatusCard} ${styles.warningCard}`}>
            <div className={styles.paymentStatusMessage}>
              <FaExclamationTriangle className={styles.warningIcon} />
              <div>
                <p className={styles.warningTitle}>Importante:</p>
                <p className={styles.warningText}>
                  Realiza tu pago antes de la fecha de vencimiento. Recibirás un correo electrónico 
                  cuando tu permiso esté listo para descargar.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className={styles.actionButtons}>
            <Button 
              to="/dashboard" 
              variant="secondary" 
              icon={<FaArrowLeft />}
            >
              Volver al Panel
            </Button>
            <Button 
              to={`/permits/${applicationId}`} 
              variant="primary" 
              icon={<FaCheckCircle />}
            >
              Ver Estado del Permiso
            </Button>
          </div>
        </div>
      </Card>
    </ResponsiveContainer>
  );
};

export default OxxoConfirmationPage;