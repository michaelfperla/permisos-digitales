import React from 'react';
import { useFormContext } from 'react-hook-form';
import {
  FaUser,
  FaIdCard,
  FaMapMarkerAlt,
  FaCheck,
  FaTimes,
  FaInfoCircle,
  FaArrowLeft,
  FaArrowRight,
} from 'react-icons/fa';

import styles from './CompleteForm.module.css';
import Icon from '../../shared/components/ui/Icon';
import { CompletePermitFormData } from '../../shared/schemas/permit.schema';
import Button from "../ui/Button/Button";

interface PersonalInfoStepProps {
  onNext: () => void;
  onPrevious: () => void;
}

const PersonalInfoStep: React.FC<PersonalInfoStepProps> = ({ onNext, onPrevious }) => {
  // Get form methods from React Hook Form context
  const {
    register,
    formState: { errors, touchedFields },
    trigger,
  } = useFormContext<CompletePermitFormData>();

  // Handle next button click with validation
  const handleNext = async () => {
    // Validate only the personal info fields
    const isStepValid = await trigger(['nombre_completo', 'curp_rfc', 'domicilio']);

    if (isStepValid) {
      onNext();
    }
  };

  return (
    <div className={styles.formSection}>
      <div className={styles.formSectionHeader}>
        <Icon IconComponent={FaUser} className={styles.formSectionIcon} size="lg" />
        <h2 className={styles.formSectionTitle}>Información Personal</h2>
      </div>

      <div className={styles.formSectionContent}>
        <div className={styles.formFields}>
          <div className={styles.formGroup}>
            <label htmlFor="nombre_completo" className={styles.formLabel}>
              Nombre completo
            </label>
            <div className={styles.inputWithIcon}>
              <Icon IconComponent={FaUser} className={styles.inputIcon} size="sm" />
              <input
                type="text"
                id="nombre_completo"
                className={`${styles.formInput} ${touchedFields.nombre_completo && (errors.nombre_completo ? styles.invalid : styles.valid)}`}
                placeholder="Ej. Juan Pérez González"
                autoComplete="name"
                inputMode="text"
                {...register('nombre_completo')}
              />
              {touchedFields.nombre_completo &&
                (!errors.nombre_completo ? (
                  <Icon
                    IconComponent={FaCheck}
                    className={`${styles.validationIcon} ${styles.validIcon}`}
                    size="sm"
                  />
                ) : (
                  <Icon
                    IconComponent={FaTimes}
                    className={`${styles.validationIcon} ${styles.invalidIcon}`}
                    size="sm"
                  />
                ))}
            </div>
            {errors.nombre_completo && (
              <span className={styles.formErrorText}>{errors.nombre_completo.message}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="curp_rfc" className={styles.formLabel}>
              CURP o RFC
            </label>
            <div className={styles.inputWithIcon}>
              <Icon IconComponent={FaIdCard} className={styles.inputIcon} size="sm" />
              <input
                type="text"
                id="curp_rfc"
                className={`${styles.formInput} ${touchedFields.curp_rfc && (errors.curp_rfc ? styles.invalid : styles.valid)}`}
                placeholder="Ej. PEGJ800101HDFRZN08"
                autoComplete="off"
                inputMode="text"
                autoCapitalize="characters"
                {...register('curp_rfc')}
              />
              {touchedFields.curp_rfc &&
                (!errors.curp_rfc ? (
                  <Icon
                    IconComponent={FaCheck}
                    className={`${styles.validationIcon} ${styles.validIcon}`}
                    size="sm"
                  />
                ) : (
                  <Icon
                    IconComponent={FaTimes}
                    className={`${styles.validationIcon} ${styles.invalidIcon}`}
                    size="sm"
                  />
                ))}
            </div>
            {errors.curp_rfc ? (
              <span className={styles.formErrorText}>{errors.curp_rfc.message}</span>
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
              <Icon IconComponent={FaMapMarkerAlt} className={styles.inputIcon} size="sm" />
              <input
                type="text"
                id="domicilio"
                className={`${styles.formInput} ${touchedFields.domicilio && (errors.domicilio ? styles.invalid : styles.valid)}`}
                placeholder="Ej. Calle Principal #123, Colonia Centro, Ciudad"
                autoComplete="street-address"
                inputMode="text"
                {...register('domicilio')}
              />
              {touchedFields.domicilio &&
                (!errors.domicilio ? (
                  <Icon
                    IconComponent={FaCheck}
                    className={`${styles.validationIcon} ${styles.validIcon}`}
                    size="sm"
                  />
                ) : (
                  <Icon
                    IconComponent={FaTimes}
                    className={`${styles.validationIcon} ${styles.invalidIcon}`}
                    size="sm"
                  />
                ))}
            </div>
            {errors.domicilio && (
              <span className={styles.formErrorText}>{errors.domicilio.message}</span>
            )}
          </div>
        </div>

        <div className={styles.infoBox}>
          <Icon IconComponent={FaInfoCircle} className={styles.infoIcon} size="md" />
          <p className={styles.infoText}>
            La información personal es necesaria para la emisión de su permiso digital. Todos los
            datos son tratados de acuerdo a nuestra política de privacidad.
          </p>
        </div>

        <div className={styles.formNavigation}>
          <Button
            variant="secondary"
            onClick={onPrevious}
            icon={<Icon IconComponent={FaArrowLeft} size="sm" />}
            className={styles.navigationButton}
          >
            Anterior
          </Button>

          <Button
            variant="primary"
            onClick={handleNext}
            className={styles.navigationButton}
            icon={<Icon IconComponent={FaArrowRight} size="sm" />}
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
