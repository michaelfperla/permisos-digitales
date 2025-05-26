import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import styles from './Form.module.css';
import authService from '../../services/authService';
import { useToast } from '../../shared/hooks/useToast';
import { resetPasswordSchema, ResetPasswordFormData } from '../../shared/schemas/auth.schema';
import { validatePassword } from '../../utils/validation';
import Button from "../ui/Button/Button";
import MobileForm, {
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormActions,
} from "../ui/MobileForm/MobileForm";

const ResetPasswordForm: React.FC = () => {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
  });

  // Watch password for strength indicator
  const password = watch('password');

  // Extract token from URL query parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tokenParam = queryParams.get('token');

    if (tokenParam) {
      setToken(tokenParam);
    } else {
      showToast('Este link no es válido o ya expiró', 'error');
    }
  }, [location.search, showToast]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      showToast('Este link no es válido o ya expiró', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.resetPassword(token, data.password);

      if (response.success) {
        setIsSubmitted(true);
        showToast('¡Contraseña cambiada!', 'success');

        // Redirect to login page after a short delay
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        showToast(response.message || 'Error al cambiar la contraseña', 'error');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      showToast('Error de red. Revisa tu conexión', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <MobileForm title="¡Contraseña cambiada!" onSubmit={(e) => e.preventDefault()}>
        <p className="mobile-success-text">
          Cambiamos tu contraseña. Te redirigimos a la página de inicio en unos segundos.
        </p>
        <div className="mobile-form-links">
          <div className="mobile-form-links-section">
            <p>
              <Link to="/login" className="mobile-link-minor touch-target">
                Ir a inicio de sesión
              </Link>
            </p>
          </div>
        </div>
      </MobileForm>
    );
  }

  return (
    <MobileForm
      title="Cambiar contraseña"
      onSubmit={handleSubmit(onSubmit)}
      description="Escribe tu nueva contraseña."
    >
      <MobileFormGroup>
        <MobileFormLabel htmlFor="password" required>
          Nueva contraseña
        </MobileFormLabel>
        <MobileFormInput
          type="password"
          id="password"
          error={errors.password?.message}
          {...register('password')}
          required
          autoComplete="new-password"
        />

        {password && !errors.password && (
          <div className={styles.passwordStrength}>
            <div
              className={`${styles.passwordStrengthBar} ${styles[`strength-${validatePassword(password).strength}`]}`}
            ></div>
            <span className={styles.passwordStrengthText}>
              Seguridad: {validatePassword(password).strengthText}
            </span>
          </div>
        )}
      </MobileFormGroup>

      <MobileFormGroup>
        <MobileFormLabel htmlFor="confirmPassword" required>
          Confirma tu contraseña
        </MobileFormLabel>
        <MobileFormInput
          type="password"
          id="confirmPassword"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
          required
          autoComplete="new-password"
        />
      </MobileFormGroup>

      <MobileFormActions>
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading || !token}
          className="mobile-button"
        >
          {isLoading ? (
            <>
              Cambiando...
              <span className={styles.spinner}></span>
            </>
          ) : (
            'Cambiar contraseña'
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

export default ResetPasswordForm;
