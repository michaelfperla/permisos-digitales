import React, { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import styles from './Form.module.css';
import { useToast } from '../../contexts/ToastContext';
import authService from '../../services/authService';
import Button from '../../components/ui/Button/Button';
import Alert from '../../components/ui/Alert/Alert';
import MobileForm, {
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormActions
} from '../../components/ui/MobileForm/MobileForm';

const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { showToast } = useToast();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);

    if (!email) {
      setEmailError('Falta tu correo');
      return false;
    } else if (!isValid) {
      setEmailError('Escribe un correo válido');
      return false;
    }

    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate form
    const isEmailValid = validateEmail(email);

    if (!isEmailValid) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.forgotPassword(email);

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
    return (
      <MobileForm
        title="¡Correo enviado!"
        onSubmit={(e) => e.preventDefault()}
      >
        <p className="mobile-success-text">
          Enviamos un link a <strong>{email}</strong>.
          Revisa tu bandeja de entrada y sigue las instrucciones para cambiar tu contraseña.
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
          </Button>.
        </p>
        <div className="mobile-form-links">
          <div className="mobile-form-links-section">
            <p>
              <Link to="/login" className="mobile-link-minor touch-target">Regresar a inicio de sesión</Link>
            </p>
          </div>
        </div>
      </MobileForm>
    );
  }

  return (
    <MobileForm
      title="Recuperar contraseña"
      onSubmit={handleSubmit}
      description="Escribe tu correo y te enviaremos un link para cambiar tu contraseña."
    >
      <MobileFormGroup>
        <MobileFormLabel htmlFor="email" required>
          Correo
        </MobileFormLabel>
        <MobileFormInput
          type="email"
          id="email"
          error={emailError}
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          required
          autoComplete="email"
          inputMode="email"
        />
      </MobileFormGroup>

      <MobileFormActions>
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading}
          className="mobile-button"
        >
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
            <Link to="/login" className="mobile-link-minor touch-target">Regresar a inicio de sesión</Link>
          </p>
        </div>
      </div>
    </MobileForm>
  );
};

export default ForgotPasswordForm;
