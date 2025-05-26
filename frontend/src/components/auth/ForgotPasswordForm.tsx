import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import styles from './Form.module.css';
import authService from '../../services/authService';
import { useToast } from '../../shared/hooks/useToast';
import { forgotPasswordSchema, ForgotPasswordFormData } from '../../shared/schemas/auth.schema';
import Button from "../ui/Button/Button";
import MobileForm, {
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormActions,
} from "../ui/MobileForm/MobileForm";

const ForgotPasswordForm: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { showToast } = useToast();

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);

    try {
      const response = await authService.forgotPassword(data.email);

      if (response.success) {
        setIsSubmitted(true);
        showToast('Enviamos un link a tu correo', 'success');
      } else {
        showToast(response.message || 'Error al enviar el correo', 'error');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      showToast('Error de red. Revisa tu conexión', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    const email = getValues('email');
    return (
      <MobileForm title="¡Correo enviado!" onSubmit={(e) => e.preventDefault()}>
        <p className="mobile-success-text">
          Enviamos un link a <strong>{email}</strong>. Revisa tu bandeja de entrada y sigue las
          instrucciones para cambiar tu contraseña.
        </p>
        <p className="mobile-success-text">
          Si no lo recibes en unos minutos, revisa tu carpeta de spam o{' '}
          <Button
            variant="text"
            size="small"
            onClick={() => setIsSubmitted(false)}
            className="mobile-link-button touch-target"
          >
            inténtalo de nuevo
          </Button>
          .
        </p>
        <div className="mobile-form-links">
          <div className="mobile-form-links-section">
            <p>
              <Link to="/login" className="mobile-link-minor touch-target">
                Regresar a inicio de sesión
              </Link>
            </p>
          </div>
        </div>
      </MobileForm>
    );
  }

  return (
    <MobileForm
      title="Recuperar contraseña"
      onSubmit={handleSubmit(onSubmit)}
      description="Escribe tu correo y te enviaremos un link para cambiar tu contraseña."
    >
      <MobileFormGroup>
        <MobileFormLabel htmlFor="email" required>
          Correo
        </MobileFormLabel>
        <MobileFormInput
          type="email"
          id="email"
          error={errors.email?.message}
          {...register('email')}
          required
          autoComplete="email"
          inputMode="email"
        />
      </MobileFormGroup>

      <MobileFormActions>
        <Button type="submit" variant="primary" disabled={isLoading} className="mobile-button">
          {isLoading ? (
            <>
              Enviando...
              <span className={styles.spinner}></span>
            </>
          ) : (
            'Enviar link'
          )}
        </Button>
      </MobileFormActions>

      <div className="mobile-form-links">
        <div className="mobile-form-links-section">
          <p>
            <Link to="/login" className="mobile-link-minor touch-target">
              Regresar a inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    </MobileForm>
  );
};

export default ForgotPasswordForm;
