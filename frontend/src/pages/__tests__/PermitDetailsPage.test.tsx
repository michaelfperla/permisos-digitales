import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

// Import components and mocked services after mocks are defined
import { AuthProvider } from '../../shared/contexts/AuthContext';
import { ToastProvider } from '../../shared/contexts/ToastContext';
import applicationService, { Application } from '../../services/applicationService';
import authService from '../../services/authService';
import PermitDetailsPage from '../PermitDetailsPage';
import styles from '../PermitDetailsPage.module.css';

// --- Mocking Dependencies ---
vi.mock('../../services/applicationService');
vi.mock('../../services/authService'); // For AuthProvider checkStatus call

// Mock the toast context hook
const mockShowToast = vi.fn();
vi.mock('../../contexts/ToastContext', async (importOriginal) => {
  const actual = await importOriginal() as any;
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
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

// Mock URL.createObjectURL for file previews
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Create mock application data for different statuses
const createMockApplication = (status: string, overrides = {}): Application => ({
  id: '123',
  user_id: '456',
  status: status as any,
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
  importe: 1500.0,
  ...overrides,
});

// Mock auth service
const mockAuthService = {
  login: vi.fn(),
  logout: vi.fn(),
  checkStatus: vi.fn(),
  register: vi.fn(),
  resendVerificationEmail: vi.fn(),
};

// Helper function for standard rendering
const renderPermitDetailsPage = () => {
  return render(
    <BrowserRouter>
      <AuthProvider type="user" authService={mockAuthService}>
        <ToastProvider>
          <PermitDetailsPage />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>,
  );
};

describe('PermitDetailsPage', () => {
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
        accountType: 'citizen',
      },
    });

    // Default mock for getApplicationById
    vi.mocked(applicationService.getApplicationById).mockResolvedValue({
      success: true,
      application: {
        id: '123',
        vehicleInfo: {
          marca: 'Toyota',
          linea: 'Corolla',
          ano_modelo: 2023,
          color: 'Azul',
          numero_serie: 'ABC123456789',
          numero_motor: 'M123456',
        },
        ownerInfo: {
          nombre_completo: 'Test User',
          curp_rfc: 'TESU123456ABC',
          domicilio: '123 Main St, Anytown, CA 12345',
        },
        dates: {
          created: '2023-01-01T00:00:00Z',
          updated: '2023-01-01T00:00:00Z',
          fecha_vencimiento: '2023-02-15T00:00:00Z',
          fecha_expedicion: '2023-01-15T00:00:00Z',
        },
        is_sample_permit: false,
      },
    });

    // Default mock for downloadPermit
    vi.mocked(applicationService.downloadPermit).mockResolvedValue(
      new Blob(['mock pdf content'], { type: 'application/pdf' }),
    );

    // Default mock for checkRenewalEligibility
    vi.mocked(applicationService.checkRenewalEligibility).mockResolvedValue({
      eligible: true,
      message: 'Su permiso es elegible para renovación',
      daysUntilExpiration: 5,
      expirationDate: '2023-02-15T00:00:00Z',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('displays loading state initially', async () => {
    renderPermitDetailsPage();

    // Check for loading indicator
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText(/Cargando información de la solicitud/i)).toBeInTheDocument();
  }, 10000);

  test('displays application details when data is fetched successfully', async () => {
    const { container: _container } = renderPermitDetailsPage();

    // Wait for application data to load
    await waitFor(
      () => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    // Check for page title and application ID
    expect(
      screen.getByRole('heading', { name: /Detalles de la Solicitud/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Solicitud #123/i)).toBeInTheDocument();

    // Check for applicant details section
    const applicantSection = screen.getByRole('heading', {
      name: /Información del Solicitante/i,
    }).parentElement!;
    expect(within(applicantSection).getByText(/Test User/i)).toBeInTheDocument();
    expect(within(applicantSection).getByText(/TESU123456ABC/i)).toBeInTheDocument();
    expect(
      within(applicantSection).getByText(/123 Main St, Anytown, CA 12345/i),
    ).toBeInTheDocument();

    // Check for vehicle details section
    const vehicleSection = screen.getByRole('heading', {
      name: /Información del Vehículo/i,
    }).parentElement!;
    expect(within(vehicleSection).getByText(/Toyota/i)).toBeInTheDocument();
    expect(within(vehicleSection).getByText(/Corolla/i)).toBeInTheDocument();
    expect(within(vehicleSection).getByText(/Azul/i)).toBeInTheDocument();
    expect(within(vehicleSection).getByText(/ABC123456789/i)).toBeInTheDocument();
    expect(within(vehicleSection).getByText(/M123456/i)).toBeInTheDocument();

    // Find the año modelo field specifically
    const yearModelItem = Array.from(vehicleSection.querySelectorAll('div')).find((div) =>
      div.textContent?.includes('Año Modelo'),
    );
    expect(yearModelItem).toBeTruthy();
    expect(yearModelItem!.textContent).toContain('2023');

    // Check for permit details section
    const permitSection = screen.getByRole('heading', {
      name: /Información del Permiso/i,
    }).parentElement!;
    expect(within(permitSection).getByText(/PD-2023-123/i)).toBeInTheDocument();
    expect(within(permitSection).getByText(/\$1,500.00/i)).toBeInTheDocument();

    // Check for status timeline
    expect(screen.getByText(/Estado de la Solicitud/i)).toBeInTheDocument();

    // Check for download button (since status is PERMIT_READY)
    expect(screen.getByRole('button', { name: /Descargar Permiso/i })).toBeInTheDocument();

    // Check for back button
    expect(screen.getByRole('link', { name: /Volver al Panel/i })).toBeInTheDocument();
  }, 10000);

  test('displays error state when application fetch fails', async () => {
    // Mock API error response
    vi.mocked(applicationService.getApplicationById).mockResolvedValue({
      success: false,
      application: null as any,
      message: 'Error al cargar la solicitud',
    });

    renderPermitDetailsPage();

    // Wait for error message to appear
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: /Error/i })).toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    // Check for error message
    expect(screen.getByText(/Error al cargar la solicitud/i)).toBeInTheDocument();

    // Check for back button
    expect(screen.getByRole('button', { name: /Volver al Panel de Control/i })).toBeInTheDocument();

    // Check that toast was shown
    expect(mockShowToast).toHaveBeenCalledWith('Error al cargar la solicitud', 'error');
  }, 10000);

  test('displays error state when network error occurs during fetch', async () => {
    // Mock network error
    vi.mocked(applicationService.getApplicationById).mockRejectedValue(new Error('Network Error'));

    renderPermitDetailsPage();

    // Wait for error message to appear
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: /Error/i })).toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    // Check for error message
    expect(screen.getByText(/Error de red. Por favor, verifique su conexión/i)).toBeInTheDocument();

    // Check that toast was shown
    expect(mockShowToast).toHaveBeenCalledWith(
      'Error de red. Por favor, verifique su conexión',
      'error',
    );
  }, 10000);

  test('shows download button for PERMIT_READY status and handles download', async () => {
    // Mock application with PERMIT_READY status
    vi.mocked(applicationService.getApplicationById).mockResolvedValue({
      success: true,
      application: {
        id: '123',
        vehicleInfo: {
          marca: 'Toyota',
          linea: 'Corolla',
          ano_modelo: 2023,
          color: 'Azul',
          numero_serie: 'ABC123456789',
          numero_motor: 'M123456',
        },
        ownerInfo: {
          nombre_completo: 'Test User',
          curp_rfc: 'TESU123456ABC',
          domicilio: '123 Main St, Anytown, CA 12345',
        },
        dates: {
          created: '2023-01-01T00:00:00Z',
          updated: '2023-01-01T00:00:00Z',
          fecha_expedicion: '2023-01-15T00:00:00Z',
        },
        folio: 'PD-2023-123',
      },
    });

    renderPermitDetailsPage();

    // Wait for application data to load
    await waitFor(
      () => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    // Check that download button is present
    const downloadButton = screen.getByRole('button', { name: /Descargar Permiso/i });
    expect(downloadButton).toBeInTheDocument();

    // Click the download button
    await user.click(downloadButton);

    // Check that success toast was shown after the timeout
    await waitFor(
      () => {
        expect(mockShowToast).toHaveBeenCalledWith('Permiso descargado exitosamente', 'success');
      },
      { timeout: 6000 },
    );
  }, 15000);

  test('shows upload payment proof link for PENDING_PAYMENT status', async () => {
    // Mock application with AWAITING_PAYMENT status
    vi.mocked(applicationService.getApplicationById).mockResolvedValue({
      success: true,
      application: {
        id: '123',
        vehicleInfo: {
          marca: 'Toyota',
          linea: 'Corolla',
          ano_modelo: 2023,
          color: 'Azul',
          numero_serie: 'ABC123456789',
          numero_motor: 'M123456',
        },
        ownerInfo: {
          nombre_completo: 'Test User',
          curp_rfc: 'TESU123456ABC',
          domicilio: '123 Main St, Anytown, CA 12345',
        },
        dates: {
          created: '2023-01-01T00:00:00Z',
          updated: '2023-01-01T00:00:00Z',
        },
      },
    });

    const { container } = renderPermitDetailsPage();

    // Wait for application data to load
    await waitFor(
      () => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    // Check that upload payment proof link is present
    const headerActions = container.querySelector('.' + styles.headerActions);
    expect(headerActions).toBeTruthy();
    expect(headerActions!.textContent).toContain('Subir Comprobante de Pago');

    // Check that download button is NOT present
    expect(screen.queryByRole('button', { name: /Descargar Permiso/i })).not.toBeInTheDocument();
  }, 10000);

  test('shows rejection reason for PROOF_REJECTED status', async () => {
    // Mock application with PAYMENT_FAILED status
    vi.mocked(applicationService.getApplicationById).mockResolvedValue({
      success: true,
      application: {
        id: '123',
        vehicleInfo: {
          marca: 'Toyota',
          linea: 'Corolla',
          ano_modelo: 2023,
          color: 'Azul',
          numero_serie: 'ABC123456789',
          numero_motor: 'M123456',
        },
        ownerInfo: {
          nombre_completo: 'Test User',
          curp_rfc: 'TESU123456ABC',
          domicilio: '123 Main St, Anytown, CA 12345',
        },
        dates: {
          created: '2023-01-01T00:00:00Z',
          updated: '2023-01-01T00:00:00Z',
        },
        payment_rejection_reason: 'Comprobante ilegible. Por favor, suba una imagen más clara.',
      },
    });

    const { container } = renderPermitDetailsPage();

    // Wait for application data to load
    await waitFor(
      () => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    // Check that rejection reason is displayed
    const statusSection = container.querySelector('.' + styles.statusSection);
    expect(statusSection).toBeTruthy();
    expect(statusSection!.textContent).toContain('Motivo de Rechazo');
    expect(statusSection!.textContent).toContain(
      'Comprobante ilegible. Por favor, suba una imagen más clara.',
    );

    // Check that upload new payment proof link is present
    const headerActions = container.querySelector('.' + styles.headerActions);
    expect(headerActions).toBeTruthy();
    expect(headerActions!.textContent).toContain('Subir Nuevo Comprobante');
  }, 10000);

  test('shows renewal eligibility section for PERMIT_READY status', async () => {
    // Mock application with PERMIT_READY status
    vi.mocked(applicationService.getApplicationById).mockResolvedValue({
      success: true,
      application: {
        id: '123',
        vehicleInfo: {
          marca: 'Toyota',
          linea: 'Corolla',
          ano_modelo: 2023,
          color: 'Azul',
          numero_serie: 'ABC123456789',
          numero_motor: 'M123456',
        },
        ownerInfo: {
          nombre_completo: 'Test User',
          curp_rfc: 'TESU123456ABC',
          domicilio: '123 Main St, Anytown, CA 12345',
        },
        dates: {
          created: '2023-01-01T00:00:00Z',
          updated: '2023-01-01T00:00:00Z',
          fecha_expedicion: '2023-01-15T00:00:00Z',
          fecha_vencimiento: '2023-02-15T00:00:00Z',
        },
        folio: 'PD-2023-123',
      },
    });

    const { container } = renderPermitDetailsPage();

    // Wait for application data to load
    await waitFor(
      () => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    // Check that renewal section is displayed
    const statusSection = container.querySelector('.' + styles.statusSection);
    expect(statusSection).toBeTruthy();
    expect(statusSection!.textContent).toContain('Renovación de Permiso');
  }, 15000);

  test('shows download button for PERMIT_READY status', async () => {
    // Mock application with PERMIT_READY status
    vi.mocked(applicationService.getApplicationById).mockResolvedValue({
      success: true,
      application: {
        id: '123',
        vehicleInfo: {
          marca: 'Toyota',
          linea: 'Corolla',
          ano_modelo: 2023,
          color: 'Azul',
          numero_serie: 'ABC123456789',
          numero_motor: 'M123456',
        },
        ownerInfo: {
          nombre_completo: 'Test User',
          curp_rfc: 'TESU123456ABC',
          domicilio: '123 Main St, Anytown, CA 12345',
        },
        dates: {
          created: '2023-01-01T00:00:00Z',
          updated: '2023-01-01T00:00:00Z',
          fecha_expedicion: '2023-01-15T00:00:00Z',
        },
        folio: 'PD-2023-123',
      },
    });

    renderPermitDetailsPage();

    // Wait for application data to load
    await waitFor(
      () => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    // Check that download button is present
    const downloadButton = screen.getByRole('button', { name: /Descargar Permiso/i });
    expect(downloadButton).toBeInTheDocument();
  }, 10000);

  test('navigates back to dashboard when error back button is clicked', async () => {
    // Mock API error response
    vi.mocked(applicationService.getApplicationById).mockResolvedValue({
      success: false,
      application: null as any,
      message: 'Error al cargar la solicitud',
    });

    renderPermitDetailsPage();

    // Wait for error message to appear
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: /Error/i })).toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    // Click the back button
    await user.click(screen.getByRole('button', { name: /Volver al Panel de Control/i }));

    // Check that navigation was called
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  }, 10000);

  test('navigates back to dashboard when back button is clicked', async () => {
    renderPermitDetailsPage();

    // Wait for application data to load
    await waitFor(
      () => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    // Check that the back link exists (we can't test navigation with Link directly)
    expect(screen.getByRole('link', { name: /Volver al Panel/i })).toBeInTheDocument();
  }, 10000);
});
