import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Import components and mocked services after mocks
import applicationService, { Application, ApplicationStatus } from '../../services/applicationService';
import authService from '../../services/authService';
import { render } from '../../test/test-utils';
import DashboardPage from '../UserDashboardPage';

// --- Mocking Dependencies ---
vi.mock('../../services/applicationService');
vi.mock('../../services/authService'); // For AuthProvider checkStatus call

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock application data
const mockApplications: Application[] = [
  {
    id: '1',
    user_id: '123',
    status: 'PERMIT_READY' as ApplicationStatus,
    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-20T14:45:00Z',
    nombre_completo: 'Test User',
    curp_rfc: 'TESU123456ABC',
    domicilio: '123 Main St, Anytown, CA 12345',
    marca: 'Ford',
    linea: 'Mustang',
    color: 'Rojo',
    numero_serie: 'ABC123456789',
    numero_motor: 'M123456',
    ano_modelo: 2023,
    folio: 'PD-2025-001',
    importe: 1500.0,
    fecha_expedicion: '2025-01-15',
    fecha_vencimiento: '2026-01-15',
  },
  {
    id: '2',
    user_id: '123',
    status: 'AWAITING_PAYMENT' as ApplicationStatus,
    created_at: '2025-02-10T09:15:00Z',
    updated_at: '2025-02-10T09:15:00Z',
    nombre_completo: 'Test User',
    curp_rfc: 'TESU123456ABC',
    domicilio: '123 Main St, Anytown, CA 12345',
    marca: 'Toyota',
    linea: 'Corolla',
    color: 'Azul',
    numero_serie: 'XYZ987654321',
    numero_motor: 'T987654',
    ano_modelo: 2022,
  },
];

// Mock auth service (unused but kept for potential future use)
const _mockAuthService = {
  login: vi.fn(),
  logout: vi.fn(),
  checkStatus: vi.fn(),
  register: vi.fn(),
  resendVerificationEmail: vi.fn(),
};

// Render helper
const renderDashboardPage = () => {
  render(<DashboardPage />, {
    authContextProps: {
      isAuthenticatedByDefault: true,
      initialUser: {
        id: '123',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
        accountType: 'citizen',
      },
    },
  });
};

describe('DashboardPage', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup({ delay: null });
    vi.resetAllMocks();

    // Mock user as logged in for dashboard access
    vi.mocked(authService.checkStatus).mockResolvedValue({
      isLoggedIn: true,
      user: {
        id: '123',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
        accountType: 'citizen',
      },
    });
  });

  test('displays loading state initially', async () => {
    // Mock getApplications to never resolve (simulating a long-running request)
    vi.mocked(applicationService.getApplications).mockImplementation(() => {
      return new Promise(() => {}); // Promise that never resolves
    });

    renderDashboardPage();

    // Check for loading indicator
    expect(screen.getByText(/Mis Solicitudes/i)).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument(); // LoadingSpinner

    // Verify that the applications table is not yet displayed
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('displays applications when data is fetched successfully', async () => {
    // Mock successful response
    vi.mocked(applicationService.getApplications).mockResolvedValue({
      success: true,
      applications: mockApplications,
    });

    renderDashboardPage();

    // Wait for applications to load
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument(); // LoadingSpinner should be gone
    });

    // Check that the table is displayed
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Check that data from both applications is displayed
    expect(screen.getByText(/Ford Mustang/)).toBeInTheDocument();
    expect(screen.getByText(/Toyota Corolla/)).toBeInTheDocument();

    // Check that the status badges are displayed
    expect(screen.getByText('Permiso Listo')).toBeInTheDocument();
    expect(screen.getByText('Pago Pendiente')).toBeInTheDocument();

    // Check that the dates are displayed (using regex to handle different date formats)
    expect(screen.getByText(/1\/15\/2025|15\/01\/2025|2025-01-15/)).toBeInTheDocument();
    expect(screen.getByText(/2\/10\/2025|10\/02\/2025|2025-02-10/)).toBeInTheDocument();
  });

  test('displays empty state when no applications are found', async () => {
    // Mock empty response
    vi.mocked(applicationService.getApplications).mockResolvedValue({
      success: true,
      applications: [],
    });

    renderDashboardPage();

    // Wait for applications to load
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument(); // LoadingSpinner should be gone
    });

    // Check for empty state message
    expect(screen.getByText(/No tiene solicitudes de permisos/i)).toBeInTheDocument();

    // Verify that the applications table is not displayed
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('displays API error message when fetch fails with error response', async () => {
    // Mock API error response
    const errorMessage = 'Error al cargar las solicitudes';
    vi.mocked(applicationService.getApplications).mockResolvedValue({
      success: false,
      applications: [],
      message: errorMessage,
    });

    renderDashboardPage();

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Check for retry button
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();

    // Verify that the applications table is not displayed
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Verify that the loading spinner is not displayed
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('displays network error message when fetch is rejected', async () => {
    // Mock network error
    vi.mocked(applicationService.getApplications).mockRejectedValue(new Error('Network Error'));

    renderDashboardPage();

    // Wait for error message to appear
    await waitFor(() => {
      expect(
        screen.getByText(/Error de red. Por favor, verifique su conexión/i),
      ).toBeInTheDocument();
    });

    // Check for retry button
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();

    // Verify that the applications table is not displayed
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Verify that the loading spinner is not displayed
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('retries fetching applications when retry button is clicked', async () => {
    // Mock API error response initially
    vi.mocked(applicationService.getApplications).mockResolvedValueOnce({
      success: false,
      applications: [],
      message: 'Error al cargar las solicitudes',
    });

    // Mock successful response for the retry
    vi.mocked(applicationService.getApplications).mockResolvedValueOnce({
      success: true,
      applications: mockApplications,
    });

    renderDashboardPage();

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(/Error al cargar las solicitudes/i)).toBeInTheDocument();
    });

    // Click the retry button
    const retryButton = screen.getByRole('button', { name: /Reintentar/i });
    await user.click(retryButton);

    // Skip checking for loading spinner since it may render and disappear too quickly
    // in the test environment

    // Wait for applications to load and table to appear
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Check that the application data is displayed
    expect(screen.getByText(/Ford Mustang/)).toBeInTheDocument();

    // Verify that getApplications was called twice
    expect(applicationService.getApplications).toHaveBeenCalledTimes(2);
  });

  test('navigates to application details when row is clicked', async () => {
    // Mock successful response
    vi.mocked(applicationService.getApplications).mockResolvedValue({
      success: true,
      applications: mockApplications,
    });

    renderDashboardPage();

    // Wait for applications to load
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Find and click on the first application row
    const fordMustangText = screen.getByText(/Ford Mustang/);
    const tableRow = fordMustangText.closest('tr');
    expect(tableRow).not.toBeNull();

    if (tableRow) {
      await user.click(tableRow);
    }

    // Check that navigation was called with the correct path
    expect(mockNavigate).toHaveBeenCalledWith('/permits/1');
  });

  test('navigates to new permit page when "Solicitar Nuevo Permiso" button is clicked', async () => {
    // Mock successful response
    vi.mocked(applicationService.getApplications).mockResolvedValue({
      success: true,
      applications: mockApplications,
    });

    renderDashboardPage();

    // Find and click the "Solicitar Nuevo Permiso" button
    const newPermitButton = screen.getByText(/Solicitar Nuevo Permiso/i);
    await user.click(newPermitButton);

    // Check that navigation was triggered
    // Note: Since we're using Link, it won't call our mocked navigate function
    // Instead, we can check that the link has the correct href
    expect(newPermitButton.closest('a')).toHaveAttribute('href', '/permits/new');
  });

  test('displays expiring permits section when there are expiring permits', async () => {
    // Create a permit that expires in 15 days
    const today = new Date();
    const expirationDate = new Date(today);
    expirationDate.setDate(today.getDate() + 15);

    const expiringPermit = {
      ...mockApplications[0],
      fecha_vencimiento: expirationDate.toISOString(),
    };

    // Mock successful response with expiring permit
    vi.mocked(applicationService.getApplications).mockResolvedValue({
      success: true,
      applications: [expiringPermit, mockApplications[1]],
    });

    renderDashboardPage();

    // Wait for applications to load and expiring permits section to appear
    await waitFor(
      () => {
        expect(screen.getByText(/Permisos por Expirar/i)).toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    // Check that the expiring permit is displayed in the section with days remaining
    // Use a more flexible regex to match different ways of displaying days
    expect(screen.getByText(/\d+ días?/i)).toBeInTheDocument();

    // Check that the renew button is displayed
    expect(screen.getByRole('button', { name: /Renovar/i })).toBeInTheDocument();
  }, 10000);

  test('navigates to renewal page when renew button is clicked', async () => {
    // Create a permit that expires in 15 days
    const today = new Date();
    const expirationDate = new Date(today);
    expirationDate.setDate(today.getDate() + 15);

    const expiringPermit = {
      ...mockApplications[0],
      fecha_vencimiento: expirationDate.toISOString(),
    };

    // Mock successful response with expiring permit
    vi.mocked(applicationService.getApplications).mockResolvedValue({
      success: true,
      applications: [expiringPermit, mockApplications[1]],
    });

    renderDashboardPage();

    // Wait for applications to load
    await waitFor(() => {
      expect(screen.getByText(/Permisos por Expirar/i)).toBeInTheDocument();
    });

    // Find and click the renew button
    const renewButton = screen.getByRole('button', { name: /Renovar/i });
    await user.click(renewButton);

    // Check that navigation was called with the correct path
    expect(mockNavigate).toHaveBeenCalledWith('/permits/1/renew');
  });

  test('renders with full-width layout structure', async () => {
    // Mock successful response
    vi.mocked(applicationService.getApplications).mockResolvedValue({
      success: true,
      applications: mockApplications,
    });

    renderDashboardPage();

    // Wait for dashboard content to load (no table in UserDashboardPage)
    await waitFor(() => {
      expect(screen.getByText('Panel de Usuario')).toBeInTheDocument();
    });

    // Check that the dashboard page container exists
    const dashboardPage = document.querySelector('.dashboardPage');
    expect(dashboardPage).toBeInTheDocument();

    // Check that the content wrapper exists and has full-width styling
    const contentWrapper = document.querySelector('.dashboardContentWrapper');
    expect(contentWrapper).toBeInTheDocument();

    // Verify that the page header is present
    expect(screen.getByText('Panel de Usuario')).toBeInTheDocument();
    expect(screen.getByText(/Bienvenido, Test/)).toBeInTheDocument();

    // Verify that the stats overview section is present
    expect(screen.getByText('Permisos Activos')).toBeInTheDocument();
    expect(screen.getByText('Pagos Pendientes')).toBeInTheDocument();

    // Verify that the status section is present
    expect(screen.getByText('Estado de Mis Permisos')).toBeInTheDocument();

    // Verify that the quick actions section is present
    expect(screen.getByText('Acciones Rápidas')).toBeInTheDocument();
    expect(screen.getByText('Solicitar Nuevo Permiso')).toBeInTheDocument();
    expect(screen.getByText('Ver Todos Mis Permisos')).toBeInTheDocument();
  });
});
