import React from 'react';
import {
  FaUser,
  FaCar,
  FaClipboardCheck,
  FaEdit,
  FaInfoCircle,
  FaArrowLeft,
  FaPaperPlane
} from 'react-icons/fa';
import styles from './CompleteForm.module.css';
import Button from '../../components/ui/Button/Button';

interface ReviewStepProps {
  formData: {
    nombre_completo: string;
    curp_rfc: string;
    domicilio: string;
    marca: string;
    linea: string;
    color: string;
    numero_serie: string;
    numero_motor: string;
    ano_modelo: string | number;
  };
  onPrevious: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  goToStep: (step: string) => void;
}

const CompleteReviewStep: React.FC<ReviewStepProps> = ({
  formData,
  onPrevious,
  onSubmit,
  isSubmitting,
  goToStep
}) => {
  return (
    <div className={styles.formSection}>
      <div className={styles.formSectionHeader}>
        <FaClipboardCheck className={styles.formSectionIcon} />
        <h2 className={styles.formSectionTitle}>Revisar y Confirmar</h2>
      </div>

      <div className={styles.formSectionContent}>
        <div className={styles.reviewSection}>
          <h3 className={styles.reviewSectionTitle}>
            <FaUser className={styles.reviewSectionIcon} />
            Información Personal
          </h3>

          <div className={styles.reviewGrid}>
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Nombre completo</span>
              <span className={styles.reviewValue}>{formData.nombre_completo}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => goToStep('personal')}
                className={styles.reviewEdit}
                icon={<FaEdit className={styles.reviewEditIcon} />}
              >
                Editar
              </Button>
            </div>

            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>CURP o RFC</span>
              <span className={styles.reviewValue}>{formData.curp_rfc}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => goToStep('personal')}
                className={styles.reviewEdit}
                icon={<FaEdit className={styles.reviewEditIcon} />}
              >
                Editar
              </Button>
            </div>

            <div className={`${styles.reviewItem} ${styles.fullWidth}`}>
              <span className={styles.reviewLabel}>Dirección</span>
              <span className={styles.reviewValue}>{formData.domicilio}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => goToStep('personal')}
                className={styles.reviewEdit}
                icon={<FaEdit className={styles.reviewEditIcon} />}
              >
                Editar
              </Button>
            </div>
          </div>
        </div>

        <div className={styles.reviewSection}>
          <h3 className={styles.reviewSectionTitle}>
            <FaCar className={styles.reviewSectionIcon} />
            Información del Vehículo
          </h3>

          <div className={styles.reviewGrid}>
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Marca</span>
              <span className={styles.reviewValue}>{formData.marca}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => goToStep('vehicle')}
                className={styles.reviewEdit}
                icon={<FaEdit className={styles.reviewEditIcon} />}
              >
                Editar
              </Button>
            </div>

            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Modelo</span>
              <span className={styles.reviewValue}>{formData.linea}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => goToStep('vehicle')}
                className={styles.reviewEdit}
                icon={<FaEdit className={styles.reviewEditIcon} />}
              >
                Editar
              </Button>
            </div>

            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Color</span>
              <span className={styles.reviewValue}>{formData.color}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => goToStep('vehicle')}
                className={styles.reviewEdit}
                icon={<FaEdit className={styles.reviewEditIcon} />}
              >
                Editar
              </Button>
            </div>

            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Año</span>
              <span className={styles.reviewValue}>{formData.ano_modelo}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => goToStep('vehicle')}
                className={styles.reviewEdit}
                icon={<FaEdit className={styles.reviewEditIcon} />}
              >
                Editar
              </Button>
            </div>

            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Número de serie (VIN)</span>
              <span className={styles.reviewValue}>{formData.numero_serie}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => goToStep('vehicle')}
                className={styles.reviewEdit}
                icon={<FaEdit className={styles.reviewEditIcon} />}
              >
                Editar
              </Button>
            </div>

            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Número de motor</span>
              <span className={styles.reviewValue}>{formData.numero_motor}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => goToStep('vehicle')}
                className={styles.reviewEdit}
                icon={<FaEdit className={styles.reviewEditIcon} />}
              >
                Editar
              </Button>
            </div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <FaInfoCircle className={styles.infoIcon} />
          <p className={styles.infoText}>
            Por favor revise cuidadosamente toda la información antes de enviar su solicitud.
            Una vez enviada, no podrá modificar estos datos y deberá iniciar una nueva solicitud si necesita hacer cambios.
          </p>
        </div>

        <div className={styles.formNavigation}>
          <Button
            variant="secondary"
            onClick={onPrevious}
            icon={<FaArrowLeft />}
            className={styles.navigationButton}
          >
            Anterior
          </Button>

          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={isSubmitting}
            className={styles.navigationButton}
            icon={!isSubmitting ? <FaPaperPlane /> : undefined}
          >
            {isSubmitting ? (
              <>
                <div className={styles.loadingSpinner}></div>
                Enviando...
              </>
            ) : (
              'Enviar Solicitud'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CompleteReviewStep;
