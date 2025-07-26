import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from '../DashboardPage';
import adminService from '../../services/adminService';

// Mock dependencies
vi.mock('../../services/adminService');
vi.mock('../../../shared/hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

const mockAdminService = vi.mocked(adminService);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const mockStats = {
  oxxoPaymentsPending: 15,
  todayPermits: 8,
  statusCounts: [
    { status: 'AWAITING_OXXO_PAYMENT', count: 15 },
    { status: 'PAYMENT_RECEIVED', count: 42 },
    { status: 'GENERATING_PERMIT', count: 3 },
    { status: 'ERROR_GENERATING_PERMIT', count: 2 },
    { status: 'PERMIT_READY', count: 8 },
    { status: 'COMPLETED', count: 125 },
    { status: 'CANCELLED', count: 5 },
    { status: 'EXPIRED', count: 12 },
  ],
};

describe('DashboardPage (SystemHealthDashboard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockAdminService.getDashboardStats.mockImplementation(() => new Promise(() => {}));

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Cargando estadísticas...')).toBeInTheDocument();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('should render dashboard with stats when data loads successfully', async () => {
    mockAdminService.getDashboardStats.mockResolvedValue(mockStats);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    });

    expect(screen.getByText('Resumen de actividad del sistema')).toBeInTheDocument();
    expect(screen.getByText('Pagos OXXO Pendientes')).toBeInTheDocument();
    expect(screen.getByText('Permisos Generados Hoy')).toBeInTheDocument();
    expect(screen.getByText('Estado de Solicitudes')).toBeInTheDocument();
  });

  it('should display correct stats values', async () => {
    mockAdminService.getDashboardStats.mockResolvedValue(mockStats);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument(); // OXXO payments pending
      expect(screen.getByText('8')).toBeInTheDocument(); // Today permits
    });
  });

  it('should display all status counts correctly', async () => {
    mockAdminService.getDashboardStats.mockResolvedValue(mockStats);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Pagos OXXO Pendientes')).toBeInTheDocument();
    });

    // Check status display names
    expect(screen.getByText('Pagos Recibidos')).toBeInTheDocument();
    expect(screen.getByText('Generando Permisos')).toBeInTheDocument();
    expect(screen.getByText('Error al Generar Permisos')).toBeInTheDocument();
    expect(screen.getByText('Permisos Listos')).toBeInTheDocument();
    expect(screen.getByText('Completados')).toBeInTheDocument();
    expect(screen.getByText('Cancelados')).toBeInTheDocument();
    expect(screen.getByText('Permisos Vencidos')).toBeInTheDocument();

    // Check counts
    expect(screen.getByText('42')).toBeInTheDocument(); // Payment received
    expect(screen.getByText('3')).toBeInTheDocument(); // Generating permit
    expect(screen.getByText('2')).toBeInTheDocument(); // Error generating
    expect(screen.getByText('125')).toBeInTheDocument(); // Completed
    expect(screen.getByText('5')).toBeInTheDocument(); // Cancelled
    expect(screen.getByText('12')).toBeInTheDocument(); // Expired
  });

  it('should handle empty status counts gracefully', async () => {
    mockAdminService.getDashboardStats.mockResolvedValue({
      oxxoPaymentsPending: 0,
      todayPermits: 0,
      statusCounts: [],
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    expect(screen.getByText('No hay datos de estado de solicitudes disponibles.')).toBeInTheDocument();
  });

  it('should handle missing stats data gracefully', async () => {
    mockAdminService.getDashboardStats.mockResolvedValue({});

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    });

    // Should show 0 for missing values
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('should render error state when data loading fails', async () => {
    const error = new Error('Failed to load dashboard stats');
    mockAdminService.getDashboardStats.mockRejectedValue(error);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Error al cargar estadísticas')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load dashboard stats')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intentar nuevamente' })).toBeInTheDocument();
  });

  it('should retry loading when retry button is clicked', async () => {
    const error = new Error('Network error');
    mockAdminService.getDashboardStats.mockRejectedValueOnce(error).mockResolvedValueOnce(mockStats);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Error al cargar estadísticas')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: 'Intentar nuevamente' });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    });
  });

  it('should display correct icons for different statuses', async () => {
    mockAdminService.getDashboardStats.mockResolvedValue(mockStats);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    });

    // Icons should be present (testing via class names or test IDs would be better)
    const statusCards = screen.getAllByTestId(/status-card/);
    expect(statusCards.length).toBeGreaterThan(0);
  });

  it('should render quick action links correctly', async () => {
    mockAdminService.getDashboardStats.mockResolvedValue(mockStats);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Acciones Rápidas')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /ver todas las solicitudes/i })).toHaveAttribute('href', '/applications');
    expect(screen.getByRole('link', { name: /pagos oxxo pendientes/i })).toHaveAttribute('href', '/applications?status=AWAITING_OXXO_PAYMENT');
    expect(screen.getByRole('link', { name: /permisos listos/i })).toHaveAttribute('href', '/applications?status=PERMIT_READY');
  });

  it('should navigate to filtered applications when status card links are clicked', async () => {
    mockAdminService.getDashboardStats.mockResolvedValue(mockStats);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    });

    const oxxoPaymentsLink = screen.getByRole('link', { name: /ver pagos oxxo pendientes/i });
    expect(oxxoPaymentsLink).toHaveAttribute('href', '/applications?status=AWAITING_OXXO_PAYMENT');

    const permitsReadyLink = screen.getByRole('link', { name: /ver permisos listos/i });
    expect(permitsReadyLink).toHaveAttribute('href', '/applications?status=PERMIT_READY');
  });

  it('should handle legacy status mappings correctly', async () => {
    const statsWithLegacy = {
      ...mockStats,
      statusCounts: [
        ...mockStats.statusCounts,
        { status: 'PENDING', count: 5 },
        { status: 'PROOF_SUBMITTED', count: 3 },
        { status: 'PAYMENT_VERIFIED', count: 8 },
        { status: 'PAYMENT_REJECTED', count: 2 },
        { status: 'PERMIT_GENERATED', count: 15 },
      ],
    };

    mockAdminService.getDashboardStats.mockResolvedValue(statsWithLegacy);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    });

    expect(screen.getByText('Pendientes de Pago (Legacy)')).toBeInTheDocument();
    expect(screen.getByText('Comprobantes Enviados (Legacy)')).toBeInTheDocument();
    expect(screen.getByText('Pagos Verificados (Legacy)')).toBeInTheDocument();
    expect(screen.getByText('Comprobantes Rechazados (Legacy)')).toBeInTheDocument();
    expect(screen.getByText('Permisos Generados (Legacy)')).toBeInTheDocument();
  });

  it('should show toast notification on error', async () => {
    const { showToast } = require('../../../shared/hooks/useToast').useToast();
    const error = new Error('API Error');
    mockAdminService.getDashboardStats.mockRejectedValue(error);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Error al cargar estadísticas: API Error', 'error');
    });
  });

  it('should handle unknown statuses gracefully', async () => {
    const statsWithUnknown = {
      ...mockStats,
      statusCounts: [
        ...mockStats.statusCounts,
        { status: 'UNKNOWN_STATUS', count: 1 },
      ],
    };

    mockAdminService.getDashboardStats.mockResolvedValue(statsWithUnknown);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    });

    // Unknown status should be displayed as-is
    expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should be responsive and use responsive container', async () => {
    mockAdminService.getDashboardStats.mockResolvedValue(mockStats);

    const { container } = render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    });

    // Check if responsive container is used
    const responsiveContainer = container.querySelector('[class*="ResponsiveContainer"]');
    expect(responsiveContainer).toBeInTheDocument();
  });

  it('should display correct stat card structure', async () => {
    mockAdminService.getDashboardStats.mockResolvedValue(mockStats);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    });

    // Check structure of stat cards
    expect(screen.getByText('Pagos OXXO Pendientes')).toBeInTheDocument();
    expect(screen.getByText('Permisos Generados Hoy')).toBeInTheDocument();

    // Check stat values are displayed
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should maintain real-time data capabilities through React Query', async () => {
    mockAdminService.getDashboardStats.mockResolvedValue(mockStats);

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockAdminService.getDashboardStats).toHaveBeenCalledTimes(1);
    });

    // React Query should be set up to refetch data
    expect(mockAdminService.getDashboardStats).toHaveBeenCalledWith();
  });
});