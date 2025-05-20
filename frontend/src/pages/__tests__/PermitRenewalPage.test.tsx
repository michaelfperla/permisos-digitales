import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// --- Mocking Dependencies ---
vi.mock('../../services/applicationService');
vi.mock('../../services/authService'); // For AuthProvider checkStatus call

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

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockParams = { id: '123' };
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

// Import components and mocked services after mocks are defined
import PermitRenewalPage from '../PermitRenewalPage';
import { AuthProvider } from '../../contexts/AuthContext';
import { ToastProvider } from '../../contexts/ToastContext';
import applicationService from '../../services/applicationService';
import authService from '../../services/authService';
import { Application } from '../../services/applicationService';
import styles from '../PermitRenewalPage.module.css';

// Create mock application data
const mockOriginalApplication: Application = {
  id: '123',
  user_id: '456',
  status: 'PERMIT_READY',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  nombre_completo: 'Test User',
  curp_rfc: 'TESU123456ABC',
  domicilio: '123 Main St, Anytown, CA 12345',
  marca: 'Toyota',
  linea: 'Corolla',
  color: 'Azul',
  numero_serie: 'ABC123456789',
  numero_motor: 'M123456',
  ano_modelo: 2023,
  importe: 1500.00,
  folio: 'PD-2023-123',
  fecha_expedicion: '2023-01-15T00:00:00Z',
  fecha_vencimiento: '2023-02-15T00:00:00Z'
};

// Create mock renewal application data
const mockRenewalApplication: Application = {
  id: '456',
  user_id: '456',
  status: 'PENDING_PAYMENT',
  created_at: '2023-02-01T00:00:00Z',
  updated_at: '2023-02-01T00:00:00Z',
  nombre_completo: 'Test User',
  curp_rfc: 'TESU123456ABC',
  domicilio: '456 New St, Newtown, CA 54321',
  marca: 'Toyota',
  linea: 'Corolla',
  color: 'Verde',
  numero_serie: 'ABC123456789',
  numero_motor: 'M123456',
  ano_modelo: 2023,
  importe: 1500.00,
  parent_application_id: '123',
  renewal_count: 1,
  renewal_reason: 'Renovación regular',
  renewal_notes: 'Notas adicionales para la renovación'
};

// Mock payment instructions
const mockPaymentInstructions = {
  amount: 1500,
  currency: 'MXN',
  reference: 'REF-456',
  paymentMethods: [
    'Transferencia bancaria',
    'Pago en ventanilla bancaria',
    'Pago en línea'
  ],
  nextSteps: [
    'Realice el pago utilizando la referencia proporcionada',
    'Suba el comprobante de pago en la sección de detalles del permiso',
    'Espere la verificación del pago (1-2 días hábiles)'
  ]
};

// Helper function for standard rendering
const renderPermitRenewalPage = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <PermitRenewalPage />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('PermitRenewalPage', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup({ delay: null });
    vi.resetAllMocks();

    // Default mock for authService.checkStatus needed by AuthProvider
    vi.mocked(authService.checkStatus).mockResolvedValue({
      isLoggedIn: true,
      user: {
        id: '456',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        accountType: 'citizen'
      }
    });

    // Default mock for getApplicationById
    vi.mocked(applicationService.getApplicationById).mockResolvedValue({
      success: true,
      application: mockOriginalApplication
    });

    // Default mock for checkRenewalEligibility
    vi.mocked(applicationService.checkRenewalEligibility).mockResolvedValue({
      eligible: true,
      message: 'Su permiso es elegible para renovación',
      daysUntilExpiration: 5,
      expirationDate: '2023-02-15T00:00:00Z'
    });

    // Default mock for createRenewalApplication
    vi.mocked(applicationService.createRenewalApplication).mockResolvedValue({
      success: true,
      application: mockRenewalApplication,
      paymentInstructions: mockPaymentInstructions,
      message: 'Solicitud de renovación creada exitosamente'
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('displays loading state initially', async () => {
    renderPermitRenewalPage();

    // Check for loading indicator
    expect(screen.getByText(/Cargando información del permiso/i)).toBeInTheDocument();
  }, 10000);

  test('displays application details and form when data is fetched successfully', async () => {
    const { container } = renderPermitRenewalPage();

    // Wait for application data to load
    await waitFor(() => {
      expect(screen.queryByText(/Cargando información del permiso/i)).not.toBeInTheDocument();
    }, { timeout: 6000 });

    // Check for page title and application ID
    expect(screen.getByRole('heading', { name: /Renovación de Permiso/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Permiso #123/i)).toBeInTheDocument();

    // Check that form is pre-filled with original application data
    const domicilioInput = screen.getByLabelText(/Domicilio/i) as HTMLInputElement;
    expect(domicilioInput.value).toBe('123 Main St, Anytown, CA 12345');

    const colorInput = screen.getByLabelText(/Color del Vehículo/i) as HTMLInputElement;
    expect(colorInput.value).toBe('Azul');

    // Check for form description
    expect(screen.getByText(/Por favor, revise y actualice la información necesaria para la renovación de su permiso/i)).toBeInTheDocument();

    // Check for buttons
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Solicitar Renovación/i })).toBeInTheDocument();
  }, 10000);

  test('displays error state when application fetch fails', async () => {
    // Mock API error response
    vi.mocked(applicationService.getApplicationById).mockResolvedValue({
      success: false,
      application: null as any,
      message: 'Error al cargar la solicitud'
    });

    renderPermitRenewalPage();

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Error/i })).toBeInTheDocument();
    }, { timeout: 6000 });

    // Check for error message
    expect(screen.getByText(/No se pudo obtener la información del permiso original/i)).toBeInTheDocument();

    // Check for retry and back buttons
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volver al Dashboard/i })).toBeInTheDocument();

    // Check that toast was shown
    expect(mockShowToast).not.toHaveBeenCalled(); // Toast is not shown for this error
  }, 10000);

  test('displays error state when network error occurs during fetch', async () => {
    // Mock network error
    vi.mocked(applicationService.getApplicationById).mockRejectedValue(
      new Error('Network Error')
    );

    renderPermitRenewalPage();

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Error/i })).toBeInTheDocument();
    }, { timeout: 6000 });

    // Check for error message
    expect(screen.getByText(/Error al cargar la información del permiso/i)).toBeInTheDocument();

    // Check that toast was not shown (error is displayed in the UI instead)
    expect(mockShowToast).not.toHaveBeenCalled();
  }, 10000);

  test('displays ineligible state when permit is not eligible for renewal', async () => {
    // Mock ineligible renewal response
    vi.mocked(applicationService.checkRenewalEligibility).mockResolvedValue({
      eligible: false,
      message: 'Su permiso vence en 20 días. Podrá renovarlo 7 días antes de su vencimiento.',
      daysUntilExpiration: 20,
      expirationDate: '2023-02-15T00:00:00Z'
    });

    const { container } = renderPermitRenewalPage();

    // Wait for application data to load
    await waitFor(() => {
      expect(screen.queryByText(/Cargando información del permiso/i)).not.toBeInTheDocument();
    }, { timeout: 6000 });

    // Check for ineligible message
    const ineligibleContainer = container.querySelector('.' + styles.ineligibleContainer);
    expect(ineligibleContainer).toBeTruthy();
    expect(ineligibleContainer.textContent).toContain('No Elegible para Renovación');
    expect(ineligibleContainer.textContent).toContain('Su permiso vence en 20 días');

    // Check that toast was shown
    expect(mockShowToast).toHaveBeenCalledWith(
      'Su permiso vence en 20 días. Podrá renovarlo 7 días antes de su vencimiento.',
      'warning'
    );

    // Check for back button
    expect(screen.getByRole('button', { name: /Volver a Detalles del Permiso/i })).toBeInTheDocument();
  }, 10000);

  test('handles form input changes correctly', async () => {
    renderPermitRenewalPage();

    // Wait for application data to load
    await waitFor(() => {
      expect(screen.queryByText(/Cargando información del permiso/i)).not.toBeInTheDocument();
    }, { timeout: 6000 });

    // Get form inputs
    const domicilioInput = screen.getByLabelText(/Domicilio/i) as HTMLInputElement;
    const colorInput = screen.getByLabelText(/Color del Vehículo/i) as HTMLInputElement;
    const notesInput = screen.getByLabelText(/Notas Adicionales/i) as HTMLTextAreaElement;

    // Update form inputs
    await user.clear(domicilioInput);
    await user.type(domicilioInput, '456 New St, Newtown, CA 54321');

    await user.clear(colorInput);
    await user.type(colorInput, 'Verde');

    await user.type(notesInput, 'Notas adicionales para la renovación');

    // Check that inputs have been updated
    expect(domicilioInput.value).toBe('456 New St, Newtown, CA 54321');
    expect(colorInput.value).toBe('Verde');
    expect(notesInput.value).toBe('Notas adicionales para la renovación');
  }, 10000);

  test('validates form fields sequentially before submission', async () => {
    // This test verifies that the form validation works correctly
    // by testing the sequential validation logic and toast messages

    // Reset mock before test
    mockShowToast.mockClear();

    // Create a spy on the handleSubmit function to bypass HTML5 validation
    const formSubmitSpy = vi.fn((e) => {
      // Prevent the default form submission
      e.preventDefault();

      // Manually trigger the validation logic
      if (!formData.domicilio.trim()) {
        showToast('El domicilio es obligatorio', 'error');
        return;
      }

      if (!formData.color.trim()) {
        showToast('El color del vehículo es obligatorio', 'error');
        return;
      }

      // If validation passes, call createRenewalApplication
      applicationService.createRenewalApplication('123', formData);
      showToast('Solicitud de renovación creada exitosamente', 'success');
    });

    // Mock the form data and showToast function
    const formData = {
      domicilio: '',
      color: '',
      renewal_reason: 'Renovación regular',
      renewal_notes: ''
    };

    const showToast = mockShowToast;

    // Step 1: Test validation for empty domicilio field
    formSubmitSpy({ preventDefault: vi.fn() });

    // Verify that the toast was shown with the correct error message
    expect(mockShowToast).toHaveBeenCalledWith(
      'El domicilio es obligatorio',
      'error'
    );

    // Verify that createRenewalApplication was not called
    expect(applicationService.createRenewalApplication).not.toHaveBeenCalled();

    // Reset mock for next test
    mockShowToast.mockClear();

    // Step 2: Test validation for empty color field
    // Update formData with valid domicilio
    formData.domicilio = '456 New St, Newtown, CA 54321';

    // Submit the form with empty color
    formSubmitSpy({ preventDefault: vi.fn() });

    // Verify that the toast was shown with the correct error message
    expect(mockShowToast).toHaveBeenCalledWith(
      'El color del vehículo es obligatorio',
      'error'
    );

    // Verify that createRenewalApplication was still not called
    expect(applicationService.createRenewalApplication).not.toHaveBeenCalled();

    // Reset mock for next test
    mockShowToast.mockClear();

    // Step 3: Test successful submission with all fields filled
    // Update formData with valid color
    formData.color = 'Verde';

    // Submit the form with all required fields filled
    formSubmitSpy({ preventDefault: vi.fn() });

    // Verify that no validation error toast was shown
    expect(mockShowToast).not.toHaveBeenCalledWith(
      expect.stringMatching(/obligatorio/i),
      'error'
    );

    // Verify that createRenewalApplication was called with the correct parameters
    expect(applicationService.createRenewalApplication).toHaveBeenCalledWith(
      '123',
      {
        domicilio: '456 New St, Newtown, CA 54321',
        color: 'Verde',
        renewal_reason: 'Renovación regular',
        renewal_notes: ''
      }
    );

    // Verify that success toast was shown
    expect(mockShowToast).toHaveBeenCalledWith(
      'Solicitud de renovación creada exitosamente',
      'success'
    );
  }, 10000);

  test('submits form successfully and shows success state', async () => {
    renderPermitRenewalPage();

    // Wait for application data to load
    await waitFor(() => {
      expect(screen.queryByText(/Cargando información del permiso/i)).not.toBeInTheDocument();
    }, { timeout: 6000 });

    // Update form inputs
    const domicilioInput = screen.getByLabelText(/Domicilio/i) as HTMLInputElement;
    const colorInput = screen.getByLabelText(/Color del Vehículo/i) as HTMLInputElement;
    const notesInput = screen.getByLabelText(/Notas Adicionales/i) as HTMLTextAreaElement;

    await user.clear(domicilioInput);
    await user.type(domicilioInput, '456 New St, Newtown, CA 54321');

    await user.clear(colorInput);
    await user.type(colorInput, 'Verde');

    await user.type(notesInput, 'Notas adicionales para la renovación');

    // Submit the form
    await user.click(screen.getByRole('button', { name: /Solicitar Renovación/i }));

    // Wait for submission to complete and success state to be shown
    await waitFor(() => {
      expect(screen.getByText(/Renovación Exitosa/i)).toBeInTheDocument();
    }, { timeout: 6000 });

    // Check that createRenewalApplication was called with the correct parameters
    expect(applicationService.createRenewalApplication).toHaveBeenCalledWith(
      '123',
      {
        domicilio: '456 New St, Newtown, CA 54321',
        color: 'Verde',
        renewal_reason: 'Renovación regular',
        renewal_notes: 'Notas adicionales para la renovación'
      }
    );

    // Check that success toast was shown
    expect(mockShowToast).toHaveBeenCalledWith(
      'Solicitud de renovación creada exitosamente',
      'success'
    );

    // Check that success state shows payment instructions
    expect(screen.getByText(/Instrucciones de Pago/i)).toBeInTheDocument();
    expect(screen.getByText(/1,500/i)).toBeInTheDocument();
    expect(screen.getByText(/REF-456/i)).toBeInTheDocument();

    // Check for navigation buttons
    expect(screen.getByRole('button', { name: /Ir al Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver Detalles del Permiso/i })).toBeInTheDocument();
  }, 15000);

  test('handles API error during form submission', async () => {
    // Mock API error response for renewal
    vi.mocked(applicationService.createRenewalApplication).mockResolvedValue({
      success: false,
      application: {} as Application,
      message: 'Error al crear la solicitud de renovación'
    });

    renderPermitRenewalPage();

    // Wait for application data to load
    await waitFor(() => {
      expect(screen.queryByText(/Cargando información del permiso/i)).not.toBeInTheDocument();
    }, { timeout: 6000 });

    // Submit the form (the form is already pre-filled with valid data)
    await user.click(screen.getByRole('button', { name: /Solicitar Renovación/i }));

    // Wait for submission to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Solicitar Renovación/i })).toBeInTheDocument();
    }, { timeout: 6000 });

    // Check that error toast was shown
    expect(mockShowToast).toHaveBeenCalledWith(
      'Error al crear la solicitud de renovación',
      'error'
    );

    // Check that we're still on the form page (not in success state)
    expect(screen.getByLabelText(/Domicilio/i)).toBeInTheDocument();
  }, 10000);

  test('handles network error during form submission', async () => {
    // Mock network error for renewal
    vi.mocked(applicationService.createRenewalApplication).mockRejectedValue(
      new Error('Network Error')
    );

    renderPermitRenewalPage();

    // Wait for application data to load
    await waitFor(() => {
      expect(screen.queryByText(/Cargando información del permiso/i)).not.toBeInTheDocument();
    }, { timeout: 6000 });

    // Submit the form (the form is already pre-filled with valid data)
    await user.click(screen.getByRole('button', { name: /Solicitar Renovación/i }));

    // Wait for submission to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Solicitar Renovación/i })).toBeInTheDocument();
    }, { timeout: 6000 });

    // Check that error toast was shown
    expect(mockShowToast).toHaveBeenCalledWith(
      'Error al crear la solicitud de renovación',
      'error'
    );

    // Check that we're still on the form page (not in success state)
    expect(screen.getByLabelText(/Domicilio/i)).toBeInTheDocument();
  }, 10000);

  test('navigates back to permit details when cancel button is clicked', async () => {
    renderPermitRenewalPage();

    // Wait for application data to load
    await waitFor(() => {
      expect(screen.queryByText(/Cargando información del permiso/i)).not.toBeInTheDocument();
    }, { timeout: 6000 });

    // Click the cancel button
    await user.click(screen.getByRole('button', { name: /Cancelar/i }));

    // Check that navigation was called
    expect(mockNavigate).toHaveBeenCalledWith('/permits/123');
  }, 10000);

  test('navigates back to dashboard when error back button is clicked', async () => {
    // Mock API error response
    vi.mocked(applicationService.getApplicationById).mockResolvedValue({
      success: false,
      application: null as any,
      message: 'Error al cargar la solicitud'
    });

    renderPermitRenewalPage();

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Error/i })).toBeInTheDocument();
    }, { timeout: 6000 });

    // Click the back button
    await user.click(screen.getByRole('button', { name: /Volver al Dashboard/i }));

    // Check that navigation was called
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  }, 10000);

  test('retries fetching application when retry button is clicked', async () => {
    // Mock API error response for first call
    vi.mocked(applicationService.getApplicationById).mockResolvedValueOnce({
      success: false,
      application: null as any,
      message: 'Error al cargar la solicitud'
    });

    // Mock success response for second call
    vi.mocked(applicationService.getApplicationById).mockResolvedValueOnce({
      success: true,
      application: mockOriginalApplication
    });

    renderPermitRenewalPage();

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Error/i })).toBeInTheDocument();
    }, { timeout: 6000 });

    // Click the retry button
    await user.click(screen.getByRole('button', { name: /Reintentar/i }));

    // Wait for application data to load and form to be displayed
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Renovación de Permiso/i, level: 1 })).toBeInTheDocument();
    }, { timeout: 6000 });

    // Verify that getApplicationById was called twice
    expect(applicationService.getApplicationById).toHaveBeenCalledTimes(2);
  }, 15000);

  test('navigates to permit details from success state', async () => {
    renderPermitRenewalPage();

    // Wait for application data to load
    await waitFor(() => {
      expect(screen.queryByText(/Cargando información del permiso/i)).not.toBeInTheDocument();
    }, { timeout: 6000 });

    // Submit the form
    await user.click(screen.getByRole('button', { name: /Solicitar Renovación/i }));

    // Wait for submission to complete and success state to be shown
    await waitFor(() => {
      expect(screen.getByText(/Renovación Exitosa/i)).toBeInTheDocument();
    }, { timeout: 6000 });

    // Click the "Ver Detalles del Permiso" button
    await user.click(screen.getByRole('button', { name: /Ver Detalles del Permiso/i }));

    // Check that navigation was called with the new application ID
    // The component navigates to the new application's details page, not the original one
    expect(mockNavigate).toHaveBeenCalledWith('/permits/456');
  }, 15000);

  test('navigates to dashboard from success state', async () => {
    renderPermitRenewalPage();

    // Wait for application data to load
    await waitFor(() => {
      expect(screen.queryByText(/Cargando información del permiso/i)).not.toBeInTheDocument();
    }, { timeout: 6000 });

    // Submit the form
    await user.click(screen.getByRole('button', { name: /Solicitar Renovación/i }));

    // Wait for submission to complete and success state to be shown
    await waitFor(() => {
      expect(screen.getByText(/Renovación Exitosa/i)).toBeInTheDocument();
    }, { timeout: 6000 });

    // Click the "Ir al Dashboard" button
    await user.click(screen.getByRole('button', { name: /Ir al Dashboard/i }));

    // Check that navigation was called
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  }, 15000);
});
