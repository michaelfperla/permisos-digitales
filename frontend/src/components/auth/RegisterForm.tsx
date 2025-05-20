import React, { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from './Form.module.css';
import useAuth from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { debugLog, errorLog } from '../../utils/debug';
import Button from '../../components/ui/Button/Button';
import Alert from '../../components/ui/Alert/Alert';
import MobileForm, {
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormActions
} from '../../components/ui/MobileForm/MobileForm';
import { FaArrowRight, FaArrowLeft } from 'react-icons/fa';

interface RegisterFormProps {
  onRegistrationSuccess: (email: string) => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onRegistrationSuccess }) => {
  const navigate = useNavigate();
  // Form step state (1 = personal info, 2 = account info)
  const [currentStep, setCurrentStep] = useState(1);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // Get auth context
  const { register, isLoading, error, clearError } = useAuth();

  // Get toast context
  const { showToast } = useToast();

  // Clear auth errors when component unmounts
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Function to go to next step
  const goToNextStep = () => {
    // Validate first step fields
    const isFirstNameValid = validateFirstName(firstName);
    const isLastNameValid = validateLastName(lastName);

    if (isFirstNameValid && isLastNameValid) {
      setCurrentStep(2);
    }
  };

  // Function to go back to previous step
  const goToPreviousStep = () => {
    setCurrentStep(1);
  };

  const validateFirstName = (name: string): boolean => {
    if (!name.trim()) {
      setFirstNameError('Falta tu nombre');
      return false;
    }
    setFirstNameError('');
    return true;
  };

  const validateLastName = (name: string): boolean => {
    if (!name.trim()) {
      setLastNameError('Falta tu apellido');
      return false;
    }
    setLastNameError('');
    return true;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);

    if (!email) {
      setEmailError('Falta tu correo electrónico');
      return false;
    } else if (!isValid) {
      setEmailError('Escribe un correo electrónico válido');
      return false;
    }

    setEmailError('');
    return true;
  };

  const validatePassword = (password: string): boolean => {
    if (!password) {
      setPasswordError('Falta tu contraseña');
      return false;
    } else if (password.length < 8) {
      setPasswordError('Tu contraseña debe tener mínimo 8 caracteres');
      return false;
    }

    setPasswordError('');
    return true;
  };

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
    debugLog('RegisterForm', 'Register form submitted');

    // If on step 1, just go to next step
    if (currentStep === 1) {
      goToNextStep();
      return;
    }

    // Clear any previous errors
    clearError();

    // Validate form (step 2 fields)
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);

    if (!isEmailValid || !isPasswordValid || !isConfirmPasswordValid) {
      debugLog('RegisterForm', 'Form validation failed', {
        emailError,
        passwordError,
        confirmPasswordError
      });
      return;
    }

    // Also validate step 1 fields again to be safe
    const isFirstNameValid = validateFirstName(firstName);
    const isLastNameValid = validateLastName(lastName);

    if (!isFirstNameValid || !isLastNameValid) {
      debugLog('RegisterForm', 'Step 1 validation failed on submit', {
        firstNameError,
        lastNameError
      });
      setCurrentStep(1); // Go back to step 1 if there are errors
      return;
    }

    // Create a promise that will reject after a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Registration request timed out'));
      }, 10000); // 10 second timeout
    });

    try {
      debugLog('RegisterForm', `Attempting registration with email: ${email}`);

      // Race the registration against the timeout
      const registerPromise = register({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        confirmPassword
      });

      const success = await Promise.race([registerPromise, timeoutPromise]) as boolean;
      debugLog('RegisterForm', `Registration result: ${success}`);

      if (success) {
        // Show success toast
        showToast('¡Cuenta creada! Revisa tu correo para verificarla.', 'success');
        debugLog('RegisterForm', 'Registration successful');

        // Store the email before resetting the form
        const registeredEmail = email;

        // Reset form
        setFirstName('');
        setLastName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');

        // Navigate to pre-verification page with email in state
        debugLog('RegisterForm', 'Navigating to pre-verification page with email:', registeredEmail);
        navigate('/pre-verification', { state: { email: registeredEmail } });
      } else {
        debugLog('RegisterForm', 'Registration returned false');
        showToast('No pudimos crear tu cuenta. Por favor, inténtalo de nuevo.', 'error');
      }
    } catch (error) {
      errorLog('RegisterForm', 'Registration submission error', error);

      // Handle timeout specifically
      if (error instanceof Error && error.message === 'Registration request timed out') {
        showToast('La solicitud de registro tardó demasiado. Por favor, inténtalo de nuevo.', 'error');
      } else {
        // Try to extract a more specific error message from the error object
        let errorMessage = 'No pudimos crear tu cuenta. Por favor, inténtalo de nuevo.';

        // Check if it's an Axios error with a response
        if (axios.isAxiosError(error) && error.response?.data) {
          // Extract the error message from the response data
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (error.response.data.message) {
            // If the response has a message property, use that
            errorMessage = error.response.data.message;
          } else if (error.response.data.error) {
            // If the response has an error property, use that
            errorMessage = typeof error.response.data.error === 'string'
              ? error.response.data.error
              : error.response.data.error.message || errorMessage;
          } else if (error.response.data.errors && Array.isArray(error.response.data.errors) && error.response.data.errors.length > 0) {
            // If the response has an errors array, use the first error message
            const firstError = error.response.data.errors[0];
            errorMessage = firstError.msg || firstError.message || errorMessage;
          }

          // Map common error messages to more user-friendly messages
          if (errorMessage.includes('already exists') || errorMessage.includes('ya existe')) {
            errorMessage = 'Este correo ya está registrado. Por favor, utiliza otro correo o intenta recuperar tu contraseña.';
          } else if (errorMessage.includes('password') && errorMessage.includes('match')) {
            errorMessage = 'Las contraseñas no coinciden. Por favor, verifica que sean iguales.';
          }
        } else if (error instanceof Error) {
          // If it's a regular Error object, use its message if it's not empty
          if (error.message && error.message !== 'Error' && !error.message.includes('network error')) {
            errorMessage = error.message;
          }
        }

        // Show the error message to the user
        showToast(errorMessage, 'error');

        // If the error is related to validation, highlight the relevant fields
        if (axios.isAxiosError(error) && error.response?.data?.errors) {
          const validationErrors = error.response.data.errors;
          if (Array.isArray(validationErrors)) {
            validationErrors.forEach(validationError => {
              // Set field-specific error messages based on the validation errors
              switch (validationError.param) {
                case 'email':
                  setEmailError(validationError.msg);
                  break;
                case 'password':
                  setPasswordError(validationError.msg);
                  break;
                case 'confirmPassword':
                  setConfirmPasswordError(validationError.msg);
                  break;
                case 'first_name':
                  setFirstNameError(validationError.msg);
                  break;
                case 'last_name':
                  setLastNameError(validationError.msg);
                  break;
              }
            });
          }
        }
      }

      // Force isLoading to false in case it got stuck
      if (isLoading) {
        // This is a hack to force the loading state to false
        // We're directly calling the function that would normally be called by the AuthContext
        if (typeof clearError === 'function') {
          clearError();
        }
      }
    }
  };

  return (
    <MobileForm
      title="Crear cuenta"
      onSubmit={handleSubmit}
    >
      {error && (
        <Alert variant="error" className={styles.formAlert}>
          {error}
        </Alert>
      )}

      {currentStep === 1 ? (
        // Step 1: Personal Information
        <div className={styles.formStep}>
          <MobileFormGroup>
            <MobileFormLabel htmlFor="firstName" required>
              Nombre
            </MobileFormLabel>
            <MobileFormInput
              type="text"
              id="firstName"
              error={firstNameError}
              value={firstName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
              inputMode="text"
            />
          </MobileFormGroup>

          <MobileFormGroup>
            <MobileFormLabel htmlFor="lastName" required>
              Apellido
            </MobileFormLabel>
            <MobileFormInput
              type="text"
              id="lastName"
              error={lastNameError}
              value={lastName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
              inputMode="text"
            />
          </MobileFormGroup>

          <MobileFormActions>
            <Button
              type="button"
              variant="primary"
              onClick={goToNextStep}
              icon={<FaArrowRight />}
              iconAfter={true}
            >
              Siguiente
            </Button>
          </MobileFormActions>
        </div>
      ) : (
        // Step 2: Account Information
        <div className={styles.formStep}>
          <MobileFormGroup>
            <MobileFormLabel htmlFor="email" required>
              Correo electrónico
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

          <MobileFormGroup>
            <MobileFormLabel htmlFor="password" required>
              Contraseña
            </MobileFormLabel>
            <MobileFormInput
              type="password"
              id="password"
              error={passwordError}
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </MobileFormGroup>

          <MobileFormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={goToPreviousStep}
              icon={<FaArrowLeft />}
            >
              Atrás
            </Button>

            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  Creando cuenta...
                  <span className={styles.spinner}></span>
                </>
              ) : (
                'Crear cuenta'
              )}
            </Button>
          </MobileFormActions>
        </div>
      )}

      <div className="mobile-form-links">
        <div className="mobile-form-links-section">
          <p className="mobile-text-muted">
            Al crear tu cuenta, aceptas nuestros
          </p>
          <p>
            <Link to="/terms" className="mobile-link-minor touch-target">Términos de Servicio</Link>{' '}y{' '}
            <Link to="/privacy" className="mobile-link-minor touch-target">Política de Privacidad</Link>
          </p>
        </div>

        <div className="mobile-form-links-section">
          <p className="mobile-text-muted">
            ¿Ya tienes una cuenta?
          </p>
          <p>
            <Link to="/login" className="mobile-link-action touch-target">Entrar</Link>
          </p>
        </div>
      </div>
    </MobileForm>
  );
};

export default RegisterForm;
