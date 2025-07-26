import { describe, it, expect, vi, beforeEach } from 'vitest';

import { render, screen, waitFor } from '../../../test/test-utils';
import RenewalEligibility from '../RenewalEligibility';
import { ApplicationStatus } from '../../../constants/application.constants';

// Mock the application service
vi.mock('../../../services/applicationService', () => {
  return {
    default: {
      checkRenewalEligibility: vi.fn(),
    },
    checkRenewalEligibility: vi.fn(),
  };
});

// Get the mocked service
const applicationService = (await import('../../../services/applicationService')).default;

describe('RenewalEligibility', () => {
  const mockApplication = {
    id: '1',
    user_id: '123',
    status: ApplicationStatus.PERMIT_READY,
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z',
    nombre_completo: 'Test User',
    curp_rfc: 'TEST123456',
    domicilio: 'Test Address',
    marca: 'Test Brand',
    linea: 'Test Model',
    color: 'Red',
    numero_serie: 'TEST123',
    numero_motor: 'MOTOR123',
    ano_modelo: 2023,
    folio: 'F123',
    importe: 150,
    fecha_expedicion: '2023-01-01T00:00:00.000Z',
    fecha_vencimiento: '2023-12-31T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', async () => {
    // Mock a delayed response
    applicationService.checkRenewalEligibility = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            eligible: true,
            message: 'Eligible for renewal',
            daysUntilExpiration: 30,
            expirationDate: '2023-12-31T00:00:00.000Z',
          });
        }, 100);
      });
    });

    render(<RenewalEligibility application={mockApplication} />);

    // Check if loading state is shown
    expect(screen.getByText(/Verificando elegibilidad para renovación/i)).toBeInTheDocument();
  });

  it('should show eligible message when permit is eligible for renewal', async () => {
    // Mock eligible response
    applicationService.checkRenewalEligibility = vi.fn().mockResolvedValue({
      eligible: true,
      message: 'Su permiso vence en 5 días. Puede renovarlo ahora.',
      daysUntilExpiration: 5,
      expirationDate: '2023-12-31T00:00:00.000Z',
    });

    render(<RenewalEligibility application={mockApplication} />);

    // Wait for eligibility check to complete
    await waitFor(() => {
      expect(screen.getByText(/Elegible para Renovación/i)).toBeInTheDocument();
    });

    // Check if the message is displayed
    expect(
      screen.getByText(/Su permiso vence en 5 días. Puede renovarlo ahora./i),
    ).toBeInTheDocument();

    // Check if the renewal button is displayed
    expect(screen.getByText(/Renovar Permiso/i)).toBeInTheDocument();

    // Check if the expiration date is displayed
    expect(screen.getByText(/Fecha de vencimiento:/i)).toBeInTheDocument();
  });

  it('should show ineligible message when permit is not eligible for renewal', async () => {
    // Mock ineligible response
    applicationService.checkRenewalEligibility = vi.fn().mockResolvedValue({
      eligible: false,
      message: 'Su permiso vence en 20 días. Podrá renovarlo 7 días antes de su vencimiento.',
      daysUntilExpiration: 20,
      expirationDate: '2023-12-31T00:00:00.000Z',
    });

    render(<RenewalEligibility application={mockApplication} />);

    // Wait for eligibility check to complete
    await waitFor(() => {
      expect(screen.getByText(/No Elegible para Renovación/i)).toBeInTheDocument();
    });

    // Check if the message is displayed
    expect(
      screen.getByText(
        /Su permiso vence en 20 días. Podrá renovarlo 7 días antes de su vencimiento./i,
      ),
    ).toBeInTheDocument();

    // Check if the renewal button is NOT displayed
    expect(screen.queryByText(/Renovar Permiso/i)).not.toBeInTheDocument();
  });

  it('should show error message when eligibility check fails', async () => {
    // Mock error response
    applicationService.checkRenewalEligibility = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    render(<RenewalEligibility application={mockApplication} />);

    // Wait for eligibility check to fail
    await waitFor(() => {
      expect(
        screen.getByText(/Error al verificar la elegibilidad para renovación/i),
      ).toBeInTheDocument();
    });

    // Check if retry button is displayed
    expect(screen.getByText(/Reintentar/i)).toBeInTheDocument();
  });

  it('should show new permit button for expired permits', async () => {
    // Mock expired permit response
    applicationService.checkRenewalEligibility = vi.fn().mockResolvedValue({
      eligible: false,
      message: 'Su permiso venció hace más de 15 días. Debe solicitar un nuevo permiso.',
      daysUntilExpiration: -20,
      expirationDate: '2023-11-15T00:00:00.000Z',
    });

    render(<RenewalEligibility application={mockApplication} />);

    // Wait for eligibility check to complete
    await waitFor(() => {
      expect(screen.getByText(/No Elegible para Renovación/i)).toBeInTheDocument();
    });

    // Check if the new permit button is displayed
    expect(screen.getByText(/Solicitar Nuevo Permiso/i)).toBeInTheDocument();
  });
});
