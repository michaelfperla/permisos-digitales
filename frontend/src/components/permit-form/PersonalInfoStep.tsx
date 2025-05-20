import React, { useState, useEffect } from 'react';
import { FaUser, FaIdCard, FaMapMarkerAlt, FaCheck, FaTimes, FaInfoCircle, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import styles from './CompleteForm.module.css';
import Button from '../../components/ui/Button/Button';

interface PersonalInfoStepProps {
  formData: {
    nombre_completo: string;
    curp_rfc: string;
    domicilio: string;
  };
  errors: Record<string, string>;
  updateFormData: (data: Partial<typeof formData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const PersonalInfoStep: React.FC<PersonalInfoStepProps> = ({
  formData,
  errors,
  updateFormData,
  onNext,
  onPrevious
}) => {
  // Local state for validation
  const [touched, setTouched] = useState({
    nombre_completo: false,
    curp_rfc: false,
    domicilio: false
  });

  // Local state for field validity
  const [fieldValidity, setFieldValidity] = useState({
    nombre_completo: false,
    curp_rfc: false,
    domicilio: false
  });

  // Validate fields on mount and when formData changes
  useEffect(() => {
    validateFields();
  }, [formData]);

  // Validate all fields
  const validateFields = () => {
    const validity = {
      nombre_completo: formData.nombre_completo.trim().length >= 3,
      curp_rfc: validateCurpRfc(formData.curp_rfc),
      domicilio: formData.domicilio.trim().length >= 10
    };

    setFieldValidity(validity);
  };

  // Validate CURP or RFC
  const validateCurpRfc = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length === 18 || trimmed.length === 12 || trimmed.length === 13;
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Update form data
    updateFormData({ [name]: value });

    // Mark field as touched
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
  };

  // Handle input blur
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;

    // Mark field as touched
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
  };

  // Check if all fields are valid
  const isFormValid = () => {
    return fieldValidity.nombre_completo && fieldValidity.curp_rfc && fieldValidity.domicilio;
  };

  return (
    <div className={styles.formSection}>
      <div className={styles.formSectionHeader}>
        <FaUser className={styles.formSectionIcon} />
        <h2 className={styles.formSectionTitle}>Información Personal</h2>
      </div>

      <div className={styles.formSectionContent}>
        <div className={styles.formFields}>
          <div className={styles.formGroup}>
            <label htmlFor="nombre_completo" className={styles.formLabel}>
              Nombre completo
            </label>
            <div className={styles.inputWithIcon}>
              <FaUser className={styles.inputIcon} />
              <input
                type="text"
                id="nombre_completo"
                name="nombre_completo"
                className={`${styles.formInput} ${touched.nombre_completo && (fieldValidity.nombre_completo ? styles.valid : styles.invalid)}`}
                value={formData.nombre_completo}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Ej. Juan Pérez González"
                autoComplete="name"
                inputMode="text"
              />
              {touched.nombre_completo && (
                fieldValidity.nombre_completo ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                )
              )}
            </div>
            {touched.nombre_completo && !fieldValidity.nombre_completo && (
              <span className={styles.formErrorText}>
                {errors.nombre_completo || 'El nombre completo debe tener al menos 3 caracteres'}
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="curp_rfc" className={styles.formLabel}>
              CURP o RFC
            </label>
            <div className={styles.inputWithIcon}>
              <FaIdCard className={styles.inputIcon} />
              <input
                type="text"
                id="curp_rfc"
                name="curp_rfc"
                className={`${styles.formInput} ${touched.curp_rfc && (fieldValidity.curp_rfc ? styles.valid : styles.invalid)}`}
                value={formData.curp_rfc}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Ej. PEGJ800101HDFRZN08"
                autoComplete="off"
                inputMode="text"
                autoCapitalize="characters"
              />
              {touched.curp_rfc && (
                fieldValidity.curp_rfc ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                )
              )}
            </div>
            {touched.curp_rfc && !fieldValidity.curp_rfc ? (
              <span className={styles.formErrorText}>
                {errors.curp_rfc || 'Formato inválido. CURP (18 caracteres) o RFC (12-13 caracteres)'}
              </span>
            ) : (
              <span className={styles.formHelperText}>
                CURP (18 caracteres) o RFC (12-13 caracteres)
              </span>
            )}
          </div>

          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label htmlFor="domicilio" className={styles.formLabel}>
              Dirección completa
            </label>
            <div className={styles.inputWithIcon}>
              <FaMapMarkerAlt className={styles.inputIcon} />
              <input
                type="text"
                id="domicilio"
                name="domicilio"
                className={`${styles.formInput} ${touched.domicilio && (fieldValidity.domicilio ? styles.valid : styles.invalid)}`}
                value={formData.domicilio}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Ej. Calle Principal #123, Colonia Centro, Ciudad"
                autoComplete="street-address"
                inputMode="text"
              />
              {touched.domicilio && (
                fieldValidity.domicilio ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                )
              )}
            </div>
            {touched.domicilio && !fieldValidity.domicilio && (
              <span className={styles.formErrorText}>
                {errors.domicilio || 'La dirección debe ser completa (mínimo 10 caracteres)'}
              </span>
            )}
          </div>
        </div>

        <div className={styles.infoBox}>
          <FaInfoCircle className={styles.infoIcon} />
          <p className={styles.infoText}>
            La información personal es necesaria para la emisión de su permiso digital.
            Todos los datos son tratados de acuerdo a nuestra política de privacidad.
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
            onClick={onNext}
            disabled={!isFormValid()}
            className={styles.navigationButton}
            icon={<FaArrowRight />}
            iconAfter
          >
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PersonalInfoStep;
