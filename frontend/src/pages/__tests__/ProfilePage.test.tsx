import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import AuthContext from '../../contexts/AuthContext';
import { ToastProvider } from '../../contexts/ToastContext';
import userService from '../../services/userService';
import { mockUser } from '../../test/mocks/authService';
import ProfilePage from '../ProfilePage';


// Mock userService
vi.mock('../../services/userService', () => ({
  default: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}));

// Mock ChangePasswordForm component
vi.mock('../../components/ChangePasswordForm', () => ({
  default: ({ onSuccess }: { onSuccess: () => void }) => {
    return (
      <div data-testid="mock-change-password-form">
        <button type="button" data-testid="mock-success-button" onClick={onSuccess}>
          Mock Success
        </button>
      </div>
    );
  },
}));

// Mock the toast context
const mockShowToast = vi.fn();
vi.mock('../../contexts/ToastContext', async () => {
  const actual = await vi.importActual('../../contexts/ToastContext');
  return {
    ...(actual as any),
    useToast: () => ({
      showToast: mockShowToast,
    }),
  };
});

describe('ProfilePage', () => {
  const updatedUser = {
    ...mockUser,
    first_name: 'Updated',
    last_name: 'Name',
  };

  // Create a custom auth context for testing
  const createAuthContext = (isAuthenticated = true, user = mockUser) => {
    return {
      isAuthenticated,
      user: isAuthenticated ? user : null,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      clearError: vi.fn(),
      setUser: vi.fn(),
    };
  };

  // Custom render function with auth context
  const customRender = (
    ui: React.ReactElement,
    { authContext = createAuthContext(), ...options } = {},
  ) => {
    return render(
      <BrowserRouter>
        <AuthContext.Provider value={authContext}>
          <ToastProvider>{ui}</ToastProvider>
        </AuthContext.Provider>
      </BrowserRouter>,
      options,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation for successful profile update
    userService.updateProfile = vi.fn().mockResolvedValue({
      success: true,
      user: updatedUser,
      message: 'Profile updated successfully',
    });
  });

  it('should render user profile information when authenticated', () => {
    customRender(<ProfilePage />);

    // Check if user information is displayed
    expect(screen.getByText('Perfil de Usuario')).toBeInTheDocument();
    expect(screen.getByText('Información Personal')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument(); // first_name
    expect(screen.getByText('User')).toBeInTheDocument(); // last_name
    expect(screen.getByText('test@example.com')).toBeInTheDocument(); // email
    expect(screen.getByText('Usuario')).toBeInTheDocument(); // role

    // Check if edit button is present
    expect(screen.getByText('Editar')).toBeInTheDocument();

    // Check if change password button is present
    expect(screen.getByTestId('change-password-button')).toBeInTheDocument();
  });

  it('should show login message when user is not authenticated', () => {
    const authContext = createAuthContext(false);
    customRender(<ProfilePage />, { authContext });

    // Check if login message is displayed
    expect(
      screen.getByText(
        'No se ha encontrado información del usuario. Por favor, inicie sesión nuevamente.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();

    // Verify that profile information is not displayed
    expect(screen.queryByText('Información Personal')).not.toBeInTheDocument();
  });

  it('should switch to edit mode when edit button is clicked', () => {
    customRender(<ProfilePage />);

    // Click the edit button
    fireEvent.click(screen.getByText('Editar'));

    // Check if form inputs are displayed
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Apellido')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo Electrónico')).toBeInTheDocument();

    // Check if form inputs have correct values
    expect(screen.getByLabelText('Nombre')).toHaveValue('Test');
    expect(screen.getByLabelText('Apellido')).toHaveValue('User');
    expect(screen.getByLabelText('Correo Electrónico')).toHaveValue('test@example.com');

    // Check if save and cancel buttons are displayed
    expect(screen.getByText('Guardar Cambios')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('should exit edit mode when cancel button is clicked', () => {
    customRender(<ProfilePage />);

    // Enter edit mode
    fireEvent.click(screen.getByText('Editar'));
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();

    // Click the cancel button
    fireEvent.click(screen.getByText('Cancelar'));

    // Check if we're back to view mode
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
    expect(screen.getByText('Editar')).toBeInTheDocument();
  });

  it('should update form data when input values change', () => {
    customRender(<ProfilePage />);

    // Enter edit mode
    fireEvent.click(screen.getByText('Editar'));

    // Change input values
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Updated' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Name' } });

    // Check if input values are updated
    expect(screen.getByLabelText('Nombre')).toHaveValue('Updated');
    expect(screen.getByLabelText('Apellido')).toHaveValue('Name');
  });

  it('should call updateProfile service and update user when form is submitted successfully', async () => {
    const setUser = vi.fn();
    const authContext = createAuthContext(true, mockUser);
    authContext.setUser = setUser;

    customRender(<ProfilePage />, { authContext });

    // Enter edit mode
    fireEvent.click(screen.getByText('Editar'));

    // Change input values
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Updated' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Name' } });

    // Submit the form
    fireEvent.submit(screen.getByText('Guardar Cambios'));

    // Check if updateProfile was called with correct data
    expect(userService.updateProfile).toHaveBeenCalledWith({
      first_name: 'Updated',
      last_name: 'Name',
    });

    // Wait for the update to complete
    await waitFor(() => {
      // Check if success toast was shown
      expect(mockShowToast).toHaveBeenCalledWith('Perfil actualizado exitosamente', 'success');

      // Check if user was updated in context
      expect(setUser).toHaveBeenCalledWith(updatedUser);

      // Check if we're back to view mode
      expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
    });
  });

  it('should show error toast when updateProfile service fails with API error', async () => {
    // Mock API error
    userService.updateProfile = vi.fn().mockResolvedValue({
      success: false,
      user: null,
      message: 'Invalid profile data',
    });

    customRender(<ProfilePage />);

    // Enter edit mode
    fireEvent.click(screen.getByText('Editar'));

    // Change input values
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Updated' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Name' } });

    // Submit the form
    fireEvent.submit(screen.getByText('Guardar Cambios'));

    // Wait for the update to complete
    await waitFor(() => {
      // Check if error toast was shown
      expect(mockShowToast).toHaveBeenCalledWith('Invalid profile data', 'error');

      // Check if we're still in edit mode
      expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    });
  });

  it('should show error toast when updateProfile service throws an exception', async () => {
    // Mock network error
    userService.updateProfile = vi.fn().mockRejectedValue(new Error('Network error'));

    customRender(<ProfilePage />);

    // Enter edit mode
    fireEvent.click(screen.getByText('Editar'));

    // Change input values
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Updated' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Name' } });

    // Submit the form
    fireEvent.submit(screen.getByText('Guardar Cambios'));

    // Wait for the update to complete
    await waitFor(() => {
      // Check if error toast was shown
      expect(mockShowToast).toHaveBeenCalledWith('Error al actualizar el perfil', 'error');

      // Check if we're still in edit mode
      expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    });
  });

  it('should show loading state during form submission', async () => {
    // Use a delayed promise to simulate a slow API call
    userService.updateProfile = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            user: updatedUser,
            message: 'Profile updated successfully',
          });
        }, 10);
      });
    });

    const setUser = vi.fn();
    const authContext = createAuthContext(true, mockUser);
    authContext.setUser = setUser;

    customRender(<ProfilePage />, { authContext });

    // Enter edit mode
    fireEvent.click(screen.getByText('Editar'));

    // Submit the form
    fireEvent.submit(screen.getByText('Guardar Cambios'));

    // Check for loading state
    expect(screen.getByText('Guardando...')).toBeInTheDocument();

    // Wait for the update to complete
    await waitFor(() => {
      expect(screen.queryByText('Guardando...')).not.toBeInTheDocument();
      expect(setUser).toHaveBeenCalledWith(updatedUser);
    });
  });

  it('should open password change modal when change password button is clicked', () => {
    customRender(<ProfilePage />);

    // Click the change password button
    fireEvent.click(screen.getByTestId('change-password-button'));

    // Check if modal is displayed
    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('modal-container')).toBeInTheDocument();

    // Check if our mocked ChangePasswordForm is rendered inside the modal
    expect(screen.getByTestId('mock-change-password-form')).toBeInTheDocument();
    expect(screen.getByTestId('mock-success-button')).toBeInTheDocument();
  });

  it('should close password change modal when close button is clicked', () => {
    customRender(<ProfilePage />);

    // Open the modal
    fireEvent.click(screen.getByTestId('change-password-button'));
    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();

    // Click the close button
    fireEvent.click(screen.getByTestId('modal-close-button'));

    // Check if modal is closed
    expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
  });

  it('should close password change modal when password change is successful', async () => {
    customRender(<ProfilePage />);

    // Open the modal
    fireEvent.click(screen.getByTestId('change-password-button'));
    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();

    // Our mocked ChangePasswordForm should be rendered
    expect(screen.getByTestId('mock-change-password-form')).toBeInTheDocument();

    // Click the mock success button to simulate successful password change
    fireEvent.click(screen.getByTestId('mock-success-button'));

    // Wait for the modal to close
    await waitFor(() => {
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
    });
  });
});
