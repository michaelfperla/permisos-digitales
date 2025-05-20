import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import LoginForm from '../LoginForm';
import { AuthProvider } from '../../../contexts/AuthContext';
import { ToastProvider } from '../../../contexts/ToastContext';

// Mock the auth hook
vi.mock('../../../hooks/useAuth', () => ({
  default: () => ({
    login: vi.fn().mockResolvedValue(true),
    isLoading: false,
    error: null,
    clearError: vi.fn(),
    resendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
    isAuthenticated: false,
  }),
}));

// Mock the toast hook
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Helper function to render the component with all required providers
const renderLoginForm = () => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('LoginForm Component', () => {
  it('renders the login form correctly', () => {
    renderLoginForm();
    
    // Check for form elements
    expect(screen.getByText('Entrar')).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();
    
    // Check for links
    expect(screen.getByText(/¿Olvidaste tu contraseña?/i)).toBeInTheDocument();
    expect(screen.getByText(/Crear cuenta/i)).toBeInTheDocument();
  });

  it('validates email and password fields', async () => {
    renderLoginForm();
    
    // Get form elements
    const emailInput = screen.getByLabelText(/Correo electrónico/i);
    const passwordInput = screen.getByLabelText(/Contraseña/i);
    const submitButton = screen.getByRole('button', { name: /Entrar/i });
    
    // Submit form without filling fields
    fireEvent.click(submitButton);
    
    // Check for validation errors
    await waitFor(() => {
      expect(screen.getByText(/Falta tu correo electrónico/i)).toBeInTheDocument();
      expect(screen.getByText(/Falta tu contraseña/i)).toBeInTheDocument();
    });
    
    // Fill email with invalid format
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);
    
    // Check for email validation error
    await waitFor(() => {
      expect(screen.getByText(/Escribe un correo electrónico válido/i)).toBeInTheDocument();
    });
    
    // Fill fields with valid data
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    // Validation errors should be gone
    await waitFor(() => {
      expect(screen.queryByText(/Falta tu correo electrónico/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Falta tu contraseña/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Escribe un correo electrónico válido/i)).not.toBeInTheDocument();
    });
  });
});
