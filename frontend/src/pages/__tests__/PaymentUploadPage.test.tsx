import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock URL.createObjectURL for file previews
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock the necessary modules
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '123' }),
    useNavigate: () => vi.fn()
  };
});

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn()
  })
}));

vi.mock('../../services/applicationService', () => ({
  default: {
    getApplicationById: vi.fn(),
    uploadPaymentProof: vi.fn()
  }
}));

// Import components and mocked services after mocks are defined
import PaymentUploadPage from '../PaymentUploadPage';
import applicationService from '../../services/applicationService';

// Create mock application data
const mockApplication = {
  id: '123',
  user_id: '456',
  status: {
    currentStatus: 'PENDING_PAYMENT',
    statusText: 'Pendiente de Pago',
    rejectionReason: null
  },
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  reference: 'APP-123',
  vehicle: {
    marca: 'Toyota',
    linea: 'Corolla',
    modelo: 2023,
    color: 'Azul'
  }
};

// Helper function for standard rendering
const renderPaymentUploadPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <PaymentUploadPage />
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('PaymentUploadPage', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();

    // Mock getApplicationById to return our mock application
    vi.mocked(applicationService.getApplicationById).mockResolvedValue(mockApplication);

    // Mock uploadPaymentProof to return a successful response
    vi.mocked(applicationService.uploadPaymentProof).mockResolvedValue({
      success: true,
      application: {
        ...mockApplication,
        status: {
          currentStatus: 'PROOF_SUBMITTED',
          statusText: 'Comprobante Enviado',
          rejectionReason: null
        },
        payment_proof_path: '/uploads/payment-proof.jpg',
        payment_proof_uploaded_at: '2023-01-02T00:00:00Z'
      }
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('displays loading state initially', async () => {
    renderPaymentUploadPage();
    expect(screen.getByText(/Cargando información del pago/i)).toBeInTheDocument();
  });

  test('displays application information after loading', async () => {
    renderPaymentUploadPage();

    await waitFor(() => {
      expect(screen.getByText(/Subir Comprobante de Pago/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/APP-123/i)).toBeInTheDocument();
    expect(screen.getByText(/Toyota Corolla 2023/i)).toBeInTheDocument();
  });

  test('displays instructions for uploading payment proof', async () => {
    renderPaymentUploadPage();

    await waitFor(() => {
      expect(screen.getByText(/Instrucciones/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Asegúrate que sean visibles la fecha, monto y referencia/i)).toBeInTheDocument();
    expect(screen.getByText(/Formatos aceptados: JPG, PNG y PDF/i)).toBeInTheDocument();
  });

  test('displays security note', async () => {
    renderPaymentUploadPage();

    await waitFor(() => {
      expect(screen.getByText(/Tu información está segura/i)).toBeInTheDocument();
    });
  });

  test('displays help section', async () => {
    renderPaymentUploadPage();

    await waitFor(() => {
      expect(screen.getByText(/¿Necesitas ayuda?/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Si tienes problemas para subir tu comprobante/i)).toBeInTheDocument();
  });
});
