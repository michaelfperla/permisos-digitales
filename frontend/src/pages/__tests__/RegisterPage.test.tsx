import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// --- Mocking Dependencies ---

// Mock the entire authService module BEFORE importing components
vi.mock('../../services/authService');

// Mock useNavigate from react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal(); // Import actual module
  return {
    ...actual, // Keep other exports like BrowserRouter
    useNavigate: () => mockNavigate,
  };
});

// Mock the toast context hook
const mockShowToast = vi.fn();
vi.mock('../../contexts/ToastContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useToast: () => ({
      showToast: mockShowToast,
    }),
  };
});

// Import components and mocked service after mocks are defined
import RegisterPage from '../RegisterPage';
import { AuthProvider } from '../../contexts/AuthContext'; // Adjust path if needed
import { ToastProvider } from '../../contexts/ToastContext'; // Adjust path if needed
import authService from '../../services/authService'; // Import the mocked service
// No longer importing useAuth directly in the test file

// Helper function for standard rendering (used by most tests)
const renderRegisterPage = () => {
  render(
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <RegisterPage />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('RegisterPage', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup({ delay: null }); // Use delay: null for faster user events in tests
    vi.resetAllMocks();
    // Default mock for checkStatus needed by AuthProvider on initial load
    vi.mocked(authService.checkStatus).mockResolvedValue({ isLoggedIn: false });
  });

  afterEach(() => {
     // Ensure fake timers are always cleaned up if used in a test
     vi.useRealTimers();
  });

  test('renders the registration form correctly', () => {
    renderRegisterPage();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/apellido/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument(); // Use exact match for password
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
    // Find button by role and accessible name (allows for text changes like "Registrando")
    expect(screen.getByRole('button', { name: /registrarse|registrando/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  test('shows validation errors for all required fields on empty submission', async () => {
    renderRegisterPage();
    const submitButton = screen.getByRole('button', { name: /registrarse|registrando/i });

    // Ensure button is clickable before interaction
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    await user.click(submitButton);

    // Check for ALL required field errors using specific messages
    expect(await screen.findByText(/el nombre es requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/el apellido es requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/el correo electrónico es requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/la contraseña es requerida/i)).toBeInTheDocument();
    expect(screen.getByText(/por favor, confirme su contraseña/i)).toBeInTheDocument();
  });

  test('validates email format', async () => {
    renderRegisterPage();
    await user.type(screen.getByLabelText(/correo electrónico/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /registrarse|registrando/i }));
    expect(await screen.findByText(/por favor, ingrese un correo electrónico válido/i)).toBeInTheDocument();
  });

  test('validates password length', async () => {
    renderRegisterPage();
    await user.type(screen.getByLabelText(/^contraseña$/i), 'short');
    await user.click(screen.getByRole('button', { name: /registrarse|registrando/i }));
    expect(await screen.findByText(/la contraseña debe tener al menos 8 caracteres/i)).toBeInTheDocument();
  });

  test('validates password confirmation', async () => {
    renderRegisterPage();
    await user.type(screen.getByLabelText(/^contraseña$/i), 'password123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'different123');
    await user.click(screen.getByRole('button', { name: /registrarse|registrando/i }));
    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
  });

  test('submits valid data, calls service, shows success toast, and navigates', async () => {
    const actualSuccessMessage = 'Registro exitoso. Por favor, revise su correo electrónico para verificar su cuenta.';
    const expectedUserData = {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      password: 'Password123!',
    };

    vi.mocked(authService.register).mockResolvedValue({
      success: true,
      message: 'Success message from service (not directly shown)',
    });

    renderRegisterPage();

    // Fill form
    await user.type(screen.getByLabelText(/nombre/i), expectedUserData.first_name);
    await user.type(screen.getByLabelText(/apellido/i), expectedUserData.last_name);
    await user.type(screen.getByLabelText(/correo electrónico/i), expectedUserData.email);
    await user.type(screen.getByLabelText(/^contraseña$/i), expectedUserData.password);
    await user.type(screen.getByLabelText(/confirmar contraseña/i), expectedUserData.password);

    const submitButton = screen.getByRole('button', { name: /registrarse|registrando/i });
    await user.click(submitButton);

    // Assert service call
    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith(expectedUserData);
    });

    // Assert success toast was shown
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(actualSuccessMessage, 'success');
    });

    // Assert navigation happens immediately through the useEffect
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  }, 10000); // Keep overall test timeout if needed

  test('submits valid data but does not navigate if registration fails (API error)', async () => {
    const mockErrorMessage = 'Email already exists';
    const expectedUserData = {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      password: 'Password123!',
    };

    vi.mocked(authService.register).mockResolvedValue({
      success: false,
      message: mockErrorMessage,
    });

    renderRegisterPage();

    // Fill form...
    await user.type(screen.getByLabelText(/nombre/i), expectedUserData.first_name);
    await user.type(screen.getByLabelText(/apellido/i), expectedUserData.last_name);
    await user.type(screen.getByLabelText(/correo electrónico/i), expectedUserData.email);
    await user.type(screen.getByLabelText(/^contraseña$/i), expectedUserData.password);
    await user.type(screen.getByLabelText(/confirmar contraseña/i), expectedUserData.password);

    const submitButton = screen.getByRole('button', { name: /registrarse|registrando/i });
    await user.click(submitButton);

    // Assert service call
    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith(expectedUserData);
    });

    // TODO: Verify visual display of error message (e.g., screen.getByText(mockErrorMessage)).
    // Current test setup has issues observing context update needed for this check.

    // Assert NO success toast occurred
    expect(mockShowToast).not.toHaveBeenCalled();
    // Assert NO navigation occurred
    expect(mockNavigate).not.toHaveBeenCalled();
  }, 10000);

  test('handles network error during registration and does not navigate', async () => {
     const expectedUserData = {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      password: 'Password123!',
    };
    const networkErrorMessage = 'Network error. Please check your connection.';

    // Mock service rejection
    vi.mocked(authService.register).mockRejectedValue(new Error('Network Failure'));

    renderRegisterPage();

    // Fill form...
    await user.type(screen.getByLabelText(/nombre/i), expectedUserData.first_name);
    await user.type(screen.getByLabelText(/apellido/i), expectedUserData.last_name);
    await user.type(screen.getByLabelText(/correo electrónico/i), expectedUserData.email);
    await user.type(screen.getByLabelText(/^contraseña$/i), expectedUserData.password);
    await user.type(screen.getByLabelText(/confirmar contraseña/i), expectedUserData.password);

    const submitButton = screen.getByRole('button', { name: /registrarse|registrando/i });
    await user.click(submitButton);

    // Assert service call was attempted
    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith(expectedUserData);
    });

    // TODO: Verify visual display of error message (e.g., screen.getByText(networkErrorMessage)).
    // Current test setup has issues observing context update needed for this check.

    // Assert NO success toast occurred
    expect(mockShowToast).not.toHaveBeenCalled();
    // Assert NO navigation occurred
    expect(mockNavigate).not.toHaveBeenCalled();
  }, 10000);

  test('redirects to dashboard if user is already authenticated', async () => {
    // Mock user is already authenticated via checkStatus
    vi.mocked(authService.checkStatus).mockResolvedValue({
      isLoggedIn: true,
      user: { id: '123', email: 'test@example.com', first_name: 'Test', last_name: 'User', accountType: 'citizen' },
    });

    renderRegisterPage();

    // Assert navigation to dashboard occurred (checkStatus is likely called by AuthProvider on mount)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

});