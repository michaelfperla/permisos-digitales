import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import React from 'react';
import { useForm } from 'react-hook-form';

import styles from './ChangePasswordForm.module.css';
import { changePassword } from '../../services/authService';
import { useToast } from '../../shared/hooks/useToast';
import { changePasswordSchema, ChangePasswordFormData } from '../../shared/schemas/auth.schema';
import Button from '../ui/Button/Button';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onSuccess, onCancel }) => {
  const { showToast } = useToast();

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onChange',
  });

  // Set up the mutation for changing password
  const passwordChangeMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      changePassword(data.currentPassword, data.newPassword),
    onSuccess: (_data) => {
      showToast('Contraseña cambiada con éxito.', 'success');

      // Reset form
      reset();

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : error instanceof Error
            ? error.message
            : 'Error al cambiar la contraseña.';

      showToast(message, 'error');

      // If the error is related to the current password being incorrect
      if (message.toLowerCase().includes('actual') || message.toLowerCase().includes('current')) {
        setError('currentPassword', {
          type: 'manual',
          message: 'La contraseña actual es incorrecta',
        });
      }
    },
  });

  const onSubmit = (data: ChangePasswordFormData) => {
    // Call the mutation with the form data
    passwordChangeMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Cambiar Contraseña</h2>

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="currentPassword" className={styles.formLabel}>
            Contraseña Actual
          </label>
          <input
            type="password"
            id="currentPassword"
            className={`${styles.formInput} ${errors.currentPassword ? styles.inputError : ''}`}
            disabled={passwordChangeMutation.isPending}
            {...register('currentPassword')}
          />
          {errors.currentPassword && (
            <p className={styles.errorText}>{errors.currentPassword.message}</p>
          )}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="newPassword" className={styles.formLabel}>
            Nueva Contraseña
          </label>
          <input
            type="password"
            id="newPassword"
            className={`${styles.formInput} ${errors.newPassword ? styles.inputError : ''}`}
            disabled={passwordChangeMutation.isPending}
            data-testid="new-password-input"
            {...register('newPassword')}
          />
          {errors.newPassword && <p className={styles.errorText}>{errors.newPassword.message}</p>}
          <p className={styles.helperText}>La contraseña debe tener al menos 8 caracteres</p>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword" className={styles.formLabel}>
            Confirmar Nueva Contraseña
          </label>
          <input
            type="password"
            id="confirmPassword"
            className={`${styles.formInput} ${errors.confirmPassword ? styles.inputError : ''}`}
            disabled={passwordChangeMutation.isPending}
            data-testid="confirm-password-input"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className={styles.errorText}>{errors.confirmPassword.message}</p>
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
