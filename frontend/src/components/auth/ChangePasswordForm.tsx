import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import authService from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';
import styles from './ChangePasswordForm.module.css';
import Button from '../ui/Button/Button';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({
  onSuccess,
  onCancel
}) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Set up the mutation for changing password
  const passwordChangeMutation = useMutation({
    mutationFn: (data: { currentPassword: string, newPassword: string }) =>
      authService.changePassword(data.currentPassword, data.newPassword),
    onSuccess: (data) => {
      showToast('Contraseña cambiada con éxito.', 'success');

      // Reset form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      const message = axios.isAxiosError(error) && error.response?.data?.message
        ? error.response.data.message
        : error instanceof Error ? error.message : 'Error al cambiar la contraseña.';

      showToast(message, 'error');

      // If the error is related to the current password being incorrect
      if (message.toLowerCase().includes('actual') ||
          message.toLowerCase().includes('current')) {
        setErrors(prev => ({
          ...prev,
          currentPassword: 'La contraseña actual es incorrecta'
        }));
      }
    }
  });

  const validateForm = (): boolean => {
    const newErrors = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    let isValid = true;

    // Validate current password
    if (!formData.currentPassword) {
      newErrors.currentPassword = 'La contraseña actual es requerida';
      isValid = false;
    }

    // Validate new password
    if (!formData.newPassword) {
      newErrors.newPassword = 'La nueva contraseña es requerida';
      isValid = false;
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'La contraseña debe tener al menos 8 caracteres';
      isValid = false;
    }

    // Validate confirm password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Debe confirmar la nueva contraseña';
      isValid = false;
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user types
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Call the mutation with the form data
    passwordChangeMutation.mutate({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword
    });
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Cambiar Contraseña</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="currentPassword" className={styles.formLabel}>
            Contraseña Actual
          </label>
          <input
            type="password"
            id="currentPassword"
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleInputChange}
            className={`${styles.formInput} ${errors.currentPassword ? styles.inputError : ''}`}
            disabled={passwordChangeMutation.isPending}
          />
          {errors.currentPassword && (
            <p className={styles.errorText}>{errors.currentPassword}</p>
          )}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="newPassword" className={styles.formLabel}>
            Nueva Contraseña
          </label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleInputChange}
            className={`${styles.formInput} ${errors.newPassword ? styles.inputError : ''}`}
            disabled={passwordChangeMutation.isPending}
            data-testid="new-password-input"
          />
          {errors.newPassword && (
            <p className={styles.errorText}>{errors.newPassword}</p>
          )}
          <p className={styles.helperText}>
            La contraseña debe tener al menos 8 caracteres
          </p>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword" className={styles.formLabel}>
            Confirmar Nueva Contraseña
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className={`${styles.formInput} ${errors.confirmPassword ? styles.inputError : ''}`}
            disabled={passwordChangeMutation.isPending}
            data-testid="confirm-password-input"
          />
          {errors.confirmPassword && (
            <p className={styles.errorText}>{errors.confirmPassword}</p>
          )}
        </div>

        <div className={styles.formActions}>
          {onCancel && (
            <Button
              variant="secondary"
              onClick={onCancel}
              disabled={passwordChangeMutation.isPending}
              className={styles.actionButton}
            >
              Cancelar
            </Button>
          )}
          <Button
            variant="primary"
            htmlType="submit"
            disabled={passwordChangeMutation.isPending}
            className={styles.actionButton}
          >
            {passwordChangeMutation.isPending ? 'Cambiando...' : 'Cambiar Contraseña'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChangePasswordForm;
