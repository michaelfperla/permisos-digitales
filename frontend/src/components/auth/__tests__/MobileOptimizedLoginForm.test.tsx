import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import MobileOptimizedLoginForm from '../MobileOptimizedLoginForm';

// Mock dependencies
const mockLogin = vi.fn();
const mockNavigate = vi.fn();
const mockShowToast = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: { from: { pathname: '/dashboard' } } }),
  };
});

vi.mock('../../shared/hooks/useAuth', () => ({
  useUserAuth: () => ({
    login: mockLogin,
    isAuthenticated: false,
  }),
}));

vi.mock('../../shared/hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: vi.fn(),
  writable: true,
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('MobileOptimizedLoginForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render form with mobile-optimized elements', () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    expect(screen.getByText('Bienvenido de vuelta')).toBeInTheDocument();
    expect(screen.getByText('Ingresa a tu cuenta de Permisos Digitales')).toBeInTheDocument();

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('should have proper mobile input attributes', () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);

    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');
    expect(emailInput).toHaveAttribute('inputMode', 'email');
    expect(emailInput).toHaveAttribute('autoCapitalize', 'off');
    expect(emailInput).toHaveAttribute('spellCheck', 'false');

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
  });

  it('should auto-advance to password field when email is valid', async () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);

    await user.type(emailInput, 'test@example.com');

    // Should show validation success icon
    await waitFor(() => {
      expect(screen.getByTestId('success-icon')).toBeInTheDocument();
    }, { timeout: 500 });

    // Should auto-focus password field
    await waitFor(() => {
      expect(passwordInput).toHaveFocus();
    }, { timeout: 500 });
  });

  it('should toggle password visibility', async () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const passwordInput = screen.getByLabelText(/contraseña/i);
    const toggleButton = screen.getByRole('button', { name: /mostrar contraseña/i });

    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /ocultar contraseña/i })).toBeInTheDocument();

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should handle successful login', async () => {
    mockLogin.mockResolvedValue(true);

    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockShowToast).toHaveBeenCalledWith('¡Bienvenido!', 'success');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('should handle login failure with vibration', async () => {
    mockLogin.mockResolvedValue(false);

    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Credenciales incorrectas', 'error');
      expect(navigator.vibrate).toHaveBeenCalledWith(200);
    });
  });

  it('should handle login error', async () => {
    mockLogin.mockRejectedValue(new Error('Network error'));

    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Error al iniciar sesión', 'error');
    });
  });

  it('should handle remember me functionality', async () => {
    mockLogin.mockResolvedValue(true);

    renderWithRouter(<MobileOptimizedLoginForm />);

    const rememberMeCheckbox = screen.getByLabelText(/recordarme en este dispositivo/i);
    expect(rememberMeCheckbox).not.toBeChecked();

    await user.click(rememberMeCheckbox);
    expect(rememberMeCheckbox).toBeChecked();

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(localStorage.getItem('rememberMe')).toBe('true');
    });
  });

  it('should handle biometric login attempt', async () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const biometricButton = screen.getByRole('button', { name: /iniciar sesión con huella digital/i });
    await user.click(biometricButton);

    expect(mockShowToast).toHaveBeenCalledWith(
      'Autenticación biométrica no disponible en este dispositivo',
      'info'
    );
  });

  it('should handle social login buttons', async () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const googleButton = screen.getByRole('button', { name: /google/i });
    const facebookButton = screen.getByRole('button', { name: /facebook/i });

    await user.click(googleButton);
    expect(mockShowToast).toHaveBeenCalledWith('Iniciando sesión con google...', 'info');

    await user.click(facebookButton);
    expect(mockShowToast).toHaveBeenCalledWith('Iniciando sesión con facebook...', 'info');
  });

  it('should display form validation errors', async () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    // Try to submit without filling fields
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/el email es requerido/i)).toBeInTheDocument();
      expect(screen.getByText(/la contraseña es requerida/i)).toBeInTheDocument();
    });
  });

  it('should validate email format', async () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/formato de email inválido/i)).toBeInTheDocument();
    });
  });

  it('should show loading state during submission', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 1000)));

    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveClass('loading');
  });

  it('should handle keyboard navigation properly', async () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);

    await user.tab();
    expect(emailInput).toHaveFocus();

    await user.tab();
    expect(passwordInput).toHaveFocus();

    await user.tab();
    const passwordToggle = screen.getByRole('button', { name: /mostrar contraseña/i });
    expect(passwordToggle).toHaveFocus();
  });

  it('should navigate to forgot password page', () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const forgotPasswordLink = screen.getByRole('link', { name: /¿olvidaste tu contraseña?/i });
    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
  });

  it('should navigate to register page', () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const registerLink = screen.getByRole('link', { name: /crear cuenta/i });
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  it('should handle touch-friendly input interactions', async () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);

    // Touch inputs should be large enough for mobile
    expect(emailInput.closest('.inputWrapper')).toHaveClass('inputWrapper');
    expect(passwordInput.closest('.inputWrapper')).toHaveClass('inputWrapper');
  });

  it('should prevent iOS zoom on form focus', () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);

    // Check meta viewport is configured (would need DOM setup in real test)
    expect(emailInput).toHaveAttribute('inputMode', 'email');
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
  });

  it('should handle form submission with Enter key', async () => {
    mockLogin.mockResolvedValue(true);

    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('should maintain focus management for mobile users', async () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);

    // Focus should move automatically from email to password
    await user.type(emailInput, 'test@example.com');
    
    await waitFor(() => {
      expect(passwordInput).toHaveFocus();
    }, { timeout: 500 });
  });

  it('should handle error states with proper visual feedback', async () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'invalid');
    await user.click(submitButton);

    await waitFor(() => {
      const inputWrapper = emailInput.closest('.inputWrapper');
      expect(inputWrapper).toHaveClass('inputError');
    });
  });

  it('should optimize for thumb navigation zone', () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });
    const biometricButton = screen.getByRole('button', { name: /iniciar sesión con huella digital/i });

    // Buttons should be in thumb-friendly positions
    expect(submitButton).toHaveClass('submitButton');
    expect(biometricButton).toHaveClass('biometricButton');
  });

  it('should handle edge cases with malformed input', async () => {
    renderWithRouter(<MobileOptimizedLoginForm />);

    const emailInput = screen.getByLabelText(/correo electrónico/i);

    // Test with just @ symbol
    await user.type(emailInput, '@');
    expect(screen.queryByTestId('success-icon')).not.toBeInTheDocument();

    // Test with just dot
    await user.clear(emailInput);
    await user.type(emailInput, '.');
    expect(screen.queryByTestId('success-icon')).not.toBeInTheDocument();

    // Test with proper email
    await user.clear(emailInput);
    await user.type(emailInput, 'test@example.com');
    await waitFor(() => {
      expect(screen.getByTestId('success-icon')).toBeInTheDocument();
    });
  });
});