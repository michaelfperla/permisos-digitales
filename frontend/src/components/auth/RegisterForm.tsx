import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FaArrowRight, FaArrowLeft } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';

import generalFormStyles from './Form.module.css'; // Assuming this is the original styles import
import formSpecificStyles from './RegisterForm.module.css'; // Renamed import for clarity
import Icon from '../../shared/components/ui/Icon';
import { useUserAuth as useAuth } from '../../shared/hooks/useAuth';
import { useToast } from '../../shared/hooks/useToast';
import { registerSchema, RegisterFormData } from '../../shared/schemas/auth.schema';
import { debugLog, errorLog } from '../../utils/debug';
import Alert from "../ui/Alert/Alert";
import Button from "../ui/Button/Button";
import MobileForm, {
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormActions,
} from "../ui/MobileForm/MobileForm";



interface RegisterFormProps {
  onRegistrationSuccess: (email: string) => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onRegistrationSuccess: _onRegistrationSuccess }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const { register: registerUser, isLoading, error, clearError } = useAuth();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    getValues,
    reset,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onSubmit',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  const goToNextStep = async () => {
    const isFirstStepValid = await trigger(['firstName', 'lastName']);
    if (isFirstStepValid) {
      const { firstName, lastName } = getValues();
      reset({ firstName, lastName, email: '', password: '', confirmPassword: '' });
      setCurrentStep(2);
    }
  };

  const goToPreviousStep = () => {
    const { firstName, lastName } = getValues();
    reset({ firstName, lastName, email: '', password: '', confirmPassword: '' });
    setCurrentStep(1);
  };

  const onSubmit = async (data: RegisterFormData) => {
    debugLog('RegisterForm', 'Register form submitted');
    if (currentStep === 1) {
      await goToNextStep(); // Ensure await if it's async
      return;
    }

    clearError();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Registration request timed out')), 10000);
    });

    try {
      debugLog('RegisterForm', `Attempting registration with email: ${data.email}`);
      const registerPromise = registerUser({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });

      const success = (await Promise.race([registerPromise, timeoutPromise])) as boolean;
      debugLog('RegisterForm', `Registration result: ${success}`);

      if (success) {
        showToast('¡Cuenta creada! Revisa tu correo para verificarla.', 'success');
        const registeredEmail = data.email;
        debugLog(
          'RegisterForm',
          'Navigating to pre-verification page with email:',
          registeredEmail,
        );
        navigate('/pre-verification', { state: { email: registeredEmail } });
      } else {
        // This 'else' might not be hit if registerUser throws on failure or timeout rejects.
        // The catch block is more likely to handle explicit failures.
        // showToast('No pudimos crear tu cuenta. Por favor, inténtalo de nuevo.', 'error');
      }
    } catch (err) {
      // Changed 'error' to 'err' to avoid conflict with context 'error'
      errorLog('RegisterForm', 'Registration submission error', err);
      let errorMessage = 'No pudimos crear tu cuenta. Por favor, inténtalo de nuevo.';

      if (err instanceof Error && err.message === 'Registration request timed out') {
        errorMessage = 'La solicitud de registro tardó demasiado. Por favor, inténtalo de nuevo.';
      } else if (axios.isAxiosError(err) && err.response?.data) {
        const resData = err.response.data;
        if (typeof resData === 'string') {
          errorMessage = resData;
        } else if (resData.message) {
          errorMessage = resData.message;
        } else if (resData.error) {
          errorMessage =
            typeof resData.error === 'string'
              ? resData.error
              : resData.error.message || errorMessage;
        } else if (resData.errors && Array.isArray(resData.errors) && resData.errors.length > 0) {
          const firstError = resData.errors[0];
          errorMessage = firstError.msg || firstError.message || errorMessage;
        }

        if (errorMessage.includes('already exists') || errorMessage.includes('ya existe')) {
          errorMessage =
            'Este correo ya está registrado. Intenta iniciar sesión o usa otro correo.';
        } else if (errorMessage.includes('password') && errorMessage.includes('match')) {
          errorMessage = 'Las contraseñas no coinciden. Por favor, verifica que sean iguales.';
        }
      } else if (
        err instanceof Error &&
        err.message &&
        err.message !== 'Error' &&
        !err.message.includes('Network Error')
      ) {
        errorMessage = err.message;
      }
      showToast(errorMessage, 'error');
    }
    // Removed isLoading manual toggle; useAuth hook should manage this.
  };

  return (
    <MobileForm
      title="Crear cuenta"
      onSubmit={handleSubmit(onSubmit)}
      // className={formSpecificStyles.mobileFormOverrides} // If MobileForm itself needs overrides from RegisterForm.module.css
    >
      {error && (
        <Alert variant="error" className={generalFormStyles.formAlert}>
          {' '}
          {/* Use generalFormStyles or specific from formSpecificStyles */}
          {error}
        </Alert>
      )}

      {currentStep === 1 ? (
        <div className={formSpecificStyles.formStep} key="step1">
          <MobileFormGroup className={formSpecificStyles.formGroup}>
            <MobileFormLabel htmlFor="firstName" required className={formSpecificStyles.label}>
              Nombre
            </MobileFormLabel>
            <MobileFormInput
              type="text"
              id="firstName"
              error={errors.firstName?.message}
              {...register('firstName')}
              required
              autoComplete="given-name"
              inputMode="text"
              className={formSpecificStyles.input}
            />
          </MobileFormGroup>

          <MobileFormGroup className={formSpecificStyles.formGroup}>
            <MobileFormLabel htmlFor="lastName" required className={formSpecificStyles.label}>
              Apellido
            </MobileFormLabel>
            <MobileFormInput
              type="text"
              id="lastName"
              error={errors.lastName?.message}
              {...register('lastName')}
              required
              autoComplete="family-name"
              inputMode="text"
              className={formSpecificStyles.input}
            />
          </MobileFormGroup>

          <MobileFormActions>
            <Button
              type="button"
              variant="primary"
              onClick={goToNextStep}
              icon={<Icon IconComponent={FaArrowRight} size="sm" />}
              iconAfter={true}
              className={formSpecificStyles.nextButton} // Apply full-width style for step 1
            >
              Siguiente
            </Button>
          </MobileFormActions>
        </div>
      ) : (
        <div className={formSpecificStyles.formStep} key="step2">
          <MobileFormGroup className={formSpecificStyles.formGroup}>
            <MobileFormLabel htmlFor="email" required className={formSpecificStyles.label}>
              Correo electrónico
            </MobileFormLabel>
            <MobileFormInput
              type="email"
              id="email"
              error={errors.email?.message}
              {...register('email')}
              required
              autoComplete="off" // Changed from "email" to "off" as it's a new account, or "username" if email is username
              inputMode="email"
              className={formSpecificStyles.input}
            />
          </MobileFormGroup>

          <MobileFormGroup className={formSpecificStyles.formGroup}>
            <MobileFormLabel htmlFor="password" required className={formSpecificStyles.label}>
              Contraseña
            </MobileFormLabel>
            <MobileFormInput
              type="password"
              id="password"
              error={errors.password?.message}
              {...register('password')}
              required
              autoComplete="new-password"
              className={formSpecificStyles.input}
            />
          </MobileFormGroup>

          <MobileFormGroup className={formSpecificStyles.formGroup}>
            <MobileFormLabel
              htmlFor="confirmPassword"
              required
              className={formSpecificStyles.label}
            >
              Confirma tu contraseña
            </MobileFormLabel>
            <MobileFormInput
              type="password"
              id="confirmPassword"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
              required
              autoComplete="new-password"
              className={formSpecificStyles.input}
            />
          </MobileFormGroup>

          <MobileFormActions className={formSpecificStyles.buttonGroup}>
            <Button
              type="button"
              variant="secondary"
              onClick={goToPreviousStep}
              icon={<Icon IconComponent={FaArrowLeft} size="sm" />}
              className={formSpecificStyles.backButton}
            >
              Atrás
            </Button>

            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              className={formSpecificStyles.registerButton}
            >
              {isLoading ? (
                <>
                  Creando cuenta...
                  {/* Assuming Button component shows spinner if isLoading prop is true, or add custom */}
                  {/* <span className={generalFormStyles.spinner}></span> */}
                </>
              ) : (
                'Crear cuenta'
              )}
            </Button>
          </MobileFormActions>
        </div>
      )}

      <div className={formSpecificStyles.formFooterLinks}>
        <div className={formSpecificStyles.formFooterSection}>
          <p className={formSpecificStyles.mutedText}>
            Al continuar, aceptas nuestros {/* Wording updated */}
          </p>
          <div className={formSpecificStyles.termsLinksContainer}>
            <Link to="/terminos-y-condiciones" className={formSpecificStyles.minorLink}>
              Términos y Condiciones
            </Link>
            <span className={formSpecificStyles.termsSeparator}>y</span>
            <Link to="/politica-de-privacidad" className={formSpecificStyles.minorLink}>
              Política de Privacidad
            </Link>
          </div>
        </div>

        <div className={formSpecificStyles.formFooterSection}>
          <p className={formSpecificStyles.mutedText}>¿Ya tienes una cuenta?</p>
          <p>
            <Link to="/login" className={formSpecificStyles.actionLink}>
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </MobileForm>
  );
};

export default RegisterForm;
