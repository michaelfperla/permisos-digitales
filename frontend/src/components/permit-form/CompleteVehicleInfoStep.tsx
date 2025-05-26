import React from 'react';
import { useFormContext } from 'react-hook-form';
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
  FaArrowRight,
} from 'react-icons/fa';

import styles from './CompleteForm.module.css';
import { CompletePermitFormData } from '../../shared/schemas/permit.schema';
import Button from "../ui/Button/Button";

interface VehicleInfoStepProps {
  onNext: () => void;
  onPrevious: () => void;
}

const CompleteVehicleInfoStep: React.FC<VehicleInfoStepProps> = ({ onNext, onPrevious }) => {
  // Common car brands for quick selection
  const commonBrands = [
    'Toyota',
    'Honda',
    'Nissan',
    'Volkswagen',
    'Ford',
    'Chevrolet',
    'Mazda',
    'Kia',
    'Hyundai',
  ];

  // Get form methods from React Hook Form context
  const {
    register,
    setValue,
    formState: { errors, touchedFields },
    trigger,
    watch,
  } = useFormContext<CompletePermitFormData>();

  // Watch marca field for quick selection highlighting
  const currentMarca = watch('marca');

  // Handle quick brand selection
  const handleQuickBrandSelect = (brand: string) => {
    setValue('marca', brand, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  // Handle next button click with validation
  const handleNext = async () => {
    // Validate only the vehicle info fields
    const isStepValid = await trigger([
      'marca',
      'linea',
      'color',
      'numero_serie',
      'numero_motor',
      'ano_modelo',
    ]);

    if (isStepValid) {
      onNext();
    }
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
                className={`${styles.formInput} ${touchedFields.marca && (errors.marca ? styles.invalid : styles.valid)}`}
                placeholder="Ej. Toyota, Ford, Chevrolet"
                inputMode="text"
                {...register('marca')}
              />
              {touchedFields.marca &&
                (!errors.marca ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                ))}
            </div>
            {errors.marca && <span className={styles.formErrorText}>{errors.marca.message}</span>}

            <div className={styles.quickSelectContainer}>
              {commonBrands.slice(0, 5).map((brand) => (
                <Button
                  key={brand}
                  variant="text"
                  size="small"
                  className={`${styles.quickSelectButton} ${currentMarca === brand ? styles.quickSelectActive : ''}`}
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
              className={`${styles.formInput} ${touchedFields.linea && (errors.linea ? styles.invalid : styles.valid)}`}
              placeholder="Ej. Corolla, Mustang, Silverado"
              inputMode="text"
              {...register('linea')}
            />
            {touchedFields.linea &&
              (!errors.linea ? (
                <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
              ) : (
                <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
              ))}
            {errors.linea && <span className={styles.formErrorText}>{errors.linea.message}</span>}
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
                className={`${styles.formInput} ${touchedFields.color && (errors.color ? styles.invalid : styles.valid)}`}
                placeholder="Ej. Blanco, Negro, Rojo"
                inputMode="text"
                {...register('color')}
              />
              {touchedFields.color &&
                (!errors.color ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                ))}
            </div>
            {errors.color && <span className={styles.formErrorText}>{errors.color.message}</span>}
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
                className={`${styles.formInput} ${touchedFields.ano_modelo && (errors.ano_modelo ? styles.invalid : styles.valid)}`}
                placeholder="Ej. 2023"
                min="1900"
                max={new Date().getFullYear() + 2}
                inputMode="numeric"
                pattern="[0-9]*"
                {...register('ano_modelo')}
              />
              {touchedFields.ano_modelo &&
                (!errors.ano_modelo ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                ))}
            </div>
            {errors.ano_modelo && (
              <span className={styles.formErrorText}>{errors.ano_modelo.message}</span>
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
                className={`${styles.formInput} ${touchedFields.numero_serie && (errors.numero_serie ? styles.invalid : styles.valid)}`}
                placeholder="Ej. 1HGCM82633A123456"
                inputMode="text"
                autoCapitalize="characters"
                {...register('numero_serie')}
              />
              {touchedFields.numero_serie &&
                (!errors.numero_serie ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                ))}
            </div>
            {errors.numero_serie && (
              <span className={styles.formErrorText}>{errors.numero_serie.message}</span>
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
                className={`${styles.formInput} ${touchedFields.numero_motor && (errors.numero_motor ? styles.invalid : styles.valid)}`}
                placeholder="Ej. 12345ABC"
                inputMode="text"
                autoCapitalize="characters"
                {...register('numero_motor')}
              />
              {touchedFields.numero_motor &&
                (!errors.numero_motor ? (
                  <FaCheck className={`${styles.validationIcon} ${styles.validIcon}`} />
                ) : (
                  <FaTimes className={`${styles.validationIcon} ${styles.invalidIcon}`} />
                ))}
            </div>
            {errors.numero_motor && (
              <span className={styles.formErrorText}>{errors.numero_motor.message}</span>
            )}
          </div>
        </div>

        <div className={styles.infoBox}>
          <FaInfoCircle className={styles.infoIcon} />
          <p className={styles.infoText}>
            Verifica que los datos del vehículo coincidan con los de tu tarjeta de circulación. El
            número de serie (VIN) y el número de motor son especialmente importantes para la
            validación.
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
            onClick={handleNext}
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
