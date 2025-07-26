import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import ApplicationDetailsPage from '../../pages/ApplicationDetailsPage';
import adminService from '../../services/adminService';

// Mock dependencies
vi.mock('../../services/adminService');
vi.mock('../../../shared/hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

// Mock router params
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-app-123' }),
    useNavigate: () => mockNavigate,
  };
});

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

const mockApplication = {
  id: 'test-app-123',
  status: 'PROOF_SUBMITTED',
  marca: 'Toyota',
  linea: 'Corolla',
  ano_modelo: '2020',
  color: 'Blanco',
  numero_serie: 'ABC123456789',
  numero_motor: 'XYZ987654321',
  nombre_completo: 'Juan Pérez García',
  curp_rfc: 'PEGJ850301HDFRZN01',
  domicilio: 'Calle Principal 123, Col. Centro',
  applicant_email: 'juan.perez@email.com',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-20T15:30:00Z',
  folio: 'PERM-2024-001',
  fecha_expedicion: '2024-01-20T00:00:00Z',
  fecha_vencimiento: '2025-01-20T00:00:00Z',
  amount: 1250.50,
  payment_reference: 'PAY-REF-789456123',
};

const mockPaymentProofDetails = {
  uploaded_at: '2024-01-19T14:20:00Z',
  original_filename: 'comprobante-pago.pdf',
  mime_type: 'application/pdf',
  size: 245760,
};

describe('PermitDetailModal (ApplicationDetailsPage Modals)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.window = Object.create(window);
    Object.defineProperty(window, 'open', {
      value: vi.fn(),
    });
  });

  it('should render application details correctly', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Solicitud #test-app-123')).toBeInTheDocument();
    });

    expect(screen.getByText('Comprobante Enviado')).toBeInTheDocument();
    expect(screen.getByText('Toyota')).toBeInTheDocument();
    expect(screen.getByText('Corolla')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez García')).toBeInTheDocument();
  });

  it('should show approve and reject buttons for PROOF_SUBMITTED status', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aprobar pago/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /rechazar pago/i })).toBeInTheDocument();
    });
  });

  it('should open reject modal when reject button is clicked', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rechazar pago/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /rechazar pago/i }));

    expect(screen.getByText('Rechazar Comprobante de Pago')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Motivo de rechazo')).toBeInTheDocument();
  });

  it('should open verify modal when approve button is clicked', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aprobar pago/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /aprobar pago/i }));

    expect(screen.getByText('Verificar Pago')).toBeInTheDocument();
    expect(screen.getByText('¿Está seguro que desea verificar este pago?')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez García')).toBeInTheDocument();
    expect(screen.getByText('Toyota Corolla (2020)')).toBeInTheDocument();
  });

  it('should close reject modal when cancel is clicked', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rechazar pago/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /rechazar pago/i }));
    
    expect(screen.getByText('Rechazar Comprobante de Pago')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByText('Rechazar Comprobante de Pago')).not.toBeInTheDocument();
  });

  it('should close reject modal when X button is clicked', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rechazar pago/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /rechazar pago/i }));

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(screen.queryByText('Rechazar Comprobante de Pago')).not.toBeInTheDocument();
  });

  it('should require reject reason before submitting', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rechazar pago/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /rechazar pago/i }));

    const confirmButton = screen.getByRole('button', { name: /confirmar rechazo/i });
    expect(confirmButton).toBeDisabled();

    // Type reject reason
    const textArea = screen.getByPlaceholderText('Motivo de rechazo');
    fireEvent.change(textArea, { target: { value: 'Documento ilegible' } });

    expect(confirmButton).not.toBeDisabled();
  });

  it('should submit reject payment successfully', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);
    mockAdminService.rejectPayment.mockResolvedValue({ success: true });

    const { showToast } = require('../../../shared/hooks/useToast').useToast();

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rechazar pago/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /rechazar pago/i }));

    const textArea = screen.getByPlaceholderText('Motivo de rechazo');
    fireEvent.change(textArea, { target: { value: 'Documento no válido' } });

    const confirmButton = screen.getByRole('button', { name: /confirmar rechazo/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockAdminService.rejectPayment).toHaveBeenCalledWith('test-app-123', 'Documento no válido');
      expect(showToast).toHaveBeenCalledWith('Pago rechazado correctamente', 'success');
    });

    expect(screen.queryByText('Rechazar Comprobante de Pago')).not.toBeInTheDocument();
  });

  it('should handle reject payment error', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);
    mockAdminService.rejectPayment.mockRejectedValue(new Error('Network error'));

    const { showToast } = require('../../../shared/hooks/useToast').useToast();

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rechazar pago/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /rechazar pago/i }));

    const textArea = screen.getByPlaceholderText('Motivo de rechazo');
    fireEvent.change(textArea, { target: { value: 'Test reason' } });

    const confirmButton = screen.getByRole('button', { name: /confirmar rechazo/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Error al rechazar pago: Network error', 'error');
    });
  });

  it('should submit verify payment successfully', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);
    mockAdminService.verifyPayment.mockResolvedValue({ success: true });

    const { showToast } = require('../../../shared/hooks/useToast').useToast();

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aprobar pago/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /aprobar pago/i }));

    const notesTextArea = screen.getByPlaceholderText('Notas adicionales sobre la verificación');
    fireEvent.change(notesTextArea, { target: { value: 'Pago verificado correctamente' } });

    const confirmButton = screen.getByRole('button', { name: /confirmar verificación/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockAdminService.verifyPayment).toHaveBeenCalledWith('test-app-123', 'Pago verificado correctamente');
      expect(showToast).toHaveBeenCalledWith('Pago verificado correctamente', 'success');
    });

    expect(screen.queryByText('Verificar Pago')).not.toBeInTheDocument();
  });

  it('should handle verify payment error', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);
    mockAdminService.verifyPayment.mockRejectedValue(new Error('API Error'));

    const { showToast } = require('../../../shared/hooks/useToast').useToast();

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aprobar pago/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /aprobar pago/i }));

    const confirmButton = screen.getByRole('button', { name: /confirmar verificación/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Error al verificar pago: API Error', 'error');
    });
  });

  it('should open payment proof file when view button is clicked', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ver comprobante/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /ver comprobante/i }));

    expect(window.open).toHaveBeenCalledWith('/api/admin/applications/test-app-123/payment-proof-file', '_blank');
  });

  it('should display payment proof details correctly', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Información de Pago')).toBeInTheDocument();
    });

    expect(screen.getByText('PAY-REF-789456123')).toBeInTheDocument();
    expect(screen.getByText('comprobante-pago.pdf')).toBeInTheDocument();
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
    expect(screen.getByText('240 KB')).toBeInTheDocument();
  });

  it('should handle different application statuses appropriately', async () => {
    const appWithDifferentStatus = { ...mockApplication, status: 'PAYMENT_RECEIVED' };
    mockAdminService.getApplicationDetails.mockResolvedValue(appWithDifferentStatus);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Pago Verificado')).toBeInTheDocument();
    });

    // Should not show approve/reject buttons for verified payments
    expect(screen.queryByRole('button', { name: /aprobar pago/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rechazar pago/i })).not.toBeInTheDocument();
  });

  it('should show loading states correctly', async () => {
    mockAdminService.getApplicationDetails.mockImplementation(() => new Promise(() => {}));

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Cargando detalles de la solicitud...')).toBeInTheDocument();
  });

  it('should navigate back when back button is clicked', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('should show error state when application loading fails', async () => {
    mockAdminService.getApplicationDetails.mockRejectedValue(new Error('Not found'));

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Error al cargar detalles de la solicitud')).toBeInTheDocument();
    });

    expect(screen.getByText('Not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /intentar nuevamente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument();
  });

  it('should disable submit buttons during processing', async () => {
    mockAdminService.getApplicationDetails.mockResolvedValue(mockApplication);
    mockAdminService.getPaymentProofDetails.mockResolvedValue(mockPaymentProofDetails);
    mockAdminService.verifyPayment.mockImplementation(() => new Promise(() => {}));

    render(<ApplicationDetailsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aprobar pago/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /aprobar pago/i }));

    const confirmButton = screen.getByRole('button', { name: /confirmar verificación/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Procesando...')).toBeInTheDocument();
      expect(confirmButton).toBeDisabled();
    });
  });
});