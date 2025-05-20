import React, { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './Form.module.css';
import { useToast } from '../../contexts/ToastContext';
import authService from '../../services/authService';
import { validatePassword } from '../../utils/validation';
import Button from '../../components/ui/Button/Button';
import Alert from '../../components/ui/Alert/Alert';
import MobileForm, {
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormActions
} from '../../components/ui/MobileForm/MobileForm';

const ResetPasswordForm: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

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

  const validateConfirmPassword = (confirmPassword: string): boolean => {
    if (!confirmPassword) {
      setConfirmPasswordError('Confirma tu contraseña');
      return false;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('Las contraseñas no son iguales');
      return false;
    }

    setConfirmPasswordError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate form
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error);
      return;
    }

    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);

    if (!passwordValidation.isValid || !isConfirmPasswordValid) {
      return;
    }

    if (!token) {
      showToast('Este link no es válido o ya expiró', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.resetPassword(token, password);

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
      <MobileForm
        title="¡Contraseña cambiada!"
        onSubmit={(e) => e.preventDefault()}
      >
        <p className="mobile-success-text">
          Cambiamos tu contraseña. Te redirigimos a la página de inicio en unos segundos.
        </p>
        <div className="mobile-form-links">
          <div className="mobile-form-links-section">
            <p>
              <Link to="/login" className="mobile-link-minor touch-target">Ir a inicio de sesión</Link>
            </p>
          </div>
        </div>
      </MobileForm>
    );
  }

  return (
    <MobileForm
      title="Cambiar contraseña"
      onSubmit={handleSubmit}
      description="Escribe tu nueva contraseña."
    >
      <MobileFormGroup>
        <MobileFormLabel htmlFor="password" required>
          Nueva contraseña
        </MobileFormLabel>
        <MobileFormInput
          type="password"
          id="password"
          error={passwordError}
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setPassword(e.target.value);
            const validation = validatePassword(e.target.value);
            setPasswordError(validation.isValid ? '' : validation.error);
          }}
          required
          autoComplete="new-password"
        />

        {password && !passwordError && (
          <div className={styles.passwordStrength}>
            <div className={`${styles.passwordStrengthBar} ${styles[`strength-${validatePassword(password).strength}`]}`}></div>
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
          error={confirmPasswordError}
          value={confirmPassword}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setConfirmPassword(e.target.value);
            if (e.target.value) {
              validateConfirmPassword(e.target.value);
            } else {
              setConfirmPasswordError('');
            }
          }}
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
            <Link to="/login" className="mobile-link-minor touch-target">Regresar a inicio de sesión</Link>
          </p>
        </div>
      </div>
    </MobileForm>
  );
};

export default ResetPasswordForm;
