import React, { useState, useEffect } from 'react';
import {
  FaCar,
  FaPalette,
  FaBarcode,
  FaCogs,
  FaCalendarAlt,
  FaCheck,
  FaTimes,
  FaInfoCircle,
  FaArrowLeft,
  FaArrowRight
} from 'react-icons/fa';
import styles from './CompleteForm.module.css';
import Button from '../../components/ui/Button/Button';

interface VehicleInfoStepProps {
  formData: {
    marca: string;
    linea: string;
    color: string;
    numero_serie: string;
    numero_motor: string;
    ano_modelo: string | number;
  };
  errors: Record<string, string>;
  updateFormData: (data: Partial<typeof formData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const CompleteVehicleInfoStep: React.FC<VehicleInfoStepProps> = ({
  formData,
  errors,
  updateFormData,
  onNext,
  onPrevious
}) => {
  // Common car brands for quick selection
  const commonBrands = [
    'Toyota', 'Honda', 'Nissan', 'Volkswagen', 'Ford',
    'Chevrolet', 'Mazda', 'Kia', 'Hyundai'
  ];

  // Local state for validation
  const [touched, setTouched] = useState({
    marca: false,
    linea: false,
    color: false,
    numero_serie: false,
    numero_motor: false,
    ano_modelo: false
  });

  // Local state for field validity
  const [fieldValidity, setFieldValidity] = useState({
    marca: false,
    linea: false,
    color: false,
    numero_serie: false,
    numero_motor: false,
    ano_modelo: false
  });

  // Validate fields on mount and when formData changes
  useEffect(() => {
    validateFields();
  }, [formData]);

  // Validate all fields
  const validateFields = () => {
    const validity = {
      marca: formData.marca.trim().length >= 2,
      linea: formData.linea.trim().length >= 2,
      color: formData.color.trim().length >= 2,
      numero_serie: formData.numero_serie.trim().length >= 5,
      numero_motor: formData.numero_motor.trim().length >= 2,
      ano_modelo: validateYear(formData.ano_modelo)
    };

    setFieldValidity(validity);
  };

  // Validate year
  const validateYear = (year: string | number) => {
    const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
    const currentYear = new Date().getFullYear();
    return !isNaN(yearNum) && yearNum >= 1900 && yearNum <= currentYear + 1;
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Update form data
    updateFormData({
      [name]: name === 'ano_modelo' ? (value ? parseInt(value, 10) : '') : value
    });

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

  // Handle quick brand selection
  const handleQuickBrandSelect = (brand: string) => {
    updateFormData({ marca: brand });

    // Mark field as touched
    setTouched(prev => ({
      ...prev,
      marca: true
    }));
  };

  // Check if all fields are valid
  const isFormValid = () => {
    return Object.values(fieldValidity).every(valid => valid);
  };

  return (
    <div className={styles.formSection}>
      <div className={styles.formSectionHeader}>
        <FaCar className={styles.formSectionIcon} />
        <h2 className={styles.formSectionTitle}>Información del Vehículo</h2>
      </div>

      <div className={styles.formSectionContent}>
        <div className={styles.formFields}>
          <div className={styles.formGroup}>
            <label htmlFor="marca" className={styles.formLabel}>
              Marca
            </label>
            <div className={styles.inputWithIcon}>
              <FaCar className={styles.inputIcon} />
              <input
                type="text"
                id="marca"
                name="marca"
                className={`${styles.formInput} ${touched.marca && (fieldValidity.marca ? styles.valid : styles.invalid)}`}
                value={formData.marca}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Ej. Toyota, Ford, Chevrolet"
                inputMode="text"
              />
              {touched.marca && (
                fieldValidity.marca ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                )
              )}
            </div>
            {touched.marca && !fieldValidity.marca && (
              <span className={styles.formErrorText}>
                {errors.marca || 'La marca es requerida'}
              </span>
            )}

            <div className={styles.quickSelectContainer}>
              {commonBrands.slice(0, 5).map(brand => (
                <Button
                  key={brand}
                  variant="text"
                  size="small"
                  className={`${styles.quickSelectButton} ${formData.marca === brand ? styles.quickSelectActive : ''}`}
                  onClick={() => handleQuickBrandSelect(brand)}
                >
                  {brand}
                </Button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="linea" className={styles.formLabel}>
              Modelo
            </label>
            <input
              type="text"
              id="linea"
              name="linea"
              className={`${styles.formInput} ${touched.linea && (fieldValidity.linea ? styles.valid : styles.invalid)}`}
              value={formData.linea}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Ej. Corolla, Mustang, Silverado"
              inputMode="text"
            />
            {touched.linea && (
              fieldValidity.linea ? (
                <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
              ) : (
                <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
              )
            )}
            {touched.linea && !fieldValidity.linea && (
              <span className={styles.formErrorText}>
                {errors.linea || 'El modelo es requerido'}
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="color" className={styles.formLabel}>
              Color
            </label>
            <div className={styles.inputWithIcon}>
              <FaPalette className={styles.inputIcon} />
              <input
                type="text"
                id="color"
                name="color"
                className={`${styles.formInput} ${touched.color && (fieldValidity.color ? styles.valid : styles.invalid)}`}
                value={formData.color}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Ej. Blanco, Negro, Rojo"
                inputMode="text"
              />
              {touched.color && (
                fieldValidity.color ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                )
              )}
            </div>
            {touched.color && !fieldValidity.color && (
              <span className={styles.formErrorText}>
                {errors.color || 'El color es requerido'}
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="ano_modelo" className={styles.formLabel}>
              Año
            </label>
            <div className={styles.inputWithIcon}>
              <FaCalendarAlt className={styles.inputIcon} />
              <input
                type="number"
                id="ano_modelo"
                name="ano_modelo"
                className={`${styles.formInput} ${touched.ano_modelo && (fieldValidity.ano_modelo ? styles.valid : styles.invalid)}`}
                value={formData.ano_modelo}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Ej. 2023"
                min="1900"
                max={new Date().getFullYear() + 1}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              {touched.ano_modelo && (
                fieldValidity.ano_modelo ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                )
              )}
            </div>
            {touched.ano_modelo && !fieldValidity.ano_modelo && (
              <span className={styles.formErrorText}>
                {errors.ano_modelo || `El año debe estar entre 1900 y ${new Date().getFullYear() + 1}`}
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="numero_serie" className={styles.formLabel}>
              Número de serie (VIN)
            </label>
            <div className={styles.inputWithIcon}>
              <FaBarcode className={styles.inputIcon} />
              <input
                type="text"
                id="numero_serie"
                name="numero_serie"
                className={`${styles.formInput} ${touched.numero_serie && (fieldValidity.numero_serie ? styles.valid : styles.invalid)}`}
                value={formData.numero_serie}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Ej. 1HGCM82633A123456"
                inputMode="text"
                autoCapitalize="characters"
              />
              {touched.numero_serie && (
                fieldValidity.numero_serie ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                )
              )}
            </div>
            {touched.numero_serie && !fieldValidity.numero_serie && (
              <span className={styles.formErrorText}>
                {errors.numero_serie || 'El número de serie debe tener al menos 5 caracteres'}
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="numero_motor" className={styles.formLabel}>
              Número de motor
            </label>
            <div className={styles.inputWithIcon}>
              <FaCogs className={styles.inputIcon} />
              <input
                type="text"
                id="numero_motor"
                name="numero_motor"
                className={`${styles.formInput} ${touched.numero_motor && (fieldValidity.numero_motor ? styles.valid : styles.invalid)}`}
                value={formData.numero_motor}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Ej. 12345ABC"
                inputMode="text"
                autoCapitalize="characters"
              />
              {touched.numero_motor && (
                fieldValidity.numero_motor ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                )
              )}
            </div>
            {touched.numero_motor && !fieldValidity.numero_motor && (
              <span className={styles.formErrorText}>
                {errors.numero_motor || 'El número de motor es requerido'}
              </span>
            )}
          </div>
        </div>

        <div className={styles.infoBox}>
          <FaInfoCircle className={styles.infoIcon} />
          <p className={styles.infoText}>
            Verifica que los datos del vehículo coincidan con los de tu tarjeta de circulación.
            El número de serie (VIN) y el número de motor son especialmente importantes para la validación.
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

export default CompleteVehicleInfoStep;
