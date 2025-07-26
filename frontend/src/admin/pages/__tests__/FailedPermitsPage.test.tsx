import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import FailedPermitsPage from '../FailedPermitsPage';
import { ToastProvider } from '../../../shared/contexts/ToastContext';
import adminService from '../../services/adminService';
import { PermitErrorCategory, PermitErrorSeverity } from '../../../constants/application.constants';

// Mock the admin service
vi.mock('../../services/adminService');

// Mock data
const mockFailedApplications = {
  applications: [
    {
      id: 123,
      userId: 1,
      userName: 'Juan Pérez',
      userEmail: 'juan@example.com',
      userPhone: '555-1234',
      errorTime: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 72 hours ago
      errorMessage: 'TimeoutError: waiting for selector "#login-button" failed: timeout 30000ms exceeded',
      screenshotPath: '/screenshots/error_123.png',
      applicationData: {
        marca: 'Toyota',
        linea: 'Corolla',
        ano_modelo: 2022,
        color: 'Rojo',
        numero_serie: 'ABC123',
        numero_motor: 'XYZ789',
        nombre_completo: 'Juan Pérez',
        curp_rfc: 'PEPJ850101',
        domicilio: 'Calle 123, Col. Centro',
        importe: 850
      },
      errorCategory: PermitErrorCategory.TIMEOUT,
      severity: PermitErrorSeverity.CRITICAL,
      suggestion: 'El portal está lento. Intente nuevamente más tarde.',
      adminReviewRequired: true,
      resolvedAt: undefined,
      resolvedByAdmin: undefined,
      adminNotes: undefined
    },
    {
      id: 124,
      userId: 2,
      userName: 'María García',
      userEmail: 'maria@example.com',
      errorTime: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
      errorMessage: 'Error: Login failed - authentication error',
      applicationData: {
        marca: 'Honda',
        linea: 'Civic',
        ano_modelo: 2021,
        color: 'Azul',
        numero_serie: 'DEF456',
        numero_motor: 'UVW456',
        nombre_completo: 'María García',
        curp_rfc: 'GARM900202',
        domicilio: 'Av. Principal 456',
        importe: 850
      },
      errorCategory: PermitErrorCategory.AUTH_FAILURE,
      severity: PermitErrorSeverity.MEDIUM,
      suggestion: 'Credenciales incorrectas. Verifique configuración.',
      adminReviewRequired: true
    }
  ]
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          {children}
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('FailedPermitsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (adminService.getFailedApplications as any).mockImplementation(() => new Promise(() => {}));
    
    render(<FailedPermitsPage />, { wrapper: createWrapper() });
    
    expect(screen.getByText('Cargando aplicaciones fallidas...')).toBeInTheDocument();
  });

  it('renders error state when API fails', async () => {
    (adminService.getFailedApplications as any).mockRejectedValue(new Error('API Error'));
    
    render(<FailedPermitsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Error al cargar aplicaciones fallidas')).toBeInTheDocument();
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('renders failed applications correctly', async () => {
    (adminService.getFailedApplications as any).mockResolvedValue(mockFailedApplications);
    
    render(<FailedPermitsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      // Check header
      expect(screen.getByText('Permisos Fallidos - Acción Requerida')).toBeInTheDocument();
      
      // Check metrics
      expect(screen.getByText('Necesita Acción Ahora')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // One critical
      
      // Check applications
      expect(screen.getByText('Aplicación #123')).toBeInTheDocument();
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.getByText(/juan@example.com/)).toBeInTheDocument();
      
      // Check error details
      expect(screen.getByText(/TimeoutError/)).toBeInTheDocument();
      expect(screen.getByText('💡 El portal está lento. Intente nuevamente más tarde.')).toBeInTheDocument();
      
      // Check vehicle info
      expect(screen.getByText(/Toyota Corolla \(2022\)/)).toBeInTheDocument();
    });
  });

  it('renders empty state when no failed applications', async () => {
    (adminService.getFailedApplications as any).mockResolvedValue({ applications: [] });
    
    render(<FailedPermitsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('¡Todo está al día!')).toBeInTheDocument();
      expect(screen.getByText('No hay aplicaciones fallidas sin resolver.')).toBeInTheDocument();
    });
  });

  it('handles retry action correctly', async () => {
    (adminService.getFailedApplications as any).mockResolvedValue(mockFailedApplications);
    (adminService.retryPuppeteer as any).mockResolvedValue({ success: true });
    
    render(<FailedPermitsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      const retryButton = screen.getAllByText('Reintentar')[0];
      fireEvent.click(retryButton);
    });
    
    await waitFor(() => {
      expect(adminService.retryPuppeteer).toHaveBeenCalledWith(123);
    });
  });

  it('handles mark resolved action correctly', async () => {
    (adminService.getFailedApplications as any).mockResolvedValue(mockFailedApplications);
    (adminService.markApplicationResolved as any).mockResolvedValue({ success: true });
    
    // Mock window.prompt
    window.prompt = vi.fn().mockReturnValue('Test resolution notes');
    
    render(<FailedPermitsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      const resolveButton = screen.getAllByText('Marcar Resuelto')[0];
      fireEvent.click(resolveButton);
    });
    
    await waitFor(() => {
      expect(adminService.markApplicationResolved).toHaveBeenCalledWith(123, 'Test resolution notes');
    });
  });

  it('opens upload modal when clicking upload PDFs', async () => {
    (adminService.getFailedApplications as any).mockResolvedValue(mockFailedApplications);
    
    render(<FailedPermitsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      const uploadButton = screen.getAllByText('Subir PDFs')[0];
      fireEvent.click(uploadButton);
    });
    
    expect(screen.getByText('Subir PDFs Manualmente')).toBeInTheDocument();
    expect(screen.getByText('Aplicación #123')).toBeInTheDocument();
    expect(screen.getByText('Permiso PDF:')).toBeInTheDocument();
  });

  it('copies form data to clipboard', async () => {
    (adminService.getFailedApplications as any).mockResolvedValue(mockFailedApplications);
    
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    
    render(<FailedPermitsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      const copyButton = screen.getAllByText('Copiar Datos')[0];
      fireEvent.click(copyButton);
    });
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('MARCA: Toyota'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('LÍNEA: Corolla'));
  });

  it('displays correct severity colors', async () => {
    (adminService.getFailedApplications as any).mockResolvedValue(mockFailedApplications);
    
    const { container } = render(<FailedPermitsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      // Check for severity classes
      const criticalCard = container.querySelector('.severityCritical');
      const mediumCard = container.querySelector('.severityMedium');
      
      expect(criticalCard).toBeInTheDocument();
      expect(mediumCard).toBeInTheDocument();
    });
  });

  it('displays time ago correctly', async () => {
    (adminService.getFailedApplications as any).mockResolvedValue(mockFailedApplications);
    
    render(<FailedPermitsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      // Should show "Hace X días" for 72 hours ago
      expect(screen.getByText(/Hace 3 días/)).toBeInTheDocument();
      // Should show "Hace X horas" for 12 hours ago
      expect(screen.getByText(/Hace 12 horas/)).toBeInTheDocument();
    });
  });
});